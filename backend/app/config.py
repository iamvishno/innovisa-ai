from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql://postgres:postgres@localhost:5432/innovisa"
    ANTHROPIC_API_KEY: str = ""
    OPENAI_API_KEY: str = ""
    SECRET_KEY: str = "change-me-to-a-random-string-at-least-32-characters-long"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60  # 1 hour
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    FRONTEND_URL: str = "http://localhost:3000"
    CHROMA_PERSIST_DIRECTORY: str = "./chroma_db"
    APIFY_API_KEY: str = ""

    # DB pool tuning
    DB_POOL_SIZE: int = 5
    DB_MAX_OVERFLOW: int = 10

    # Rate limiting
    RATE_LIMIT_PER_MINUTE: int = 100
    AUTH_RATE_LIMIT_PER_MINUTE: int = 10

    # Claude model
    CLAUDE_MODEL: str = "claude-sonnet-4-20250514"
    EMBEDDING_MODEL: str = "text-embedding-3-large"
    EMBEDDING_DIMENSIONS: int = 1536

    # RAG tuning
    CHUNK_SIZE_TOKENS: int = 800
    CHUNK_OVERLAP_TOKENS: int = 150
    RAG_CONTEXT_BUDGET_TOKENS: int = 15000
    RAG_TOP_K: int = 20

    model_config = {"env_file": ".env", "extra": "ignore"}


@lru_cache()
def get_settings() -> Settings:
    return Settings()
