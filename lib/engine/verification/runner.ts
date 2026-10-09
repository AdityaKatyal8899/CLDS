import { VerificationRecord } from "./models";
import { AvailabilityChecker } from "./availability";
import { ResponsivenessChecker } from "./responsiveness";
import { PerformanceChecker } from "./performance";
import { CachingChecker } from "./caching";
import { TechnicalSEOChecker } from "./seo";
import { AccessibilityChecker } from "./accessibility";
import { ConversionUXChecker } from "./conversion";

export class WebsiteVerificationRunner {
  private availabilityChecker: AvailabilityChecker;
  private responsivenessChecker: ResponsivenessChecker;
  private performanceChecker: PerformanceChecker;
  private cachingChecker: CachingChecker;
  private seoChecker: TechnicalSEOChecker;
  private accessibilityChecker: AccessibilityChecker;
  private conversionChecker: ConversionUXChecker;

  constructor(options?: {
    availabilityChecker?: AvailabilityChecker;
    responsivenessChecker?: ResponsivenessChecker;
    performanceChecker?: PerformanceChecker;
    cachingChecker?: CachingChecker;
    seoChecker?: TechnicalSEOChecker;
    accessibilityChecker?: AccessibilityChecker;
    conversionChecker?: ConversionUXChecker;
  }) {
    this.availabilityChecker = options?.availabilityChecker || new AvailabilityChecker();
    this.responsivenessChecker = options?.responsivenessChecker || new ResponsivenessChecker();
    this.performanceChecker = options?.performanceChecker || new PerformanceChecker();
    this.cachingChecker = options?.cachingChecker || new CachingChecker();
    this.seoChecker = options?.seoChecker || new TechnicalSEOChecker();
    this.accessibilityChecker = options?.accessibilityChecker || new AccessibilityChecker();
    this.conversionChecker = options?.conversionChecker || new ConversionUXChecker();
  }

  async verify(url: string, leadId?: string): Promise<VerificationRecord> {
    const startTime = performance.now();
    const record: VerificationRecord = {
      lead_id: leadId || null,
      target_url: url,
      verified_at: new Date().toISOString(),
      overall_status: "pending",
      availability: {
        reachable: false,
        status_code: null,
        dns_resolved: false,
        https: false,
        response_time_ms: null,
        redirect_chain: [],
        final_url: null,
        error: null,
      },
      responsiveness: {
        viewport: "375x812",
        horizontal_overflow: false,
        scroll_width_px: 375,
        viewport_width_px: 375,
        content_overflow: false,
        images_exceeding_viewport: 0,
        responsive: false,
        method: "dom_analysis",
        error: null,
      },
      performance: {
        ttfb_ms: null,
        total_load_time_ms: null,
        document_size_kb: 0,
        resource_count: 0,
        compression_enabled: false,
        compression_type: null,
        oversized_resources_count: 0,
        error: null,
      },
      caching: {
        cache_control: null,
        etag: false,
        etag_value: null,
        last_modified: false,
        last_modified_value: null,
        expires: false,
        expires_value: null,
        has_caching_signals: false,
        error: null,
      },
      seo: {
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
      },
      accessibility: {
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
      },
      conversion: {
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
      },
      verification_duration_ms: 0,
    };

    // 1. Availability Check
    let availResponse: any = null;
    try {
      availResponse = await this.availabilityChecker.check(url);
      record.availability = availResponse.result;

      if (!availResponse.result.reachable) {
        record.overall_status = "unreachable";
        record.verification_duration_ms = Math.round(performance.now() - startTime);
        return record;
      }
    } catch (err: any) {
      record.availability.error = `Availability exception: ${err.message || err}`;
      record.overall_status = "error";
      record.verification_duration_ms = Math.round(performance.now() - startTime);
      return record;
    }

    const htmlContent = availResponse.htmlContent || "";
    const headers = availResponse.headers || {};
    const finalUrl = record.availability.final_url || url;
    const responseDurationMs = record.availability.response_time_ms ?? undefined;

    // 2. Mobile Responsiveness Check (375x812)
    try {
      record.responsiveness = this.responsivenessChecker.check(finalUrl, htmlContent);
    } catch (err: any) {
      record.responsiveness.error = `Responsiveness check error: ${err.message || err}`;
    }

    // 3. Performance & Loading Signals Check
    try {
      record.performance = this.performanceChecker.check(headers, htmlContent, responseDurationMs);
    } catch (err: any) {
      record.performance.error = `Performance check error: ${err.message || err}`;
    }

    // 4. HTTP Caching Check
    try {
      record.caching = this.cachingChecker.check(headers);
    } catch (err: any) {
      record.caching.error = `Caching check error: ${err.message || err}`;
    }

    // 5. Basic Technical SEO Check
    try {
      record.seo = await this.seoChecker.check(htmlContent, finalUrl, headers);
    } catch (err: any) {
      record.seo.error = `SEO check error: ${err.message || err}`;
    }

    // 6. Basic Accessibility Signals Check
    try {
      record.accessibility = this.accessibilityChecker.check(htmlContent);
    } catch (err: any) {
      record.accessibility.error = `Accessibility check error: ${err.message || err}`;
    }

    // 7. Basic Conversion & UX Signals Check
    try {
      record.conversion = this.conversionChecker.check(htmlContent);
    } catch (err: any) {
      record.conversion.error = `Conversion UX check error: ${err.message || err}`;
    }

    record.overall_status = "verified";
    record.verification_duration_ms = Math.round(performance.now() - startTime);
    return record;
  }
}
