"""Unit tests for Auto multi-provider merging and cross-provider deduplication."""

from typing import List
from clds.models import BusinessLead, SearchCriteria
from clds.providers.base import BaseDiscoveryProvider
from clds.providers.auto import AutoDiscoveryProvider


class MockOSM(BaseDiscoveryProvider):
    def search(self, criteria: SearchCriteria) -> List[BusinessLead]:
        return [
            BusinessLead(
                place_id="osm_1",
                business_name="Austin Bloom Florist",
                category="gift stores",
                country="US",
                city="Austin",
                address="1200 S Congress Ave",
                website="https://austinbloom.com",
                source="osm_overpass",
            ),
            BusinessLead(
                place_id="osm_2",
                business_name="Vintage Corner",
                category="gift stores",
                country="US",
                city="Austin",
                address="300 E 6th St",
                website=None,
                source="osm_overpass",
            ),
        ]


class MockWeb(BaseDiscoveryProvider):
    def search(self, criteria: SearchCriteria) -> List[BusinessLead]:
        return [
            # Same website as osm_1 -> should be deduplicated!
            BusinessLead(
                place_id=None,
                business_name="Austin Bloom",
                category="gift stores",
                country="US",
                city="Austin",
                address="Austin, US",
                website="https://www.austinbloom.com/",
                source="web_search",
            ),
            # New lead from web
            BusinessLead(
                place_id=None,
                business_name="Texas Hill Crafts",
                category="gift stores",
                country="US",
                city="Austin",
                address="Austin, US",
                website="https://texashillcrafts.com",
                source="web_search",
            ),
        ]


def test_auto_provider_merging_and_deduplication():
    auto = AutoDiscoveryProvider(osm_provider=MockOSM(), web_provider=MockWeb())
    criteria = SearchCriteria(category="gift stores", country="US", city="Austin", limit=10)

    leads, osm_cnt, web_cnt = auto.search_with_stats(criteria)

    assert osm_cnt == 2
    assert web_cnt == 2
    # Total unique should be 3 (Austin Bloom deduplicated)
    assert len(leads) == 3
    names = {l.business_name for l in leads}
    assert "Austin Bloom Florist" in names
    assert "Vintage Corner" in names
    assert "Texas Hill Crafts" in names
