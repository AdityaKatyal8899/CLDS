"""Check 7 — Basic Conversion and UX Signals Checker."""

import re
from urllib.parse import urlparse
from typing import Optional, List, Set
from bs4 import BeautifulSoup
from clds.verification.models import ConversionResult


class ConversionUXChecker:
    """Checks for contact details, primary CTA, booking actions, social links, and navigation."""

    BOOKING_KEYWORDS = [
        "book", "reserve", "appointment", "schedule", "order online", "reservations",
        "book now", "schedule now", "table reservation", "book online"
    ]

    PRIMARY_CTA_KEYWORDS = [
        "contact us", "get in touch", "get a quote", "request quote", "shop now",
        "buy now", "order now", "view menu", "call now", "get started", "free consultation"
    ]

    SOCIAL_DOMAINS = {
        "instagram.com": "Instagram",
        "facebook.com": "Facebook",
        "linkedin.com": "LinkedIn",
        "twitter.com": "Twitter/X",
        "x.com": "Twitter/X",
        "tiktok.com": "TikTok",
        "youtube.com": "YouTube",
        "pinterest.com": "Pinterest",
    }

    def check(self, html_content: str) -> ConversionResult:
        result = ConversionResult()
        if not html_content:
            result.error = "Empty or missing HTML content"
            return result

        try:
            soup = BeautifulSoup(html_content, "html.parser")
            page_text = soup.get_text(" ", strip=True)

            # 1. Phone number detection
            phone_numbers: Set[str] = set()
            for a in soup.find_all("a", href=True):
                href = a["href"].strip()
                if href.lower().startswith("tel:"):
                    clean_p = href[4:].strip()
                    if clean_p:
                        phone_numbers.add(clean_p)

            # Text regex for phone numbers (US/UK/IN patterns)
            phone_matches = re.findall(r"(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}", page_text)
            for p in phone_matches[:3]:
                if len(re.sub(r"\D", "", p)) >= 10:
                    phone_numbers.add(p.strip())

            result.phone_numbers = sorted(list(phone_numbers))
            result.phone_present = len(result.phone_numbers) > 0

            # 2. Email detection
            emails: Set[str] = set()
            for a in soup.find_all("a", href=True):
                href = a["href"].strip()
                if href.lower().startswith("mailto:"):
                    email_clean = href[7:].split("?")[0].strip()
                    if "@" in email_clean:
                        emails.add(email_clean)

            email_matches = re.findall(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,7}\b", page_text)
            for e in email_matches[:3]:
                # Filter out obvious false positives like file extensions or dummy emails
                if not e.endswith((".png", ".jpg", ".jpeg", ".webp", ".svg", ".js")):
                    emails.add(e.lower())

            result.emails = sorted(list(emails))
            result.email_present = len(result.emails) > 0

            # 3. Contact link detection
            contact_urls: Set[str] = set()
            for a in soup.find_all("a", href=True):
                href = a["href"].strip()
                text = a.get_text(strip=True).lower()
                if any(k in href.lower() for k in ["contact", "contact-us", "about-us", "get-in-touch"]) or \
                   any(k in text for k in ["contact", "contact us", "get in touch"]):
                    contact_urls.add(href)

            result.contact_urls = list(contact_urls)[:3]
            result.contact_link = len(result.contact_urls) > 0

            # 4. Booking & Primary CTAs
            buttons_and_links = soup.find_all(["button", "a"])
            booking_matches = set()
            primary_cta_matches = set()

            for el in buttons_and_links:
                text = el.get_text(strip=True).lower()
                if not text:
                    continue

                for kw in self.BOOKING_KEYWORDS:
                    if kw in text and len(text) < 40:
                        booking_matches.add(text)
                        break

                for kw in self.PRIMARY_CTA_KEYWORDS:
                    if kw in text and len(text) < 40:
                        primary_cta_matches.add(text)
                        break

            result.booking_cta_matches = sorted(list(booking_matches))[:5]
            result.booking_cta = len(result.booking_cta_matches) > 0

            result.primary_cta_matches = sorted(list(primary_cta_matches))[:5]
            result.primary_cta = len(result.primary_cta_matches) > 0

            # 5. Social Media links
            social_platforms: Set[str] = set()
            for a in soup.find_all("a", href=True):
                href = a["href"].lower()
                for domain, platform in self.SOCIAL_DOMAINS.items():
                    if domain in href:
                        social_platforms.add(platform)

            result.social_platforms = sorted(list(social_platforms))
            result.social_links_present = len(result.social_platforms) > 0

            # 6. Navigation presence
            nav = soup.find(["nav", "header"])
            if not nav:
                nav = soup.find(attrs={"role": lambda x: x and x.lower() == "navigation"})
            if not nav:
                nav = soup.find(class_=lambda x: x and any(c in str(x).lower() for c in ["navbar", "nav-menu", "site-navigation", "main-nav"]))

            result.navigation_present = bool(nav)

        except Exception as exc:
            result.error = f"Conversion UX analysis error: {exc}"

        return result
