"""OpenStreetMap (Overpass API) Discovery Provider for CLDS."""

import re
import httpx
from typing import List, Optional, Dict, Any
from clds.models import BusinessLead, SearchCriteria
from clds.providers.base import BaseDiscoveryProvider


# Common category to OSM key/value mappings
OSM_CATEGORY_MAP = {
    "gift stores": '["shop"="gift"]',
    "gift store": '["shop"="gift"]',
    "gift shop": '["shop"="gift"]',
    "gifts": '["shop"="gift"]',
    "cafes": '["amenity"="cafe"]',
    "cafe": '["amenity"="cafe"]',
    "coffee shop": '["amenity"="cafe"]',
    "coffee": '["amenity"="cafe"]',
    "restaurants": '["amenity"="restaurant"]',
    "restaurant": '["amenity"="restaurant"]',
    "bakery": '["shop"="bakery"]',
    "bakeries": '["shop"="bakery"]',
    "clothing boutiques": '["shop"="clothes"]',
    "clothing": '["shop"="clothes"]',
    "boutique": '["shop"="boutique"]',
    "salons": '["shop"~"beauty|hairdresser"]',
    "salon": '["shop"~"beauty|hairdresser"]',
    "beauty salon": '["shop"="beauty"]',
    "hair salon": '["shop"="hairdresser"]',
    "perfume stores": '["shop"="perfumery"]',
    "perfumery": '["shop"="perfumery"]',
    "florists": '["shop"="florist"]',
    "florist": '["shop"="florist"]',
    "flower shop": '["shop"="florist"]',
    "bookstores": '["shop"="books"]',
    "bookstore": '["shop"="books"]',
    "jewelry": '["shop"="jewelry"]',
    "jewelry stores": '["shop"="jewelry"]',
    "hotels": '["tourism"="hotel"]',
    "hotel": '["tourism"="hotel"]',
    "art gallery": '["tourism"="gallery"]',
    "art galleries": '["tourism"="gallery"]',
    "event planners": '["office"="event_management"]',
    "interior designers": '["craft"="interior_decorator"]',
    "photographers": '["craft"="photographer"]',
}


class OSMDiscoveryProvider(BaseDiscoveryProvider):
    """Discovers real local businesses through public OpenStreetMap Overpass API ($0 cost)."""

    OVERPASS_ENDPOINTS = [
        "https://overpass-api.de/api/interpreter",
        "https://overpass.kumi.systems/api/interpreter",
    ]

    def _get_osm_tag_filter(self, category: str) -> str:
        cat_lower = category.lower().strip()
        if cat_lower in OSM_CATEGORY_MAP:
            return OSM_CATEGORY_MAP[cat_lower]

        # Check partial keyword matches
        for key, tag in OSM_CATEGORY_MAP.items():
            if key in cat_lower or cat_lower in key:
                return tag

        # Dynamic fallback: search shop, amenity, or craft with sanitized keyword
        clean_word = re.sub(r"[^\w]", "", cat_lower)
        if clean_word:
            return f'["shop"~"{clean_word}",i]'
        return '["shop"]'

    def _build_overpass_query(self, criteria: SearchCriteria) -> str:
        tag_filter = self._get_osm_tag_filter(criteria.category)
        city_name = (criteria.city or "").strip()
        
        limit_val = max(criteria.limit, 20)

        if city_name:
            # Query within city administrative area or boundary
            query = f"""
            [out:json][timeout:25];
            (
              area["name"="{city_name}"]["admin_level"~"4|6|7|8|9|10"]->.searchArea;
              area["name"="{city_name}"]->.searchArea;
            );
            (
              node{tag_filter}(area.searchArea);
              way{tag_filter}(area.searchArea);
            );
            out center {limit_val};
            """
        else:
            country_name = criteria.country.strip()
            query = f"""
            [out:json][timeout:25];
            area["name"="{country_name}"]->.searchArea;
            (
              node{tag_filter}(area.searchArea);
              way{tag_filter}(area.searchArea);
            );
            out center {limit_val};
            """
        return query

    def _map_element_to_lead(self, elem: Dict[str, Any], criteria: SearchCriteria) -> Optional[BusinessLead]:
        tags = elem.get("tags", {})
        name = tags.get("name")
        if not name or not str(name).strip():
            return None

        elem_type = elem.get("type", "node")
        elem_id = elem.get("id", "")
        place_id = f"osm_{elem_type}_{elem_id}"
        source_url = f"https://www.openstreetmap.org/{elem_type}/{elem_id}"

        # Extract address components from OSM tags
        street = tags.get("addr:street", "")
        housenumber = tags.get("addr:housenumber", "")
        postcode = tags.get("addr:postcode", "")
        city = tags.get("addr:city") or criteria.city or ""
        state = tags.get("addr:state") or criteria.state
        country = tags.get("addr:country") or criteria.country

        addr_parts = []
        if housenumber and street:
            addr_parts.append(f"{housenumber} {street}")
        elif street:
            addr_parts.append(street)
        if city:
            addr_parts.append(city)
        if state:
            addr_parts.append(state)
        if postcode:
            addr_parts.append(postcode)
        if country:
            addr_parts.append(country)

        full_address = ", ".join(addr_parts) if addr_parts else (city or criteria.country)

        # Website extraction
        website = tags.get("website") or tags.get("contact:website") or tags.get("url")
        website_str = str(website).strip() if website else None

        phone = tags.get("phone") or tags.get("contact:phone")

        # Category from OSM tag
        osm_cat = tags.get("shop") or tags.get("amenity") or tags.get("craft") or tags.get("tourism") or criteria.category

        # Location coordinates
        lat = elem.get("lat") or (elem.get("center", {}).get("lat") if "center" in elem else None)
        lon = elem.get("lon") or (elem.get("center", {}).get("lon") if "center" in elem else None)

        return BusinessLead(
            place_id=place_id,
            business_name=str(name).strip(),
            category=osm_cat,
            country=criteria.country,
            state=state,
            city=city or criteria.city,
            address=full_address,
            website=website_str,
            source="osm_overpass",
            source_url=source_url,
            phone=str(phone).strip() if phone else None,
            latitude=float(lat) if lat is not None else None,
            longitude=float(lon) if lon is not None else None,
        )

    def search(self, criteria: SearchCriteria) -> List[BusinessLead]:
        """Query Overpass API for real matching businesses."""
        query = self._build_overpass_query(criteria)
        leads: List[BusinessLead] = []

        headers = {
            "User-Agent": "CLDS-Discovery-Tool/1.0 (client-lead-discovery)",
        }

        with httpx.Client(timeout=25.0) as client:
            for endpoint in self.OVERPASS_ENDPOINTS:
                try:
                    response = client.post(endpoint, data={"data": query}, headers=headers)
                    if response.status_code == 200:
                        data = response.json()
                        elements = data.get("elements", [])
                        for elem in elements:
                            lead = self._map_element_to_lead(elem, criteria)
                            if lead:
                                leads.append(lead)
                                if len(leads) >= criteria.limit:
                                    break
                        if leads:
                            return leads
                except Exception:
                    # Try next endpoint gracefully on timeout/fail
                    continue

        return leads
