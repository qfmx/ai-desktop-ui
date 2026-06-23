import json
from datetime import datetime

from fastapi import APIRouter, HTTPException
from sse_starlette.sse import EventSourceResponse

from core.database import get_db
from services.llm import llm
from services.model_provider import model_label_for_id, resolve_model_config
from services.rag import rag, vector_store

router = APIRouter(prefix="/api/chat", tags=["chat"])


def _json_list(value, fallback=None):
    if fallback is None:
        fallback = []
    if isinstance(value, list):
        return value
    if isinstance(value, str):
        try:
            parsed = json.loads(value)
            return parsed if isinstance(parsed, list) else fallback
        except json.JSONDecodeError:
            return fallback
    return fallback


def _render_template(template: str, values: dict) -> str:
    try:
        return template.format_map(values)
    except (KeyError, ValueError):
        return template


def _title_from_question(question: str) -> str:
    normalized = " ".join(question.split()).strip()
    max_length = 24
    if len(normalized) > max_length:
        return f"{normalized[:max_length]}..."
    return normalized


def _normalize_session_title(value) -> str:
    return " ".join(str(value or "").split()).strip()[:32]


def _normalize_session_tags(value) -> list[str]:
    if isinstance(value, str):
        try:
            parsed = json.loads(value)
            value = parsed if isinstance(parsed, list) else value
        except json.JSONDecodeError:
            pass
    raw_tags = value if isinstance(value, list) else str(value or "").replace("，", ",").split(",")
    tags = []
    seen = set()
    for item in raw_tags:
        tag = " ".join(str(item or "").split()).strip()[:16]
        if not tag or tag in seen:
            continue
        seen.add(tag)
        tags.append(tag)
        if len(tags) >= 6:
            break
    return tags


def _bool_setting(values: dict[str, str], key: str, default: bool) -> bool:
    if key not in values:
        return default
    return str(values[key]).lower() in {"1", "true", "yes", "on"}


def _int_setting(values: dict[str, str], key: str, default: int) -> int:
    try:
        return int(values.get(key, default))
    except (TypeError, ValueError):
        return default


def _float_setting(values: dict[str, str], key: str, default: float) -> float:
    try:
        return float(values.get(key, default))
    except (TypeError, ValueError):
        return default


async def _settings_map(db=None) -> dict[str, str]:
    if db is not None:
        rows = await db.execute_fetchall("SELECT key, value FROM settings")
        return {row["key"]: row["value"] for row in rows}
    owned_db = await get_db()
    try:
        return await _settings_map(owned_db)
    finally:
        await owned_db.close()


async def _session_model_config_id(session_id: str) -> str:
    if not session_id:
        return ""
    db = await get_db()
    try:
        rows = await db.execute_fetchall(
            "SELECT model_config_id FROM conversations WHERE id = ?",
            (session_id,),
        )
        return rows[0]["model_config_id"] if rows else ""
    finally:
        await db.close()


@router.get("/quick-actions")
async def quick_actions():
    db = await get_db()
    try:
        rows = await db.execute_fetchall(
            """
            SELECT id, title, prompt
            FROM quick_actions
            WHERE enabled = 1
            ORDER BY sort_order ASC, title ASC
            """
        )
        return [dict(row) for row in rows]
    finally:
        await db.close()


@router.get("/runtime-context")
async def runtime_context(session_id: str | None = None):
    session = None
    setting_values: dict[str, str] = {}
    routing = []
    db = await get_db()
    try:
        if session_id:
            rows = await db.execute_fetchall(
                "SELECT * FROM conversations WHERE id = ?",
                (session_id,),
            )
            if rows:
                session = dict(rows[0])
        setting_values = await _settings_map(db)
        pipeline_rows = await db.execute_fetchall(
            """
            SELECT label, value_template, tone
            FROM runtime_pipeline_steps
            WHERE enabled = 1
            ORDER BY sort_order ASC, label ASC
            """
        )
        route_rows = await db.execute_fetchall(
            """
            SELECT label, kind, value_key
            FROM runtime_route_items
            WHERE enabled = 1
            ORDER BY sort_order ASC, label ASC
            """
        )
        for row in route_rows:
            setting_key = row["value_key"]
            configured_id = setting_values.get(setting_key, "")
            value = await model_label_for_id(db, configured_id)
            routing.append(
                {
                    "label": row["label"],
                    "value": value or configured_id or "未配置",
                    "kind": row["kind"],
                }
            )
    finally:
        await db.close()

    model = (session or {}).get("model") or setting_values.get("default_chat_model_config_id", "未配置")
    scope = (session or {}).get("scope") or "默认知识库"
    vector_stats = vector_store.stats()
    template_values = {
        "top_k": _int_setting(setting_values, "default_top_k", 8),
        "total_chunks": vector_stats.get("total_chunks", 0),
        "scope": scope,
    }

    return {
        "pipeline": [
            {
                "label": row["label"],
                "value": _render_template(row["value_template"], template_values),
                "tone": row["tone"],
            }
            for row in pipeline_rows
        ],
        "routing": routing or [{"label": "主模型", "value": model, "kind": "cpu"}],
        "audit": {
            "enabled": _bool_setting(setting_values, "audit_enabled", True),
            "title": "审计链路已记录" if _bool_setting(setting_values, "audit_enabled", True) else "审计链路未开启",
            "description": "请求、检索、引用和权限策略完整留痕",
        },
        "scope": scope,
        "stats": vector_stats,
    }


