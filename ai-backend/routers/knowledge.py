import json

from fastapi import APIRouter, HTTPException

from core.config import settings
from core.database import get_db
from services.document import doc_service
from services.rag import vector_store

router = APIRouter(prefix="/api/knowledge", tags=["knowledge"])


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


def _format_size(documents: int, chunks: int) -> str:
    estimated_mb = max(1, round((documents * 0.08) + (chunks * 0.004)))
    if estimated_mb >= 1024:
        return f"{estimated_mb / 1024:.1f} GB"
    return f"{estimated_mb} MB"


def _health_for_status(status: str, chunks: int) -> int:
    if status == "ready":
        return 96 if chunks else 90
    if status == "syncing":
        return 84
    return 70


@router.get("/bases")
async def list_bases():
    vector_stats = vector_store.stats()
    chunk_counts = vector_stats.get("by_knowledge_base", {})
    db = await get_db()
    try:
        rows = await db.execute_fetchall("SELECT * FROM knowledge_bases ORDER BY updated_at DESC")
        result = []
        for row in rows:
            base = dict(row)
            chunks = int(chunk_counts.get(base["id"], 0))
            documents = int(base.get("documents") or 0)
            base["tags"] = _json_list(base.get("tags"))
            base["chunks"] = chunks
            base["size"] = _format_size(documents, chunks)
            base["health"] = _health_for_status(base.get("status", "ready"), chunks)
            result.append(base)
        return result
    finally:
        await db.close()


@router.post("/bases")
async def create_base(data: dict):
    db = await get_db()
    try:
        await db.execute(
            """
            INSERT INTO knowledge_bases
                (id, name, description, embedding_model, owner, tags)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                data.get("id", ""),
                data.get("name", ""),
                data.get("description", ""),
                data.get("embedding_model", settings.default_embedding_model),
                data.get("owner", ""),
                json.dumps(data.get("tags", []), ensure_ascii=False),
            ),
        )
        await db.execute(
            """
            INSERT OR IGNORE INTO knowledge_access_policies
                (knowledge_base_id, roles, policy)
            VALUES (?, ?, ?)
            """,
            (
                data.get("id", ""),
                json.dumps(data.get("access_roles", ["全员"]), ensure_ascii=False),
                data.get("access_policy", "全员可读"),
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
        await db.execute("DELETE FROM knowledge_access_policies WHERE knowledge_base_id = ?", (base_id,))
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
        rows = await db.execute_fetchall(
            "SELECT documents FROM knowledge_bases WHERE id = ?",
            (base_id,),
        )
        if rows:
            current = rows[0]["documents"]
            await db.execute(
                """
                UPDATE knowledge_bases
                SET documents = ?, updated_at = datetime('now','localtime')
                WHERE id = ?
                """,
                (current + 1, base_id),
            )
            await db.commit()
    finally:
        await db.close()
    return {"ok": True, "chunks_added": len(chunks)}


@router.get("/stats")
async def stats():
    vector_stats = vector_store.stats()
    db = await get_db()
    try:
        rows = await db.execute_fetchall(
            "SELECT COUNT(*) AS bases, COALESCE(SUM(documents), 0) AS documents FROM knowledge_bases"
        )
        row = dict(rows[0]) if rows else {"bases": 0, "documents": 0}
        return {
            "bases": row["bases"],
            "documents": row["documents"],
            "chunks": vector_stats["total_chunks"],
            "vector_dim": vector_stats["vector_dim"],
        }
    finally:
        await db.close()


@router.get("/access-matrix")
async def access_matrix():
    db = await get_db()
    try:
        rows = await db.execute_fetchall(
            """
            SELECT
                kb.id,
                kb.name,
                kb.owner,
                COALESCE(kap.roles, '["全员"]') AS roles,
                COALESCE(kap.policy, '全员可读') AS policy
            FROM knowledge_bases kb
            LEFT JOIN knowledge_access_policies kap
                ON kap.knowledge_base_id = kb.id
            ORDER BY kb.updated_at DESC
            """
        )
        matrix = []
        for row in rows:
            base = dict(row)
            matrix.append(
                {
                    "id": base["id"],
                    "name": base["name"],
                    "owner": base["owner"],
                    "roles": _json_list(base.get("roles"), ["全员"]),
                    "policy": base.get("policy") or "全员可读",
                }
            )
        return matrix
    finally:
        await db.close()
