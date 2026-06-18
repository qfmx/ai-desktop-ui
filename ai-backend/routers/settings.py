from pathlib import Path

from fastapi import APIRouter

from core.config import settings
from core.database import DB_PATH, get_db

router = APIRouter(prefix="/api/settings", tags=["settings"])


def _bool(value, default=False):
    if value is None:
        return default
    return str(value).lower() in {"1", "true", "yes", "on"}


def _setting(overrides: dict[str, str], key: str, default):
    return overrides.get(key, default)


@router.get("/")
async def get_settings():
    db = await get_db()
    try:
        rows = await db.execute_fetchall("SELECT key, value FROM settings")
        overrides = {row["key"]: row["value"] for row in rows}
        return {
            "default_llm_model": _setting(overrides, "default_llm_model", settings.default_llm_model),
            "default_temperature": float(_setting(overrides, "default_temperature", settings.default_temperature)),
            "default_top_k": int(_setting(overrides, "default_top_k", settings.default_top_k)),
            "audit_enabled": _bool(_setting(overrides, "audit_enabled", settings.audit_enabled), True),
            "masking_enabled": _bool(_setting(overrides, "masking_enabled", settings.masking_enabled), True),
            "model_fallback_enabled": _bool(_setting(overrides, "model_fallback_enabled", True), True),
            "trace_enabled": _bool(_setting(overrides, "trace_enabled", settings.audit_enabled), True),
            "auto_save": _bool(_setting(overrides, "auto_save", True), True),
            "restore_session": _bool(_setting(overrides, "restore_session", True), True),
            "language": _setting(overrides, "language", "zh-CN"),
            "notifications_enabled": _bool(_setting(overrides, "notifications_enabled", True), True),
            "sound_enabled": _bool(_setting(overrides, "sound_enabled", False), False),
            "data_retention_days": int(_setting(overrides, "data_retention_days", 180)),
            "system_prompt": _setting(
                overrides,
                "system_prompt",
                "你是企业 AI 工作台助手。回答应基于授权知识库，重要结论需要给出来源；当证据不足时明确说明不确定性。",
            ),
        }
    finally:
        await db.close()


@router.post("/")
async def save_settings(data: dict):
    db = await get_db()
    try:
        for key, value in data.items():
            await db.execute(
                """
                INSERT INTO settings (key, value)
                VALUES (?, ?)
                ON CONFLICT(key) DO UPDATE SET value = ?
                """,
                (key, str(value), str(value)),
            )
        await db.commit()
        return {"ok": True}
    finally:
        await db.close()


@router.get("/prompt-templates")
async def prompt_templates():
    db = await get_db()
    try:
        rows = await db.execute_fetchall(
            """
            SELECT id, name, description
            FROM prompt_templates
            WHERE enabled = 1
            ORDER BY sort_order ASC, name ASC
            """
        )
        return [dict(row) for row in rows]
    finally:
        await db.close()


def _path_size(path: Path) -> int:
    if not path.exists():
        return 0
    if path.is_file():
        return path.stat().st_size
    total = 0
    for item in path.rglob("*"):
        if item.is_file():
            total += item.stat().st_size
    return total


def _format_size(value: int) -> str:
    if value >= 1024 * 1024 * 1024:
        return f"{value / (1024 * 1024 * 1024):.1f} GB"
    if value >= 1024 * 1024:
        return f"{value / (1024 * 1024):.1f} MB"
    if value >= 1024:
        return f"{value / 1024:.1f} KB"
    return f"{value} B"


@router.get("/storage")
async def storage_stats():
    data_dir = Path(settings.data_dir)
    vector_dir = Path(settings.vector_store_dir)
    db_size = _path_size(DB_PATH)
    vector_size = _path_size(vector_dir)
    log_size = _path_size(data_dir / "logs")
    max_size = max(db_size, vector_size, log_size, 1)
    return [
        {"label": "会话数据", "value": _format_size(db_size), "width": round(db_size / max_size * 100)},
        {"label": "知识库索引", "value": _format_size(vector_size), "width": round(vector_size / max_size * 100)},
        {"label": "审计日志", "value": _format_size(log_size), "width": round(log_size / max_size * 100)},
    ]
