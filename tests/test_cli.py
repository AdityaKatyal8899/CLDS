"""Unit tests for CLI parser and command handlers."""

import pytest
from clds.cli import create_parser


def test_cli_search_parser_valid():
    parser = create_parser()
    args = parser.parse_args(["search", "--category", "gift stores", "--country", "US", "--city", "Austin", "--limit", "25"])
    assert args.command == "search"
    assert args.category == "gift stores"
    assert args.country == "US"
    assert args.city == "Austin"
    assert args.limit == 25


def test_cli_search_parser_india():
    parser = create_parser()
    args = parser.parse_args(["search", "--category", "cafes", "--country", "IN", "--state", "Maharashtra", "--city", "Mumbai"])
    assert args.command == "search"
    assert args.country == "IN"
    assert args.state == "Maharashtra"
    assert args.city == "Mumbai"


def test_cli_list_parser():
    parser = create_parser()
    args = parser.parse_args(["list", "--country", "US", "--limit", "10", "--website-status", "website_found"])
    assert args.command == "list"
    assert args.country == "US"
    assert args.website_status == "website_found"


def test_cli_export_parser():
    parser = create_parser()
    args = parser.parse_args(["export", "--format", "csv", "--output-dir", "custom_exports"])
    assert args.command == "export"
    assert args.format == "csv"
    assert args.output_dir == "custom_exports"


def test_cli_missing_required_search_args():
    parser = create_parser()
    with pytest.raises(SystemExit):
        # Missing --country and --category
        parser.parse_args(["search", "--city", "Austin"])


def test_cli_search_missing_key(monkeypatch, capsys):
    import mongomock
    from clds.cli import cmd_search
    from clds.database import Database
    mock_db = Database(database_name="test_cli_missing_key", client=mongomock.MongoClient())
    monkeypatch.setattr("clds.search.Database", lambda *args, **kwargs: mock_db)
    monkeypatch.setattr("clds.cli.Database", lambda *args, **kwargs: mock_db)

    parser = create_parser()
    args = parser.parse_args(["search", "--category", "gift stores", "--country", "US", "--city", "Austin", "--provider", "google"])
    
    # Ensure empty key
    monkeypatch.setenv("GOOGLE_MAPS_API_KEY", "")
    exit_code = cmd_search(args)
    assert exit_code == 1
    captured = capsys.readouterr()
    assert "Configuration Error" in captured.out
    assert "GOOGLE_MAPS_API_KEY is missing or invalid" in captured.out


def test_cli_list_and_export_execution(tmp_path, monkeypatch, capsys):
    import mongomock
    from clds.cli import cmd_list, cmd_export
    from clds.models import BusinessLead
    from clds.database import Database
    from clds import config

    mock_client = mongomock.MongoClient()
    mock_db = Database(database_name="test_cli_db", client=mock_client)
    monkeypatch.setattr("clds.cli.Database", lambda *args, **kwargs: mock_db)

    test_export_dir = tmp_path / "cli_exports"
    monkeypatch.setattr(config.settings, "export_dir", test_export_dir)

    mock_db.save_lead(BusinessLead(
        place_id="cli_p1",
        business_name="Austin Boutique",
        category="clothing",
        country="US",
        city="Austin",
        address="500 S Congress Ave",
        website="https://austinboutique.com",
        phone="+15125550999",
        rating=4.8,
        review_count=95,
    ))

    parser = create_parser()
    list_args = parser.parse_args(["list", "--country", "US"])
    list_code = cmd_list(list_args)
    assert list_code == 0
    list_out = capsys.readouterr().out
    assert "Austin Boutique" in list_out
    assert "website_found" in list_out

    export_args = parser.parse_args(["export", "--format", "both", "--output-dir", str(test_export_dir)])
    export_code = cmd_export(export_args)
    assert export_code == 0
    export_out = capsys.readouterr().out
    assert "CSV" in export_out
    assert "JSON" in export_out


