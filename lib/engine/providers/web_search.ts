/**
 * Web Search Discovery Provider for CLDS ($0 Cost via public web search).
 */

import { BusinessLead, SearchCriteria, extractDomain, isLikelyOfficialDomain } from "../models";
import { isBlacklistedDomain } from "../blacklist";

export function cleanTitleToBusinessName(rawTitle: string, city?: string): string {
  let title = rawTitle.replace(/<[^>]+>/g, "").trim();

  // Split by title delimiters
  const parts = title.split(/\s+[|\-–—:]\s+/).map((p) => p.trim()).filter(Boolean);
  if (!parts.length) return title;

  let candidate = parts[0];
  const genericWords = new Set(["products", "collections", "category", "categories", "home", "items", "catalog", "all products", "shop all", "menu"]);
  if (genericWords.has(candidate.toLowerCase()) && parts.length > 1) {
    candidate = parts[1];
  }

  // Strip generic prefixes (Top 10, Best, etc.)
  candidate = candidate.replace(/^(top\s+\d+|best|the\s+best|local)\s+/i, "").trim();

  // Strip common trailing suffixes
  candidate = candidate.replace(/\s+(official\s+site|official\s+website|home|online\s+store|store|shop)$/i, "").trim();

  if (city) {
    const cityRegex = new RegExp(`\\s+(in|,)?\\s*${city}\\b.*`, "i");
    candidate = candidate.replace(cityRegex, "").trim();
  }

  return candidate.length >= 2 ? candidate : title;
}

export function isListicleOrGenericTitle(name: string, category: string): boolean {
  const clean = name.trim().toLowerCase();
  const genericWords = new Set(["products", "collections", "category", "categories", "home", "items", "catalog", "cart", "checkout", "login", "search"]);
  if (genericWords.has(clean)) return true;

  if (/^(\d+|\bthe\b|\bbest\b|\btop\b|\bgreat\b|\bguide\b|\bon\s+our\s+radar\b)/i.test(clean)) {
    if (/\b(best|top|guide|shops?|stores?|cafes?|restaurants?)\b/i.test(clean)) {
      const words = clean.split(/\s+/);
      if (words.length <= 5) return true;
    }
  }

  const catClean = category.trim().toLowerCase();
  if (clean === catClean || clean === `best ${catClean}` || clean === `top ${catClean}`) {
    return true;
  }

  return false;
}

export class WebSearchProvider {
  private endpoint = "https://html.duckduckgo.com/html/";

  private buildQueries(criteria: SearchCriteria): string[] {
    const loc = [criteria.city, criteria.state, criteria.country].filter(Boolean).join(", ");
    return [
      `${criteria.category} in ${loc} official site`,
      `local ${criteria.category} ${criteria.city || ""} ${criteria.country}`,
      `${criteria.category} ${loc} website`,
    ];
  }

  private parseDuckDuckGoHtml(html: string): Array<{ url: string; title: string }> {
    const results: Array<{ url: string; title: string }> = [];
    const regex = /<a[^>]+class="[^"]*result__a[^"]*"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
    let match;

    while ((match = regex.exec(html)) !== null) {
      const rawUrl = match[1];
      const rawTitle = match[2];

      let cleanUrl = rawUrl;
      if (rawUrl.includes("/l/?uddg=") || rawUrl.includes("duckduckgo.com/l/?")) {
        try {
          const parsed = new URL(rawUrl, "https://html.duckduckgo.com");
          const uddg = parsed.searchParams.get("uddg");
          if (uddg) cleanUrl = decodeURIComponent(uddg);
        } catch {}
      }

      const cleanTitle = rawTitle.replace(/<[^>]+>/g, "").trim();
      if (cleanUrl && cleanTitle) {
        results.push({ url: cleanUrl, title: cleanTitle });
      }
    }

    return results;
  }

  private evaluateCandidate(item: { url: string; title: string }, criteria: SearchCriteria): BusinessLead | null {
    const { url, title } = item;
    const domain = extractDomain(url);
    if (!domain) return null;

    const isDirectory = isBlacklistedDomain(domain);
    const businessName = cleanTitleToBusinessName(title, criteria.city);
    if (!businessName || businessName.length < 2) return null;

    if (isListicleOrGenericTitle(businessName, criteria.category)) return null;

    let website: string | null = null;
    let websiteStatus: "website_found" | "no_website_found" = "no_website_found";

    if (isDirectory) {
      website = null;
      websiteStatus = "no_website_found";
    } else {
      if (isLikelyOfficialDomain(businessName, url)) {
        website = url;
        websiteStatus = "website_found";
      } else {
        website = null;
        websiteStatus = "no_website_found";
      }
    }

    const cityDisplay = criteria.city || "";
    const addressDisplay = cityDisplay ? `${cityDisplay}, ${criteria.country}` : criteria.country;

    return {
      place_id: `web_${Buffer.from(businessName + (website || "")).toString("hex").slice(0, 16)}`,
      business_name: businessName,
      category: criteria.category,
      country: criteria.country,
      state: criteria.state,
      city: criteria.city,
      address: addressDisplay,
      website,
      website_status: websiteStatus,
      source: "web_search",
      source_url: url,
      discovered_at: new Date().toISOString(),
    };
  }

  async search(criteria: SearchCriteria): Promise<BusinessLead[]> {
    const leads: BusinessLead[] = [];
    const queries = this.buildQueries(criteria);
    const seenNames = new Set<string>();

    for (const q of queries) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);

        const res = await fetch(this.endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          },
          body: `q=${encodeURIComponent(q)}&b=`,
          signal: controller.signal,
        });

        clearTimeout(timeout);

        if (res.ok) {
          const html = await res.text();
          const items = this.parseDuckDuckGoHtml(html);
          for (const item of items) {
            const lead = this.evaluateCandidate(item, criteria);
            if (lead) {
              const normName = lead.business_name.toLowerCase().replace(/[^\w]/g, "");
              if (seenNames.has(normName)) continue;
              seenNames.add(normName);
              leads.push(lead);
              if (leads.length >= criteria.limit) return leads;
            }
          }
        }
      } catch {
        continue;
      }
    }

    return leads;
  }
}
