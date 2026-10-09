"""Data models and normalization for CLDS."""

import json
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Literal, Optional, List, Set
from urllib.parse import urlparse
from pydantic import BaseModel, Field, field_validator


def load_domain_blacklist() -> Set[str]:
    """Load directory, social, and aggregator domains from config/blacklist.json."""
    blacklist_path = Path(__file__).resolve().parent / "blacklist.json"
    if not blacklist_path.exists():
        return {
            "yelp.com", "tripadvisor.com", "yellowpages.com", "facebook.com",
            "instagram.com", "linkedin.com", "twitter.com", "x.com", "tiktok.com"
        }
    try:
        with open(blacklist_path, "r", encoding="utf-8") as f:
            data = json.load(f)
            domains = set()
            for key in ["directories", "social_media", "aggregators_and_generic"]:
                domains.update(d.lower().strip() for d in data.get(key, []))
            return domains
    except Exception:
        return {"yelp.com", "tripadvisor.com", "facebook.com", "instagram.com"}


DOMAIN_BLACKLIST = load_domain_blacklist()


def normalize_website(url: Optional[str]) -> Optional[str]:
    """Normalize website URL for comparison (removes protocol, www, trailing slash, query params)."""
    if not url or not isinstance(url, str):
        return None
    url = url.strip()
    if not url:
        return None
    if not url.startswith(("http://", "https://")):
        url = "https://" + url
    try:
        parsed = urlparse(url)
        domain = parsed.netloc.lower()
        if domain.startswith("www."):
            domain = domain[4:]
        path = parsed.path.rstrip("/")
        if not domain:
            return None
        return f"{domain}{path}"
    except Exception:
        return url.lower().rstrip("/")


def extract_domain(url: Optional[str]) -> Optional[str]:
    """Extract clean root/second-level domain from URL (e.g. https://www.bloom.com/about -> bloom.com)."""
    if not url or not isinstance(url, str):
        return None
    url = url.strip()
    if not url.startswith(("http://", "https://")):
        url = "https://" + url
    try:
        parsed = urlparse(url)
        domain = parsed.netloc.lower()
        if domain.startswith("www."):
            domain = domain[4:]
        return domain if domain else None
    except Exception:
        return None


def is_blacklisted_domain(url_or_domain: Optional[str]) -> bool:
    """Check if domain belongs to directory, social media, or aggregator list."""
    domain = extract_domain(url_or_domain)
    if not domain:
        return True
    
    # Check exact match or subdomain match against blacklist
    for bl_domain in DOMAIN_BLACKLIST:
        if domain == bl_domain or domain.endswith("." + bl_domain):
            return True
    return False


def is_likely_official_domain(business_name: str, url: str) -> bool:
    """
    Check if a URL is likely the official website of a business:
    1. Not in directory/social blacklist
    2. Substantial token/name overlap between business name and domain
    """
    domain = extract_domain(url)
    if not domain or is_blacklisted_domain(domain):
        return False
    
    # Strip TLD (e.g. .com, .co.uk, .in, .store)
    domain_core = re.sub(r"\.[a-z]{2,}(\.[a-z]{2,})?$", "", domain)
    domain_core = re.sub(r"[^a-z0-9]", "", domain_core)

    # Clean business name tokens
    name_clean = re.sub(r"[^a-z0-9\s]", "", business_name.lower())
    words = [w for w in name_clean.split() if len(w) > 2 and w not in ["the", "and", "store", "shop", "cafe", "ltd", "inc", "co", "llc"]]
    
    if not words:
        words = [w for w in name_clean.split() if len(w) > 1]
    
    if not words:
        return True

    # Check if any significant word appears in domain or domain in name
    match_count = sum(1 for w in words if w in domain_core)
    return match_count >= 1 or domain_core in re.sub(r"\s+", "", name_clean)


