/**
 * Domain blacklist for CLDS TypeScript engine.
 * Filters out aggregators, directories, social media, and generic portals.
 */

export const DIRECTORY_DOMAINS = new Set([
  "yelp.com",
  "tripadvisor.com",
  "yellowpages.com",
  "whitepages.com",
  "superpages.com",
  "manta.com",
  "bbb.org",
  "mapquest.com",
  "foursquare.com",
  "angi.com",
  "angieslist.com",
  "thumbtack.com",
  "houzz.com",
  "homeadvisor.com",
  "bark.com",
  "trustpilot.com",
  "opentable.com",
  "resy.com",
  "zomato.com",
  "swiggy.com",
  "justdial.com",
  "indiamart.com",
  "tradeindia.com",
  "sulekha.com",
  "yell.com",
  "scoop.it",
  "kompass.com",
  "hotfrog.com",
  "merchantcircle.com",
  "chamberofcommerce.com",
  "citysearch.com",
  "ezlocal.com",
  "local.com",
  "patch.com",
  "nextdoor.com",
]);

export const SOCIAL_DOMAINS = new Set([
  "facebook.com",
  "instagram.com",
  "twitter.com",
  "x.com",
  "linkedin.com",
  "tiktok.com",
  "youtube.com",
  "pinterest.com",
  "reddit.com",
  "tumblr.com",
  "threads.net",
  "snapchat.com",
  "whatsapp.com",
]);

export const AGGREGATOR_DOMAINS = new Set([
  "google.com",
  "maps.google.com",
  "apple.com",
  "bing.com",
  "yahoo.com",
  "duckduckgo.com",
  "wikipedia.org",
  "wikidata.org",
  "openstreetmap.org",
  "amazon.com",
  "ebay.com",
  "etsy.com",
  "shopify.com",
  "wordpress.com",
  "wix.com",
  "squarespace.com",
  "weebly.com",
  "medium.com",
  "github.com",
]);

export const ALL_BLACKLISTED_DOMAINS = new Set([
  ...Array.from(DIRECTORY_DOMAINS),
  ...Array.from(SOCIAL_DOMAINS),
  ...Array.from(AGGREGATOR_DOMAINS),
]);

export function isBlacklistedDomain(domainOrUrl: string | null | undefined): boolean {
  if (!domainOrUrl || typeof domainOrUrl !== "string") return true;
  const clean = domainOrUrl.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/^www\./, "");
  if (!clean) return true;

  for (const bl of ALL_BLACKLISTED_DOMAINS) {
    if (clean === bl || clean.endsWith("." + bl)) {
      return true;
    }
  }
  return false;
}
