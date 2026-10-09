"""Unit tests for models and normalization functions."""

import pytest
from clds.models import (
    BusinessLead,
    SearchCriteria,
    normalize_website,
    normalize_phone,
    normalize_name_address,
)


def test_normalize_website():
    assert normalize_website("https://www.example.com/path/?ref=123") == "example.com/path"
    assert normalize_website("http://example.com/") == "example.com"
    assert normalize_website("sub.example.com") == "sub.example.com"
    assert normalize_website("") is None
    assert normalize_website(None) is None


def test_normalize_phone():
    assert normalize_phone("+1 (512) 555-0198") == "+15125550198"
    assert normalize_phone("(022) 1234 5678") == "02212345678"
    assert normalize_phone("") is None
    assert normalize_phone(None) is None


def test_normalize_name_address():
    key1 = normalize_name_address("Starbucks Coffee!", "123 Main St., Suite 4")
    key2 = normalize_name_address("starbucks coffee", "123 Main St Suite 4")
    assert key1 == key2
    assert "starbucks coffee|123 main st suite 4" == key1


def test_business_lead_with_website():
    lead = BusinessLead(
        place_id="ChIJ12345",
        business_name="Austin Gift Emporium",
        category="gift stores",
        country="US",
        city="Austin",
        address="100 Congress Ave, Austin, TX",
        website="https://austingifts.com",
    )
    assert lead.website == "https://austingifts.com"
    assert lead.website_status == "website_found"


def test_business_lead_without_website():
    lead = BusinessLead(
        place_id="ChIJ67890",
        business_name="Local Artisan Corner",
        category="gift stores",
        country="US",
        city="Austin",
        address="200 S Lamar Blvd, Austin, TX",
        website=None,
    )
    assert lead.website is None
    assert lead.website_status == "no_website_found"


def test_search_criteria_validation():
    sc = SearchCriteria(category="cafes", country="IN", city="Mumbai", limit=25)
    assert sc.category == "cafes"
    assert sc.limit == 25

    with pytest.raises(Exception):
        SearchCriteria(category="cafes", country="IN", limit=0)
