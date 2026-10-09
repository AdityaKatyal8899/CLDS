"""Unit tests for MongoDB repository operations, deduplication, and verification tracking."""

import pytest
import mongomock
from datetime import datetime, timezone, timedelta
from clds.database import Database, MongoDBDatabase, MongoDBConfigurationError
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


@pytest.fixture
def mock_mongo_client():
    return mongomock.MongoClient()


@pytest.fixture
def temp_db(mock_mongo_client):
    return MongoDBDatabase(database_name="test_clds", client=mock_mongo_client)


def test_missing_mongodb_uri_raises_configuration_error(monkeypatch):
    """Verify clean error raised when MONGODB_URI is absent."""
    monkeypatch.setenv("MONGODB_URI", "")
    with pytest.raises(MongoDBConfigurationError) as exc_info:
        MongoDBDatabase(uri="")
    assert "MongoDB configuration missing" in str(exc_info.value)
    assert "Set MONGODB_URI in your .env file" in str(exc_info.value)


def test_insert_and_count_lead(temp_db: Database):
    lead = BusinessLead(
        place_id="place_1",
        business_name="Bloom Florist",
        category="florists",
        country="US",
        city="Austin",
        address="101 First St, Austin, TX",
        website="https://bloomflorist.com",
        phone="+15125550100",
        rating=4.7,
        review_count=85,
    )
    is_new, action = temp_db.save_lead(lead)
    assert is_new is True
    assert action == "inserted"
    assert temp_db.count_leads() == 1


def test_update_existing_lead_on_same_place_id(temp_db: Database):
    lead1 = BusinessLead(
        place_id="place_1",
        business_name="Bloom Florist",
        category="florists",
        country="US",
        city="Austin",
        address="101 First St, Austin, TX",
        rating=4.5,
        review_count=80,
    )
    temp_db.save_lead(lead1)

    lead2 = BusinessLead(
        place_id="place_1",
        business_name="Bloom Florist & Gifts",
        category="florists",
        country="US",
        city="Austin",
        address="101 First St, Austin, TX",
        rating=4.8,
        review_count=120,
    )
    is_new, action = temp_db.save_lead(lead2)
    assert is_new is False
    assert action == "updated"
    assert temp_db.count_leads() == 1

    stored = temp_db.get_leads()[0]
    assert stored.business_name == "Bloom Florist & Gifts"
    assert stored.rating == 4.8
    assert stored.review_count == 120


def test_separate_branches_are_kept_separate(temp_db: Database):
    """Verify separate physical branches with distinct addresses/place_ids remain separate."""
    branch1 = BusinessLead(
        place_id="place_downtown",
        business_name="Starbucks - Austin Downtown",
        category="cafes",
        country="US",
        city="Austin",
        address="300 Congress Ave, Austin, TX",
        website="https://starbucks.com",
    )
    branch2 = BusinessLead(
        place_id="place_airport",
        business_name="Starbucks - Austin Airport",
        category="cafes",
        country="US",
        city="Austin",
        address="3600 Presidential Blvd, Austin, TX",
        website="https://starbucks.com",
    )

    temp_db.save_lead(branch1)
    temp_db.save_lead(branch2)

    assert temp_db.count_leads() == 2
    leads = temp_db.get_leads()
    names = {l.business_name for l in leads}
    assert "Starbucks - Austin Downtown" in names
    assert "Starbucks - Austin Airport" in names


def test_query_filters(temp_db: Database):
    temp_db.save_lead(BusinessLead(
        place_id="p1", business_name="Store US 1", category="gifts", country="US", city="Austin", address="A1", website="https://site1.com"
    ))
    temp_db.save_lead(BusinessLead(
        place_id="p2", business_name="Store US 2", category="gifts", country="US", city="Dallas", address="A2", website=None
    ))
    temp_db.save_lead(BusinessLead(
        place_id="p3", business_name="Store IN 1", category="cafes", country="IN", city="Mumbai", address="A3", website="https://cafe.in"
    ))

    # Filter country
    assert len(temp_db.get_leads(country="US")) == 2
    assert len(temp_db.get_leads(country="IN")) == 1

    # Filter city
    assert len(temp_db.get_leads(city="Austin")) == 1

    # Filter website status
    assert len(temp_db.get_leads(website_status="no_website_found")) == 1
    assert len(temp_db.get_leads(website_status="website_found")) == 2


def test_repeated_searches_do_not_duplicate(temp_db: Database):
    leads = [
        BusinessLead(place_id=f"id_{i}", business_name=f"Shop {i}", category="gifts", country="US", city="Austin", address=f"Addr {i}")
        for i in range(10)
    ]
    # First search
    inserted1, updated1 = temp_db.save_leads(leads)
    assert inserted1 == 10
    assert updated1 == 0
    assert temp_db.count_leads() == 10

    # Repeated search
    inserted2, updated2 = temp_db.save_leads(leads)
    assert inserted2 == 0
    assert updated2 == 10
    assert temp_db.count_leads() == 10


