"""Google Places API (New) Provider for CLDS."""

import os
import httpx
from typing import List, Optional, Dict, Any
from clds.models import BusinessLead, SearchCriteria
from clds.providers.base import BaseDiscoveryProvider


class GooglePlacesAPIError(Exception):
    """Base exception for Google Places API errors."""
    pass


class InvalidAPIKeyError(GooglePlacesAPIError):
    """Raised when Google Places API key is missing or invalid."""
    pass


class GooglePlacesProvider(BaseDiscoveryProvider):
    """Google Places API (New) implementation."""

    SEARCH_TEXT_ENDPOINT = "https://places.googleapis.com/v1/places:searchText"

    # Minimal valid FieldMask containing only required V1 discovery fields
    FIELD_MASK = ",".join([
        "places.id",
        "places.displayName",
        "places.primaryType",
        "places.formattedAddress",
        "places.websiteUri",
        "places.googleMapsUri",
        "places.rating",
        "places.userRatingCount",
        "nextPageToken",
    ])

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.getenv("GOOGLE_MAPS_API_KEY", "").strip()

    def _validate_api_key(self) -> None:
        if not self.api_key or self.api_key == "your_google_maps_api_key_here":
            raise InvalidAPIKeyError(
                "GOOGLE_MAPS_API_KEY is missing or invalid. "
                "Please configure your Google Cloud Places API key in .env or set GOOGLE_MAPS_API_KEY in your environment."
            )

    def _build_text_query(self, criteria: SearchCriteria) -> str:
        parts = [criteria.category]
        location_parts = []
        if criteria.city:
            location_parts.append(criteria.city)
        if criteria.state:
            location_parts.append(criteria.state)
        if criteria.country:
            location_parts.append(criteria.country)

        if location_parts:
            parts.append("in " + ", ".join(location_parts))
        return " ".join(parts)

    def _map_place_to_lead(self, place: Dict[str, Any], criteria: SearchCriteria) -> BusinessLead:
        place_id = place.get("id") or ""
        display_name_obj = place.get("displayName") or {}
        business_name = display_name_obj.get("text") or "Unknown Business"
        formatted_address = place.get("formattedAddress") or ""
        
        category = place.get("primaryType") or criteria.category
        city = criteria.city
        state = criteria.state
        country = criteria.country

        website_uri = place.get("websiteUri")
        website = str(website_uri).strip() if website_uri else None
        website_status = "website_found" if website else "no_website_found"

        maps_url = place.get("googleMapsUri")
        rating = place.get("rating")
        review_count = place.get("userRatingCount")

        return BusinessLead(
            place_id=place_id,
            business_name=business_name,
            category=category,
            country=country,
            state=state,
            city=city,
            address=formatted_address,
            website=website,
            website_status=website_status,
            source="google_places",
            source_url=maps_url,
            maps_url=maps_url,
            phone=None,
            rating=float(rating) if rating is not None else None,
            review_count=int(review_count) if review_count is not None else None,
            latitude=None,
            longitude=None,
        )

    def search(self, criteria: SearchCriteria) -> List[BusinessLead]:
        """Execute Google Places API (New) Text Search."""
        self._validate_api_key()

        leads: List[BusinessLead] = []
        text_query = self._build_text_query(criteria)
        
        headers = {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": self.api_key,
            "X-Goog-FieldMask": self.FIELD_MASK,
        }

        page_token: Optional[str] = None
        remaining = criteria.limit

        with httpx.Client(timeout=20.0) as client:
            while remaining > 0:
                page_size = min(remaining, 20)
                payload: Dict[str, Any] = {
                    "textQuery": text_query,
                    "pageSize": page_size,
                }
                
                # Optional regionCode hint if country is a 2-character ISO code
                if criteria.country and len(criteria.country.strip()) == 2:
                    payload["regionCode"] = criteria.country.strip().upper()

                if page_token:
                    payload["pageToken"] = page_token

                try:
                    response = client.post(
                        self.SEARCH_TEXT_ENDPOINT,
                        headers=headers,
                        json=payload,
                    )
                except httpx.RequestError as exc:
                    raise GooglePlacesAPIError(f"Network error while connecting to Google Places API: {exc}") from exc

                if response.status_code == 400:
                    resp_json = response.json()
                    error_msg = resp_json.get("error", {}).get("message", response.text)
                    if "API key not valid" in error_msg or "INVALID_ARGUMENT" in error_msg and "API_KEY" in error_msg:
                        raise InvalidAPIKeyError(f"Invalid Google Places API key: {error_msg}")
                    raise GooglePlacesAPIError(f"Google Places API Bad Request (400): {error_msg}")
                elif response.status_code == 403:
                    resp_json = response.json()
                    error_msg = resp_json.get("error", {}).get("message", response.text)
                    raise InvalidAPIKeyError(
                        f"Google Places API permission/quota error (403): {error_msg}. "
                        "Ensure 'Places API (New)' is enabled and billing is active in Google Cloud Console."
                    )
                elif response.status_code != 200:
                    raise GooglePlacesAPIError(
                        f"Google Places API returned HTTP {response.status_code}: {response.text}"
                    )

                data = response.json()
                places = data.get("places", [])
                if not places:
                    break

                for place in places:
                    lead = self._map_place_to_lead(place, criteria)
                    leads.append(lead)
                    if len(leads) >= criteria.limit:
                        break

                page_token = data.get("nextPageToken")
                if not page_token or len(leads) >= criteria.limit:
                    break

                remaining = criteria.limit - len(leads)

        return leads
