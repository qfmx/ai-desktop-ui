from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any
from urllib.parse import urlparse

import aiosqlite
import httpx


@dataclass
class ModelProviderError(Exception):
    message: str
    status: str = "limited"

    def __str__(self) -> str:
        return self.message


def normalize_endpoint(endpoint: str) -> str:
    value = (endpoint or "").strip().rstrip("/")
    parsed = urlparse(value)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise ModelProviderError("Endpoint must be a valid http(s) URL", "offline")
    return value


def mask_api_key(api_key: str) -> str:
    if not api_key:
        return ""
    if len(api_key) <= 8:
        return "****"
    return f"{api_key[:3]}****{api_key[-4:]}"


def infer_capabilities(model_id: str) -> list[str]:
    model = model_id.lower()
    if "embedding" in model or "embed" in model:
        return ["嵌入"]
    capabilities = ["问答"]
    if any(token in model for token in ("vision", "gpt-4o")):
        capabilities.append("视觉")
    if any(token in model for token in ("code", "coder")):
        capabilities.append("代码")
    return capabilities


def parse_openai_models(payload: Any) -> list[dict[str, Any]]:
    if not isinstance(payload, dict) or not isinstance(payload.get("data"), list):
        raise ModelProviderError("Response is not an OpenAI-compatible models list", "limited")

    seen: set[str] = set()
    models: list[dict[str, Any]] = []
    for item in payload["data"]:
        if not isinstance(item, dict) or not isinstance(item.get("id"), str):
            continue
        model_id = item["id"].strip()
        if not model_id or model_id in seen:
            continue
        seen.add(model_id)
        models.append({"id": model_id, "raw": item})
    return models


async def fetch_openai_models(endpoint: str, api_key: str = "") -> list[dict[str, Any]]:
    base_url = normalize_endpoint(endpoint)
    headers = {"Content-Type": "application/json"}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.get(f"{base_url}/models", headers=headers)
            response.raise_for_status()
            payload = response.json()
    except httpx.HTTPStatusError as exc:
        status = exc.response.status_code
        if status in (401, 403):
            raise ModelProviderError("Provider authentication failed", "offline") from exc
        if status == 404:
            raise ModelProviderError("Models endpoint not found; check the OpenAI-compatible base URL", "limited") from exc
        raise ModelProviderError(f"Provider returned HTTP {status}", "offline") from exc
    except httpx.TimeoutException as exc:
        raise ModelProviderError("Provider request timed out", "offline") from exc
    except httpx.RequestError as exc:
        raise ModelProviderError("Provider request failed", "offline") from exc
    except ValueError as exc:
        raise ModelProviderError("Provider returned invalid JSON", "limited") from exc

    return parse_openai_models(payload)


def _model_response(row: dict[str, Any]) -> dict[str, Any]:
    capabilities = row.get("capabilities", [])
    if isinstance(capabilities, str):
        try:
            capabilities = json.loads(capabilities)
        except json.JSONDecodeError:
            capabilities = []
    return {**row, "capabilities": capabilities}


async def list_provider_models(db: aiosqlite.Connection, provider_id: str) -> list[dict[str, Any]]:
    rows = await db.execute_fetchall(
        "SELECT * FROM model_configs WHERE provider_id = ? ORDER BY name",
        (provider_id,),
    )
    return [_model_response(dict(row)) for row in rows]


async def sync_provider_models(
    db: aiosqlite.Connection,
    provider_id: str,
    protocol: str = "openai",
    overwrite: bool = False,
) -> dict[str, Any]:
    if protocol not in ("openai", "openai-compatible", "openai_compatible"):
        raise ModelProviderError("Only OpenAI-compatible protocol is supported for now", "limited")

    rows = await db.execute_fetchall(
        "SELECT * FROM model_providers WHERE id = ?",
        (provider_id,),
    )
    if not rows:
        raise ModelProviderError("Provider not found", "offline")

    provider = dict(rows[0])
    remote_models = await fetch_openai_models(provider.get("endpoint", ""), provider.get("api_key", ""))

    inserted = 0
    updated = 0
    for remote_model in remote_models:
        remote_id = remote_model["id"]
        model_id = f"{provider_id}:{remote_id}"
        capabilities = infer_capabilities(remote_id)
        existing = await db.execute_fetchall(
            "SELECT id FROM model_configs WHERE id = ?",
            (model_id,),
        )
        if existing:
            if overwrite:
                await db.execute(
                    """
                    UPDATE model_configs
                    SET name = ?, capabilities = ?
                    WHERE id = ?
                    """,
                    (remote_id, json.dumps(capabilities, ensure_ascii=False), model_id),
                )
                updated += 1
            continue

        await db.execute(
            """
            INSERT INTO model_configs
                (id, provider_id, name, context_length, max_output, temperature, active, capabilities)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                model_id,
                provider_id,
                remote_id,
                "未知",
                4096,
                0.4,
                1,
                json.dumps(capabilities, ensure_ascii=False),
            ),
        )
        inserted += 1

    await db.execute(
        "UPDATE model_providers SET status = ? WHERE id = ?",
        ("connected", provider_id),
    )
    await db.commit()

    return {
        "ok": True,
        "provider_id": provider_id,
        "fetched": len(remote_models),
        "inserted": inserted,
        "updated": updated,
        "models": await list_provider_models(db, provider_id),
    }
