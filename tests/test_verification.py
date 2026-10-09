"""Automated tests for Stage 2 Fast Website Verification (All 7 Checkers)."""

import pytest
from pathlib import Path
from clds.verification.models import (
    AvailabilityResult,
    ResponsivenessResult,
    PerformanceResult,
    CachingResult,
    TechnicalSEOResult,
    AccessibilityResult,
    ConversionResult,
    VerificationRecord,
)
from clds.verification.availability import AvailabilityChecker
from clds.verification.responsiveness import ResponsivenessChecker
from clds.verification.performance import PerformanceChecker
from clds.verification.caching import CachingChecker
from clds.verification.seo import TechnicalSEOChecker
from clds.verification.accessibility import AccessibilityChecker
from clds.verification.conversion import ConversionUXChecker
from clds.verification.runner import WebsiteVerificationRunner
from clds.database import Database
from clds.models import BusinessLead


SAMPLE_HTML = """<!DOCTYPE html>
<html lang="en">
<head>
    <title>Austin Artisan Gifts & Boutique | Austin, TX</title>
    <meta name="description" content="Discover handcrafted unique gifts, local artisan jewelry, and home decor in Austin.">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link rel="canonical" href="https://austinartisan.com/">
</head>
<body>
    <header>
        <nav class="main-nav">
            <a href="/">Home</a>
            <a href="/shop">Shop</a>
            <a href="/contact">Contact Us</a>
        </nav>
    </header>
    <main>
        <h1>Austin Artisan Gifts</h1>
        <p>Welcome to our local boutique!</p>
        <img src="/img/gift1.jpg" alt="Handmade candle">
        <img src="/img/gift2.jpg"> <!-- Missing alt -->
        
        <form action="/subscribe">
            <input type="email" id="email-sub" placeholder="Enter your email">
            <button type="submit">Subscribe Now</button>
        </form>

        <div class="cta-box">
            <a href="/book-appointment" class="btn">Book Now</a>
            <a href="/contact" class="btn">Get a Quote</a>
        </div>

        <div class="contact-info">
            <p>Call us at: <a href="tel:+15125550198">(512) 555-0198</a></p>
            <p>Email: hello@austinartisan.com</p>
        </div>

        <footer>
            <a href="https://instagram.com/austinartisan">Instagram</a>
            <a href="https://facebook.com/austinartisan">Facebook</a>
            <button></button> <!-- Empty button -->
        </footer>
    </main>
</body>
</html>
"""


class MockResponse:
    def __init__(self, status_code=200, content=b"sample html content", headers=None, url="https://austinartisan.com/"):
        self.status_code = status_code
        self.content = content
        self.text = content.decode("utf-8", errors="ignore")
        self.headers = headers or {
            "content-type": "text/html; charset=utf-8",
            "cache-control": "public, max-age=3600",
            "etag": '"123456"',
            "last-modified": "Wed, 01 Oct 2026 12:00:00 GMT",
            "content-encoding": "gzip",
        }
        self.url = url
        self.history = []
        import datetime
        self.elapsed = datetime.timedelta(milliseconds=320)


# 1. Availability Checker Tests
def test_availability_checker_reachable(monkeypatch):
    checker = AvailabilityChecker()
    mock_resp = MockResponse()

    monkeypatch.setattr("socket.gethostbyname", lambda host: "93.184.216.34")
    monkeypatch.setattr("httpx.Client.get", lambda *args, **kwargs: mock_resp)

    res, resp = checker.check("https://austinartisan.com")
    assert res.reachable is True
    assert res.dns_resolved is True
    assert res.status_code == 200
    assert res.https is True
    assert res.final_url == "https://austinartisan.com/"


def test_availability_checker_dns_failure(monkeypatch):
    checker = AvailabilityChecker()
    def mock_dns_fail(host):
        raise Exception("Host not found")

    monkeypatch.setattr("socket.gethostbyname", mock_dns_fail)

    res, resp = checker.check("https://nonexistent-fake-domain-123456.com")
    assert res.reachable is False
    assert res.dns_resolved is False
    assert "DNS resolution failed" in (res.error or "")


# 2. Responsiveness Checker Tests
def test_responsiveness_dom_fallback():
    checker = ResponsivenessChecker(use_browser=False)
    res = checker.check("https://austinartisan.com", SAMPLE_HTML)
    assert res.viewport == "375x812"
    assert res.responsive is True
    assert res.horizontal_overflow is False


def test_responsiveness_overflow_detected():
    bad_html = "<html><body><div style='width: 900px;'>Very Wide Fixed Content</div></body></html>"
    checker = ResponsivenessChecker(use_browser=False)
    res = checker.check("https://austinartisan.com", bad_html)
    assert res.responsive is False
    assert res.horizontal_overflow is True


# 3. Performance Checker Tests
def test_performance_checker():
    checker = PerformanceChecker()
    mock_resp = MockResponse(content=b"A" * 10240)  # 10KB
    res = checker.check(mock_resp, SAMPLE_HTML)

    assert res.document_size_kb == 10.0
    assert res.ttfb_ms == 320
    assert res.compression_enabled is True
    assert res.compression_type == "gzip"
    assert res.resource_count > 0


