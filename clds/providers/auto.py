"""Auto multi-source discovery provider ($0 cost combining OSM and Web Search)."""

from typing import List, Tuple, Optional
from clds.models import (
    BusinessLead,
    SearchCriteria,
    normalize_website,
    normalize_name_address,
)
from clds.providers.base import BaseDiscoveryProvider
from clds.providers.osm import OSMDiscoveryProvider
from clds.providers.web_search import WebSearchProvider


class AutoDiscoveryProvider(BaseDiscoveryProvider):
    """
    Default $0 Multi-Provider:
    Combines OpenStreetMap structured data + Web Search discovery,
    merging and deduplicating results without requiring API keys or payment.
    """

    def __init__(
        self,
        osm_provider: Optional[OSMDiscoveryProvider] = None,
        web_provider: Optional[WebSearchProvider] = None,
    ):
        self.osm = osm_provider or OSMDiscoveryProvider()
        self.web = web_provider or WebSearchProvider()

    def search_with_stats(self, criteria: SearchCriteria) -> Tuple[List[BusinessLead], int, int]:
        """
        Execute combined discovery and return (leads, osm_count, web_count).
        """
        osm_leads: List[BusinessLead] = []
        web_leads: List[BusinessLead] = []

        try:
            osm_leads = self.osm.search(criteria)
        except Exception:
            osm_leads = []

        # If OSM produced fewer than criteria.limit, ask WebSearch to contribute more
        try:
            web_leads = self.web.search(criteria)
        except Exception:
            web_leads = []

        osm_count = len(osm_leads)
        web_count = len(web_leads)

        # Merge & deduplicate
        seen_websites = set()
        seen_name_addrs = set()
        seen_place_ids = set()
        merged: List[BusinessLead] = []

        for lead in (osm_leads + web_leads):
            # Check place_id if present
            if lead.place_id and lead.place_id in seen_place_ids:
                continue

            # Check normalized website if present
            norm_web = normalize_website(lead.website)
            if norm_web and norm_web in seen_websites:
                continue

            # Check normalized name + address
            name_addr = normalize_name_address(lead.business_name, lead.address)
            if name_addr in seen_name_addrs:
                continue

            if lead.place_id:
                seen_place_ids.add(lead.place_id)
            if norm_web:
                seen_websites.add(norm_web)
            if name_addr:
                seen_name_addrs.add(name_addr)

            merged.append(lead)
            if len(merged) >= criteria.limit:
                break

        return merged, osm_count, web_count

    def search(self, criteria: SearchCriteria) -> List[BusinessLead]:
        leads, _, _ = self.search_with_stats(criteria)
        return leads
