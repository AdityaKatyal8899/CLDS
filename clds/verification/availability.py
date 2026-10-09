"""Check 1 — Website Availability Checker."""

import time
import socket
from urllib.parse import urlparse
from typing import Optional, Tuple
import httpx
from clds.verification.models import AvailabilityResult


class AvailabilityChecker:
    """Checks DNS, HTTP/HTTPS connectivity, status code, response time, and redirects."""

    def __init__(self, timeout_sec: float = 10.0):
        self.timeout_sec = timeout_sec
        self.headers = {
            "User-Agent": "CLDS-Website-Verifier/2.0 (+https://github.com/client-lead-discovery)",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        }

    def check(self, url: str) -> Tuple[AvailabilityResult, Optional[httpx.Response]]:
        """
        Execute availability check.
        Returns (AvailabilityResult, httpx.Response).
        """
        result = AvailabilityResult()
        clean_url = url.strip()
        if not clean_url.startswith(("http://", "https://")):
            clean_url = "https://" + clean_url

        # Check DNS
        try:
            parsed = urlparse(clean_url)
            host = parsed.netloc.split(":")[0]
            socket.gethostbyname(host)
            result.dns_resolved = True
        except Exception as exc:
            result.dns_resolved = False
            result.error = f"DNS resolution failed: {exc}"
            return result, None

        # Execute HTTP Request with redirect tracing
        start_time = time.perf_counter()
        try:
            with httpx.Client(
                timeout=self.timeout_sec,
                headers=self.headers,
                follow_redirects=True,
                verify=False,  # Allow self-signed/expired cert detection without crashing
            ) as client:
                response = client.get(clean_url)
                duration_ms = int((time.perf_counter() - start_time) * 1000)

                result.reachable = True
                result.status_code = response.status_code
                result.final_url = str(response.url)
                result.https = str(response.url).startswith("https://")
                result.response_time_ms = duration_ms

                # Track redirect chain
                chain = []
                for hist in response.history:
                    chain.append(str(hist.url))
                if chain:
                    chain.append(str(response.url))
                result.redirect_chain = chain

                return result, response
        except httpx.ConnectTimeout:
            result.reachable = False
            result.error = "Connection timed out"
            return result, None
        except httpx.ReadTimeout:
            result.reachable = False
            result.error = "Read timed out while waiting for server response"
            return result, None
        except httpx.ConnectError as exc:
            result.reachable = False
            result.error = f"Connection failed: {exc}"
            return result, None
        except Exception as exc:
            result.reachable = False
            result.error = f"HTTP request failed: {exc}"
            return result, None
