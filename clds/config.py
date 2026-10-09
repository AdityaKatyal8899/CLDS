"""Configuration management for CLDS."""

import os
from pathlib import Path
from typing import Optional
from dotenv import load_dotenv

# Load .env file from project root if present
load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent

class Settings:
    """Application settings."""

    def __init__(self):
        self._db_path: Optional[Path] = None
        self._export_dir: Optional[Path] = None
        self._mongodb_uri: Optional[str] = None
        self._mongodb_database: Optional[str] = None

    @property
    def mongodb_uri(self) -> str:
        if self._mongodb_uri is not None:
            return self._mongodb_uri
        return os.getenv("MONGODB_URI", "").strip()

    @mongodb_uri.setter
    def mongodb_uri(self, val: Optional[str]) -> None:
        self._mongodb_uri = val

    @property
    def mongodb_database(self) -> str:
        if self._mongodb_database is not None:
            return self._mongodb_database
        return os.getenv("MONGODB_DATABASE", "clds").strip() or "clds"

    @mongodb_database.setter
    def mongodb_database(self, val: Optional[str]) -> None:
        self._mongodb_database = val

    @property
    def google_maps_api_key(self) -> str:
        key = os.getenv("GOOGLE_MAPS_API_KEY", "").strip()
        return key

    @property
    def db_path(self) -> Path:
        if self._db_path is not None:
            return self._db_path
        custom_path = os.getenv("CLDS_DB_PATH")
        if custom_path:
            p = Path(custom_path)
            return p if p.is_absolute() else BASE_DIR / p
        return BASE_DIR / "data" / "clds.db"

    @db_path.setter
    def db_path(self, val: Optional[Path]) -> None:
        self._db_path = Path(val) if val is not None else None

    @property
    def export_dir(self) -> Path:
        if self._export_dir is not None:
            return self._export_dir
        custom_dir = os.getenv("CLDS_EXPORT_DIR")
        if custom_dir:
            p = Path(custom_dir)
            return p if p.is_absolute() else BASE_DIR / p
        return BASE_DIR / "data" / "exports"

    @export_dir.setter
    def export_dir(self, val: Optional[Path]) -> None:
        self._export_dir = Path(val) if val is not None else None


settings = Settings()
