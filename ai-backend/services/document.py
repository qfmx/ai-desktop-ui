import hashlib
from pathlib import Path

from core.config import settings


class DocumentService:
    SUPPORTED_EXTS = {".txt", ".md", ".json", ".csv", ".py", ".yaml", ".yml", ".xml"}

    async def parse(self, file_path: str) -> list[dict]:
        path = Path(file_path)
        if not path.exists():
            raise FileNotFoundError(f"File not found: {file_path}")
        content = path.read_text(encoding="utf-8", errors="replace")
        chunks = self._chunk_text(content, meta={"source": path.name, "path": str(path)})
        return chunks

    def _chunk_text(self, text: str, meta: dict | None = None, chunk_size: int = 512, overlap: int = 64) -> list[dict]:
        chunks = []
        words = list(self._split_sentences(text))
        current = []
        current_len = 0
        for sentence in words:
            current.append(sentence)
            current_len += len(sentence)
            if current_len >= chunk_size:
                content = "".join(current)
                chunks.append({
                    "content": content,
                    **({"meta": meta} if meta else {}),
                })
                overlap_text = self._get_overlap(current, overlap)
                current = [overlap_text] if overlap_text else []
                current_len = len(overlap_text) if overlap_text else 0
        if current:
            chunks.append({
                "content": "".join(current),
                **({"meta": meta} if meta else {}),
            })
        return chunks

    def _split_sentences(self, text: str) -> list[str]:
        import re
        return [s.strip() for s in re.split(r'(?<=[。！？\n])\s*', text) if s.strip()]

    def _get_overlap(self, sentences: list[str], overlap_chars: int) -> str:
        text = "".join(sentences)
        return text[-overlap_chars:] if len(text) > overlap_chars else ""


doc_service = DocumentService()
