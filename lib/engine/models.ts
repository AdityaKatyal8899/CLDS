/**
 * Data models and normalization helpers for CLDS TypeScript engine.
 */

import { isBlacklistedDomain } from "./blacklist";

export interface BusinessLead {
  place_id: string;
  business_name: string;
  category: string;
  country: string;
  state?: string;
  city?: string;
  address?: string;
  website?: string | null;
  website_status: "website_found" | "no_website_found" | "verified" | "issues_detected" | "unverified";
  source: string;
  source_url?: string;
  maps_url?: string;
  phone?: string;
  rating?: number;
  review_count?: number;
  latitude?: number;
  longitude?: number;
  discovered_at: string;
}

export interface SearchCriteria {
  category: string;
  country: string;
  city?: string;
  state?: string;
  limit: number;
  provider?: "auto" | "osm" | "web" | "google";
}

export interface SearchSummary {
  category: string;
  country: string;
  city?: string;
  state?: string;
  limit: number;
  provider_used: string;
  total_discovered: number;
  unique_discovered: number;
  websites_found: number;
  no_website_found: number;
  osm_results_count: number;
  web_results_count: number;
  google_results_count?: number;
  duplicates_removed: number;
  records_stored_or_updated: number;
  is_india?: boolean;
  international_count?: number;
  india_count?: number;
  csv_export_path?: string | null;
  json_export_path?: string | null;
}

export function normalizeWebsite(url: string | null | undefined): string | null {
  if (!url || typeof url !== "string") return null;
  let clean = url.trim();
  if (!clean) return null;
  if (!/^https?:\/\//i.test(clean)) {
    clean = "https://" + clean;
  }
  try {
    const parsed = new URL(clean);
    let domain = parsed.hostname.toLowerCase();
    if (domain.startsWith("www.")) {
      domain = domain.slice(4);
    }
    const path = parsed.pathname.replace(/\/$/, "");
    if (!domain) return null;
    return `${domain}${path}`;
  } catch {
    return clean.toLowerCase().replace(/\/$/, "");
  }
}

export function extractDomain(url: string | null | undefined): string | null {
  if (!url || typeof url !== "string") return null;
  let clean = url.trim();
  if (!clean) return null;
  if (!/^https?:\/\//i.test(clean)) {
    clean = "https://" + clean;
  }
  try {
    const parsed = new URL(clean);
    let domain = parsed.hostname.toLowerCase();
    if (domain.startsWith("www.")) {
      domain = domain.slice(4);
    }
    return domain || null;
  } catch {
    return null;
  }
}

export function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone || typeof phone !== "string") return null;
  const clean = phone.trim();
  if (!clean) return null;
  const hasPlus = clean.startsWith("+");
  const digits = clean.replace(/\D/g, "");
  if (!digits) return null;
  return hasPlus ? `+${digits}` : digits;
}

export function normalizeNameAddress(name: string, address?: string): string {
  const cleanName = (name || "").toLowerCase().replace(/[^\w\s]/g, "").replace(/\s+/g, " ").trim();
  const cleanAddr = (address || "").toLowerCase().replace(/[^\w\s]/g, "").replace(/\s+/g, " ").trim();
  return `${cleanName}|${cleanAddr}`;
}

export function isLikelyOfficialDomain(businessName: string, url: string): boolean {
  const domain = extractDomain(url);
  if (!domain || isBlacklistedDomain(domain)) return false;

  // Strip TLD (e.g. .com, .co.uk, .org, .net, .in)
  const domainCore = domain.replace(/\.[a-z]{2,}(\.[a-z]{2,})?$/, "").replace(/[^a-z0-9]/g, "");

  // Clean business name tokens
  const nameClean = businessName.toLowerCase().replace(/[^a-z0-9\s]/g, "");
  const genericWords = new Set(["the", "and", "store", "shop", "cafe", "ltd", "inc", "co", "llc", "official"]);
  const words = nameClean.split(/\s+/).filter((w) => w.length > 2 && !genericWords.has(w));

  if (words.length === 0) {
    const fallbackWords = nameClean.split(/\s+/).filter((w) => w.length > 1);
    if (fallbackWords.length === 0) return true;
    return fallbackWords.some((w) => domainCore.includes(w)) || domainCore.includes(nameClean.replace(/\s+/g, ""));
  }

  const matchCount = words.filter((w) => domainCore.includes(w)).length;
  return matchCount >= 1 || domainCore.includes(nameClean.replace(/\s+/g, ""));
}
