from pathlib import Path
from typing import Annotated
from urllib.parse import urlsplit

from pydantic import Field, SecretStr, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+psycopg://cost_detective:cost_detective@localhost:5432/cost_detective"
    redis_url: str = "redis://localhost:6379/0"
    jwt_secret: SecretStr = Field(min_length=32)
    google_client_id: str = ""
    google_client_secret: SecretStr = SecretStr("")
    gemini_api_key: SecretStr = SecretStr("")
    gemini_model: str = ""
    app_base_url: str = "http://localhost:8000"
    aws_region: str = "us-east-1"
    price_table_path: Path | None = None
    frontend_origin: str = "http://localhost:5173"
    cost_cache_ttl_seconds: int = Field(default=86400, ge=300, le=604800)
    delivery_channel: str = "none"
    delivery_user_ids: list[Annotated[int, Field(ge=1)]] = Field(default_factory=list)
    weekly_report_day: int = Field(default=0, ge=0, le=6)
    weekly_report_hour: int = Field(default=9, ge=0, le=23)
    weekly_report_minute: int = Field(default=0, ge=0, le=59)
    slack_webhook_url: SecretStr = SecretStr("")
    smtp_host: str = ""
    smtp_port: int = Field(default=587, ge=1, le=65535)
    smtp_username: str = ""
    smtp_password: SecretStr = SecretStr("")
    smtp_from: str = ""
    smtp_starttls: bool = True
    dev_auth_enabled: bool = False

    @property
    def dev_auth_allowed(self) -> bool:
        return self.dev_auth_enabled and all(
            urlsplit(url).hostname in {"localhost", "127.0.0.1", "::1"}
            for url in (self.app_base_url, self.frontend_origin)
        )

    @model_validator(mode="after")
    def validate_dev_auth(self):
        if self.dev_auth_enabled and not self.dev_auth_allowed:
            raise ValueError("Development authentication requires localhost backend and frontend URLs")
        return self

    @field_validator("delivery_channel")
    @classmethod
    def validate_delivery_channel(cls, value: str) -> str:
        if value not in {"none", "email", "slack"}:
            raise ValueError("DELIVERY_CHANNEL must be none, email or slack")
        return value

    @field_validator("slack_webhook_url")
    @classmethod
    def validate_slack_webhook(cls, value: SecretStr) -> SecretStr:
        if value.get_secret_value():
            parsed = urlsplit(value.get_secret_value())
            if (parsed.scheme != "https" or parsed.hostname not in {"hooks.slack.com", "hooks.slack-gov.com"}
                    or not parsed.path.startswith("/services/") or parsed.username or parsed.password or parsed.port not in {None, 443}):
                raise ValueError("Use an HTTPS Slack incoming webhook URL")
        return value

    @field_validator("frontend_origin")
    @classmethod
    def validate_frontend_origin(cls, value: str) -> str:
        parsed = urlsplit(value)
        if (parsed.scheme not in {"http", "https"} or not parsed.hostname or parsed.path not in {"", "/"}
                or parsed.query or parsed.fragment or parsed.username or parsed.password):
            raise ValueError("FRONTEND_ORIGIN must be an HTTP(S) origin without a path")
        return value.rstrip("/")

    @field_validator("app_base_url")
    @classmethod
    def validate_base_url(cls, value: str) -> str:
        parsed = urlsplit(value)
        if parsed.scheme not in {"http", "https"} or not parsed.hostname or parsed.query or parsed.fragment:
            raise ValueError("APP_BASE_URL must be an HTTP(S) URL without query or fragment")
        return value.rstrip("/")


settings = Settings()
