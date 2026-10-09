"""Unit tests for SQLite to MongoDB migration utility."""

import json
import sqlite3
import pytest
import mongomock
from pathlib import Path
from clds.database import MongoDBDatabase, migrate_sqlite_to_mongodb
from clds.models import BusinessLead
from clds.verification.models import VerificationRecord, AvailabilityResult


@pytest.fixture
def mock_mongo_db():
    client = mongomock.MongoClient()
    return MongoDBDatabase(database_name="test_migration_clds", client=client)


def create_sample_sqlite_db(db_path: Path):
    """Helper to create a populated SQLite database for migration testing."""
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()
    cur.execute("""
        CREATE TABLE leads (
            place_id TEXT PRIMARY KEY,
            business_name TEXT NOT NULL,
            category TEXT NOT NULL,
            country TEXT NOT NULL,
            state TEXT,
            city TEXT,
            address TEXT NOT NULL,
            website TEXT,
            website_status TEXT NOT NULL,
            source TEXT NOT NULL DEFAULT 'web_search',
            source_url TEXT,
            maps_url TEXT,
            phone TEXT,
            rating REAL,
            review_count INTEGER,
            latitude REAL,
            longitude REAL,
            discovered_at TEXT NOT NULL,
            normalized_website TEXT,
            normalized_phone TEXT,
            name_address_key TEXT,
            updated_at TEXT NOT NULL
        )
    """)

    cur.execute("""
        CREATE TABLE verifications (
            lead_id TEXT PRIMARY KEY,
            target_url TEXT NOT NULL,
            overall_status TEXT NOT NULL,
            verification_duration_ms INTEGER NOT NULL,
            checker_version TEXT NOT NULL,
            verified_at TEXT NOT NULL,
            availability_json TEXT NOT NULL,
            responsiveness_json TEXT NOT NULL,
            performance_json TEXT NOT NULL,
            caching_json TEXT NOT NULL,
            seo_json TEXT NOT NULL,
            accessibility_json TEXT NOT NULL,
            conversion_json TEXT NOT NULL,
            raw_record_json TEXT NOT NULL
        )
    """)

    # Insert 2 sample leads
    cur.execute("""
        INSERT INTO leads VALUES (
            'lead_sqlite_1', 'Austin Florist', 'florists', 'US', 'Texas', 'Austin',
            '100 Main St', 'https://austinflorist.com', 'website_found',
            'osm_overpass', 'https://osm.org/node/1', NULL, '+15125550199',
            4.8, 110, 30.26, -97.74, '2026-10-08T10:00:00+00:00',
            'austinflorist.com', '15125550199', 'austinflorist|100mainst', '2026-10-08T10:00:00+00:00'
        )
    """)
    cur.execute("""
        INSERT INTO leads VALUES (
            'lead_sqlite_2', 'Austin Coffee', 'cafes', 'US', 'Texas', 'Austin',
            '200 Congress Ave', 'https://austincoffee.com', 'website_found',
            'web_search', NULL, NULL, NULL,
            4.5, 45, NULL, NULL, '2026-10-08T11:00:00+00:00',
            'austincoffee.com', NULL, 'austincoffee|200congressave', '2026-10-08T11:00:00+00:00'
        )
    """)

    # Insert 1 sample verification
    sample_raw_verif = {
        "lead_id": "lead_sqlite_1",
        "target_url": "https://austinflorist.com",
        "final_url": "https://austinflorist.com/",
        "overall_status": "verified",
        "verification_duration_ms": 350,
        "checker_version": "1.0.0",
        "verified_at": "2026-10-08T12:00:00+00:00",
        "availability": {"reachable": True, "status_code": 200, "https": True},
        "responsiveness": {"viewport": "375x812", "responsive": True},
        "performance": {"ttfb_ms": 180.0, "document_size_kb": 22.5},
        "caching": {"etag": True},
        "technical_seo": {"has_title": True, "title_length": 18},
        "accessibility": {"missing_lang_attribute": False},
        "conversion": {"phone_present": True},
    }

    cur.execute("""
        INSERT INTO verifications VALUES (
            'lead_sqlite_1', 'https://austinflorist.com', 'verified', 350, '1.0.0',
            '2026-10-08T12:00:00+00:00', '{}', '{}', '{}', '{}', '{}', '{}', '{}', ?
        )
    """, (json.dumps(sample_raw_verif),))

    conn.commit()
    conn.close()


def test_migration_successful(tmp_path: Path, mock_mongo_db: MongoDBDatabase):
    """Test migrating full SQLite database to MongoDB."""
    db_file = tmp_path / "test_migration.db"
    create_sample_sqlite_db(db_file)

    res = migrate_sqlite_to_mongodb(sqlite_path=db_file, mongo_db=mock_mongo_db)

    assert res["status"] == "success"
    assert res["leads_read"] == 2
    assert res["leads_inserted"] == 2
    assert res["verifications_read"] == 1
    assert res["verifications_migrated"] == 1
    assert len(res["errors"]) == 0

    # Verify data in MongoDB
    assert mock_mongo_db.count_leads() == 2
    assert mock_mongo_db.count_verifications() == 1

    migrated_lead = mock_mongo_db.get_leads(city="Austin")[0]
    assert migrated_lead.place_id in ["lead_sqlite_1", "lead_sqlite_2"]

    migrated_verif = mock_mongo_db.get_verification("lead_sqlite_1")
    assert migrated_verif is not None
    assert migrated_verif.overall_status == "verified"
    assert migrated_verif.availability.status_code == 200
    assert migrated_verif.availability.https is True


def test_migration_no_sqlite_file(tmp_path: Path, mock_mongo_db: MongoDBDatabase):
    """Test migration behavior when SQLite database file is missing."""
    non_existent = tmp_path / "missing.db"
    res = migrate_sqlite_to_mongodb(sqlite_path=non_existent, mongo_db=mock_mongo_db)

    assert res["status"] == "no_data"
    assert res["leads_read"] == 0
    assert res["verifications_migrated"] == 0


def test_migration_idempotent_upsert(tmp_path: Path, mock_mongo_db: MongoDBDatabase):
    """Test that running migration a second time updates existing leads rather than duplicating."""
    db_file = tmp_path / "test_idempotent.db"
    create_sample_sqlite_db(db_file)

    # First run
    res1 = migrate_sqlite_to_mongodb(sqlite_path=db_file, mongo_db=mock_mongo_db)
    assert res1["leads_inserted"] == 2
    assert res1["leads_updated"] == 0

    # Second run
    res2 = migrate_sqlite_to_mongodb(sqlite_path=db_file, mongo_db=mock_mongo_db)
    assert res2["leads_inserted"] == 0
    assert res2["leads_updated"] == 2
    assert mock_mongo_db.count_leads() == 2
