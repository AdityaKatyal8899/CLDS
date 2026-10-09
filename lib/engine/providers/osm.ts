/**
 * OpenStreetMap (Overpass API) Discovery Provider for CLDS ($0 Cost).
 */

import { BusinessLead, SearchCriteria } from "../models";
import { isBlacklistedDomain } from "../blacklist";

export const OSM_CATEGORY_MAP: Record<string, string> = {
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
  "wedding planners": '["office"="event_management"]',
  "interior designers": '["craft"="interior_decorator"]',
  "photographers": '["craft"="photographer"]',
  "dentists": '["amenity"="dentist"]',
  "gyms": '["leisure"="fitness_centre"]',
  "fitness": '["leisure"="fitness_centre"]',
  "plumbers": '["craft"="plumber"]',
  "electricians": '["craft"="electrician"]',
};

export class OSMDiscoveryProvider {
  private endpoints = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
  ];

  private getTagFilter(category: string): string {
    const catLower = category.toLowerCase().trim();
    if (OSM_CATEGORY_MAP[catLower]) {
      return OSM_CATEGORY_MAP[catLower];
    }
    for (const [key, tag] of Object.entries(OSM_CATEGORY_MAP)) {
      if (key.includes(catLower) || catLower.includes(key)) {
        return tag;
      }
    }
    const cleanWord = catLower.replace(/[^\w]/g, "");
    if (cleanWord) {
      return `["shop"~"${cleanWord}",i]`;
    }
    return '["shop"]';
  }

  private buildOverpassQuery(criteria: SearchCriteria): string {
    const tagFilter = this.getTagFilter(criteria.category);
    const cityName = (criteria.city || "").trim();
    const limitVal = Math.max(criteria.limit, 20);

    if (cityName) {
      return `
        [out:json][timeout:25];
        (
          area["name"="${cityName}"]["admin_level"~"4|6|7|8|9|10"]->.searchArea;
          area["name"="${cityName}"]->.searchArea;
        );
        (
          node${tagFilter}(area.searchArea);
          way${tagFilter}(area.searchArea);
        );
        out center ${limitVal};
      `;
    } else {
      const countryName = criteria.country.trim();
      return `
        [out:json][timeout:25];
        area["name"="${countryName}"]->.searchArea;
        (
          node${tagFilter}(area.searchArea);
          way${tagFilter}(area.searchArea);
        );
        out center ${limitVal};
      `;
    }
  }

  private mapElementToLead(elem: any, criteria: SearchCriteria): BusinessLead | null {
    const tags = elem.tags || {};
    const name = tags.name;
    if (!name || !name.trim()) return null;

    const elemType = elem.type || "node";
    const elemId = elem.id || "";
    const placeId = `osm_${elemType}_${elemId}`;
    const sourceUrl = `https://www.openstreetmap.org/${elemType}/${elemId}`;

    const street = tags["addr:street"] || "";
    const housenumber = tags["addr:housenumber"] || "";
    const postcode = tags["addr:postcode"] || "";
    const city = tags["addr:city"] || criteria.city || "";
    const state = tags["addr:state"] || criteria.state;
    const country = tags["addr:country"] || criteria.country;

    const addrParts: string[] = [];
    if (housenumber && street) addrParts.push(`${housenumber} ${street}`);
    else if (street) addrParts.push(street);
    if (city) addrParts.push(city);
    if (state) addrParts.push(state);
    if (postcode) addrParts.push(postcode);
    if (country) addrParts.push(country);

    const fullAddress = addrParts.length > 0 ? addrParts.join(", ") : city || criteria.country;

    const rawWebsite = tags.website || tags["contact:website"] || tags.url;
    let website: string | null = null;
    let websiteStatus: "website_found" | "no_website_found" = "no_website_found";

    if (rawWebsite && typeof rawWebsite === "string" && rawWebsite.trim()) {
      const cleanUrl = rawWebsite.trim().startsWith("http") ? rawWebsite.trim() : `https://${rawWebsite.trim()}`;
      if (!isBlacklistedDomain(cleanUrl)) {
        website = cleanUrl;
        websiteStatus = "website_found";
      }
    }

    const phone = tags.phone || tags["contact:phone"] || tags["contact:mobile"];
    const osmCat = tags.shop || tags.amenity || tags.craft || tags.tourism || criteria.category;

    const lat = elem.lat || (elem.center && elem.center.lat) || undefined;
    const lon = elem.lon || (elem.center && elem.center.lon) || undefined;

    return {
      place_id: placeId,
      business_name: name.trim(),
      category: osmCat,
      country: criteria.country,
      state,
      city: city || criteria.city,
      address: fullAddress,
      website,
      website_status: websiteStatus,
      source: "osm_overpass",
      source_url: sourceUrl,
      phone: phone ? String(phone).trim() : undefined,
      latitude: lat ? parseFloat(lat) : undefined,
      longitude: lon ? parseFloat(lon) : undefined,
      discovered_at: new Date().toISOString(),
    };
  }

  async search(criteria: SearchCriteria): Promise<BusinessLead[]> {
    const query = this.buildOverpassQuery(criteria);
    const leads: BusinessLead[] = [];

    for (const endpoint of this.endpoints) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 20000);

        const res = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": "CLDS-Discovery-Tool/1.0",
          },
          body: `data=${encodeURIComponent(query)}`,
          signal: controller.signal,
        });

        clearTimeout(timeout);

        if (res.ok) {
          const data = await res.json();
          const elements = data.elements || [];
          for (const elem of elements) {
            const lead = this.mapElementToLead(elem, criteria);
            if (lead) {
              leads.push(lead);
              if (leads.length >= criteria.limit) break;
            }
          }
          if (leads.length > 0) return leads;
        }
      } catch {
        continue;
      }
    }

    return leads;
  }
}