def test_cli_batch_execution(tmp_path, monkeypatch, capsys):
    import json
    import mongomock
    from clds.cli import cmd_batch
    from clds.database import Database
    from clds import config

    mock_client = mongomock.MongoClient()
    mock_db = Database(database_name="test_batch_cli", client=mock_client)
    monkeypatch.setattr("clds.search.Database", lambda *args, **kwargs: mock_db)
    monkeypatch.setattr("clds.cli.Database", lambda *args, **kwargs: mock_db)

    test_export_dir = tmp_path / "batch_exports"
    monkeypatch.setattr(config.settings, "export_dir", test_export_dir)

    batch_config = [
        {"category": "salons", "country": "US", "city": "Chicago", "limit": 2},
        {"category": "cafes", "country": "IN", "city": "Mumbai", "limit": 2},
    ]
    batch_file = tmp_path / "test_batch.json"
    with open(batch_file, "w", encoding="utf-8") as f:
        json.dump(batch_config, f)

    parser = create_parser()
    batch_args = parser.parse_args(["batch", "--file", str(batch_file), "--output-dir", str(test_export_dir)])
    exit_code = cmd_batch(batch_args)
    assert exit_code == 0

    out = capsys.readouterr().out
    assert "BATCH DISCOVERY SUMMARY" in out
    assert "Tasks Completed      : 2" in out


def test_cli_migration_command(tmp_path, monkeypatch, capsys):
    import json
    import sqlite3
    import mongomock
    from clds.cli import cmd_migrate
    from clds.database import Database

    sqlite_file = tmp_path / "test_cli_migration.db"
    conn = sqlite3.connect(sqlite_file)
    cur = conn.cursor()
    cur.execute("""
        CREATE TABLE leads (
            place_id TEXT PRIMARY KEY, business_name TEXT, category TEXT, country TEXT,
            state TEXT, city TEXT, address TEXT, website TEXT, website_status TEXT,
            source TEXT, source_url TEXT, maps_url TEXT, phone TEXT, rating REAL,
            review_count INTEGER, latitude REAL, longitude REAL, discovered_at TEXT,
            normalized_website TEXT, normalized_phone TEXT, name_address_key TEXT, updated_at TEXT
        )
    """)
    cur.execute("""
        CREATE TABLE verifications (
            lead_id TEXT PRIMARY KEY, target_url TEXT, overall_status TEXT,
            verification_duration_ms INTEGER, checker_version TEXT, verified_at TEXT,
            availability_json TEXT, responsiveness_json TEXT, performance_json TEXT,
            caching_json TEXT, seo_json TEXT, accessibility_json TEXT, conversion_json TEXT,
            raw_record_json TEXT
        )
    """)
    cur.execute("INSERT INTO leads VALUES ('p1', 'Biz 1', 'cafes', 'US', 'TX', 'Austin', '100 Main', 'https://biz1.com', 'website_found', 'web_search', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-10-08T00:00:00', NULL, NULL, NULL, '2026-10-08T00:00:00')")
    cur.execute("INSERT INTO leads VALUES ('p2', 'Biz 2', 'cafes', 'US', 'TX', 'Austin', '200 Main', 'https://biz2.com', 'website_found', 'web_search', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-10-08T00:00:00', NULL, NULL, NULL, '2026-10-08T00:00:00')")
    raw_v = {"lead_id": "p1", "target_url": "https://biz1.com", "overall_status": "verified", "verification_duration_ms": 100}
    cur.execute("INSERT INTO verifications VALUES ('p1', 'https://biz1.com', 'verified', 100, '1.0.0', '2026-10-08T00:00:00', '{}', '{}', '{}', '{}', '{}', '{}', '{}', ?)", (json.dumps(raw_v),))
    conn.commit()
    conn.close()

    mock_client = mongomock.MongoClient()
    mock_db = Database(database_name="test_migrated_cli", client=mock_client)
    monkeypatch.setattr("clds.database.migration.MongoDBDatabase", lambda *args, **kwargs: mock_db)

    parser = create_parser()
    migrate_args = parser.parse_args(["migrate-to-mongodb", "--sqlite-path", str(sqlite_file)])
    exit_code = cmd_migrate(migrate_args)
    assert exit_code == 0

    out = capsys.readouterr().out
    assert "SQLITE TO MONGODB MIGRATION SUMMARY" in out
    assert "Leads Read           : 2" in out
    assert "Verifications Stored : 1" in out