# 4. Caching Checker Tests
def test_caching_checker():
    checker = CachingChecker()
    mock_resp = MockResponse()
    res = checker.check(mock_resp)

    assert res.has_caching_signals is True
    assert res.etag is True
    assert res.etag_value == '"123456"'
    assert res.last_modified is True
    assert "max-age=3600" in (res.cache_control or "")


# 5. Technical SEO Checker Tests
def test_technical_seo_checker(monkeypatch):
    checker = TechnicalSEOChecker()
    res = checker.check(SAMPLE_HTML, "https://austinartisan.com", check_remote_files=False)

    assert res.title is True
    assert "Austin Artisan Gifts" in (res.title_text or "")
    assert res.meta_description is True
    assert res.canonical is True
    assert res.viewport is True
    assert res.is_indexable is True


# 6. Accessibility Checker Tests
def test_accessibility_checker():
    checker = AccessibilityChecker()
    res = checker.check(SAMPLE_HTML)

    assert res.missing_lang_attribute is False
    assert res.html_lang == "en"
    assert res.total_images == 2
    assert res.images_without_alt == 1  # One missing alt
    assert res.empty_buttons >= 1       # One empty button
    assert res.h1_count == 1


# 7. Conversion & UX Signals Checker Tests
def test_conversion_ux_checker():
    checker = ConversionUXChecker()
    res = checker.check(SAMPLE_HTML)

    assert res.phone_present is True
    assert any("512" in p for p in res.phone_numbers)
    assert res.email_present is True
    assert "hello@austinartisan.com" in res.emails
    assert res.contact_link is True
    assert res.booking_cta is True
    assert any("book" in b.lower() for b in res.booking_cta_matches)
    assert res.primary_cta is True
    assert res.social_links_present is True
    assert "Instagram" in res.social_platforms
    assert "Facebook" in res.social_platforms
    assert res.navigation_present is True


# 8. Complete Verification Runner & Error Isolation Tests
def test_runner_complete_and_isolation(monkeypatch):
    runner = WebsiteVerificationRunner(
        responsiveness_checker=ResponsivenessChecker(use_browser=False)
    )

    mock_resp = MockResponse(content=SAMPLE_HTML.encode("utf-8"))
    monkeypatch.setattr(runner.availability_checker, "check", lambda url: (
        AvailabilityResult(reachable=True, status_code=200, https=True, response_time_ms=250, final_url=url, dns_resolved=True),
        mock_resp
    ))
    # Remote files false for fast unit tests
    monkeypatch.setattr(runner.seo_checker, "check", lambda html, url, resp: TechnicalSEOChecker().check(html, url, resp, check_remote_files=False))

    record = runner.verify("https://austinartisan.com", lead_id="test_lead_1")

    assert record.overall_status == "verified"
    assert record.lead_id == "test_lead_1"
    assert record.availability.reachable is True
    assert record.responsiveness.responsive is True
    assert record.caching.has_caching_signals is True
    assert record.seo.title is True
    assert record.accessibility.total_images == 2
    assert record.conversion.phone_present is True


def test_runner_unreachable_site(monkeypatch):
    runner = WebsiteVerificationRunner()
    monkeypatch.setattr(runner.availability_checker, "check", lambda url: (
        AvailabilityResult(reachable=False, error="Connection timed out"),
        None
    ))

    record = runner.verify("https://broken-domain-999.com")
    assert record.overall_status == "unreachable"
    assert record.availability.reachable is False
    assert "Connection timed out" in (record.availability.error or "")


# 9. Persistence & Batch Retrieval Tests
def test_database_verification_storage():
    import mongomock
    client = mongomock.MongoClient()
    db = Database(database_name="test_verif_clds", client=client)

    # Insert a lead with website
    lead = BusinessLead(
        place_id="lead_123",
        business_name="Austin Bloom",
        category="gift stores",
        country="US",
        city="Austin",
        address="100 Main St",
        website="https://austinbloom.com",
    )
    db.save_lead(lead)

    unverified = db.get_unverified_leads(limit=10)
    assert len(unverified) == 1
    assert unverified[0].place_id == "lead_123"

    # Save verification record
    record = VerificationRecord(
        lead_id="lead_123",
        target_url="https://austinbloom.com",
        overall_status="verified",
        verification_duration_ms=450,
        availability=AvailabilityResult(reachable=True, status_code=200, https=True),
    )
    db.save_verification(record)

    # Check unverified leads is now empty
    unverified_after = db.get_unverified_leads(limit=10)
    assert len(unverified_after) == 0

    # Retrieve verification record
    saved_rec = db.get_verification("lead_123")
    assert saved_rec is not None
    assert saved_rec.overall_status == "verified"
    assert saved_rec.availability.status_code == 200
    assert db.count_verifications() == 1