@router.get("/sessions")
async def list_sessions(include_archived: bool = False, archived: bool | None = None):
    db = await get_db()
    try:
        filters = []
        values = []
        if archived is not None:
            filters.append("archived = ?")
            values.append(1 if archived else 0)
        elif not include_archived:
            filters.append("archived = 0")

        where_clause = f" WHERE {' AND '.join(filters)}" if filters else ""
        rows = await db.execute_fetchall(
            f"SELECT * FROM conversations{where_clause} ORDER BY updated_at DESC",
            tuple(values),
        )
        return [dict(row) for row in rows]
    finally:
        await db.close()


@router.get("/sessions/{session_id}")
async def get_session(session_id: str):
    db = await get_db()
    try:
        rows = await db.execute_fetchall(
            "SELECT * FROM conversations WHERE id = ?",
            (session_id,),
        )
        if not rows:
            raise HTTPException(404, "Session not found")
        session = dict(rows[0])
        messages = await db.execute_fetchall(
            "SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at",
            (session_id,),
        )
        session["messages"] = [dict(message) for message in messages]
        return session
    finally:
        await db.close()


@router.post("/sessions")
async def create_session(data: dict):
    title = _normalize_session_title(data.get("title")) or "新会话"
    resolved_model = await resolve_model_config(
        data.get("model_config_id") or data.get("model") or None,
        purpose="chat",
    )
    db = await get_db()
    try:
        await db.execute(
            """
            INSERT INTO conversations (id, title, model, model_config_id, scope, preview, tags)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                data.get("id", ""),
                title,
                resolved_model.display_name,
                resolved_model.id,
                data.get("scope", ""),
                data.get("preview", ""),
                json.dumps(_normalize_session_tags(data.get("tags", [])), ensure_ascii=False),
            ),
        )
        await db.commit()
        return {"ok": True, "id": data.get("id")}
    finally:
        await db.close()


@router.patch("/sessions/{session_id}")
async def update_session(session_id: str, data: dict):
    allowed_fields = {
        "title": "title",
        "model": "model",
        "scope": "scope",
        "preview": "preview",
        "starred": "starred",
        "tags": "tags",
    }
    updates = []
    values = []

    if "model_config_id" in data:
        resolved_model = await resolve_model_config(data.get("model_config_id"), purpose="chat")
        updates.extend(["model_config_id = ?", "model = ?"])
        values.extend([resolved_model.id, resolved_model.display_name])

    if "archived" in data:
        raw_archived = data.get("archived")
        archived = (
            raw_archived
            if isinstance(raw_archived, bool)
            else str(raw_archived).lower() in {"1", "true", "yes", "on"}
        )
        if archived:
            updates.extend(["archived = 1", "archived_at = datetime('now','localtime')"])
        else:
            updates.extend(["archived = 0", "archived_at = ''"])

    for key, column in allowed_fields.items():
        if key not in data:
            continue
        value = data[key]
        if key == "starred":
            value = 1 if value else 0
        elif key == "title":
            value = _normalize_session_title(value)
            if not value:
                raise HTTPException(400, "title is required")
        elif key == "tags":
            value = json.dumps(_normalize_session_tags(value), ensure_ascii=False)
        updates.append(f"{column} = ?")
        values.append(value)

    if not updates:
        return {"ok": True, "id": session_id}

    updates.append("updated_at = datetime('now','localtime')")
    values.append(session_id)

    db = await get_db()
    try:
        cursor = await db.execute(
            f"UPDATE conversations SET {', '.join(updates)} WHERE id = ?",
            tuple(values),
        )
        await db.commit()
        if cursor.rowcount == 0:
            raise HTTPException(404, "Session not found")
        return {"ok": True, "id": session_id}
    finally:
        await db.close()


@router.delete("/sessions/{session_id}")
async def delete_session(session_id: str):
    db = await get_db()
    try:
        await db.execute("DELETE FROM messages WHERE conversation_id = ?", (session_id,))
        await db.execute("DELETE FROM conversations WHERE id = ?", (session_id,))
        await db.commit()
        return {"ok": True}
    finally:
        await db.close()


@router.post("/ask")
async def ask(data: dict):
    question = data.get("question", "")
    if not question:
        raise HTTPException(400, "question is required")

    setting_values = await _settings_map()
    result = await rag.query(
        question=question,
        knowledge_base_id=data.get("knowledge_base_id"),
        top_k=data.get("top_k", _int_setting(setting_values, "default_top_k", 8)),
        model_config_id=data.get("model_config_id"),
        model=data.get("model", ""),
    )
    await _persist_exchange(data.get("session_id", ""), question, result)
    return result


@router.post("/ask/stream")
async def ask_stream(data: dict):
    question = data.get("question", "")
    if not question:
        raise HTTPException(400, "question is required")

    conv_id = data.get("session_id", "")
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    setting_values = await _settings_map()
    model_config_id = (
        data.get("model_config_id")
        or await _session_model_config_id(conv_id)
        or data.get("model")
        or None
    )
    model_config = await resolve_model_config(model_config_id, purpose="chat")

    if conv_id:
        await _insert_user_message(conv_id, question, now)

    chunks = await vector_store.search(
        question,
        top_k=data.get("top_k", _int_setting(setting_values, "default_top_k", 8)),
        knowledge_base_id=data.get("knowledge_base_id"),
    )
    context = "\n\n".join(
        f"[{chunk.get('knowledge_base_id', 'unknown')}] {chunk['content']}"
        for chunk in chunks
    )
    system_prompt = (
        "你是企业 AI-Workspace 助手。回答应基于以下知识库内容，重要结论需要给出引用来源；"
        "当证据不足时明确说明不确定性。\n\n知识库内容：\n"
        + context
    )
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": question},
    ]

    async def generate():
        full_text = ""
        try:
            async for token in llm.chat_completion_stream(
                model_config=model_config,
                messages=messages,
                temperature=_float_setting(setting_values, "default_temperature", 0.4),
            ):
                if token:
                    full_text += token
                    yield {
                        "data": json.dumps(
                            {"type": "token", "content": token},
                            ensure_ascii=False,
                        )
                    }
        finally:
            citations = [
                {"id": chunk.get("id", ""), "content": chunk["content"][:200]}
                for chunk in chunks[:5]
            ]
            yield {
                "data": json.dumps(
                    {
                        "type": "done",
                        "content": full_text,
                        "model": model_config.display_name,
                        "model_config_id": model_config.id,
                        "citations": citations,
                    },
                    ensure_ascii=False,
                )
            }
            if conv_id:
                await _insert_assistant_message(
                    conv_id,
                    full_text,
                    model_config.display_name,
                    model_config.id,
                    citations,
                    now,
                )

    return EventSourceResponse(generate())


async def _insert_user_message(conv_id: str, question: str, now: str):
    title = _title_from_question(question)
    db = await get_db()
    try:
        await db.execute(
            "INSERT INTO messages (id, conversation_id, role, content) VALUES (?, ?, ?, ?)",
            (f"u-{conv_id}-{now}", conv_id, "user", question),
        )
        if title:
            await db.execute(
                """
                UPDATE conversations
                SET title = ?, updated_at = ?
                WHERE id = ?
                  AND (title = '' OR title = '新会话' OR title = '新回话')
                """,
                (title, now, conv_id),
            )
        await db.commit()
    finally:
        await db.close()


async def _insert_assistant_message(
    conv_id: str,
    content: str,
    model: str,
    model_config_id: str,
    citations: list[dict],
    now: str,
):
    db = await get_db()
    try:
        await db.execute(
            """
            INSERT INTO messages (id, conversation_id, role, content, model, model_config_id, citations)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                f"a-{conv_id}-{now}",
                conv_id,
                "assistant",
                content,
                model,
                model_config_id,
                json.dumps(citations, ensure_ascii=False),
            ),
        )
        await db.execute(
            """
            UPDATE conversations
            SET updated_at = ?, message_count = message_count + 2, preview = ?
            WHERE id = ?
            """,
            (now, content[:160], conv_id),
        )
        await db.commit()
    finally:
        await db.close()


async def _persist_exchange(conv_id: str, question: str, result: dict):
    if not conv_id:
        return
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    await _insert_user_message(conv_id, question, now)
    await _insert_assistant_message(
        conv_id,
        result.get("answer", ""),
        result.get("model", ""),
        result.get("model_config_id", ""),
        result.get("citations", []),
        now,
    )