def test_verification_persistence_and_retrieval(temp_db: Database):
    """Test saving and retrieving Stage 2 verification records with nested measurements."""
    record = VerificationRecord(
        lead_id="place_1",
        target_url="https://bloomflorist.com",
        final_url="https://bloomflorist.com/",
        overall_status="verified",
        verification_duration_ms=520,
        availability=AvailabilityResult(reachable=True, status_code=200, https=True, response_time_ms=120.0),
        responsiveness=ResponsivenessResult(viewport="375x812", responsive=True),
        performance=PerformanceResult(ttfb_ms=250.0, document_size_kb=15.2, resource_count=12),
        caching=CachingResult(etag=True, last_modified=True),
        seo=TechnicalSEOResult(title=True, title_length=22, meta_description=True),
        accessibility=AccessibilityResult(images_missing_alt=0, missing_lang_attribute=False),
        conversion=ConversionResult(phone_present=True, contact_page_link=True),
    )

    doc_id = temp_db.save_verification(record)
    assert doc_id is not None
    assert temp_db.count_verifications() == 1

    fetched = temp_db.get_verification("place_1")
    assert fetched is not None
    assert fetched.overall_status == "verified"
    assert fetched.availability.status_code == 200
    assert fetched.performance.ttfb_ms == 250.0
    assert fetched.caching.etag is True
    assert fetched.seo.title is True


def test_verification_history_preservation(temp_db: Database):
    """Test that multiple verifications over time are preserved and latest is retrieved first."""
    lead_id = "history_lead_1"
    
    t1 = "2026-10-01T10:00:00+00:00"
    t2 = "2026-10-05T10:00:00+00:00"
    t3 = "2026-10-08T10:00:00+00:00"

    r1 = VerificationRecord(lead_id=lead_id, target_url="https://test.com", verified_at=t1, overall_status="unreachable", verification_duration_ms=100)
    r2 = VerificationRecord(lead_id=lead_id, target_url="https://test.com", verified_at=t2, overall_status="verified", verification_duration_ms=300)
    r3 = VerificationRecord(lead_id=lead_id, target_url="https://test.com", verified_at=t3, overall_status="verified", verification_duration_ms=250)

    temp_db.save_verification(r1)
    temp_db.save_verification(r2)
    temp_db.save_verification(r3)

    assert temp_db.count_verifications() == 3

    # get_verification returns the newest (r3)
    latest = temp_db.get_verification(lead_id)
    assert latest is not None
    assert latest.verified_at == t3
    assert latest.verification_duration_ms == 250

    # get_verification_history returns all 3 in descending order
    history = temp_db.get_verification_history(lead_id)
    assert len(history) == 3
    assert [h.verified_at for h in history] == [t3, t2, t1]


def test_unverified_leads_lookup_and_recent_cutoff(temp_db: Database):
    """Test finding unverified leads vs leads verified recently."""
    # Create 3 leads with websites
    temp_db.save_lead(BusinessLead(
        place_id="lead_never_verified",
        business_name="Shop 1",
        category="gifts",
        country="US",
        address="100 Main St",
        website="https://shop1.com",
        website_status="website_found",
    ))
    temp_db.save_lead(BusinessLead(
        place_id="lead_verified_old",
        business_name="Shop 2",
        category="gifts",
        country="US",
        address="200 Main St",
        website="https://shop2.com",
        website_status="website_found",
    ))
    temp_db.save_lead(BusinessLead(
        place_id="lead_verified_today",
        business_name="Shop 3",
        category="gifts",
        country="US",
        address="300 Main St",
        website="https://shop3.com",
        website_status="website_found",
    ))

    # Old verification (20 days ago)
    old_time = (datetime.now(timezone.utc) - timedelta(days=20)).isoformat()
    temp_db.save_verification(VerificationRecord(
        lead_id="lead_verified_old",
        target_url="https://shop2.com",
        verified_at=old_time,
        overall_status="verified",
        verification_duration_ms=200,
    ))

    # Recent verification (today)
    today_time = datetime.now(timezone.utc).isoformat()
    temp_db.save_verification(VerificationRecord(
        lead_id="lead_verified_today",
        target_url="https://shop3.com",
        verified_at=today_time,
        overall_status="verified",
        verification_duration_ms=200,
    ))

    # 1. Without cutoff: only lead_never_verified should be returned
    unverified_all = temp_db.get_unverified_leads(limit=10)
    unverified_ids = [l.place_id for l in unverified_all]
    assert "lead_never_verified" in unverified_ids
    assert "lead_verified_old" not in unverified_ids
    assert "lead_verified_today" not in unverified_ids

    # 2. With 7 days cutoff: lead_never_verified AND lead_verified_old (older than 7 days) should be returned
    unverified_7d = temp_db.get_unverified_leads(limit=10, unverified_since_days=7)
    unverified_7d_ids = [l.place_id for l in unverified_7d]
    assert "lead_never_verified" in unverified_7d_ids
    assert "lead_verified_old" in unverified_7d_ids
    assert "lead_verified_today" not in unverified_7d_ids
