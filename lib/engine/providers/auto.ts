/**
 * Auto Discovery Multi-Provider for CLDS ($0 Cost combining OSM + Web Search).
 */

import { BusinessLead, SearchCriteria, normalizeWebsite, normalizeNameAddress } from "../models";
import { OSMDiscoveryProvider } from "./osm";
import { WebSearchProvider } from "./web_search";

export class AutoDiscoveryProvider {
  private osm = new OSMDiscoveryProvider();
  private web = new WebSearchProvider();

  async searchWithStats(criteria: SearchCriteria): Promise<{
    leads: BusinessLead[];
    osmCount: number;
    webCount: number;
  }> {
    let osmLeads: BusinessLead[] = [];
    let webLeads: BusinessLead[] = [];

    try {
      osmLeads = await this.osm.search(criteria);
    } catch {
      osmLeads = [];
    }

    try {
      webLeads = await this.web.search(criteria);
    } catch {
      webLeads = [];
    }

    const osmCount = osmLeads.length;
    const webCount = webLeads.length;

    const seenWebsites = new Set<string>();
    const seenNameAddrs = new Set<string>();
    const seenPlaceIds = new Set<string>();
    const merged: BusinessLead[] = [];

    for (const lead of [...osmLeads, ...webLeads]) {
      if (lead.place_id && seenPlaceIds.has(lead.place_id)) continue;

      const normWeb = normalizeWebsite(lead.website);
      if (normWeb && seenWebsites.has(normWeb)) continue;

      const nameAddr = normalizeNameAddress(lead.business_name, lead.address);
      if (seenNameAddrs.has(nameAddr)) continue;

      if (lead.place_id) seenPlaceIds.add(lead.place_id);
      if (normWeb) seenWebsites.add(normWeb);
      if (nameAddr) seenNameAddrs.add(nameAddr);

      merged.push(lead);
      if (merged.length >= criteria.limit) break;
    }

    return { leads: merged, osmCount, webCount };
  }

  async search(criteria: SearchCriteria): Promise<BusinessLead[]> {
    const { leads } = await this.searchWithStats(criteria);
    return leads;
  }
}
