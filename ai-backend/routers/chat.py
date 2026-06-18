import json
from datetime import datetime

from fastapi import APIRouter, HTTPException
from sse_starlette.sse import EventSourceResponse

from core.config import settings
from core.database import get_db
from services.llm import llm
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
    db = await get_db()
    try:
        if session_id:
            rows = await db.execute_fetchall(
                "SELECT * FROM conversations WHERE id = ?",
                (session_id,),
            )
            if rows:
                session = dict(rows[0])
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
    finally:
        await db.close()

    model = (session or {}).get("model") or settings.default_llm_model
    scope = (session or {}).get("scope") or "默认知识库"
    vector_stats = vector_store.stats()
    template_values = {
        "top_k": settings.default_top_k,
        "total_chunks": vector_stats.get("total_chunks", 0),
        "scope": scope,
    }
    route_values = {
        "default_llm_model": model,
        "default_embedding_model": settings.default_embedding_model,
        "default_rerank_model": settings.default_rerank_model,
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
        "routing": [
            {
                "label": row["label"],
                "value": route_values.get(row["value_key"], row["value_key"]),
                "kind": row["kind"],
            }
            for row in route_rows
        ],
        "audit": {
            "enabled": settings.audit_enabled,
            "title": "审计链路已记录" if settings.audit_enabled else "审计链路未开启",
            "description": "请求、检索、引用和权限策略完整留痕",
        },
        "scope": scope,
        "stats": vector_stats,
    }


@router.get("/sessions")
async def list_sessions():
    db = await get_db()
    try:
        rows = await db.execute_fetchall(
            "SELECT * FROM conversations ORDER BY updated_at DESC"
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
    db = await get_db()
    try:
        await db.execute(
            """
            INSERT INTO conversations (id, title, model, scope, preview, tags)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                data.get("id", ""),
                data.get("title", "新会话"),
                data.get("model", settings.default_llm_model),
                data.get("scope", ""),
                data.get("preview", ""),
                json.dumps(data.get("tags", []), ensure_ascii=False),
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
    for key, column in allowed_fields.items():
        if key not in data:
            continue
        value = data[key]
        if key == "starred":
            value = 1 if value else 0
        elif key == "tags":
            value = json.dumps(value if isinstance(value, list) else [], ensure_ascii=False)
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

    result = await rag.query(
        question=question,
        knowledge_base_id=data.get("knowledge_base_id"),
        top_k=data.get("top_k", settings.default_top_k),
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
    model = data.get("model", "") or settings.default_llm_model

    if conv_id:
        await _insert_user_message(conv_id, question, now)

    chunks = await vector_store.search(
        question,
        top_k=data.get("top_k", settings.default_top_k),
        knowledge_base_id=data.get("knowledge_base_id"),
    )
    context = "\n\n".join(
        f"[{chunk.get('knowledge_base_id', 'unknown')}] {chunk['content']}"
        for chunk in chunks
    )
    system_prompt = (
        "你是企业 AI 工作台助手。回答应基于以下知识库内容，重要结论需要给出引用来源；"
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
            async for chunk in llm.chat_completion_stream(model=model, messages=messages):
                try:
                    parsed = json.loads(chunk)
                    delta = (
                        parsed.get("choices", [{}])[0]
                        .get("delta", {})
                        .get("content", "")
                    )
                    if delta:
                        full_text += delta
                        yield {
                            "data": json.dumps(
                                {"type": "token", "content": delta},
                                ensure_ascii=False,
                            )
                        }
                except json.JSONDecodeError:
                    if chunk.strip():
                        full_text += chunk
                        yield {
                            "data": json.dumps(
                                {"type": "token", "content": chunk},
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
                        "model": model,
                        "citations": citations,
                    },
                    ensure_ascii=False,
                )
            }
            if conv_id:
                await _insert_assistant_message(conv_id, full_text, model, citations, now)

    return EventSourceResponse(generate())


async def _insert_user_message(conv_id: str, question: str, now: str):
    db = await get_db()
    try:
        await db.execute(
            "INSERT INTO messages (id, conversation_id, role, content) VALUES (?, ?, ?, ?)",
            (f"u-{conv_id}-{now}", conv_id, "user", question),
        )
        await db.commit()
    finally:
        await db.close()


async def _insert_assistant_message(
    conv_id: str,
    content: str,
    model: str,
    citations: list[dict],
    now: str,
):
    db = await get_db()
    try:
        await db.execute(
            """
            INSERT INTO messages (id, conversation_id, role, content, model, citations)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                f"a-{conv_id}-{now}",
                conv_id,
                "assistant",
                content,
                model,
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
        result.get("citations", []),
        now,
    )