def normalize_phone(phone: Optional[str]) -> Optional[str]:
    """Normalize phone number to digits-only with optional leading '+'."""
    if not phone or not isinstance(phone, str):
        return None
    phone = phone.strip()
    if not phone:
        return None
    has_plus = phone.startswith("+")
    digits = re.sub(r"\D", "", phone)
    if not digits:
        return None
    return f"+{digits}" if has_plus else digits


def normalize_name_address(name: str, address: Optional[str]) -> str:
    """Normalize business name and address string for comparison."""
    clean_name = re.sub(r"[^\w\s]", "", (name or "").lower())
    clean_name = re.sub(r"\s+", " ", clean_name).strip()
    
    clean_addr = re.sub(r"[^\w\s]", "", (address or "").lower())
    clean_addr = re.sub(r"\s+", " ", clean_addr).strip()
    return f"{clean_name}|{clean_addr}"


class BusinessLead(BaseModel):
    """Pydantic model representing a discovered business lead."""

    place_id: Optional[str] = Field(default=None, description="Unique place or provider ID")
    business_name: str = Field(description="Official name of the business")
    category: str = Field(description="Search or business category")
    country: str = Field(description="Country name or ISO code")
    state: Optional[str] = Field(default=None, description="State or province")
    city: Optional[str] = Field(default=None, description="City name")
    address: str = Field(default="", description="Full formatted address")
    website: Optional[str] = Field(default=None, description="Official website URL")
    website_status: Literal["website_found", "no_website_found"] = Field(
        default="no_website_found",
        description="Website availability status"
    )
    source: str = Field(default="web_search", description="Discovery source (osm_overpass, web_search, google_places)")
    source_url: Optional[str] = Field(default=None, description="Source listing or reference URL")
    maps_url: Optional[str] = Field(default=None, description="Maps listing URL if available")
    phone: Optional[str] = Field(default=None, description="Public phone number")
    rating: Optional[float] = Field(default=None, description="Public star rating")
    review_count: Optional[int] = Field(default=None, description="Total number of reviews")
    latitude: Optional[float] = Field(default=None, description="Latitude coordinate")
    longitude: Optional[float] = Field(default=None, description="Longitude coordinate")
    discovered_at: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat(),
        description="ISO 8601 timestamp of discovery"
    )

    def model_post_init(self, __context):
        # Automatically ensure website_status matches website presence and blacklist checks
        if self.website and str(self.website).strip():
            # If the website is blacklisted, reject it
            if is_blacklisted_domain(self.website):
                object.__setattr__(self, "website", None)
                object.__setattr__(self, "website_status", "no_website_found")
            else:
                clean_url = str(self.website).strip()
                if not clean_url.startswith(("http://", "https://")):
                    clean_url = "https://" + clean_url
                object.__setattr__(self, "website", clean_url)
                object.__setattr__(self, "website_status", "website_found")
        else:
            object.__setattr__(self, "website", None)
            object.__setattr__(self, "website_status", "no_website_found")


class SearchCriteria(BaseModel):
    """Search query parameters."""

    category: str
    country: str
    city: Optional[str] = None
    state: Optional[str] = None
    limit: int = Field(default=20, ge=1, le=100)
    provider: str = Field(default="auto", description="Provider to use: auto, osm, web, google")


class SearchSummary(BaseModel):
    """Execution summary of a discovery search."""

    category: str
    country: str
    city: Optional[str] = None
    state: Optional[str] = None
    limit: int
    provider_used: str = "auto"
    total_discovered: int = 0
    unique_discovered: int = 0
    websites_found: int = 0
    no_website_found: int = 0
    osm_results_count: int = 0
    web_results_count: int = 0
    google_results_count: int = 0
    duplicates_removed: int = 0
    records_stored_or_updated: int = 0
    is_india: bool = False
    international_count: int = 0
    india_count: int = 0
    csv_export_path: Optional[str] = None
    json_export_path: Optional[str] = None
