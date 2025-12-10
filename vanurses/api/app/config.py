from pydantic_settings import BaseSettings
from typing import Optional
from functools import lru_cache


class Settings(BaseSettings):
    # Database
    database_url: str = "postgresql://vanurses_app:VaNurses2025Secure@localhost:5432/vanurses"

    # Zitadel
    zitadel_issuer: str = "http://localhost:8088"
    zitadel_client_id: str = ""  # Set after Zitadel setup

    # API
    api_host: str = "0.0.0.0"
    api_port: int = 5011
    cors_origins: list[str] = ["http://localhost:5173", "https://www.vanurses.net"]

    # Email / SMTP
    smtp_host: str = "192.168.0.132"
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from_email: str = "jobs@vanurses.net"
    smtp_from_name: str = "VANurses Job Alerts"
    smtp_use_tls: bool = True
    smtp_verify_certs: bool = False

    # Stripe Configuration
    stripe_secret_key: str = ""
    stripe_publishable_key: str = ""
    stripe_webhook_secret: str = ""

    # Stripe Price IDs - Subscriptions
    stripe_price_facilities_monthly: str = ""
    stripe_price_facilities_yearly: str = ""
    stripe_price_starter_monthly: str = ""
    stripe_price_starter_yearly: str = ""
    stripe_price_pro_monthly: str = ""
    stripe_price_pro_yearly: str = ""
    stripe_price_premium_monthly: str = ""
    stripe_price_premium_yearly: str = ""
    stripe_price_hr_monthly: str = ""
    stripe_price_hr_yearly: str = ""

    # Stripe Price IDs - Token Packs
    stripe_price_tokens_small: str = ""
    stripe_price_tokens_medium: str = ""
    stripe_price_tokens_large: str = ""

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"  # Ignore extra environment variables


@lru_cache()
def get_settings() -> Settings:
    return Settings()
