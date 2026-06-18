import hashlib
import json
from pathlib import Path
from typing import Any

import numpy as np

from core.config import settings
from services.llm import llm


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
        self._index_file.write_text(json.dumps(self._chunks, ensure_ascii=False, indent=2), encoding="utf-8")
        if self._vectors is not None:
            np.save(str(self._vectors_file), self._vectors)

    async def add_chunks(self, chunks: list[dict[str, Any]], knowledge_base_id: str):
        texts = [c["content"] for c in chunks]
        embeddings = await llm.embedding(texts)
        for i, chunk in enumerate(chunks):
            chunk["id"] = hashlib.md5(chunk["content"].encode()).hexdigest()[:12]
            chunk["knowledge_base_id"] = knowledge_base_id
        self._chunks.extend(chunks)
        new_vectors = np.array(embeddings, dtype=np.float32)
        if self._vectors is None:
            self._vectors = new_vectors
        else:
            self._vectors = np.vstack([self._vectors, new_vectors])
        self._save()

    async def search(self, query: str, top_k: int = 8, knowledge_base_id: str | None = None) -> list[dict]:
        if not self._chunks or self._vectors is None:
            return []
        query_emb = (await llm.embedding([query]))[0]
        query_vec = np.array(query_emb, dtype=np.float32)
        scores = np.dot(self._vectors, query_vec)
        indices = np.argsort(scores)[::-1][:top_k]
        results = []
        for idx in indices:
            chunk = self._chunks[int(idx)]
            if knowledge_base_id and chunk.get("knowledge_base_id") != knowledge_base_id:
                continue
            results.append({**chunk, "score": float(scores[int(idx)])})
        return results

    def get_chunks_by_kb(self, knowledge_base_id: str) -> list[dict]:
        return [c for c in self._chunks if c.get("knowledge_base_id") == knowledge_base_id]

    def remove_by_kb(self, knowledge_base_id: str):
        keep = [c for c in self._chunks if c.get("knowledge_base_id") != knowledge_base_id]
        removed = len(self._chunks) - len(keep)
        self._chunks = keep
        self._rebuild_vectors()
        self._save()
        return removed

    def _rebuild_vectors(self):
        classes = list({c["knowledge_base_id"] for c in self._chunks})
        if not classes:
            self._vectors = None
            return
        all_vectors = []
        for c in self._chunks:
            vec = getattr(c, "_vec", None)
            if vec is not None:
                all_vectors.append(vec)
        self._vectors = np.array(all_vectors, dtype=np.float32) if all_vectors else None

    def stats(self) -> dict:
        return {
            "total_chunks": len(self._chunks),
            "knowledge_bases": len({c.get("knowledge_base_id") for c in self._chunks}),
            "vector_dim": self._vectors.shape[1] if self._vectors is not None else 0,
        }


vector_store = VectorStore()


class RAGService:
    async def query(
        self,
        question: str,
        knowledge_base_id: str | None = None,
        top_k: int = 8,
        model: str = "",
    ) -> dict[str, Any]:
        chunks = await vector_store.search(question, top_k=top_k, knowledge_base_id=knowledge_base_id)
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
        result = await llm.chat_completion(
            model=model or settings.default_llm_model,
            messages=messages,
            temperature=settings.default_temperature,
            max_tokens=4096,
        )
        citations = [{"id": c.get("id", ""), "content": c["content"][:200], "score": c["score"]} for c in chunks[:5]]
        return {
            "answer": result.get("choices", [{}])[0].get("message", {}).get("content", ""),
            "citations": citations,
            "chunks_retrieved": len(chunks),
            "model": model or settings.default_llm_model,
        }


rag = RAGService()
