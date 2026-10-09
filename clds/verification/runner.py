"""Orchestrator runner for Stage 2 Fast Website Verification."""

import time
from typing import Optional
from clds.verification.models import VerificationRecord
from clds.verification.availability import AvailabilityChecker
from clds.verification.responsiveness import ResponsivenessChecker
from clds.verification.performance import PerformanceChecker
from clds.verification.caching import CachingChecker
from clds.verification.seo import TechnicalSEOChecker
from clds.verification.accessibility import AccessibilityChecker
from clds.verification.conversion import ConversionUXChecker


class WebsiteVerificationRunner:
    """Orchestrates the 7 deterministic website verification checks."""

    def __init__(
        self,
        availability_checker: Optional[AvailabilityChecker] = None,
        responsiveness_checker: Optional[ResponsivenessChecker] = None,
        performance_checker: Optional[PerformanceChecker] = None,
        caching_checker: Optional[CachingChecker] = None,
        seo_checker: Optional[TechnicalSEOChecker] = None,
        accessibility_checker: Optional[AccessibilityChecker] = None,
        conversion_checker: Optional[ConversionUXChecker] = None,
    ):
        self.availability_checker = availability_checker or AvailabilityChecker()
        self.responsiveness_checker = responsiveness_checker or ResponsivenessChecker()
        self.performance_checker = performance_checker or PerformanceChecker()
        self.caching_checker = caching_checker or CachingChecker()
        self.seo_checker = seo_checker or TechnicalSEOChecker()
        self.accessibility_checker = accessibility_checker or AccessibilityChecker()
        self.conversion_checker = conversion_checker or ConversionUXChecker()

    def verify(self, url: str, lead_id: Optional[str] = None) -> VerificationRecord:
        """
        Execute fast 7-check verification pipeline for a target website URL.
        Guarantees isolation: an error in one check does not crash the remaining checks.
        """
        start_time = time.perf_counter()
        record = VerificationRecord(lead_id=lead_id, target_url=url)

        # Check 1: Availability
        try:
            avail_res, response = self.availability_checker.check(url)
            record.availability = avail_res
            if not avail_res.reachable or not response:
                record.overall_status = "unreachable"
                record.verification_duration_ms = int((time.perf_counter() - start_time) * 1000)
                return record
        except Exception as exc:
            record.availability.error = f"Availability exception: {exc}"
            record.overall_status = "error"
            record.verification_duration_ms = int((time.perf_counter() - start_time) * 1000)
            return record

        html_content = response.text if response else ""
        final_url = record.availability.final_url or url

        # Check 2: Mobile Responsiveness (375x812)
        try:
            record.responsiveness = self.responsiveness_checker.check(final_url, html_content)
        except Exception as exc:
            record.responsiveness.error = f"Responsiveness check error: {exc}"

        # Check 3: Performance & Loading Signals
        try:
            record.performance = self.performance_checker.check(response, html_content)
        except Exception as exc:
            record.performance.error = f"Performance check error: {exc}"

        # Check 4: HTTP Caching
        try:
            record.caching = self.caching_checker.check(response)
        except Exception as exc:
            record.caching.error = f"Caching check error: {exc}"

        # Check 5: Basic Technical SEO
        try:
            record.seo = self.seo_checker.check(html_content, final_url, response)
        except Exception as exc:
            record.seo.error = f"SEO check error: {exc}"

        # Check 6: Basic Accessibility Signals
        try:
            record.accessibility = self.accessibility_checker.check(html_content)
        except Exception as exc:
            record.accessibility.error = f"Accessibility check error: {exc}"

        # Check 7: Basic Conversion & UX Signals
        try:
            record.conversion = self.conversion_checker.check(html_content)
        except Exception as exc:
            record.conversion.error = f"Conversion UX check error: {exc}"

        record.overall_status = "verified"
        record.verification_duration_ms = int((time.perf_counter() - start_time) * 1000)
        return record
