from __future__ import annotations

import json
import re
import uuid
from dataclasses import dataclass
from typing import Any
from urllib.parse import urlparse

import aiosqlite
import httpx

from core.database import get_db


SUPPORTED_PROTOCOLS = {"openai-compatible", "anthropic", "ollama"}
SUPPORTED_PROVIDER_TYPES = {"cloud", "local", "custom"}


@dataclass
class ModelProviderError(Exception):
    message: str
    status: str = "limited"

    def __str__(self) -> str:
        return self.message


@dataclass
class ResolvedModelConfig:
    id: str
    provider_id: str
    provider_name: str
    provider_type: str
    protocol_type: str
    base_url: str
    api_key: str
    model_name: str
    display_name: str
    capabilities: list[str]


def normalize_base_url(base_url: str) -> str:
    value = (base_url or "").strip().rstrip("/")
    parsed = urlparse(value)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise ModelProviderError("Base URL must be a valid http(s) URL", "offline")
    return value


def normalize_endpoint(endpoint: str) -> str:
    return normalize_base_url(endpoint)


def normalize_protocol(protocol_type: str | None) -> str:
    value = (protocol_type or "openai-compatible").strip().lower()
    aliases = {
        "openai": "openai-compatible",
        "openai_compatible": "openai-compatible",
        "openai-compatible": "openai-compatible",
        "ollama": "ollama",
        "anthropic": "anthropic",
    }
    normalized = aliases.get(value, value)
    if normalized not in SUPPORTED_PROTOCOLS:
        raise ModelProviderError("Unsupported protocol type", "limited")
    return normalized


def normalize_provider_type(provider_type: str | None) -> str:
    value = (provider_type or "cloud").strip().lower()
    return value if value in SUPPORTED_PROVIDER_TYPES else "custom"


def mask_api_key(api_key: str) -> str:
    if not api_key:
        return ""
    if len(api_key) <= 8:
        return "****"
    return f"{api_key[:3]}****{api_key[-4:]}"


def provider_id_from(value: str | None, name: str) -> str:
    raw = (value or name or "provider").strip().lower()
    slug = re.sub(r"[^a-z0-9_-]+", "-", raw).strip("-")
    return slug or f"provider-{uuid.uuid4().hex[:8]}"


def infer_capabilities(model_id: str, protocol_type: str = "openai-compatible") -> list[str]:
    model = model_id.lower()
    if "embedding" in model or "embed" in model:
        return ["嵌入"]
    if "rerank" in model or "bge-reranker" in model:
        return ["重排"]
    capabilities = ["问答"]
    if any(token in model for token in ("vision", "gpt-4o")):
        capabilities.append("视觉")
    if any(token in model for token in ("code", "coder")):
        capabilities.append("代码")
    if protocol_type == "ollama":
        capabilities.append("本地")
    return capabilities


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


def _model_response(row: dict[str, Any]) -> dict[str, Any]:
    capabilities = _safe_capabilities(row.get("capabilities", []))
    display_name = row.get("display_name") or row.get("name") or row.get("model_name") or row.get("id")
    model_name = row.get("model_name") or row.get("name") or display_name
    return {
        **row,
        "model_name": model_name,
        "display_name": display_name,
        "name": display_name,
        "capabilities": capabilities,
        "active": bool(row.get("active")),
    }


def public_provider(row: dict[str, Any]) -> dict[str, Any]:
    api_key = row.pop("api_key", "") or ""
    provider_type = row.get("provider_type") or row.get("type") or "cloud"
    base_url = row.get("base_url") or row.get("endpoint") or ""
    row["provider_type"] = provider_type
    row["type"] = provider_type
    row["base_url"] = base_url
    row["endpoint"] = base_url
    row["protocol_type"] = normalize_protocol(row.get("protocol_type"))
    row["has_api_key"] = bool(api_key)
    row["api_key_masked"] = mask_api_key(api_key)
    return row


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
        models.append({"id": model_id, "name": model_id, "raw": item})
    return models


def parse_ollama_models(payload: Any) -> list[dict[str, Any]]:
    if not isinstance(payload, dict) or not isinstance(payload.get("models"), list):
        raise ModelProviderError("Response is not an Ollama models list", "limited")

    models: list[dict[str, Any]] = []
    for item in payload["models"]:
        if not isinstance(item, dict):
            continue
        model_id = item.get("name") or item.get("model")
        if isinstance(model_id, str) and model_id.strip():
            models.append({"id": model_id.strip(), "name": model_id.strip(), "raw": item})
    return models


async def fetch_openai_models(base_url: str, api_key: str = "") -> list[dict[str, Any]]:
    url = normalize_base_url(base_url)
    headers = {"Content-Type": "application/json"}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.get(f"{url}/models", headers=headers)
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


