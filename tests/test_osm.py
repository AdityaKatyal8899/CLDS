"""Unit tests for OSM Overpass Discovery Provider."""

import pytest
import httpx
from clds.models import SearchCriteria
from clds.providers.osm import OSMDiscoveryProvider, OSM_CATEGORY_MAP


def test_osm_category_tag_mapping():
    provider = OSMDiscoveryProvider()
    assert provider._get_osm_tag_filter("gift stores") == '["shop"="gift"]'
    assert provider._get_osm_tag_filter("cafes") == '["amenity"="cafe"]'
    assert provider._get_osm_tag_filter("restaurants") == '["amenity"="restaurant"]'
    assert provider._get_osm_tag_filter("salons") == '["shop"~"beauty|hairdresser"]'
    assert '["shop"~"pottery",i]' == provider._get_osm_tag_filter("pottery")


def test_osm_query_builder():
    provider = OSMDiscoveryProvider()
    criteria = SearchCriteria(category="gift stores", country="US", city="Austin", limit=10)
    query = provider._build_overpass_query(criteria)
    assert 'area["name"="Austin"]' in query
    assert '["shop"="gift"]' in query


def test_osm_element_parsing():
    provider = OSMDiscoveryProvider()
    criteria = SearchCriteria(category="gift stores", country="US", city="Austin")

    # Element 1: With website
    elem1 = {
        "type": "node",
        "id": 123456,
        "lat": 30.25,
        "lon": -97.74,
        "tags": {
            "name": "Austin Artisan Gifts",
            "shop": "gift",
            "addr:street": "South Congress Ave",
            "addr:housenumber": "1200",
            "addr:city": "Austin",
            "addr:state": "TX",
            "website": "https://austinartisan.com",
            "phone": "+1 512-555-0199",
        }
    }

    lead1 = provider._map_element_to_lead(elem1, criteria)
    assert lead1 is not None
    assert lead1.place_id == "osm_node_123456"
    assert lead1.business_name == "Austin Artisan Gifts"
    assert lead1.website == "https://austinartisan.com"
    assert lead1.website_status == "website_found"
    assert lead1.source == "osm_overpass"
    assert lead1.source_url == "https://www.openstreetmap.org/node/123456"
    assert "1200 South Congress Ave" in lead1.address

    # Element 2: Without website
    elem2 = {
        "type": "way",
        "id": 789012,
        "tags": {
            "name": "Local Vintage Corner",
            "shop": "gift",
            "addr:city": "Austin",
        }
    }
    lead2 = provider._map_element_to_lead(elem2, criteria)
    assert lead2 is not None
    assert lead2.place_id == "osm_way_789012"
    assert lead2.website is None
    assert lead2.website_status == "no_website_found"
    assert lead2.source == "osm_overpass"


def test_osm_mocked_search(monkeypatch):
    mock_response_data = {
        "elements": [
            {
                "type": "node",
                "id": 111,
                "tags": {
                    "name": "Austin Blooms",
                    "shop": "gift",
                    "website": "https://austinblooms.com",
                    "addr:city": "Austin",
                }
            }
        ]
    }

    class MockResponse:
        status_code = 200
        def json(self):
            return mock_response_data

    monkeypatch.setattr(httpx.Client, "post", lambda *args, **kwargs: MockResponse())

    provider = OSMDiscoveryProvider()
    criteria = SearchCriteria(category="gift stores", country="US", city="Austin", limit=5)
    leads = provider.search(criteria)

    assert len(leads) == 1
    assert leads[0].business_name == "Austin Blooms"
    assert leads[0].source == "osm_overpass"
