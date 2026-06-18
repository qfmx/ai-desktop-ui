import json
import re
import uuid
from typing import Any

import aiosqlite
from fastapi import APIRouter, HTTPException

from core.database import get_db
from services.model_provider import (
    ModelProviderError,
    fetch_openai_models,
    list_provider_models,
    mask_api_key,
    sync_provider_models,
)

router = APIRouter(prefix="/api/models", tags=["models"])


def _provider_id(value: str | None, name: str) -> str:
    raw = (value or name or "provider").strip().lower()
    slug = re.sub(r"[^a-z0-9_-]+", "-", raw).strip("-")
    return slug or f"provider-{uuid.uuid4().hex[:8]}"


def _safe_capabilities(value: Any) -> list[str]:
    if isinstance(value, list):
        return [str(item) for item in value]
    if isinstance(value, str):
        try:
            parsed = json.loads(value)
            if isinstance(parsed, list):
                return [str(item) for item in parsed]
        except json.JSONDecodeError:
            return []
    return []


def _public_provider(row: dict[str, Any]) -> dict[str, Any]:
    api_key = row.pop("api_key", "") or ""
    row["has_api_key"] = bool(api_key)
    row["api_key_masked"] = mask_api_key(api_key)
    return row


async def _set_provider_status(db: aiosqlite.Connection, provider_id: str, status: str):
    await db.execute(
        "UPDATE model_providers SET status = ? WHERE id = ?",
        (status, provider_id),
    )
    await db.commit()


@router.get("/providers")
async def list_providers():
    db = await get_db()
    try:
        rows = await db.execute_fetchall("SELECT * FROM model_providers ORDER BY created_at")
        providers = []
        for row in rows:
            provider = _public_provider(dict(row))
            provider["models"] = await list_provider_models(db, provider["id"])
            providers.append(provider)
        return providers
    finally:
        await db.close()


@router.post("/providers")
async def create_provider(data: dict):
    name = (data.get("name") or "").strip()
    endpoint = (data.get("endpoint") or "").strip()
    if not name:
        raise HTTPException(400, "Provider name is required")
    if not endpoint:
        raise HTTPException(400, "Provider endpoint is required")

    provider_id = _provider_id(data.get("id"), name)
    auto_sync = bool(data.get("auto_sync_models", False))
    sync_result: dict[str, Any] | None = None

    db = await get_db()
    try:
        try:
            await db.execute(
                "INSERT INTO model_providers (id, name, type, endpoint, api_key, status) VALUES (?, ?, ?, ?, ?, ?)",
                (
                    provider_id,
                    name,
                    data.get("type", "cloud"),
                    endpoint.rstrip("/"),
                    data.get("api_key", ""),
                    "limited" if auto_sync else data.get("status", "connected"),
                ),
            )
        except aiosqlite.IntegrityError as exc:
            raise HTTPException(409, "Provider already exists") from exc

        for model in data.get("models", []):
            capabilities = _safe_capabilities(model.get("capabilities", []))
            await db.execute(
                """
                INSERT INTO model_configs
                    (id, provider_id, name, context_length, max_output, temperature, active, capabilities)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    model.get("id", ""),
                    provider_id,
                    model.get("name", ""),
                    model.get("context") or model.get("context_length", "128K"),
                    model.get("max_output") or model.get("maxOutput", 4096),
                    model.get("temperature", 0.4),
                    1 if model.get("active", True) else 0,
                    json.dumps(capabilities, ensure_ascii=False),
                ),
            )
        await db.commit()

        if auto_sync:
            try:
                sync_result = await sync_provider_models(
                    db,
                    provider_id,
                    protocol=data.get("protocol", "openai"),
                    overwrite=False,
                )
            except ModelProviderError as exc:
                await _set_provider_status(db, provider_id, exc.status)
                sync_result = {"ok": False, "error": exc.message, "status": exc.status}

        provider_rows = await db.execute_fetchall(
            "SELECT * FROM model_providers WHERE id = ?",
            (provider_id,),
        )
        provider = _public_provider(dict(provider_rows[0]))
        provider["models"] = await list_provider_models(db, provider_id)
        return {"ok": True, "provider": provider, "sync": sync_result}
    finally:
        await db.close()


@router.post("/providers/{provider_id}/sync-models")
async def sync_models(provider_id: str, data: dict | None = None):
    body = data or {}
    db = await get_db()
    try:
        try:
            return await sync_provider_models(
                db,
                provider_id,
                protocol=body.get("protocol", "openai"),
                overwrite=bool(body.get("overwrite", False)),
            )
        except ModelProviderError as exc:
            await _set_provider_status(db, provider_id, exc.status)
            raise HTTPException(400, {"error": exc.message, "status": exc.status}) from exc
    finally:
        await db.close()


@router.post("/providers/{provider_id}/test")
async def test_connection(provider_id: str):
    db = await get_db()
    try:
        rows = await db.execute_fetchall(
            "SELECT * FROM model_providers WHERE id = ?",
            (provider_id,),
        )
        if not rows:
            return {"ok": False, "error": "Provider not found", "status": "offline"}

        provider = dict(rows[0])
        try:
            models = await fetch_openai_models(provider.get("endpoint", ""), provider.get("api_key", ""))
            await _set_provider_status(db, provider_id, "connected")
            return {"ok": True, "status": "connected", "fetched": len(models)}
        except ModelProviderError as exc:
            await _set_provider_status(db, provider_id, exc.status)
            return {"ok": False, "error": exc.message, "status": exc.status}
    finally:
        await db.close()


@router.patch("/configs/{model_id:path}")
async def update_model_config(model_id: str, data: dict):
    allowed_fields = {
        "active": "active",
        "temperature": "temperature",
        "max_output": "max_output",
        "context_length": "context_length",
        "capabilities": "capabilities",
    }
    updates: list[tuple[str, Any]] = []
    for key, column in allowed_fields.items():
        if key not in data:
            continue
        value = data[key]
        if key == "active":
            value = 1 if value else 0
        elif key == "capabilities":
            value = json.dumps(_safe_capabilities(value), ensure_ascii=False)
        updates.append((column, value))

    if not updates:
        raise HTTPException(400, "No supported fields to update")

    db = await get_db()
    try:
        exists = await db.execute_fetchall(
            "SELECT id FROM model_configs WHERE id = ?",
            (model_id,),
        )
        if not exists:
            raise HTTPException(404, "Model config not found")

        assignments = ", ".join(f"{column} = ?" for column, _ in updates)
        values = [value for _, value in updates]
        values.append(model_id)
        await db.execute(
            f"UPDATE model_configs SET {assignments} WHERE id = ?",
            values,
        )
        await db.commit()

        rows = await db.execute_fetchall(
            "SELECT * FROM model_configs WHERE id = ?",
            (model_id,),
        )
        model = dict(rows[0])
        model["capabilities"] = _safe_capabilities(model.get("capabilities", []))
        return {"ok": True, "model": model}
    finally:
        await db.close()
