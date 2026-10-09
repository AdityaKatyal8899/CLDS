"""Data models and schemas for Stage 2 Fast Website Verification."""

from datetime import datetime, timezone
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field


class AvailabilityResult(BaseModel):
    """Check 1 — Website Availability."""
    reachable: bool = False
    status_code: Optional[int] = None
    https: bool = False
    response_time_ms: Optional[int] = None
    final_url: Optional[str] = None
    redirect_chain: List[str] = Field(default_factory=list)
    dns_resolved: bool = False
    error: Optional[str] = None


class ResponsivenessResult(BaseModel):
    """Check 2 — Mobile Responsiveness (375x812)."""
    viewport: str = "375x812"
    horizontal_overflow: bool = False
    scroll_width_px: Optional[int] = None
    viewport_width_px: int = 375
    content_overflow: bool = False
    images_exceeding_viewport: int = 0
    responsive: bool = False
    method: str = "browser"
    error: Optional[str] = None


class PerformanceResult(BaseModel):
    """Check 3 — Performance & Loading Signals."""
    ttfb_ms: Optional[int] = None
    total_load_time_ms: Optional[int] = None
    document_size_kb: Optional[float] = None
    resource_count: Optional[int] = None
    compression_enabled: bool = False
    compression_type: Optional[str] = None
    oversized_resources_count: int = 0
    error: Optional[str] = None


class CachingResult(BaseModel):
    """Check 4 — HTTP Caching Signals."""
    cache_control: Optional[str] = None
    etag: bool = False
    etag_value: Optional[str] = None
    last_modified: bool = False
    last_modified_value: Optional[str] = None
    expires: bool = False
    expires_value: Optional[str] = None
    has_caching_signals: bool = False
    error: Optional[str] = None


class TechnicalSEOResult(BaseModel):
    """Check 5 — Basic Technical SEO Signals."""
    title: bool = False
    title_text: Optional[str] = None
    title_length: int = 0
    meta_description: bool = False
    meta_description_text: Optional[str] = None
    meta_description_length: int = 0
    canonical: bool = False
    canonical_url: Optional[str] = None
    viewport: bool = False
    viewport_content: Optional[str] = None
    robots_txt: bool = False
    sitemap: bool = False
    is_indexable: bool = True
    error: Optional[str] = None


class AccessibilityResult(BaseModel):
    """Check 6 — Basic Accessibility Signals."""
    images_without_alt: int = 0
    total_images: int = 0
    inputs_without_labels: int = 0
    total_inputs: int = 0
    missing_lang_attribute: bool = False
    html_lang: Optional[str] = None
    empty_buttons: int = 0
    heading_structure_anomalies: List[str] = Field(default_factory=list)
    h1_count: int = 0
    error: Optional[str] = None


class ConversionResult(BaseModel):
    """Check 7 — Basic Conversion / UX Signals."""
    phone_present: bool = False
    phone_numbers: List[str] = Field(default_factory=list)
    email_present: bool = False
    emails: List[str] = Field(default_factory=list)
    contact_link: bool = False
    contact_urls: List[str] = Field(default_factory=list)
    booking_cta: bool = False
    booking_cta_matches: List[str] = Field(default_factory=list)
    primary_cta: bool = False
    primary_cta_matches: List[str] = Field(default_factory=list)
    social_links_present: bool = False
    social_platforms: List[str] = Field(default_factory=list)
    navigation_present: bool = False
    error: Optional[str] = None


class VerificationRecord(BaseModel):
    """Complete Stage 2 verification record for a business lead."""
    lead_id: Optional[str] = None
    target_url: str
    final_url: Optional[str] = None
    verified_at: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )
    verification_duration_ms: int = 0
    checker_version: str = "2.0.0"
    overall_status: str = "verified"  # "verified", "unreachable", "error"
    availability: AvailabilityResult = Field(default_factory=AvailabilityResult)
    responsiveness: ResponsivenessResult = Field(default_factory=ResponsivenessResult)
    performance: PerformanceResult = Field(default_factory=PerformanceResult)
    caching: CachingResult = Field(default_factory=CachingResult)
    seo: TechnicalSEOResult = Field(default_factory=TechnicalSEOResult)
    accessibility: AccessibilityResult = Field(default_factory=AccessibilityResult)
    conversion: ConversionResult = Field(default_factory=ConversionResult)
