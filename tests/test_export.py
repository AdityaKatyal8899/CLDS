"""Unit tests for CSV and JSON export functionality."""

import csv
import json
from pathlib import Path
from clds.models import BusinessLead
from clds.export import (
    export_to_csv,
    export_to_json,
    export_leads_both,
    generate_export_filename,
)


def sample_leads():
    return [
        BusinessLead(
            place_id="p1",
            business_name="Austin Gifts",
            category="gift stores",
            country="US",
            city="Austin",
            address="100 Main St, Austin, TX",
            website="https://austingifts.com",
            phone="+15125550111",
            rating=4.9,
            review_count=100,
        ),
        BusinessLead(
            place_id="p2",
            business_name="No Web Store",
            category="gift stores",
            country="US",
            city="Austin",
            address="200 South St, Austin, TX",
            website=None,
        ),
    ]


def test_export_filenames():
    fn_csv = generate_export_filename("Gift Stores", "Austin", "US", "csv")
    assert fn_csv.startswith("gift_stores_austin_")
    assert fn_csv.endswith(".csv")

    fn_json = generate_export_filename("Cafés & Bakery", "Mumbai", "IN", "json")
    assert fn_json.startswith("cafes_bakery_mumbai_")
    assert fn_json.endswith(".json")


def test_export_to_csv(tmp_path: Path):
    leads = sample_leads()
    csv_file = tmp_path / "test.csv"
    export_to_csv(leads, csv_file)

    assert csv_file.exists()
    with open(csv_file, encoding="utf-8") as f:
        reader = csv.DictReader(f)
        rows = list(reader)
        assert len(rows) == 2
        assert rows[0]["business_name"] == "Austin Gifts"
        assert rows[0]["website_status"] == "website_found"
        assert rows[1]["business_name"] == "No Web Store"
        assert rows[1]["website_status"] == "no_website_found"


def test_export_to_json(tmp_path: Path):
    leads = sample_leads()
    json_file = tmp_path / "test.json"
    export_to_json(leads, json_file)

    assert json_file.exists()
    with open(json_file, encoding="utf-8") as f:
        data = json.load(f)
        assert len(data) == 2
        assert data[0]["place_id"] == "p1"
        assert data[0]["website"] == "https://austingifts.com"
        assert data[1]["website"] is None


def test_export_leads_both(tmp_path: Path):
    leads = sample_leads()
    csv_path, json_path = export_leads_both(
        leads=leads,
        category="gift stores",
        city="Austin",
        country="US",
        output_dir=tmp_path,
    )
    assert csv_path.exists()
    assert json_path.exists()
