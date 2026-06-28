from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+asyncpg://strands:strands@localhost:5432/strands"
    redis_url: str = "redis://localhost:6379"
    secret_key: str = "change-me-in-production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24 * 7  # 1 week
    cors_origins: list[str] = ["http://localhost:5173"]
    admin_password: str  # required — set ADMIN_PASSWORD env var, never commit a value


settings = Settings()
