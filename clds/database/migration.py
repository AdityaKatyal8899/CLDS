"""Migration utility to transfer historical CLDS data from SQLite to MongoDB."""

from pathlib import Path
from typing import Any, Dict, List, Optional
from clds.config import settings
from clds.database.mongodb import MongoDBDatabase
from clds.database.sqlite_legacy import SQLiteDatabase


def migrate_sqlite_to_mongodb(
    sqlite_path: Optional[Path] = None,
    mongo_db: Optional[MongoDBDatabase] = None,
) -> Dict[str, Any]:
    """
    Migrate leads and Stage 2 verification records from SQLite to MongoDB Atlas.
    Preserves all timestamps, raw verification signals, and lead associations.
    """
    db_file = Path(sqlite_path) if sqlite_path else settings.db_path
    sqlite_reader = SQLiteDatabase(db_file)

    if not sqlite_reader.exists():
        return {
            "status": "no_data",
            "sqlite_path": str(db_file),
            "leads_read": 0,
            "leads_inserted": 0,
            "leads_updated": 0,
            "verifications_read": 0,
            "verifications_migrated": 0,
            "errors": [],
            "message": f"SQLite database file not found at: {db_file}",
        }

    leads = sqlite_reader.get_all_leads()
    verifications = sqlite_reader.get_all_verifications()

    if not leads and not verifications:
        return {
            "status": "no_data",
            "sqlite_path": str(db_file),
            "leads_read": 0,
            "leads_inserted": 0,
            "leads_updated": 0,
            "verifications_read": 0,
            "verifications_migrated": 0,
            "errors": [],
            "message": "SQLite database exists but contains no leads or verifications.",
        }

    target_db = mongo_db or MongoDBDatabase()

    leads_inserted = 0
    leads_updated = 0
    verifications_migrated = 0
    errors: List[str] = []

    # 1. Migrate leads
    for lead in leads:
        try:
            is_new, _ = target_db.save_lead(lead)
            if is_new:
                leads_inserted += 1
            else:
                leads_updated += 1
        except Exception as e:
            errors.append(f"Failed to migrate lead '{lead.place_id}': {e}")

    # 2. Migrate verifications
    for verif in verifications:
        try:
            target_db.save_verification(verif)
            verifications_migrated += 1
        except Exception as e:
            errors.append(f"Failed to migrate verification for '{verif.lead_id or verif.target_url}': {e}")

    return {
        "status": "success",
        "sqlite_path": str(db_file),
        "database_name": target_db.db_name,
        "leads_read": len(leads),
        "leads_inserted": leads_inserted,
        "leads_updated": leads_updated,
        "verifications_read": len(verifications),
        "verifications_migrated": verifications_migrated,
        "errors": errors,
        "message": "Migration completed successfully.",
    }
