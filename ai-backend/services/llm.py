import json
from typing import Any

import httpx

from services.model_provider import ResolvedModelConfig, resolve_model_config


class LLMService:
    def __init__(self):
        self._http = httpx.AsyncClient(timeout=120)

    async def chat_completion(
        self,
        model_config: ResolvedModelConfig,
        messages: list[dict],
        temperature: float | None = None,
        max_tokens: int | None = None,
        stream: bool = False,
    ) -> dict[str, Any]:
        if model_config.protocol_type == "anthropic":
            raw = await self._anthropic_chat(model_config, messages, temperature, max_tokens, stream)
            return {"content": self._anthropic_content(raw), "raw": raw}
        if model_config.protocol_type == "ollama":
            raw = await self._ollama_chat(model_config, messages, temperature, max_tokens, stream)
            return {"content": self._ollama_content(raw), "raw": raw}
        raw = await self._openai_chat(model_config, messages, temperature, max_tokens, stream)
        return {"content": self._openai_content(raw), "raw": raw}

    async def chat_completion_stream(
        self,
        model_config: ResolvedModelConfig,
        messages: list[dict],
        temperature: float | None = None,
        max_tokens: int | None = None,
    ):
        if model_config.protocol_type == "ollama":
            async for token in self._ollama_chat_stream(model_config, messages, temperature):
                yield token
            return
        if model_config.protocol_type == "anthropic":
            result = await self.chat_completion(model_config, messages, temperature, max_tokens, stream=False)
            if result["content"]:
                yield result["content"]
            return
        async for token in self._openai_chat_stream(model_config, messages, temperature, max_tokens):
            yield token

    async def _openai_chat(
        self,
        model_config: ResolvedModelConfig,
        messages: list[dict],
        temperature: float | None,
        max_tokens: int | None,
        stream: bool,
    ) -> dict:
        body: dict[str, Any] = {
            "model": model_config.model_name,
            "messages": messages,
            "stream": stream,
        }
        if temperature is not None:
            body["temperature"] = temperature
        if max_tokens is not None:
            body["max_tokens"] = max_tokens
        headers = {"Content-Type": "application/json"}
        if model_config.api_key:
            headers["Authorization"] = f"Bearer {model_config.api_key}"
        resp = await self._http.post(
            f"{model_config.base_url}/chat/completions",
            headers=headers,
            json=body,
        )
        resp.raise_for_status()
        return resp.json()

    async def _openai_chat_stream(
        self,
        model_config: ResolvedModelConfig,
        messages: list[dict],
        temperature: float | None,
        max_tokens: int | None,
    ):
        body: dict[str, Any] = {
            "model": model_config.model_name,
            "messages": messages,
            "stream": True,
        }
        if temperature is not None:
            body["temperature"] = temperature
        if max_tokens is not None:
            body["max_tokens"] = max_tokens
        headers = {"Content-Type": "application/json"}
        if model_config.api_key:
            headers["Authorization"] = f"Bearer {model_config.api_key}"
        async with self._http.stream(
            "POST",
            f"{model_config.base_url}/chat/completions",
            headers=headers,
            json=body,
        ) as resp:
            resp.raise_for_status()
            async for line in resp.aiter_lines():
                if not line.startswith("data: "):
                    continue
                data = line[6:]
                if data.strip() == "[DONE]":
                    break
                try:
                    parsed = json.loads(data)
                except json.JSONDecodeError:
                    continue
                delta = (
                    parsed.get("choices", [{}])[0]
                    .get("delta", {})
                    .get("content", "")
                )
                if delta:
                    yield delta

    async def _anthropic_chat(
        self,
        model_config: ResolvedModelConfig,
        messages: list[dict],
        temperature: float | None,
        max_tokens: int | None,
        stream: bool,
    ) -> dict:
        next_messages = [dict(message) for message in messages]
        system_msg = None
        if next_messages and next_messages[0].get("role") == "system":
            system_msg = next_messages.pop(0)["content"]
        body: dict[str, Any] = {
            "model": model_config.model_name,
            "max_tokens": max_tokens or 4096,
            "messages": next_messages,
            "stream": stream,
        }
        if system_msg:
            body["system"] = system_msg
        if temperature is not None:
            body["temperature"] = temperature
        headers = {
            "x-api-key": model_config.api_key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        }
        resp = await self._http.post(
            f"{model_config.base_url}/messages",
            headers=headers,
            json=body,
        )
        resp.raise_for_status()
        return resp.json()

    async def _ollama_chat(
        self,
        model_config: ResolvedModelConfig,
        messages: list[dict],
        temperature: float | None,
        max_tokens: int | None,
        stream: bool,
    ) -> dict:
        body: dict[str, Any] = {
            "model": model_config.model_name,
            "messages": messages,
            "stream": stream,
        }
        if temperature is not None:
            body["options"] = {"temperature": temperature}
        if max_tokens is not None:
            body.setdefault("options", {})["num_predict"] = max_tokens
        resp = await self._http.post(f"{model_config.base_url}/api/chat", json=body)
        resp.raise_for_status()
        return resp.json()

    async def _ollama_chat_stream(
        self,
        model_config: ResolvedModelConfig,
        messages: list[dict],
        temperature: float | None,
    ):
        body: dict[str, Any] = {
            "model": model_config.model_name,
            "messages": messages,
            "stream": True,
        }
        if temperature is not None:
            body["options"] = {"temperature": temperature}
        async with self._http.stream("POST", f"{model_config.base_url}/api/chat", json=body) as resp:
            resp.raise_for_status()
            async for line in resp.aiter_lines():
                if not line.strip():
                    continue
                try:
                    parsed = json.loads(line)
                except json.JSONDecodeError:
                    continue
                token = parsed.get("message", {}).get("content", "")
                if token:
                    yield token
                if parsed.get("done"):
                    break

    async def embedding(
        self,
        texts: list[str],
        model_config_id: str | None = None,
    ) -> list[list[float]]:
        model_config = await resolve_model_config(model_config_id, purpose="embedding")
        if model_config.protocol_type == "ollama":
            return await self._ollama_embedding(texts, model_config)
        if model_config.protocol_type == "anthropic":
            raise RuntimeError("Anthropic protocol does not support embeddings in this application")
        return await self._openai_embedding(texts, model_config)

    async def _openai_embedding(
        self,
        texts: list[str],
        model_config: ResolvedModelConfig,
    ) -> list[list[float]]:
        headers = {"Content-Type": "application/json"}
        if model_config.api_key:
            headers["Authorization"] = f"Bearer {model_config.api_key}"
        resp = await self._http.post(
            f"{model_config.base_url}/embeddings",
            headers=headers,
            json={"model": model_config.model_name, "input": texts},
        )
        resp.raise_for_status()
        data = resp.json()
        return [item["embedding"] for item in data["data"]]

    async def _ollama_embedding(
        self,
        texts: list[str],
        model_config: ResolvedModelConfig,
    ) -> list[list[float]]:
        embeddings: list[list[float]] = []
        for text in texts:
            resp = await self._http.post(
                f"{model_config.base_url}/api/embeddings",
                json={"model": model_config.model_name, "prompt": text},
            )
            resp.raise_for_status()
            data = resp.json()
            embedding = data.get("embedding")
            if not isinstance(embedding, list):
                raise RuntimeError("Ollama embedding response is missing embedding")
            embeddings.append(embedding)
        return embeddings

    def _openai_content(self, payload: dict) -> str:
        return (
            payload.get("choices", [{}])[0]
            .get("message", {})
            .get("content", "")
        )

    def _anthropic_content(self, payload: dict) -> str:
        content = payload.get("content", [])
        if isinstance(content, str):
            return content
        if not isinstance(content, list):
            return ""
        return "".join(
            item.get("text", "")
            for item in content
            if isinstance(item, dict) and item.get("text")
        )

    def _ollama_content(self, payload: dict) -> str:
        return payload.get("message", {}).get("content", "") or payload.get("response", "")


llm = LLMService()
