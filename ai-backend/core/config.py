from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "AI 工作台"
    host: str = "127.0.0.1"
    port: int = 18888
    log_level: str = "info"

    data_dir: str = "data"
    vector_store_dir: str = "data/vector_store"
    knowledge_dir: str = "data/knowledge"

    openai_api_key: str = ""
    openai_base_url: str = "https://api.openai.com/v1"
    anthropic_api_key: str = ""
    ollama_base_url: str = "http://localhost:11434"

    default_embedding_model: str = "text-embedding-3-large"
    default_rerank_model: str = "bge-reranker-v2"
    default_llm_model: str = "gpt-4o-mini"
    default_temperature: float = 0.4
    default_top_k: int = 8

    audit_enabled: bool = True
    masking_enabled: bool = True

    model_config = {"env_prefix": "AI_", "env_file": ".env"}


settings = Settings()
