"""Legacy SQLite reader for migrating historical CLDS data to MongoDB."""

import json
import sqlite3
from pathlib import Path
from typing import List, Optional
from clds.models import BusinessLead
from clds.verification.models import (
    VerificationRecord,
    AvailabilityResult,
    ResponsivenessResult,
    PerformanceResult,
    CachingResult,
    TechnicalSEOResult,
    AccessibilityResult,
    ConversionResult,
)


class SQLiteDatabase:
    """Reader for historical SQLite databases."""

    def __init__(self, db_path: Path):
        self.db_path = Path(db_path)

    def exists(self) -> bool:
        """Check if SQLite database file exists."""
        return self.db_path.exists() and self.db_path.is_file()

    def _get_connection(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def get_all_leads(self) -> List[BusinessLead]:
        """Fetch all leads stored in SQLite database."""
        if not self.exists():
            return []

        leads = []
        try:
            with self._get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='leads'")
                if not cursor.fetchone():
                    return []

                cursor.execute("SELECT * FROM leads ORDER BY discovered_at ASC")
                rows = cursor.fetchall()
                for row in rows:
                    keys = row.keys()
                    leads.append(
                        BusinessLead(
                            place_id=row["place_id"],
                            business_name=row["business_name"],
                            category=row["category"],
                            country=row["country"],
                            state=row["state"] if "state" in keys else None,
                            city=row["city"] if "city" in keys else None,
                            address=row["address"],
                            website=row["website"] if "website" in keys else None,
                            website_status=row["website_status"],
                            source=row["source"] if "source" in keys and row["source"] else "web_search",
                            source_url=row["source_url"] if "source_url" in keys else None,
                            maps_url=row["maps_url"] if "maps_url" in keys else None,
                            phone=row["phone"] if "phone" in keys else None,
                            rating=row["rating"] if "rating" in keys else None,
                            review_count=row["review_count"] if "review_count" in keys else None,
                            latitude=row["latitude"] if "latitude" in keys else None,
                            longitude=row["longitude"] if "longitude" in keys else None,
                            discovered_at=row["discovered_at"],
                        )
                    )
        except Exception:
            return []

        return leads

    def get_all_verifications(self) -> List[VerificationRecord]:
        """Fetch all verification records stored in SQLite database."""
        if not self.exists():
            return []

        verifications = []
        try:
            with self._get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='verifications'")
                if not cursor.fetchone():
                    return []

                cursor.execute("SELECT * FROM verifications ORDER BY verified_at ASC")
                rows = cursor.fetchall()
                for row in rows:
                    keys = row.keys()
                    raw_json = row["raw_record_json"] if "raw_record_json" in keys and row["raw_record_json"] else None
                    if raw_json:
                        try:
                            data = json.loads(raw_json)
                            verifications.append(VerificationRecord.model_validate(data))
                            continue
                        except Exception:
                            pass

                    # Fallback to individual column parsing
                    avail = json.loads(row["availability_json"]) if "availability_json" in keys and row["availability_json"] else {}
                    resp = json.loads(row["responsiveness_json"]) if "responsiveness_json" in keys and row["responsiveness_json"] else {}
                    perf = json.loads(row["performance_json"]) if "performance_json" in keys and row["performance_json"] else {}
                    cach = json.loads(row["caching_json"]) if "caching_json" in keys and row["caching_json"] else {}
                    seo = json.loads(row["seo_json"]) if "seo_json" in keys and row["seo_json"] else {}
                    acc = json.loads(row["accessibility_json"]) if "accessibility_json" in keys and row["accessibility_json"] else {}
                    conv = json.loads(row["conversion_json"]) if "conversion_json" in keys and row["conversion_json"] else {}

                    record = VerificationRecord(
                        lead_id=row["lead_id"],
                        target_url=row["target_url"],
                        overall_status=row["overall_status"],
                        verification_duration_ms=row["verification_duration_ms"],
                        checker_version=row["checker_version"] if "checker_version" in keys else "1.0.0",
                        verified_at=row["verified_at"],
                        availability=AvailabilityResult.model_validate(avail) if avail else AvailabilityResult(),
                        responsiveness=ResponsivenessResult.model_validate(resp) if resp else ResponsivenessResult(),
                        performance=PerformanceResult.model_validate(perf) if perf else PerformanceResult(),
                        caching=CachingResult.model_validate(cach) if cach else CachingResult(),
                        seo=TechnicalSEOResult.model_validate(seo) if seo else TechnicalSEOResult(),
                        accessibility=AccessibilityResult.model_validate(acc) if acc else AccessibilityResult(),
                        conversion=ConversionResult.model_validate(conv) if conv else ConversionResult(),
                    )
                    verifications.append(record)
        except Exception:
            return []

        return verifications
