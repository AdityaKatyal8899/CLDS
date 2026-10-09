"""Check 3 — Performance & Loading Signals Checker."""

import time
from typing import Optional
from bs4 import BeautifulSoup
import httpx
from clds.verification.models import PerformanceResult


class PerformanceChecker:
    """Lightweight performance measurement: TTFB, size, resource count, compression."""

    def check(
        self,
        response: Optional[httpx.Response],
        html_content: Optional[str] = None,
    ) -> PerformanceResult:
        result = PerformanceResult()
        if not response:
            result.error = "No HTTP response available for performance evaluation"
            return result

        try:
            # 1. Document size
            raw_bytes = response.content
            doc_size_kb = round(len(raw_bytes) / 1024.0, 2)
            result.document_size_kb = doc_size_kb

            # 2. TTFB & Load timing from httpx response elapsed
            if hasattr(response, "elapsed") and response.elapsed:
                result.ttfb_ms = int(response.elapsed.total_seconds() * 1000)
                result.total_load_time_ms = result.ttfb_ms

            # 3. Compression status
            encoding = response.headers.get("content-encoding", "").lower().strip()
            if encoding in ["gzip", "br", "deflate", "zstd"]:
                result.compression_enabled = True
                result.compression_type = encoding
            else:
                result.compression_enabled = False

            # 4. Count resources linked in the HTML document
            if html_content:
                soup = BeautifulSoup(html_content, "html.parser")
                scripts = soup.find_all("script", src=True)
                stylesheets = soup.find_all("link", rel=lambda x: x and "stylesheet" in x)
                images = soup.find_all("img", src=True)
                iframes = soup.find_all("iframe")
                
                total_resources = len(scripts) + len(stylesheets) + len(images) + len(iframes)
                result.resource_count = total_resources

                # Check for oversized indicators (e.g., doc size > 500KB or > 100 resource links)
                oversized = 0
                if doc_size_kb > 500.0:
                    oversized += 1
                result.oversized_resources_count = oversized

        except Exception as exc:
            result.error = f"Performance check error: {exc}"

        return result
