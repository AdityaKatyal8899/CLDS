import * as cheerio from "cheerio";
import { TechnicalSEOResult } from "./models";

export class TechnicalSEOChecker {
  private timeoutMs: number;

  constructor(timeoutSec: number = 5.0) {
    this.timeoutMs = timeoutSec * 1000;
  }

  async check(
    htmlContent: string,
    baseUrl: string,
    headers: Record<string, string> = {},
    checkRemoteFiles: boolean = true
  ): Promise<TechnicalSEOResult> {
    const result: TechnicalSEOResult = {
      title: false,
      title_text: null,
      title_length: 0,
      meta_description: false,
      meta_description_text: null,
      meta_description_length: 0,
      canonical: false,
      canonical_url: null,
      viewport: false,
      viewport_content: null,
      robots_txt: false,
      sitemap: false,
      is_indexable: true,
      error: null,
    };

    if (!htmlContent || htmlContent.trim() === "") {
      result.error = "Empty or missing HTML content";
      return result;
    }

    try {
      const $ = cheerio.load(htmlContent);

      // 1. Title
      const titleTag = $("title").first();
      if (titleTag.length > 0) {
        const titleText = titleTag.text().trim();
        if (titleText) {
          result.title = true;
          result.title_text = titleText;
          result.title_length = titleText.length;
        }
      }

      // 2. Meta Description
      const metaDesc = $('meta[name="description" i]');
      if (metaDesc.length > 0) {
        const descContent = (metaDesc.attr("content") || "").trim();
        if (descContent) {
          result.meta_description = true;
          result.meta_description_text = descContent;
          result.meta_description_length = descContent.length;
        }
      }

      // 3. Canonical Link
      const canonicalTag = $('link[rel*="canonical" i]');
      if (canonicalTag.length > 0) {
        const canonicalHref = (canonicalTag.attr("href") || "").trim();
        if (canonicalHref) {
          result.canonical = true;
          result.canonical_url = canonicalHref;
        }
      }

      // 4. Viewport Meta Tag
      const viewportTag = $('meta[name="viewport" i]');
      if (viewportTag.length > 0) {
        const viewportContent = (viewportTag.attr("content") || "").trim();
        if (viewportContent) {
          result.viewport = true;
          result.viewport_content = viewportContent;
        }
      }

      // 5. Indexability Directives
      const metaRobots = $('meta[name="robots" i]').attr("content") || "";
      if (metaRobots.toLowerCase().includes("noindex")) {
        result.is_indexable = false;
      }

      const xRobots = headers["x-robots-tag"] || "";
      if (xRobots.toLowerCase().includes("noindex")) {
        result.is_indexable = false;
      }

      // 6. Check robots.txt and sitemap.xml
      if (checkRemoteFiles && baseUrl) {
        try {
          const parsed = new URL(baseUrl);
          const origin = `${parsed.protocol}//${parsed.host}`;

          // Check robots.txt
          try {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), this.timeoutMs);
            const robRes = await fetch(`${origin}/robots.txt`, {
              signal: controller.signal,
              headers: { "User-Agent": "CLDS-SEO-Verifier/2.0" },
            });
            clearTimeout(timer);
            result.robots_txt = robRes.status === 200;
          } catch {
            result.robots_txt = false;
          }

          // Check sitemap.xml
          try {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), this.timeoutMs);
            const smRes = await fetch(`${origin}/sitemap.xml`, {
              signal: controller.signal,
              headers: { "User-Agent": "CLDS-SEO-Verifier/2.0" },
            });
            clearTimeout(timer);
            result.sitemap = smRes.status === 200;
          } catch {
            result.sitemap = false;
          }
        } catch {
          // Ignore URL parse errors for robots/sitemap check
        }
      }
    } catch (err: any) {
      result.error = `SEO analysis error: ${err.message || err}`;
    }

    return result;
  }
}
