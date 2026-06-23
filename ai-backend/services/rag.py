import hashlib
import json
from pathlib import Path
from typing import Any

import numpy as np

from core.config import settings
from core.database import get_db
from services.llm import llm
from services.model_provider import resolve_model_config


async def _runtime_settings() -> dict[str, str]:
    db = await get_db()
    try:
        rows = await db.execute_fetchall("SELECT key, value FROM settings")
        return {row["key"]: row["value"] for row in rows}
    finally:
        await db.close()


def _float_setting(values: dict[str, str], key: str, default: float) -> float:
    try:
        return float(values.get(key, default))
    except (TypeError, ValueError):
        return default


class VectorStore:
    def __init__(self):
        self._store_dir = Path(settings.vector_store_dir)
        self._store_dir.mkdir(parents=True, exist_ok=True)
        self._index_file = self._store_dir / "index.json"
        self._vectors_file = self._store_dir / "vectors.npy"
        self._chunks: list[dict] = []
        self._vectors: np.ndarray | None = None
        self._load()

    def _load(self):
        if self._index_file.exists():
            self._chunks = json.loads(self._index_file.read_text(encoding="utf-8"))
        if self._vectors_file.exists():
            self._vectors = np.load(str(self._vectors_file))

    def _save(self):
        self._index_file.write_text(
            json.dumps(self._chunks, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        if self._vectors is not None:
            np.save(str(self._vectors_file), self._vectors)

    async def add_chunks(self, chunks: list[dict[str, Any]], knowledge_base_id: str):
        texts = [chunk["content"] for chunk in chunks]
        embeddings = await llm.embedding(texts)
        for chunk in chunks:
            chunk["id"] = hashlib.md5(chunk["content"].encode()).hexdigest()[:12]
            chunk["knowledge_base_id"] = knowledge_base_id
        self._chunks.extend(chunks)
        new_vectors = np.array(embeddings, dtype=np.float32)
        if self._vectors is None:
            self._vectors = new_vectors
        else:
            self._vectors = np.vstack([self._vectors, new_vectors])
        self._save()

    async def search(
        self,
        query: str,
        top_k: int = 8,
        knowledge_base_id: str | None = None,
    ) -> list[dict]:
        if not self._chunks or self._vectors is None:
            return []
        query_emb = (await llm.embedding([query]))[0]
        query_vec = np.array(query_emb, dtype=np.float32)
        scores = np.dot(self._vectors, query_vec)
        indices = np.argsort(scores)[::-1]
        results = []
        for idx in indices:
            chunk = self._chunks[int(idx)]
            if knowledge_base_id and chunk.get("knowledge_base_id") != knowledge_base_id:
                continue
            results.append({**chunk, "score": float(scores[int(idx)])})
            if len(results) >= top_k:
                break
        return results

    def get_chunks_by_kb(self, knowledge_base_id: str) -> list[dict]:
        return [chunk for chunk in self._chunks if chunk.get("knowledge_base_id") == knowledge_base_id]

    def remove_by_kb(self, knowledge_base_id: str):
        if not self._chunks:
            return 0
        keep_indices = [
            index
            for index, chunk in enumerate(self._chunks)
            if chunk.get("knowledge_base_id") != knowledge_base_id
        ]
        removed = len(self._chunks) - len(keep_indices)
        self._chunks = [self._chunks[index] for index in keep_indices]
        if self._vectors is not None:
            self._vectors = self._vectors[keep_indices] if keep_indices else None
        self._save()
        return removed

    def stats(self) -> dict:
        by_knowledge_base: dict[str, int] = {}
        for chunk in self._chunks:
            base_id = chunk.get("knowledge_base_id", "unknown")
            by_knowledge_base[base_id] = by_knowledge_base.get(base_id, 0) + 1
        return {
            "total_chunks": len(self._chunks),
            "knowledge_bases": len(by_knowledge_base),
            "vector_dim": self._vectors.shape[1] if self._vectors is not None else 0,
            "by_knowledge_base": by_knowledge_base,
        }


vector_store = VectorStore()


class RAGService:
    async def query(
        self,
        question: str,
        knowledge_base_id: str | None = None,
        top_k: int = 8,
        model_config_id: str | None = None,
        model: str = "",
    ) -> dict[str, Any]:
        runtime_settings = await _runtime_settings()
        chat_model = await resolve_model_config(model_config_id or model or None, purpose="chat")
        chunks = await vector_store.search(
            question,
            top_k=top_k,
            knowledge_base_id=knowledge_base_id,
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
        result = await llm.chat_completion(
            model_config=chat_model,
            messages=messages,
            temperature=_float_setting(runtime_settings, "default_temperature", 0.4),
            max_tokens=4096,
        )
        citations = [
            {
                "id": chunk.get("id", ""),
                "content": chunk["content"][:200],
                "score": chunk["score"],
            }
            for chunk in chunks[:5]
        ]
        return {
            "answer": result.get("content", ""),
            "citations": citations,
            "chunks_retrieved": len(chunks),
            "model": chat_model.display_name,
            "model_config_id": chat_model.id,
        }


rag = RAGService()