async def fetch_ollama_models(base_url: str) -> list[dict[str, Any]]:
    url = normalize_base_url(base_url)
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            response = await client.get(f"{url}/api/tags")
            response.raise_for_status()
            payload = response.json()
    except httpx.HTTPStatusError as exc:
        raise ModelProviderError(f"Ollama returned HTTP {exc.response.status_code}", "offline") from exc
    except httpx.TimeoutException as exc:
        raise ModelProviderError("Ollama request timed out", "offline") from exc
    except httpx.RequestError as exc:
        raise ModelProviderError("Ollama request failed", "offline") from exc
    except ValueError as exc:
        raise ModelProviderError("Ollama returned invalid JSON", "limited") from exc
    return parse_ollama_models(payload)


async def fetch_anthropic_models(base_url: str, api_key: str = "") -> list[dict[str, Any]]:
    url = normalize_base_url(base_url)
    headers = {
        "content-type": "application/json",
        "anthropic-version": "2023-06-01",
    }
    if api_key:
        headers["x-api-key"] = api_key

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.get(f"{url}/models", headers=headers)
            response.raise_for_status()
            payload = response.json()
    except httpx.HTTPStatusError as exc:
        status = exc.response.status_code
        if status in (401, 403):
            raise ModelProviderError("Provider authentication failed", "offline") from exc
        if status == 404:
            raise ModelProviderError("Anthropic models endpoint is unavailable", "limited") from exc
        raise ModelProviderError(f"Provider returned HTTP {status}", "offline") from exc
    except httpx.TimeoutException as exc:
        raise ModelProviderError("Provider request timed out", "offline") from exc
    except httpx.RequestError as exc:
        raise ModelProviderError("Provider request failed", "offline") from exc
    except ValueError as exc:
        raise ModelProviderError("Provider returned invalid JSON", "limited") from exc

    return parse_openai_models(payload)


async def fetch_provider_models(
    base_url: str,
    api_key: str,
    protocol_type: str,
) -> list[dict[str, Any]]:
    protocol = normalize_protocol(protocol_type)
    if protocol == "ollama":
        return await fetch_ollama_models(base_url)
    if protocol == "anthropic":
        return await fetch_anthropic_models(base_url, api_key)
    return await fetch_openai_models(base_url, api_key)


async def list_provider_models(db: aiosqlite.Connection, provider_id: str) -> list[dict[str, Any]]:
    rows = await db.execute_fetchall(
        "SELECT * FROM model_configs WHERE provider_id = ? ORDER BY display_name, name",
        (provider_id,),
    )
    return [_model_response(dict(row)) for row in rows]


async def set_provider_status(db: aiosqlite.Connection, provider_id: str, status: str):
    await db.execute(
        """
        UPDATE model_providers
        SET status = ?, updated_at = datetime('now','localtime')
        WHERE id = ?
        """,
        (status, provider_id),
    )
    await db.commit()


