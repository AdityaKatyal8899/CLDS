/**
 * Data models and schemas for Stage 2 Fast Website Verification in TypeScript.
 */

export interface AvailabilityResult {
  reachable: boolean;
  status_code?: number | null;
  https: boolean;
  response_time_ms?: number | null;
  final_url?: string | null;
  redirect_chain: string[];
  dns_resolved: boolean;
  error?: string | null;
}

export interface ResponsivenessResult {
  viewport: string;
  horizontal_overflow: boolean;
  scroll_width_px?: number | null;
  viewport_width_px?: number;
  content_overflow?: boolean;
  images_exceeding_viewport?: number;
  responsive: boolean;
  method: string;
  error?: string | null;
}

export interface PerformanceResult {
  ttfb_ms?: number | null;
  total_load_time_ms?: number | null;
  document_size_kb?: number | null;
  resource_count?: number | null;
  compression_enabled: boolean;
  compression_type?: string | null;
  oversized_resources_count: number;
  error?: string | null;
}

export interface CachingResult {
  cache_control?: string | null;
  etag: boolean;
  etag_value?: string | null;
  last_modified: boolean;
  last_modified_value?: string | null;
  expires: boolean;
  expires_value?: string | null;
  has_caching_signals: boolean;
  error?: string | null;
}

export interface TechnicalSEOResult {
  title: boolean;
  title_text?: string | null;
  title_length: number;
  meta_description: boolean;
  meta_description_text?: string | null;
  meta_description_length: number;
  canonical: boolean;
  canonical_url?: string | null;
  viewport: boolean;
  viewport_content?: string | null;
  robots_txt: boolean;
  sitemap: boolean;
  is_indexable: boolean;
  error?: string | null;
}

export interface AccessibilityResult {
  images_without_alt: number;
  total_images: number;
  inputs_without_labels: number;
  total_inputs: number;
  missing_lang_attribute: boolean;
  html_lang?: string | null;
  empty_buttons: number;
  heading_structure_anomalies: string[];
  h1_count: number;
  error?: string | null;
}

export interface ConversionResult {
  phone_present: boolean;
  phone_numbers: string[];
  email_present: boolean;
  emails: string[];
  contact_link: boolean;
  contact_urls: string[];
  booking_cta: boolean;
  booking_cta_matches?: string[];
  primary_cta?: boolean;
  primary_cta_matches?: string[];
  social_links_present?: boolean;
  social_platforms?: string[];
  navigation_present?: boolean;
  lead_capture_form?: boolean;
  has_conversion_signals?: boolean;
  error?: string | null;
}

export interface VerificationRecord {
  lead_id?: string | null;
  target_url: string;
  final_url?: string | null;
  verified_at: string;
  verification_duration_ms: number;
  checker_version?: string;
  overall_status: "verified" | "issues_detected" | "unreachable" | "error" | "pending";
  verification_status?: "verified" | "issues_detected" | "verification_failed" | "unverified";
  availability: AvailabilityResult;
  responsiveness: ResponsivenessResult;
  performance: PerformanceResult;
  caching: CachingResult;
  seo: TechnicalSEOResult;
  technical_seo?: TechnicalSEOResult;
  accessibility: AccessibilityResult;
  conversion: ConversionResult;
  conversion_ux?: ConversionResult;
}
