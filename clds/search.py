"""Search orchestration pipeline for CLDS."""

from pathlib import Path
from typing import Optional, List, Tuple
from clds.models import (
    SearchCriteria,
    BusinessLead,
    SearchSummary,
    normalize_website,
    normalize_name_address,
)
from clds.providers.base import BaseDiscoveryProvider
from clds.providers.osm import OSMDiscoveryProvider
from clds.providers.web_search import WebSearchProvider
from clds.providers.auto import AutoDiscoveryProvider
from clds.providers.google_places import GooglePlacesProvider
from clds.database import Database
from clds.export import export_leads_both
from clds.config import settings


def is_india_market(country_str: str) -> bool:
    """Check if target country is India."""
    c = (country_str or "").strip().lower()
    return c in ["in", "india", "ind"]


def deduplicate_lead_list(leads: List[BusinessLead]) -> List[BusinessLead]:
    """In-memory multi-signal deduplication of newly discovered leads list."""
    seen_place_ids = set()
    seen_websites = set()
    seen_name_addrs = set()
    unique_leads = []

    for lead in leads:
        if lead.place_id and lead.place_id in seen_place_ids:
            continue

        norm_web = normalize_website(lead.website)
        if norm_web and norm_web in seen_websites:
            continue

        name_addr = normalize_name_address(lead.business_name, lead.address)
        if name_addr and name_addr in seen_name_addrs:
            continue

        if lead.place_id:
            seen_place_ids.add(lead.place_id)
        if norm_web:
            seen_websites.add(norm_web)
        if name_addr:
            seen_name_addrs.add(name_addr)

        unique_leads.append(lead)
    return unique_leads


class LeadDiscoveryService:
    """Orchestrates search, deduplication, storage, and export across providers."""

    def __init__(
        self,
        provider: Optional[BaseDiscoveryProvider] = None,
        db: Optional[Database] = None,
        export_dir: Optional[Path] = None,
    ):
        self.provider = provider
        self.db = db if db is not None else Database()
        self.export_dir = Path(export_dir) if export_dir else settings.export_dir

    def _get_provider(self, provider_name: str) -> BaseDiscoveryProvider:
        if self.provider:
            return self.provider
        
        name = (provider_name or "auto").lower().strip()
        if name in ["osm", "overpass", "openstreetmap"]:
            return OSMDiscoveryProvider()
        elif name in ["web", "web_search", "search"]:
            return WebSearchProvider()
        elif name in ["google", "google_places", "places"]:
            return GooglePlacesProvider()
        else:
            return AutoDiscoveryProvider()

    def execute_search(self, criteria: SearchCriteria) -> Tuple[SearchSummary, List[BusinessLead]]:
        """
        Execute full discovery workflow:
        1. Select provider (auto by default)
        2. Query provider
        3. Deduplicate
        4. Persist & update database
        5. Export to CSV and JSON
        6. Return summary stats
        """
        provider_instance = self._get_provider(criteria.provider)

        osm_count = 0
        web_count = 0
        google_count = 0

        if isinstance(provider_instance, AutoDiscoveryProvider):
            raw_leads, osm_count, web_count = provider_instance.search_with_stats(criteria)
        else:
            raw_leads = provider_instance.search(criteria)
            if isinstance(provider_instance, OSMDiscoveryProvider):
                osm_count = len(raw_leads)
            elif isinstance(provider_instance, WebSearchProvider):
                web_count = len(raw_leads)
            elif isinstance(provider_instance, GooglePlacesProvider):
                google_count = len(raw_leads)

        unique_leads = deduplicate_lead_list(raw_leads)
        duplicates_removed = len(raw_leads) - len(unique_leads)

        # Truncate to limit if needed
        if len(unique_leads) > criteria.limit:
            unique_leads = unique_leads[:criteria.limit]

        # Database upsert
        inserted, updated = self.db.save_leads(unique_leads)

        # Count website statuses
        websites_found = sum(1 for l in unique_leads if l.website_status == "website_found")
        no_website_found = sum(1 for l in unique_leads if l.website_status == "no_website_found")

        # Regional breakdown
        is_in = is_india_market(criteria.country)
        india_cnt = len(unique_leads) if is_in else 0
        intl_cnt = 0 if is_in else len(unique_leads)

        # Export
        csv_path, json_path = export_leads_both(
            leads=unique_leads,
            category=criteria.category,
            city=criteria.city,
            country=criteria.country,
            output_dir=self.export_dir,
        )

        summary = SearchSummary(
            category=criteria.category,
            country=criteria.country,
            city=criteria.city,
            state=criteria.state,
            limit=criteria.limit,
            provider_used=criteria.provider,
            total_discovered=len(raw_leads),
            unique_discovered=len(unique_leads),
            websites_found=websites_found,
            no_website_found=no_website_found,
            osm_results_count=osm_count,
            web_results_count=web_count,
            google_results_count=google_count,
            duplicates_removed=duplicates_removed,
            records_stored_or_updated=inserted + updated,
            is_india=is_in,
            international_count=intl_cnt,
            india_count=india_cnt,
            csv_export_path=str(csv_path),
            json_export_path=str(json_path),
        )

        return summary, unique_leads