async def sync_provider_models(
    db: aiosqlite.Connection,
    provider_id: str,
    protocol: str | None = None,
    overwrite: bool = False,
) -> dict[str, Any]:
    rows = await db.execute_fetchall(
        "SELECT * FROM model_providers WHERE id = ?",
        (provider_id,),
    )
    if not rows:
        raise ModelProviderError("Provider not found", "offline")

    provider = dict(rows[0])
    protocol_type = normalize_protocol(protocol or provider.get("protocol_type"))
    base_url = provider.get("base_url") or provider.get("endpoint") or ""
    remote_models = await fetch_provider_models(
        base_url,
        provider.get("api_key", ""),
        protocol_type,
    )

    inserted = 0
    updated = 0
    for remote_model in remote_models:
        remote_id = remote_model["id"]
        model_id = f"{provider_id}:{remote_id}"
        capabilities = infer_capabilities(remote_id, protocol_type)
        existing = await db.execute_fetchall(
            "SELECT id FROM model_configs WHERE id = ?",
            (model_id,),
        )
        if existing:
            if overwrite:
                await db.execute(
                    """
                    UPDATE model_configs
                    SET model_name = ?, display_name = ?, name = ?, capabilities = ?,
                        updated_at = datetime('now','localtime')
                    WHERE id = ?
                    """,
                    (
                        remote_id,
                        remote_model.get("name") or remote_id,
                        remote_model.get("name") or remote_id,
                        json.dumps(capabilities, ensure_ascii=False),
                        model_id,
                    ),
                )
                updated += 1
            continue

        await db.execute(
            """
            INSERT INTO model_configs
                (id, provider_id, model_name, display_name, name, context_length, max_output, temperature, active, capabilities)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                model_id,
                provider_id,
                remote_id,
                remote_model.get("name") or remote_id,
                remote_model.get("name") or remote_id,
                "未知",
                4096,
                0.4,
                1,
                json.dumps(capabilities, ensure_ascii=False),
            ),
        )
        inserted += 1

    await db.execute(
        """
        UPDATE model_providers
        SET status = ?, updated_at = datetime('now','localtime')
        WHERE id = ?
        """,
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


async def _settings_map(db: aiosqlite.Connection) -> dict[str, str]:
    rows = await db.execute_fetchall("SELECT key, value FROM settings")
    return {row["key"]: row["value"] for row in rows}


async def _resolve_in_db(
    db: aiosqlite.Connection,
    model_config_id: str | None,
    purpose: str,
) -> ResolvedModelConfig:
    target_id = (model_config_id or "").strip()
    if not target_id:
        settings = await _settings_map(db)
        target_id = settings.get(
            {
                "chat": "default_chat_model_config_id",
                "embedding": "default_embedding_model_config_id",
                "rerank": "default_rerank_model_config_id",
            }.get(purpose, "default_chat_model_config_id"),
            "",
        ).strip()

    rows = []
    if target_id:
        rows = await db.execute_fetchall(
            """
            SELECT
                mc.*,
                mp.name AS provider_name,
                mp.provider_type,
                mp.protocol_type,
                mp.base_url,
                mp.endpoint,
                mp.api_key
            FROM model_configs mc
            JOIN model_providers mp ON mp.id = mc.provider_id
            WHERE (mc.id = ? OR mc.model_name = ? OR mc.display_name = ? OR mc.name = ?)
              AND mc.active = 1
              AND COALESCE(mp.enabled, 1) = 1
            LIMIT 1
            """,
            (target_id, target_id, target_id, target_id),
        )

    if not rows:
        capability_filter = "%嵌入%" if purpose == "embedding" else "%问答%"
        rows = await db.execute_fetchall(
            """
            SELECT
                mc.*,
                mp.name AS provider_name,
                mp.provider_type,
                mp.protocol_type,
                mp.base_url,
                mp.endpoint,
                mp.api_key
            FROM model_configs mc
            JOIN model_providers mp ON mp.id = mc.provider_id
            WHERE mc.active = 1
              AND COALESCE(mp.enabled, 1) = 1
              AND mc.capabilities LIKE ?
            ORDER BY mp.created_at ASC, mc.created_at ASC
            LIMIT 1
            """,
            (capability_filter,),
        )

    if not rows:
        raise ModelProviderError("No active model configuration is available", "offline")

    row = dict(rows[0])
    capabilities = _safe_capabilities(row.get("capabilities", []))
    return ResolvedModelConfig(
        id=row["id"],
        provider_id=row["provider_id"],
        provider_name=row["provider_name"],
        provider_type=row.get("provider_type") or "cloud",
        protocol_type=normalize_protocol(row.get("protocol_type")),
        base_url=normalize_base_url(row.get("base_url") or row.get("endpoint") or ""),
        api_key=row.get("api_key") or "",
        model_name=row.get("model_name") or row.get("name") or row["id"],
        display_name=row.get("display_name") or row.get("name") or row.get("model_name") or row["id"],
        capabilities=capabilities,
    )


async def resolve_model_config(
    model_config_id: str | None = None,
    purpose: str = "chat",
    db: aiosqlite.Connection | None = None,
) -> ResolvedModelConfig:
    if db is not None:
        return await _resolve_in_db(db, model_config_id, purpose)

    owned_db = await get_db()
    try:
        return await _resolve_in_db(owned_db, model_config_id, purpose)
    finally:
        await owned_db.close()


async def model_label_for_id(db: aiosqlite.Connection, model_config_id: str | None) -> str:
    if not model_config_id:
        return ""
    rows = await db.execute_fetchall(
        """
        SELECT mc.display_name, mc.name, mc.model_name, mp.name AS provider_name
        FROM model_configs mc
        JOIN model_providers mp ON mp.id = mc.provider_id
        WHERE mc.id = ?
        """,
        (model_config_id,),
    )
    if not rows:
        return model_config_id
    row = dict(rows[0])
    model = row.get("display_name") or row.get("name") or row.get("model_name") or model_config_id
    provider = row.get("provider_name") or ""
    return f"{provider} / {model}" if provider else model


async def model_label_for_setting(db: aiosqlite.Connection, setting_key: str) -> str:
    rows = await db.execute_fetchall("SELECT value FROM settings WHERE key = ?", (setting_key,))
    if not rows:
        return ""
    return await model_label_for_id(db, rows[0]["value"])
