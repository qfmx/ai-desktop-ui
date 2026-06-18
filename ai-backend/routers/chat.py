import json
from datetime import datetime

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from sse_starlette.sse import EventSourceResponse

from core.database import get_db
from services.llm import llm
from services.rag import rag

router = APIRouter(prefix="/api/chat", tags=["chat"])


@router.get("/sessions")
async def list_sessions():
    db = await get_db()
    try:
        rows = await db.execute_fetchall(
            "SELECT * FROM conversations ORDER BY updated_at DESC"
        )
        return [dict(r) for r in rows]
    finally:
        await db.close()


@router.get("/sessions/{session_id}")
async def get_session(session_id: str):
    db = await get_db()
    try:
        row = await db.execute_fetchall(
            "SELECT * FROM conversations WHERE id = ?", (session_id,)
        )
        if not row:
            raise HTTPException(404, "Session not found")
        session = dict(row[0])
        msgs = await db.execute_fetchall(
            "SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at", (session_id,)
        )
        session["messages"] = [dict(m) for m in msgs]
        return session
    finally:
        await db.close()


@router.post("/sessions")
async def create_session(data: dict):
    db = await get_db()
    try:
        await db.execute(
            "INSERT INTO conversations (id, title, model, scope, preview, tags) VALUES (?, ?, ?, ?, ?, ?)",
            (
                data.get("id", ""),
                data.get("title", "新会话"),
                data.get("model", ""),
                data.get("scope", ""),
                data.get("preview", ""),
                json.dumps(data.get("tags", []), ensure_ascii=False),
            ),
        )
        await db.commit()
        return {"ok": True, "id": data.get("id")}
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
        top_k=data.get("top_k", 8),
        model=data.get("model", ""),
    )
    conv_id = data.get("session_id", "")
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    if conv_id:
        db = await get_db()
        try:
            await db.execute(
                "INSERT INTO messages (id, conversation_id, role, content, model, citations) VALUES (?, ?, ?, ?, ?, ?)",
                (
                    f"u-{conv_id}-{now}",
                    conv_id,
                    "user",
                    question,
                    "",
                    "[]",
                ),
            )
            answer_text = result.get("answer", "")
            await db.execute(
                "INSERT INTO messages (id, conversation_id, role, content, model, tokens, citations) VALUES (?, ?, ?, ?, ?, ?, ?)",
                (
                    f"a-{conv_id}-{now}",
                    conv_id,
                    "assistant",
                    answer_text,
                    result.get("model", ""),
                    0,
                    json.dumps(result.get("citations", []), ensure_ascii=False),
                ),
            )
            await db.execute(
                "UPDATE conversations SET updated_at = ?, message_count = message_count + 2 WHERE id = ?",
                (now, conv_id),
            )
            await db.commit()
        finally:
            await db.close()
    return result


@router.post("/ask/stream")
async def ask_stream(data: dict):
    question = data.get("question", "")
    if not question:
        raise HTTPException(400, "question is required")

    conv_id = data.get("session_id", "")
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    model = data.get("model", "") or "gpt-4o-mini"

    if conv_id:
        db = await get_db()
        try:
            await db.execute(
                "INSERT INTO messages (id, conversation_id, role, content) VALUES (?, ?, ?, ?)",
                (f"u-{conv_id}-{now}", conv_id, "user", question),
            )
            await db.commit()
        finally:
            await db.close()

    # Retrieve RAG context
    chunks = await rag.vector_store.search(
        question,
        top_k=data.get("top_k", 8),
        knowledge_base_id=data.get("knowledge_base_id"),
    )
    context = "\n\n".join(
        f"[{c.get('knowledge_base_id', 'unknown')}] {c['content']}"
        for c in chunks
    )
    system_prompt = (
        "你是企业 AI 工作台助手。回答应基于以下知识库内容，重要结论需要给出引用来源；"
        "当证据不足时明确说明不确定性。\n\n知识库内容：\n" + context
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
                    data = json.loads(chunk)
                    delta = (
                        data.get("choices", [{}])[0]
                        .get("delta", {})
                        .get("content", "")
                    )
                    if delta:
                        full_text += delta
                        yield json.dumps({"type": "token", "content": delta}, ensure_ascii=False) + "\n"
                except json.JSONDecodeError:
                    if chunk.strip():
                        full_text += chunk
                        yield json.dumps({"type": "token", "content": chunk}, ensure_ascii=False) + "\n"
        finally:
            yield json.dumps({
                "type": "done",
                "content": full_text,
                "model": model,
                "citations": [{"id": c.get("id", ""), "content": c["content"][:200]} for c in chunks[:5]],
            }, ensure_ascii=False) + "\n"

            if conv_id:
                db2 = await get_db()
                try:
                    await db2.execute(
                        "INSERT INTO messages (id, conversation_id, role, content, model) VALUES (?, ?, ?, ?, ?)",
                        (f"a-{conv_id}-{now}", conv_id, "assistant", full_text, model),
                    )
                    await db2.execute(
                        "UPDATE conversations SET updated_at = ?, message_count = message_count + 1 WHERE id = ?",
                        (now, conv_id),
                    )
                    await db2.commit()
                finally:
                    await db2.close()

    return EventSourceResponse(generate())
