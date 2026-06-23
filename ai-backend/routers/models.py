import json
from typing import Any

import aiosqlite
from fastapi import APIRouter, HTTPException

from core.database import get_db
from services.model_provider import (
    ModelProviderError,
    fetch_provider_models,
    infer_capabilities,
    list_provider_models,
    normalize_base_url,
    normalize_protocol,
    normalize_provider_type,
    provider_id_from,
    public_provider,
    set_provider_status,
    sync_provider_models,
)

router = APIRouter(prefix="/api/models", tags=["models"])


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


def _is_chat_model(model: dict[str, Any]) -> bool:
    capabilities = _safe_capabilities(model.get("capabilities", []))
    if any(cap in capabilities for cap in ("嵌入", "重排")):
        return False
    return True


@router.get("/protocols")
async def list_protocols():
    return [
        {
            "id": "openai-compatible",
            "label": "OpenAI Compatible",
            "base_url_placeholder": "https://api.openai.com/v1",
            "supports_sync": True,
        },
        {
            "id": "anthropic",
            "label": "Anthropic",
            "base_url_placeholder": "https://api.anthropic.com/v1",
            "supports_sync": True,
        },
        {
            "id": "ollama",
            "label": "Ollama",
            "base_url_placeholder": "http://localhost:11434",
            "supports_sync": True,
        },
    ]


@router.get("/providers")
async def list_providers():
    db = await get_db()
    try:
        rows = await db.execute_fetchall("SELECT * FROM model_providers ORDER BY created_at")
        providers = []
        for row in rows:
            provider = public_provider(dict(row))
            provider["models"] = await list_provider_models(db, provider["id"])
            providers.append(provider)
        return providers
    finally:
        await db.close()


@router.get("/chat-options")
async def chat_options():
    db = await get_db()
    try:
        rows = await db.execute_fetchall(
            """
            SELECT *
            FROM model_providers
            WHERE COALESCE(enabled, 1) = 1
            ORDER BY created_at
            """
        )
        result = []
        for row in rows:
            provider = public_provider(dict(row))
            models = [
                model
                for model in await list_provider_models(db, provider["id"])
                if model.get("active") and _is_chat_model(model)
            ]
            if not models:
                continue
            result.append(
                {
                    "provider_id": provider["id"],
                    "provider_name": provider["name"],
                    "provider_type": provider["provider_type"],
                    "protocol_type": provider["protocol_type"],
                    "models": [
                        {
                            "model_config_id": model["id"],
                            "display_name": model["display_name"],
                            "model_name": model["model_name"],
                        }
                        for model in models
                    ],
                }
            )
        return result
    finally:
        await db.close()


@router.post("/providers")
async def create_provider(data: dict):
    name = (data.get("name") or "").strip()
    base_url = (data.get("base_url") or data.get("endpoint") or "").strip()
    if not name:
        raise HTTPException(400, "Provider name is required")
    if not base_url:
        raise HTTPException(400, "Provider base_url is required")

    try:
        protocol_type = normalize_protocol(data.get("protocol_type") or data.get("protocol"))
        provider_type = normalize_provider_type(data.get("provider_type") or data.get("type"))
        normalized_base_url = normalize_base_url(base_url)
    except ModelProviderError as exc:
        raise HTTPException(400, exc.message) from exc

    provider_id = provider_id_from(data.get("id"), name)
    auto_sync = bool(data.get("auto_sync_models", False))
    sync_result: dict[str, Any] | None = None

    db = await get_db()
    try:
        try:
            await db.execute(
                """
                INSERT INTO model_providers
                    (id, name, provider_type, protocol_type, base_url, api_key, status, enabled, type, endpoint)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    provider_id,
                    name,
                    provider_type,
                    protocol_type,
                    normalized_base_url,
                    data.get("api_key", ""),
                    "limited" if auto_sync else data.get("status", "connected"),
                    1 if data.get("enabled", True) else 0,
                    provider_type,
                    normalized_base_url,
                ),
            )
        except aiosqlite.IntegrityError as exc:
            raise HTTPException(409, "Provider already exists") from exc

        for model in data.get("models", []):
            model_name = (model.get("model_name") or model.get("name") or model.get("id") or "").strip()
            if not model_name:
                continue
            display_name = model.get("display_name") or model.get("name") or model_name
            model_id = model.get("id") or f"{provider_id}:{model_name}"
            capabilities = _safe_capabilities(model.get("capabilities")) or infer_capabilities(model_name, protocol_type)
            await db.execute(
                """
                INSERT INTO model_configs
                    (id, provider_id, model_name, display_name, name, context_length, max_output, temperature, active, capabilities)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    model_id,
                    provider_id,
                    model_name,
                    display_name,
                    display_name,
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
                    protocol=protocol_type,
                    overwrite=False,
                )
            except ModelProviderError as exc:
                await set_provider_status(db, provider_id, exc.status)
                sync_result = {"ok": False, "error": exc.message, "status": exc.status}

        provider_rows = await db.execute_fetchall(
            "SELECT * FROM model_providers WHERE id = ?",
            (provider_id,),
        )
        provider = public_provider(dict(provider_rows[0]))
        provider["models"] = await list_provider_models(db, provider_id)
        return {"ok": True, "provider": provider, "sync": sync_result}
    finally:
        await db.close()


