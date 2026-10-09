import * as cheerio from "cheerio";
import { PerformanceResult } from "./models";

export class PerformanceChecker {
  check(
    headers: Record<string, string>,
    htmlContent: string,
    responseDurationMs?: number
  ): PerformanceResult {
    const result: PerformanceResult = {
      ttfb_ms: responseDurationMs ?? null,
      total_load_time_ms: responseDurationMs ?? null,
      document_size_kb: 0,
      resource_count: 0,
      compression_enabled: false,
      compression_type: null,
      oversized_resources_count: 0,
      error: null,
    };

    try {
      // 1. Document size in KB
      const byteLength = Buffer.byteLength(htmlContent || "", "utf-8");
      const docSizeKb = Math.round((byteLength / 1024.0) * 100) / 100;
      result.document_size_kb = docSizeKb;

      // 2. Compression status
      const encoding = (headers["content-encoding"] || "").toLowerCase().trim();
      if (["gzip", "br", "deflate", "zstd"].includes(encoding)) {
        result.compression_enabled = true;
        result.compression_type = encoding;
      } else {
        result.compression_enabled = false;
      }

      // 3. Count resources linked in the HTML document
      if (htmlContent) {
        const $ = cheerio.load(htmlContent);
        const scripts = $("script[src]").length;
        const stylesheets = $('link[rel*="stylesheet"]').length;
        const images = $("img[src]").length;
        const iframes = $("iframe").length;

        const totalResources = scripts + stylesheets + images + iframes;
        result.resource_count = totalResources;

        // Check oversized indicator (doc size > 500KB or > 100 resource links)
        let oversized = 0;
        if (docSizeKb > 500.0) {
          oversized += 1;
        }
        result.oversized_resources_count = oversized;
      }
    } catch (err: any) {
      result.error = `Performance check error: ${err.message || err}`;
    }

    return result;
  }
}
