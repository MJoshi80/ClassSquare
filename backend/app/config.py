from pydantic_settings import BaseSettings, SettingsConfigDict

from pydantic import field_validator

class Settings(BaseSettings):
    SECRET_KEY: str = "opticlass-ai-cloud-deployment-secret-key-change-in-prod"
    DATABASE_URL: str = "sqlite:///./data/opticlass.db"
    ACCESS_TOKEN_EXPIRE_HOURS: int = 8
    ALGORITHM: str = "HS256"

    @field_validator("DATABASE_URL", mode="before")
    @classmethod
    def fix_postgres_url(cls, v: str) -> str:
        if isinstance(v, str) and v.startswith("postgres://"):
            return v.replace("postgres://", "postgresql://", 1)
        return v

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

settings = Settings()
