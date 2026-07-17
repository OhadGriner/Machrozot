from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+asyncpg://machrozot:machrozot@localhost:5432/machrozot"
    redis_url: str = "redis://localhost:6379"
    secret_key: str = "change-me-in-production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24 * 7  # 1 week
    cors_origins: list[str] = ["http://localhost:5173"]
    google_client_id: str = ""
    # Comma-separated string, not list[str] — pydantic-settings JSON-parses
    # list-typed env vars, which makes plain "a@x.com,b@y.com" values crash.
    admin_emails: str = ""

    @property
    def admin_email_list(self) -> set[str]:
        return {e.strip().lower() for e in self.admin_emails.split(",") if e.strip()}


settings = Settings()
