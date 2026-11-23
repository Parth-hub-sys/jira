from pydantic import PositiveInt, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict

class TokenLifetimes(BaseSettings):
    jwt_access_token_ttl_minutes: PositiveInt
    jwt_refresh_token_ttl_minutes: PositiveInt

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


class Settings(TokenLifetimes):
    database_url: str
    jwt_secret: SecretStr | None = None
    jwt_refresh_cookie_secure: bool = True


settings = Settings()
