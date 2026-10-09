"""Web Search Discovery Provider for CLDS ($0 cost via public web search)."""

import html
import re
import urllib.parse
import httpx
from typing import List, Optional, Tuple, Dict
from clds.models import (
    BusinessLead,
    SearchCriteria,
    is_blacklisted_domain,
    is_likely_official_domain,
    extract_domain,
)
from clds.providers.base import BaseDiscoveryProvider


def clean_title_to_business_name(raw_title: str, city: Optional[str] = None) -> str:
    """Extract clean business brand name from SERP title."""
    title = html.unescape(raw_title).strip()
    
    # Remove HTML tags if present
    title = re.sub(r"<[^>]+>", "", title)
    
    # Split by standard title delimiters (| , - , : , – , —)
    parts = [p.strip() for p in re.split(r"\s+[|\-–—:]\s+", title) if p.strip()]
    if not parts:
        return title

    candidate = parts[0]
    
    # If first part is a generic breadcrumb like "Products", "Collections", "Category", "Home", "Items", "Catalog"
    generic_words = {"products", "collections", "category", "categories", "home", "items", "catalog", "all products", "shop all", "menu"}
    if candidate.lower() in generic_words and len(parts) > 1:
        candidate = parts[1]

    # If candidate is a generic prefix like "Top 10" or "Best", strip that prefix
    candidate = re.sub(r"^(top\s+\d+|best|the\s+best|local)\s+", "", candidate, flags=re.IGNORECASE).strip()

    # Clean common suffixes
    clean = re.sub(r"(?i)\s+(official\s+site|official\s+website|home|online\s+store|store|shop)$", "", candidate)
    if city:
        clean = re.sub(rf"(?i)\s+(in|,)?\s*{re.escape(city)}\b.*", "", clean)

    clean = re.sub(r"\s+", " ", clean).strip()
    return clean if len(clean) >= 2 else title


def is_listicle_or_generic_title(name: str, category: str) -> bool:
    """Check if the extracted name is a generic listicle or directory headline."""
    name_clean = name.strip().lower()
    
    # Single generic breadcrumbs
    if name_clean in {"products", "collections", "category", "categories", "home", "items", "catalog", "cart", "checkout", "login", "search"}:
        return True

    # Check if purely numbers or generic words
    if re.match(r"^(\d+|\bthe\b|\bbest\b|\btop\b|\bgreat\b|\bguide\b|\bon\s+our\s+radar\b)", name_clean):
        # If it contains phrases like "best gift shops", "10 gift stores", "15 best"
        if re.search(r"\b(best|top|guide|shops?|stores?|cafes?|restaurants?)\b", name_clean):
            words = name_clean.split()
            if len(words) <= 5 and any(w in name_clean for w in ["best", "top", "guide", "15", "10", "20", "5", "radar"]):
                return True

    # Reject if name is identical to category
    cat_clean = category.strip().lower()
    if name_clean in [cat_clean, f"best {cat_clean}", f"top {cat_clean}", "gift shops", "gift stores", "cafes"]:
        return True

    return False


class WebSearchProvider(BaseDiscoveryProvider):
    """Discovers real local businesses through public web search ($0 cost)."""

    DDG_HTML_ENDPOINT = "https://html.duckduckgo.com/html/"
    DDG_LITE_ENDPOINT = "https://lite.duckduckgo.com/lite/"

    def __init__(self):
        self.headers = {
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/120.0.0.0 Safari/537.36"
            ),
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
        }

    def _build_queries(self, criteria: SearchCriteria) -> List[str]:
        city_str = criteria.city or ""
        state_str = criteria.state or ""
        country_str = criteria.country or ""
        
        loc_tokens = [t for t in [city_str, state_str, country_str] if t]
        loc = ", ".join(loc_tokens)

        queries = [
            f"{criteria.category} in {loc} official site",
            f"local {criteria.category} {city_str} {country_str}",
            f"{criteria.category} {loc} website",
        ]
        return queries

    def _parse_duckduckgo_html(self, html_content: str) -> List[Dict[str, str]]:
        """Parse raw DuckDuckGo HTML for result titles, URLs, and snippets."""
        results = []
        
        pattern = re.compile(
            r'<a[^>]+class="[^"]*result__a[^"]*"[^>]+href="([^"]+)"[^>]*>(.*?)</a>',
            re.IGNORECASE | re.DOTALL,
        )
        
        for match in pattern.finditer(html_content):
            raw_url = match.group(1)
            raw_title = match.group(2)
            
            clean_url = raw_url
            if "/l/?uddg=" in raw_url or "duckduckgo.com/l/?" in raw_url:
                parsed = urllib.parse.urlparse(raw_url)
                qs = urllib.parse.parse_qs(parsed.query)
                if "uddg" in qs:
                    clean_url = qs["uddg"][0]

            clean_title = re.sub(r"<[^>]+>", "", raw_title).strip()
            if clean_url and clean_title:
                results.append({
                    "url": clean_url,
                    "title": html.unescape(clean_title),
                })

        return results

    def _evaluate_candidate(
        self,
        item: Dict[str, str],
        criteria: SearchCriteria,
    ) -> Optional[BusinessLead]:
        """Evaluate a SERP result item and determine whether it represents a real business lead."""
        url = item["url"]
        title = item["title"]

        domain = extract_domain(url)
        if not domain:
            return None

        # Check if domain is blacklisted (directory, social, aggregator)
        is_directory = is_blacklisted_domain(domain)

        business_name = clean_title_to_business_name(title, criteria.city)
        if not business_name or len(business_name) < 2:
            return None

        # Discard generic listicles/articles (e.g. "THE 15 BEST Gift Shops", "Top 10 Gift Stores")
        if is_listicle_or_generic_title(business_name, criteria.category):
            return None

        # If it's a directory/aggregator result (e.g. Yelp, TripAdvisor listing),
        # we can record the business name found in the title, but mark website as no_website_found.
        if is_directory:
            website = None
            website_status = "no_website_found"
            source_url = url
        else:
            # Check if domain name is likely the official website of this business
            if is_likely_official_domain(business_name, url):
                website = url
                website_status = "website_found"
                source_url = url
            else:
                website = None
                website_status = "no_website_found"
                source_url = url

        city_display = criteria.city or ""
        address_display = f"{city_display}, {criteria.country}" if city_display else criteria.country

        return BusinessLead(
            place_id=None,
            business_name=business_name,
            category=criteria.category,
            country=criteria.country,
            state=criteria.state,
            city=criteria.city,
            address=address_display,
            website=website,
            website_status=website_status,
            source="web_search",
            source_url=source_url,
        )

    def search(self, criteria: SearchCriteria) -> List[BusinessLead]:
        """Execute public web search discovery."""
        leads: List[BusinessLead] = []
        queries = self._build_queries(criteria)
        seen_names = set()

        with httpx.Client(timeout=15.0, headers=self.headers, follow_redirects=True) as client:
            for q in queries:
                try:
                    resp = client.post(
                        self.DDG_HTML_ENDPOINT,
                        data={"q": q, "b": ""},
                    )
                    if resp.status_code == 200:
                        items = self._parse_duckduckgo_html(resp.text)
                        for item in items:
                            lead = self._evaluate_candidate(item, criteria)
                            if lead:
                                norm_name = re.sub(r"[^\w]", "", lead.business_name.lower())
                                if norm_name in seen_names:
                                    continue
                                seen_names.add(norm_name)
                                leads.append(lead)
                                if len(leads) >= criteria.limit:
                                    return leads
                except Exception:
                    # Fail gracefully on network glitch or rate limits
                    continue

        return leads
