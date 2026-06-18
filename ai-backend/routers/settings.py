from fastapi import APIRouter

from core.database import get_db
from core.config import settings

router = APIRouter(prefix="/api/settings", tags=["settings"])


@router.get("/")
async def get_settings():
    db = await get_db()
    try:
        rows = await db.execute_fetchall("SELECT key, value FROM settings")
        overrides = {r["key"]: r["value"] for r in rows}
        return {
            "default_llm_model": overrides.get("default_llm_model", settings.default_llm_model),
            "default_temperature": float(overrides.get("default_temperature", settings.default_temperature)),
            "default_top_k": int(overrides.get("default_top_k", settings.default_top_k)),
            "audit_enabled": overrides.get("audit_enabled", str(settings.audit_enabled)).lower() == "true",
            "masking_enabled": overrides.get("masking_enabled", str(settings.masking_enabled)).lower() == "true",
        }
    finally:
        await db.close()


@router.post("/")
async def save_settings(data: dict):
    db = await get_db()
    try:
        for key, value in data.items():
            await db.execute(
                "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = ?",
                (key, str(value), str(value)),
            )
        await db.commit()
        return {"ok": True}
    finally:
        await db.close()
