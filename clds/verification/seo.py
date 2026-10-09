"""Check 5 — Basic Technical SEO Signals Checker."""

from urllib.parse import urlparse, urljoin
from typing import Optional
from bs4 import BeautifulSoup
import httpx
from clds.verification.models import TechnicalSEOResult


class TechnicalSEOChecker:
    """Checks title, meta description, canonical, viewport, robots.txt, and sitemap."""

    def __init__(self, timeout_sec: float = 5.0):
        self.timeout_sec = timeout_sec

    def check(
        self,
        html_content: str,
        base_url: str,
        response: Optional[httpx.Response] = None,
        check_remote_files: bool = True,
    ) -> TechnicalSEOResult:
        result = TechnicalSEOResult()
        if not html_content:
            result.error = "Empty or missing HTML content"
            return result

        try:
            soup = BeautifulSoup(html_content, "html.parser")

            # Title
            title_tag = soup.find("title")
            if title_tag and title_tag.string:
                title_clean = title_tag.string.strip()
                if title_clean:
                    result.title = True
                    result.title_text = title_clean
                    result.title_length = len(title_clean)

            # Meta Description
            meta_desc = soup.find("meta", attrs={"name": lambda x: x and x.lower() == "description"})
            if meta_desc and meta_desc.get("content"):
                desc_clean = meta_desc.get("content", "").strip()
                if desc_clean:
                    result.meta_description = True
                    result.meta_description_text = desc_clean
                    result.meta_description_length = len(desc_clean)

            # Canonical Link
            canonical_tag = soup.find("link", attrs={"rel": lambda x: x and "canonical" in x})
            if canonical_tag and canonical_tag.get("href"):
                result.canonical = True
                result.canonical_url = canonical_tag.get("href", "").strip()

            # Viewport Meta Tag
            viewport_tag = soup.find("meta", attrs={"name": lambda x: x and x.lower() == "viewport"})
            if viewport_tag and viewport_tag.get("content"):
                result.viewport = True
                result.viewport_content = viewport_tag.get("content", "").strip()

            # Indexability Directives
            meta_robots = soup.find("meta", attrs={"name": lambda x: x and x.lower() == "robots"})
            if meta_robots and meta_robots.get("content"):
                if "noindex" in meta_robots.get("content", "").lower():
                    result.is_indexable = False

            if response and "noindex" in response.headers.get("x-robots-tag", "").lower():
                result.is_indexable = False

            # Check robots.txt and sitemap.xml if requested
            if check_remote_files and base_url:
                parsed = urlparse(base_url)
                origin = f"{parsed.scheme}://{parsed.netloc}"
                
                with httpx.Client(timeout=self.timeout_sec, follow_redirects=True, verify=False) as client:
                    # Check robots.txt
                    try:
                        rob_resp = client.get(f"{origin}/robots.txt")
                        result.robots_txt = rob_resp.status_code == 200 and "text/plain" in rob_resp.headers.get("content-type", "")
                    except Exception:
                        result.robots_txt = False

                    # Check sitemap.xml
                    try:
                        sm_resp = client.get(f"{origin}/sitemap.xml")
                        result.sitemap = sm_resp.status_code == 200
                    except Exception:
                        result.sitemap = False

        except Exception as exc:
            result.error = f"SEO analysis error: {exc}"

        return result
