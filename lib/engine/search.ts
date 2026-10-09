import {
  BusinessLead,
  SearchCriteria,
  SearchSummary,
  normalizeWebsite,
  normalizeNameAddress,
} from "./models";
import { OSMDiscoveryProvider } from "./providers/osm";
import { WebSearchProvider } from "./providers/web_search";
import { AutoDiscoveryProvider } from "./providers/auto";
import { EngineDatabase } from "./database";

export function isIndiaMarket(countryStr: string): boolean {
  const c = (countryStr || "").trim().toLowerCase();
  return ["in", "india", "ind"].includes(c);
}

export function deduplicateLeadList(leads: BusinessLead[]): BusinessLead[] {
  const seenPlaceIds = new Set<string>();
  const seenWebsites = new Set<string>();
  const seenNameAddrs = new Set<string>();
  const uniqueLeads: BusinessLead[] = [];

  for (const lead of leads) {
    if (lead.place_id && seenPlaceIds.has(lead.place_id)) {
      continue;
    }

    const normWeb = normalizeWebsite(lead.website);
    if (normWeb && seenWebsites.has(normWeb)) {
      continue;
    }

    const nameAddr = normalizeNameAddress(lead.business_name, lead.address);
    if (nameAddr && seenNameAddrs.has(nameAddr)) {
      continue;
    }

    if (lead.place_id) seenPlaceIds.add(lead.place_id);
    if (normWeb) seenWebsites.add(normWeb);
    if (nameAddr) seenNameAddrs.add(nameAddr);

    uniqueLeads.push(lead);
  }

  return uniqueLeads;
}

export class LeadDiscoveryService {
  private db: EngineDatabase;
  private autoProvider: AutoDiscoveryProvider;
  private osmProvider: OSMDiscoveryProvider;
  private webSearchProvider: WebSearchProvider;

  constructor(db?: EngineDatabase) {
    this.db = db || new EngineDatabase();
    this.autoProvider = new AutoDiscoveryProvider();
    this.osmProvider = new OSMDiscoveryProvider();
    this.webSearchProvider = new WebSearchProvider();
  }

  async executeSearch(
    criteria: SearchCriteria
  ): Promise<{ summary: SearchSummary; leads: BusinessLead[] }> {
    const providerName = (criteria.provider || "auto").toLowerCase().trim();

    let rawLeads: BusinessLead[] = [];
    let osmCount = 0;
    let webCount = 0;
    let googleCount = 0;

    if (["osm", "overpass", "openstreetmap"].includes(providerName)) {
      rawLeads = await this.osmProvider.search(criteria);
      osmCount = rawLeads.length;
    } else if (["web", "web_search", "search"].includes(providerName)) {
      rawLeads = await this.webSearchProvider.search(criteria);
      webCount = rawLeads.length;
    } else {
      // Auto Provider ($0 OSM + DuckDuckGo Web Search)
      const stats = await this.autoProvider.searchWithStats(criteria);
      rawLeads = stats.leads;
      osmCount = stats.osmCount;
      webCount = stats.webCount;
    }

    let uniqueLeads = deduplicateLeadList(rawLeads);
    const duplicatesRemoved = rawLeads.length - uniqueLeads.length;

    // Truncate to limit if needed
    if (criteria.limit && uniqueLeads.length > criteria.limit) {
      uniqueLeads = uniqueLeads.slice(0, criteria.limit);
    }

    // Database upsert
    let inserted = 0;
    let updated = 0;
    try {
      const saveRes = await this.db.saveLeads(uniqueLeads);
      inserted = saveRes.inserted;
      updated = saveRes.updated;
    } catch (err) {
      console.error("Warning: DB save error during discovery:", err);
    }

    // Count website statuses
    const websitesFound = uniqueLeads.filter((l) => l.website_status === "website_found").length;
    const noWebsiteFound = uniqueLeads.filter((l) => l.website_status === "no_website_found").length;

    // Regional breakdown
    const isIndia = isIndiaMarket(criteria.country);
    const indiaCount = isIndia ? uniqueLeads.length : 0;
    const internationalCount = isIndia ? 0 : uniqueLeads.length;

    const summary: SearchSummary = {
      category: criteria.category,
      country: criteria.country,
      city: criteria.city,
      state: criteria.state,
      limit: criteria.limit,
      provider_used: criteria.provider || "auto",
      total_discovered: rawLeads.length,
      unique_discovered: uniqueLeads.length,
      websites_found: websitesFound,
      no_website_found: noWebsiteFound,
      osm_results_count: osmCount,
      web_results_count: webCount,
      google_results_count: googleCount,
      duplicates_removed: duplicatesRemoved,
      records_stored_or_updated: inserted + updated,
      is_india: isIndia,
      international_count: internationalCount,
      india_count: indiaCount,
      csv_export_path: null,
      json_export_path: null,
    };

    return { summary, leads: uniqueLeads };
  }
}
