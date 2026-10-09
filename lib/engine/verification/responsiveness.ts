import * as cheerio from "cheerio";
import { ResponsivenessResult } from "./models";

export class ResponsivenessChecker {
  check(url: string, htmlContent: string): ResponsivenessResult {
    const result: ResponsivenessResult = {
      viewport: "375x812",
      horizontal_overflow: false,
      scroll_width_px: 375,
      viewport_width_px: 375,
      content_overflow: false,
      images_exceeding_viewport: 0,
      responsive: false,
      method: "dom_analysis",
      error: null,
    };

    if (!htmlContent || htmlContent.trim() === "") {
      result.error = "Empty HTML content";
      return result;
    }

    try {
      const $ = cheerio.load(htmlContent);

      // 1. Viewport Meta Tag Check
      const viewportMeta = $('meta[name="viewport"], meta[name="VIEWPORT"]');
      let hasValidViewport = false;
      if (viewportMeta.length > 0) {
        const content = viewportMeta.attr("content") || "";
        if (content.toLowerCase().includes("width=device-width")) {
          hasValidViewport = true;
        }
      }

      // 2. Detect elements with inline fixed wide widths > 400px
      let fixedWideElements = 0;
      $("[style]").each((_, el) => {
        const style = $(el).attr("style") || "";
        const match = style.match(/(?:min-)?width:\s*(\d+)px/i);
        if (match && parseInt(match[1], 10) > 400) {
          fixedWideElements++;
        }
      });

      // 3. Detect unconstrained wide tables
      let wideTables = 0;
      $("table[width]").each((_, el) => {
        const widthVal = parseInt($(el).attr("width") || "0", 10);
        if (widthVal > 400) {
          wideTables++;
        }
      });

      const overflow = !hasValidViewport || fixedWideElements > 0 || wideTables > 0;
      result.horizontal_overflow = overflow;
      result.content_overflow = overflow;
      result.scroll_width_px = overflow ? 800 : 375;
      result.responsive = !overflow;
      result.images_exceeding_viewport = fixedWideElements;
    } catch (err: any) {
      result.error = `DOM responsiveness analysis error: ${err.message || err}`;
    }

    return result;
  }
}
