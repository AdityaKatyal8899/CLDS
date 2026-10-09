"""Check 4 — HTTP Caching Signals Checker."""

from typing import Optional
import httpx
from clds.verification.models import CachingResult


class CachingChecker:
    """Inspects response headers for browser/proxy caching signals."""

    def check(self, response: Optional[httpx.Response]) -> CachingResult:
        result = CachingResult()
        if not response:
            result.error = "No HTTP response available to inspect caching headers"
            return result

        headers = response.headers
        
        # Cache-Control
        cache_ctrl = headers.get("cache-control")
        if cache_ctrl:
            result.cache_control = cache_ctrl.strip()

        # ETag
        etag = headers.get("etag")
        if etag:
            result.etag = True
            result.etag_value = etag.strip()

        # Last-Modified
        last_mod = headers.get("last-modified")
        if last_mod:
            result.last_modified = True
            result.last_modified_value = last_mod.strip()

        # Expires
        expires = headers.get("expires")
        if expires:
            result.expires = True
            result.expires_value = expires.strip()

        # Summary signal
        result.has_caching_signals = bool(
            result.cache_control or result.etag or result.last_modified or result.expires
        )
        return result
