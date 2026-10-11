import { describe, it, expect } from "vitest";
import {
  normalizeWebsite,
  normalizePhone,
  normalizeNameAddress,
  isLikelyOfficialDomain,
  isBlacklistedDomain,
  deduplicateLeadList,
  BusinessLead,
} from "@/lib/engine";
import {
  ResponsivenessChecker,
  PerformanceChecker,
  CachingChecker,
  TechnicalSEOChecker,
  AccessibilityChecker,
  ConversionUXChecker,
  WebsiteVerificationRunner,
} from "@/lib/engine/verification";

describe("TypeScript Engine: Normalization & Blacklist", () => {
  it("normalizes websites correctly", () => {
    expect(normalizeWebsite("https://www.example.com/page?ref=123#top")).toBe("example.com/page");
    expect(normalizeWebsite("HTTP://SubDomain.Target.Org/")).toBe("subdomain.target.org");
    expect(normalizeWebsite("")).toBeNull();
  });

  it("normalizes phone numbers correctly", () => {
    expect(normalizePhone("+1 (555) 123-4567")).toBe("+15551234567");
    expect(normalizePhone("09876543210")).toBe("09876543210");
  });

  it("normalizes name + address for deduplication", () => {
    const key = normalizeNameAddress("  Acme Dental Clinic LLC  ", "123 Main St, Suite 400, Chicago");
    expect(key).toBe("acme dental clinic llc|123 main st suite 400 chicago");
  });

  it("identifies directory & aggregator domains accurately", () => {
    expect(isBlacklistedDomain("https://www.yelp.com/biz/dentist")).toBe(true);
    expect(isBlacklistedDomain("https://www.facebook.com/mybusiness")).toBe(true);
    expect(isBlacklistedDomain("https://www.justdial.com/Delhi/Doctor")).toBe(true);
    expect(isBlacklistedDomain("https://www.drjohnsondental.com")).toBe(false);
  });

  it("identifies likely official domain matches", () => {
    expect(isLikelyOfficialDomain("Acme Plumbing", "acmeplumbing.com")).toBe(true);
    expect(isLikelyOfficialDomain("Star Bakery", "https://starbakery.co.uk")).toBe(true);
    expect(isLikelyOfficialDomain("Star Bakery", "https://yelp.com")).toBe(false);
  });

  it("deduplicates leads accurately", () => {
    const leads: BusinessLead[] = [
      {
        place_id: "p1",
        business_name: "Apex Auto",
        category: "mechanic",
        country: "US",
        city: "Austin",
        address: "100 South Congress",
        website: "https://apexauto.com",
        website_status: "website_found",
        source: "osm",
        discovered_at: new Date().toISOString(),
      },
      {
        place_id: "p2",
        business_name: "Apex Auto",
        category: "mechanic",
        country: "US",
        city: "Austin",
        address: "100 South Congress",
        website: "https://apexauto.com",
        website_status: "website_found",
        source: "web_search",
        discovered_at: new Date().toISOString(),
      },
      {
        place_id: "p3",
        business_name: "Unique Bakery",
        category: "bakery",
        country: "US",
        city: "Austin",
        address: "500 Lamar",
        website: "https://uniquebakery.com",
        website_status: "website_found",
        source: "osm",
        discovered_at: new Date().toISOString(),
      },
    ];

    const deduplicated = deduplicateLeadList(leads);
    expect(deduplicated).toHaveLength(2);
    expect(deduplicated[0].business_name).toBe("Apex Auto");
    expect(deduplicated[1].business_name).toBe("Unique Bakery");
  });
});

describe("TypeScript Engine: 7-Point Fast Website Verification", () => {
  const sampleHtml = `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <title>Prime Dental Care | Best Dentist in Austin</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta name="description" content="Award winning family and cosmetic dental care in Austin, TX.">
        <link rel="canonical" href="https://primedental.com">
      </head>
      <body>
        <nav class="navbar"><a href="/">Home</a><a href="/contact">Contact Us</a></nav>
        <h1>Welcome to Prime Dental Care</h1>
        <h2>Our Services</h2>
        <p>Call us today at <a href="tel:+15125551234">(512) 555-1234</a> or email us at info@primedental.com</p>
        <button>Book Appointment Now</button>
        <a href="https://instagram.com/primedental" class="social">Instagram</a>
        <img src="/hero.jpg" alt="Dental office reception">
        <form>
          <label for="name">Your Name</label>
          <input id="name" type="text">
        </form>
      </body>
    </html>
  `;

  it("evaluates mobile responsiveness correctly", () => {
    const checker = new ResponsivenessChecker();
    const result = checker.check("https://primedental.com", sampleHtml);
    expect(result.responsive).toBe(true);
    expect(result.horizontal_overflow).toBe(false);
  });

  it("evaluates performance metrics and linked resources", () => {
    const checker = new PerformanceChecker();
    const result = checker.check(
      { "content-encoding": "gzip" },
      sampleHtml,
      120
    );
    expect(result.compression_enabled).toBe(true);
    expect(result.ttfb_ms).toBe(120);
    expect(result.resource_count).toBeGreaterThanOrEqual(1);
  });

  it("evaluates HTTP caching headers", () => {
    const checker = new CachingChecker();
    const result = checker.check({
      "cache-control": "public, max-age=86400",
      "etag": '"33a64df551425fcc55e4d42a148795d9f25f89d4"',
    });
    expect(result.has_caching_signals).toBe(true);
    expect(result.etag).toBe(true);
    expect(result.cache_control).toBe("public, max-age=86400");
  });

  it("evaluates technical SEO signals", async () => {
    const checker = new TechnicalSEOChecker();
    const result = await checker.check(
      sampleHtml,
      "https://primedental.com",
      {},
      false // skip remote requests in unit tests
    );
    expect(result.title).toBe(true);
    expect(result.title_text).toBe("Prime Dental Care | Best Dentist in Austin");
    expect(result.meta_description).toBe(true);
    expect(result.viewport).toBe(true);
    expect(result.canonical).toBe(true);
    expect(result.is_indexable).toBe(true);
  });

  it("evaluates accessibility signals", () => {
    const checker = new AccessibilityChecker();
    const result = checker.check(sampleHtml);
    expect(result.missing_lang_attribute).toBe(false);
    expect(result.html_lang).toBe("en");
    expect(result.images_without_alt).toBe(0);
    expect(result.inputs_without_labels).toBe(0);
    expect(result.h1_count).toBe(1);
    expect(result.heading_structure_anomalies).toHaveLength(0);
  });

  it("evaluates conversion and contact UX signals", () => {
    const checker = new ConversionUXChecker();
    const result = checker.check(sampleHtml);
    expect(result.phone_present).toBe(true);
    expect(result.email_present).toBe(true);
    expect(result.emails).toContain("info@primedental.com");
    expect(result.booking_cta).toBe(true);
    expect(result.contact_link).toBe(true);
    expect(result.social_links_present).toBe(true);
    expect(result.social_platforms).toContain("Instagram");
    expect(result.navigation_present).toBe(true);
  });
});