@router.patch("/providers/{provider_id}")
async def update_provider(provider_id: str, data: dict):
    updates: list[tuple[str, Any]] = []

    if "name" in data:
        name = (data.get("name") or "").strip()
        if not name:
            raise HTTPException(400, "Provider name is required")
        updates.append(("name", name))

    if "provider_type" in data or "type" in data:
        provider_type = normalize_provider_type(data.get("provider_type") or data.get("type"))
        updates.extend([("provider_type", provider_type), ("type", provider_type)])

    if "protocol_type" in data or "protocol" in data:
        try:
            updates.append(("protocol_type", normalize_protocol(data.get("protocol_type") or data.get("protocol"))))
        except ModelProviderError as exc:
            raise HTTPException(400, exc.message) from exc

    if "base_url" in data or "endpoint" in data:
        try:
            base_url = normalize_base_url(data.get("base_url") or data.get("endpoint") or "")
        except ModelProviderError as exc:
            raise HTTPException(400, exc.message) from exc
        updates.extend([("base_url", base_url), ("endpoint", base_url)])

    if "api_key" in data:
        updates.append(("api_key", data.get("api_key") or ""))

    if "enabled" in data:
        updates.append(("enabled", 1 if data.get("enabled") else 0))

    if "status" in data:
        updates.append(("status", data.get("status") or "limited"))

    if not updates:
        raise HTTPException(400, "No supported fields to update")

    assignments = ", ".join(f"{column} = ?" for column, _ in updates)
    values = [value for _, value in updates]
    values.append(provider_id)

    db = await get_db()
    try:
        cursor = await db.execute(
            f"""
            UPDATE model_providers
            SET {assignments}, updated_at = datetime('now','localtime')
            WHERE id = ?
            """,
            values,
        )
        await db.commit()
        if cursor.rowcount == 0:
            raise HTTPException(404, "Provider not found")

        rows = await db.execute_fetchall("SELECT * FROM model_providers WHERE id = ?", (provider_id,))
        provider = public_provider(dict(rows[0]))
        provider["models"] = await list_provider_models(db, provider_id)
        return {"ok": True, "provider": provider}
    finally:
        await db.close()


@router.delete("/providers/{provider_id}")
async def delete_provider(provider_id: str):
    db = await get_db()
    try:
        cursor = await db.execute("DELETE FROM model_providers WHERE id = ?", (provider_id,))
        await db.commit()
        if cursor.rowcount == 0:
            raise HTTPException(404, "Provider not found")
        return {"ok": True}
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
                protocol=body.get("protocol_type") or body.get("protocol"),
                overwrite=bool(body.get("overwrite", False)),
            )
        except ModelProviderError as exc:
            await set_provider_status(db, provider_id, exc.status)
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
            models = await fetch_provider_models(
                provider.get("base_url") or provider.get("endpoint") or "",
                provider.get("api_key", ""),
                provider.get("protocol_type") or "openai-compatible",
            )
            await set_provider_status(db, provider_id, "connected")
            return {"ok": True, "status": "connected", "fetched": len(models)}
        except ModelProviderError as exc:
            await set_provider_status(db, provider_id, exc.status)
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
        "model_name": "model_name",
        "display_name": "display_name",
        "name": "name",
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
            f"""
            UPDATE model_configs
            SET {assignments}, updated_at = datetime('now','localtime')
            WHERE id = ?
            """,
            values,
        )
        await db.commit()

        rows = await db.execute_fetchall(
            "SELECT * FROM model_configs WHERE id = ?",
            (model_id,),
        )
        model = dict(rows[0])
        model["capabilities"] = _safe_capabilities(model.get("capabilities", []))
        model["active"] = bool(model.get("active"))
        return {"ok": True, "model": model}
    finally:
        await db.close()
