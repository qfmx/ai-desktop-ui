from typing import Any

import httpx

from core.config import settings


class LLMService:
    def __init__(self):
        self._http = httpx.AsyncClient(timeout=120)

    async def chat_completion(
        self,
        model: str,
        messages: list[dict],
        temperature: float | None = None,
        max_tokens: int | None = None,
        stream: bool = False,
    ) -> dict[str, Any]:
        provider = self._resolve_provider(model)
        if provider == "openai":
            return await self._openai_chat(model, messages, temperature, max_tokens, stream)
        elif provider == "anthropic":
            return await self._anthropic_chat(model, messages, temperature, max_tokens, stream)
        elif provider == "ollama":
            return await self._ollama_chat(model, messages, temperature, max_tokens, stream)
        return {"error": f"Unknown provider for model: {model}"}

    def _resolve_provider(self, model: str) -> str:
        model_lower = model.lower()
        if any(k in model_lower for k in ("gpt", "o1", "o3", "text-embedding")):
            return "openai"
        if any(k in model_lower for k in ("claude",)):
            return "anthropic"
        if any(k in model_lower for k in ("qwen", "llama", "deepseek")):
            return "ollama"
        return "openai"

    async def _openai_chat(self, model: str, messages: list[dict], temperature: float | None, max_tokens: int | None, stream: bool) -> dict:
        body = {"model": model, "messages": messages, "stream": stream}
        if temperature is not None:
            body["temperature"] = temperature
        if max_tokens is not None:
            body["max_tokens"] = max_tokens
        resp = await self._http.post(
            f"{settings.openai_base_url}/chat/completions",
            headers={"Authorization": f"Bearer {settings.openai_api_key}"},
            json=body,
        )
        resp.raise_for_status()
        return resp.json()

    async def _openai_chat_stream(self, model: str, messages: list[dict], temperature: float | None, max_tokens: int | None):
        body = {"model": model, "messages": messages, "stream": True}
        if temperature is not None:
            body["temperature"] = temperature
        if max_tokens is not None:
            body["max_tokens"] = max_tokens
        async with self._http.stream(
            "POST",
            f"{settings.openai_base_url}/chat/completions",
            headers={"Authorization": f"Bearer {settings.openai_api_key}"},
            json=body,
        ) as resp:
            resp.raise_for_status()
            async for line in resp.aiter_lines():
                if line.startswith("data: "):
                    data = line[6:]
                    if data.strip() == "[DONE]":
                        break
                    yield data

    async def chat_completion_stream(self, model: str, messages: list[dict], temperature: float | None = None, max_tokens: int | None = None):
        provider = self._resolve_provider(model)
        if provider == "openai":
            async for chunk in self._openai_chat_stream(model, messages, temperature, max_tokens):
                yield chunk
        elif provider == "ollama":
            body = {"model": model, "messages": messages, "stream": True}
            if temperature is not None:
                body["temperature"] = temperature / 2.0
            async with self._http.stream("POST", f"{settings.ollama_base_url}/api/chat", json=body) as resp:
                resp.raise_for_status()
                async for line in resp.aiter_lines():
                    if line.strip():
                        yield line
        else:
            result = await self.chat_completion(model, messages, temperature, max_tokens, stream=False)
            yield result.get("choices", [{}])[0].get("message", {}).get("content", "")

    async def _anthropic_chat(self, model: str, messages: list[dict], temperature: float | None, max_tokens: int | None, stream: bool) -> dict:
        system_msg = None
        if messages and messages[0].get("role") == "system":
            system_msg = messages.pop(0)["content"]
        body: dict = {"model": model, "max_tokens": max_tokens or 4096, "messages": messages, "stream": stream}
        if system_msg:
            body["system"] = system_msg
        if temperature is not None:
            body["temperature"] = temperature
        headers = {
            "x-api-key": settings.anthropic_api_key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        }
        resp = await self._http.post("https://api.anthropic.com/v1/messages", headers=headers, json=body)
        resp.raise_for_status()
        return resp.json()

    async def _ollama_chat(self, model: str, messages: list[dict], temperature: float | None, max_tokens: int | None, stream: bool) -> dict:
        body: dict = {"model": model, "messages": messages, "stream": stream}
        if temperature is not None:
            body["temperature"] = temperature / 2.0
        resp = await self._http.post(f"{settings.ollama_base_url}/api/chat", json=body)
        resp.raise_for_status()
        return resp.json()

    async def embedding(self, texts: list[str], model: str = "") -> list[list[float]]:
        model = model or settings.default_embedding_model
        resp = await self._http.post(
            f"{settings.openai_base_url}/embeddings",
            headers={"Authorization": f"Bearer {settings.openai_api_key}"},
            json={"model": model, "input": texts},
        )
        resp.raise_for_status()
        data = resp.json()
        return [item["embedding"] for item in data["data"]]


llm = LLMService()
