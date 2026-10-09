import * as cheerio from "cheerio";
import { AccessibilityResult } from "./models";

export class AccessibilityChecker {
  check(htmlContent: string): AccessibilityResult {
    const result: AccessibilityResult = {
      missing_lang_attribute: false,
      html_lang: null,
      images_without_alt: 0,
      total_images: 0,
      inputs_without_labels: 0,
      total_inputs: 0,
      empty_buttons: 0,
      heading_structure_anomalies: [],
      h1_count: 0,
      error: null,
    };

    if (!htmlContent || htmlContent.trim() === "") {
      result.error = "Empty or missing HTML content";
      return result;
    }

    try {
      const $ = cheerio.load(htmlContent);

      // 1. HTML lang attribute
      const htmlTag = $("html").first();
      if (htmlTag.length > 0) {
        const lang = htmlTag.attr("lang");
        if (lang && lang.trim()) {
          result.html_lang = lang.trim();
          result.missing_lang_attribute = false;
        } else {
          result.missing_lang_attribute = true;
        }
      } else {
        result.missing_lang_attribute = true;
      }

      // 2. Image alt attributes
      const images = $("img");
      result.total_images = images.length;
      let noAltCount = 0;
      images.each((_, el) => {
        const alt = $(el).attr("alt");
        if (alt === undefined || alt === null) {
          noAltCount++;
        }
      });
      result.images_without_alt = noAltCount;

      // 3. Form input labels
      const inputs = $("input, select, textarea");
      let validInputsCount = 0;
      let unlabelledCount = 0;

      inputs.each((_, el) => {
        const type = ($(el).attr("type") || "text").toLowerCase();
        if (["hidden", "submit", "button", "reset", "image"].includes(type)) {
          return;
        }

        validInputsCount++;
        const inputId = $(el).attr("id");
        let hasLabel = false;

        // Check explicit <label for="id">
        if (inputId) {
          const label = $(`label[for="${inputId}"]`);
          if (label.length > 0 && label.text().trim().length > 0) {
            hasLabel = true;
          }
        }

        // Check wrapping parent <label>
        if (!hasLabel && $(el).closest("label").length > 0) {
          hasLabel = true;
        }

        // Check aria-label or aria-labelledby or title or placeholder
        if (
          !hasLabel &&
          ($(el).attr("aria-label") ||
            $(el).attr("aria-labelledby") ||
            $(el).attr("title"))
        ) {
          hasLabel = true;
        }

        if (!hasLabel) {
          unlabelledCount++;
        }
      });

      result.total_inputs = validInputsCount;
      result.inputs_without_labels = unlabelledCount;

      // 4. Empty buttons or icon-only links without accessible text
      const buttons = $("button, a");
      let emptyBtns = 0;
      buttons.each((_, el) => {
        const text = $(el).text().trim();
        const hasAria = $(el).attr("aria-label") || $(el).attr("title");
        const hasImgAlt = $(el).find("img[alt]").length > 0;
        const hasSvg = $(el).find("svg").length > 0;

        if (!text && !hasAria && !hasImgAlt && !hasSvg) {
          emptyBtns++;
        }
      });
      result.empty_buttons = emptyBtns;

      // 5. Heading hierarchy anomalies
      const h1Tags = $("h1");
      result.h1_count = h1Tags.length;

      const anomalies: string[] = [];
      if (result.h1_count === 0) {
        anomalies.push("Missing <h1> element");
      } else if (result.h1_count > 1) {
        anomalies.push(`Multiple <h1> elements (${result.h1_count})`);
      }

      const headings = $("h1, h2, h3, h4, h5, h6");
      const levels: number[] = [];
      headings.each((_, el) => {
        const tagName = (el as any).tagName ? (el as any).tagName.toLowerCase() : "";
        if (tagName.startsWith("h") && tagName.length === 2) {
          const lvl = parseInt(tagName[1], 10);
          if (!isNaN(lvl)) levels.push(lvl);
        }
      });

      for (let i = 0; i < levels.length - 1; i++) {
        if (levels[i + 1] > levels[i] + 1) {
          anomalies.push(`Skipped heading level: h${levels[i]} to h${levels[i + 1]}`);
          break;
        }
      }

      result.heading_structure_anomalies = anomalies;
    } catch (err: any) {
      result.error = `Accessibility analysis error: ${err.message || err}`;
    }

    return result;
  }
}
