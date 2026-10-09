"""Unit tests for Google Places (New) API Provider."""

import pytest
import httpx
from clds.models import SearchCriteria
from clds.providers.google_places import (
    GooglePlacesProvider,
    InvalidAPIKeyError,
    GooglePlacesAPIError,
)


def test_missing_api_key_raises_error():
    provider = GooglePlacesProvider(api_key="")
    criteria = SearchCriteria(category="gift stores", country="US", city="Austin")
    with pytest.raises(InvalidAPIKeyError, match="missing or invalid"):
        provider.search(criteria)


def test_invalid_placeholder_key_raises_error():
    provider = GooglePlacesProvider(api_key="your_google_maps_api_key_here")
    criteria = SearchCriteria(category="cafes", country="IN", city="Mumbai")
    with pytest.raises(InvalidAPIKeyError, match="missing or invalid"):
        provider.search(criteria)


def test_successful_search_parsing_us(monkeypatch):
    mock_response_data = {
        "places": [
            {
                "id": "ChIJ_austin_florist_1",
                "displayName": {"text": "Austin Flower Co.", "languageCode": "en"},
                "primaryType": "florist",
                "formattedAddress": "1612 W 35th St, Austin, TX 78703, USA",
                "websiteUri": "https://austinflowerco.com",
                "googleMapsUri": "https://maps.google.com/?cid=111222",
                "rating": 4.7,
                "userRatingCount": 350,
            },
            {
                "id": "ChIJ_austin_gift_no_web",
                "displayName": {"text": "Local Craft Corner", "languageCode": "en"},
                "primaryType": "gift_shop",
                "formattedAddress": "2000 S Congress Ave, Austin, TX 78704, USA",
                "websiteUri": None,
                "googleMapsUri": "https://maps.google.com/?cid=333444",
                "rating": 4.3,
                "userRatingCount": 42,
            }
        ]
    }

    class MockResponse:
        status_code = 200
        def json(self):
            return mock_response_data

    def mock_post(*args, **kwargs):
        return MockResponse()

    monkeypatch.setattr(httpx.Client, "post", mock_post)

    provider = GooglePlacesProvider(api_key="VALID_MOCK_KEY")
    criteria = SearchCriteria(category="gift stores", country="US", city="Austin", limit=10)
    leads = provider.search(criteria)

    assert len(leads) == 2
    
    # Lead 1: With website
    l1 = leads[0]
    assert l1.place_id == "ChIJ_austin_florist_1"
    assert l1.business_name == "Austin Flower Co."
    assert l1.category == "florist"
    assert l1.website == "https://austinflowerco.com"
    assert l1.website_status == "website_found"
    assert l1.city == "Austin"
    assert l1.country == "US"
    assert l1.rating == 4.7
    assert l1.review_count == 350

    # Lead 2: Without website
    l2 = leads[1]
    assert l2.place_id == "ChIJ_austin_gift_no_web"
    assert l2.business_name == "Local Craft Corner"
    assert l2.category == "gift_shop"
    assert l2.website is None
    assert l2.website_status == "no_website_found"


def test_successful_search_parsing_india(monkeypatch):
    mock_response_data = {
        "places": [
            {
                "id": "ChIJ_mumbai_cafe_1",
                "displayName": {"text": "Subko Coffee Roasters", "languageCode": "en"},
                "primaryType": "coffee_shop",
                "formattedAddress": "Ground Floor, Chapel Rd, Bandra West, Mumbai, Maharashtra 400050, India",
                "websiteUri": "https://subko.cr",
                "googleMapsUri": "https://maps.google.com/?cid=999888",
                "rating": 4.6,
                "userRatingCount": 1850,
            }
        ]
    }

    class MockResponse:
        status_code = 200
        def json(self):
            return mock_response_data

    monkeypatch.setattr(httpx.Client, "post", lambda *args, **kwargs: MockResponse())

    provider = GooglePlacesProvider(api_key="VALID_MOCK_KEY")
    criteria = SearchCriteria(category="cafes", country="IN", state="Maharashtra", city="Mumbai", limit=5)
    leads = provider.search(criteria)

    assert len(leads) == 1
    l = leads[0]
    assert l.business_name == "Subko Coffee Roasters"
    assert l.category == "coffee_shop"
    assert l.website_status == "website_found"
    assert l.city == "Mumbai"
    assert l.state == "Maharashtra"
    assert l.country == "IN"
