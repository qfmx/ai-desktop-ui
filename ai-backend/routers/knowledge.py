import json

from fastapi import APIRouter, HTTPException

from core.database import get_db
from core.config import settings
from services.document import doc_service
from services.rag import vector_store

router = APIRouter(prefix="/api/knowledge", tags=["knowledge"])


@router.get("/bases")
async def list_bases():
    db = await get_db()
    try:
        rows = await db.execute_fetchall("SELECT * FROM knowledge_bases ORDER BY updated_at DESC")
        return [dict(r) for r in rows]
    finally:
        await db.close()


@router.post("/bases")
async def create_base(data: dict):
    db = await get_db()
    try:
        await db.execute(
            "INSERT INTO knowledge_bases (id, name, description, embedding_model, owner, tags) VALUES (?, ?, ?, ?, ?, ?)",
            (
                data.get("id", ""),
                data.get("name", ""),
                data.get("description", ""),
                data.get("embedding_model", settings.default_embedding_model),
                data.get("owner", ""),
                json.dumps(data.get("tags", []), ensure_ascii=False),
            ),
        )
        await db.commit()
        return {"ok": True, "id": data.get("id")}
    finally:
        await db.close()


@router.delete("/bases/{base_id}")
async def delete_base(base_id: str):
    removed = vector_store.remove_by_kb(base_id)
    db = await get_db()
    try:
        await db.execute("DELETE FROM knowledge_bases WHERE id = ?", (base_id,))
        await db.commit()
        return {"ok": True, "chunks_removed": removed}
    finally:
        await db.close()


@router.post("/bases/{base_id}/upload")
async def upload_document(base_id: str, data: dict):
    file_path = data.get("file_path", "")
    if not file_path:
        raise HTTPException(400, "file_path is required")
    chunks = await doc_service.parse(file_path)
    await vector_store.add_chunks(chunks, base_id)
    db = await get_db()
    try:
        row = await db.execute_fetchall(
            "SELECT documents FROM knowledge_bases WHERE id = ?", (base_id,)
        )
        if row:
            current = row[0][0]
            await db.execute(
                "UPDATE knowledge_bases SET documents = ?, updated_at = datetime('now','localtime') WHERE id = ?",
                (current + len(chunks), base_id),
            )
            await db.commit()
    finally:
        await db.close()
    return {"ok": True, "chunks_added": len(chunks)}


@router.get("/stats")
async def stats():
    return vector_store.stats()
