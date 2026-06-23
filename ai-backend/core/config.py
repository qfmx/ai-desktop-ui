from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "AI-Workspace"
    host: str = "127.0.0.1"
    port: int = 18888
    log_level: str = "info"

    data_dir: str = "data"
    vector_store_dir: str = "data/vector_store"
    knowledge_dir: str = "data/knowledge"

    audit_enabled: bool = True
    masking_enabled: bool = True

    model_config = {"env_prefix": "AI_", "env_file": ".env", "extra": "ignore"}


settings = Settings()
