import * as cheerio from "cheerio";
import { ConversionResult } from "./models";

export class ConversionUXChecker {
  private static readonly BOOKING_KEYWORDS = [
    "book", "reserve", "appointment", "schedule", "order online", "reservations",
    "book now", "schedule now", "table reservation", "book online",
  ];

  private static readonly PRIMARY_CTA_KEYWORDS = [
    "contact us", "get in touch", "get a quote", "request quote", "shop now",
    "buy now", "order now", "view menu", "call now", "get started", "free consultation",
  ];

  private static readonly SOCIAL_DOMAINS: Record<string, string> = {
    "instagram.com": "Instagram",
    "facebook.com": "Facebook",
    "linkedin.com": "LinkedIn",
    "twitter.com": "Twitter/X",
    "x.com": "Twitter/X",
    "tiktok.com": "TikTok",
    "youtube.com": "YouTube",
    "pinterest.com": "Pinterest",
  };

  check(htmlContent: string): ConversionResult {
    const result: ConversionResult = {
      phone_present: false,
      phone_numbers: [],
      email_present: false,
      emails: [],
      contact_link: false,
      contact_urls: [],
      booking_cta: false,
      booking_cta_matches: [],
      primary_cta: false,
      primary_cta_matches: [],
      social_links_present: false,
      social_platforms: [],
      navigation_present: false,
      error: null,
    };

    if (!htmlContent || htmlContent.trim() === "") {
      result.error = "Empty or missing HTML content";
      return result;
    }

    try {
      const $ = cheerio.load(htmlContent);
      const pageText = $("body").text().replace(/\s+/g, " ");

      // 1. Phone number detection
      const phoneNumbers = new Set<string>();
      $('a[href^="tel:"]').each((_, el) => {
        const href = ($(el).attr("href") || "").replace(/^tel:/i, "").trim();
        if (href) phoneNumbers.add(href);
      });

      // Text regex for phone numbers (US/UK/IN patterns)
      const phoneRegex = /(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;
      const phoneMatches = pageText.match(phoneRegex) || [];
      for (const p of phoneMatches.slice(0, 5)) {
        const digitsOnly = p.replace(/\D/g, "");
        if (digitsOnly.length >= 10) {
          phoneNumbers.add(p.trim());
        }
      }

      result.phone_numbers = Array.from(phoneNumbers).sort();
      result.phone_present = result.phone_numbers.length > 0;

      // 2. Email detection
      const emails = new Set<string>();
      $('a[href^="mailto:"]').each((_, el) => {
        const href = ($(el).attr("href") || "").replace(/^mailto:/i, "").split("?")[0].trim();
        if (href.includes("@")) emails.add(href.toLowerCase());
      });

      const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,7}\b/g;
      const emailMatches = pageText.match(emailRegex) || [];
      for (const e of emailMatches.slice(0, 5)) {
        if (!/\.(png|jpg|jpeg|webp|svg|js|css)$/i.test(e)) {
          emails.add(e.toLowerCase());
        }
      }

      result.emails = Array.from(emails).sort();
      result.email_present = result.emails.length > 0;

      // 3. Contact link detection
      const contactUrls = new Set<string>();
      $("a[href]").each((_, el) => {
        const href = ($(el).attr("href") || "").trim();
        const text = $(el).text().trim().toLowerCase();
        const hrefLower = href.toLowerCase();

        if (
          ["contact", "contact-us", "about-us", "get-in-touch"].some((k) => hrefLower.includes(k)) ||
          ["contact", "contact us", "get in touch"].some((k) => text.includes(k))
        ) {
          if (href.length > 0 && href !== "#") {
            contactUrls.add(href);
          }
        }
      });

      result.contact_urls = Array.from(contactUrls).slice(0, 3);
      result.contact_link = result.contact_urls.length > 0;

      // 4. Booking & Primary CTAs
      const bookingMatches = new Set<string>();
      const primaryCtaMatches = new Set<string>();

      $("button, a").each((_, el) => {
        const text = $(el).text().trim().toLowerCase();
        if (!text || text.length > 40) return;

        for (const kw of ConversionUXChecker.BOOKING_KEYWORDS) {
          if (text.includes(kw)) {
            bookingMatches.add(text);
            break;
          }
        }

        for (const kw of ConversionUXChecker.PRIMARY_CTA_KEYWORDS) {
          if (text.includes(kw)) {
            primaryCtaMatches.add(text);
            break;
          }
        }
      });

      result.booking_cta_matches = Array.from(bookingMatches).sort().slice(0, 5);
      result.booking_cta = result.booking_cta_matches.length > 0;

      result.primary_cta_matches = Array.from(primaryCtaMatches).sort().slice(0, 5);
      result.primary_cta = result.primary_cta_matches.length > 0;

      // 5. Social Media links
      const socialPlatforms = new Set<string>();
      $("a[href]").each((_, el) => {
        const href = ($(el).attr("href") || "").toLowerCase();
        for (const [domain, platform] of Object.entries(ConversionUXChecker.SOCIAL_DOMAINS)) {
          if (href.includes(domain)) {
            socialPlatforms.add(platform);
          }
        }
      });

      result.social_platforms = Array.from(socialPlatforms).sort();
      result.social_links_present = result.social_platforms.length > 0;

      // 6. Navigation presence
      const hasNavTag = $("nav, header").length > 0;
      const hasRoleNav = $('[role="navigation" i]').length > 0;
      const hasNavClass = $('[class*="navbar" i], [class*="nav-menu" i], [class*="site-navigation" i], [class*="main-nav" i]').length > 0;

      result.navigation_present = hasNavTag || hasRoleNav || hasNavClass;
    } catch (err: any) {
      result.error = `Conversion UX analysis error: ${err.message || err}`;
    }

    return result;
  }
}
