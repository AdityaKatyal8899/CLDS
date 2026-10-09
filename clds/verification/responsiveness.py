"""Check 2 — Mobile Responsiveness Checker (375x812 Viewport)."""

import re
from typing import Optional
from bs4 import BeautifulSoup
from clds.verification.models import ResponsivenessResult


class ResponsivenessChecker:
    """Evaluates mobile responsiveness at 375x812 viewport via Playwright or DOM analysis."""

    def __init__(self, use_browser: bool = True, timeout_sec: float = 12.0):
        self.use_browser = use_browser
        self.timeout_sec = timeout_sec

    def _check_with_playwright(self, url: str) -> Optional[ResponsivenessResult]:
        """Test with Playwright headless browser at 375x812."""
        try:
            from playwright.sync_api import sync_playwright
            with sync_playwright() as p:
                browser = p.chromium.launch(headless=True)
                context = browser.new_context(
                    viewport={"width": 375, "height": 812},
                    user_agent="Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1",
                )
                page = context.new_page()
                page.goto(url, timeout=int(self.timeout_sec * 1000), wait_until="domcontentloaded")
                page.wait_for_timeout(1000)  # Allow CSS/layout calculation

                # Evaluate layout metrics in browser context
                metrics = page.evaluate("""() => {
                    const docWidth = document.documentElement.scrollWidth;
                    const bodyWidth = document.body ? document.body.scrollWidth : 0;
                    const maxScrollWidth = Math.max(docWidth, bodyWidth);
                    const viewportWidth = window.innerWidth;
                    const horizontalOverflow = maxScrollWidth > (viewportWidth + 5);

                    // Count images exceeding viewport width
                    let overflowingImages = 0;
                    const images = document.querySelectorAll('img');
                    images.forEach(img => {
                        const rect = img.getBoundingClientRect();
                        if (rect.width > (viewportWidth + 5)) {
                            overflowingImages++;
                        }
                    });

                    return {
                        scrollWidth: maxScrollWidth,
                        viewportWidth: viewportWidth,
                        horizontalOverflow: horizontalOverflow,
                        overflowingImages: overflowingImages
                    };
                }""")

                browser.close()

                scroll_w = int(metrics.get("scrollWidth", 375))
                h_overflow = bool(metrics.get("horizontalOverflow", False))
                img_overflow = int(metrics.get("overflowingImages", 0))

                return ResponsivenessResult(
                    viewport="375x812",
                    horizontal_overflow=h_overflow,
                    scroll_width_px=scroll_w,
                    viewport_width_px=375,
                    content_overflow=h_overflow or (img_overflow > 0),
                    images_exceeding_viewport=img_overflow,
                    responsive=not h_overflow and (img_overflow == 0),
                    method="browser_playwright",
                )
        except Exception:
            return None

    def _check_with_dom_analysis(self, html_content: str) -> ResponsivenessResult:
        """Deterministic DOM & CSS heuristic analysis fallback when browser is not running."""
        result = ResponsivenessResult(method="dom_analysis")
        if not html_content:
            result.error = "Empty HTML content"
            return result

        try:
            soup = BeautifulSoup(html_content, "html.parser")
            
            # Check viewport tag
            viewport = soup.find("meta", attrs={"name": lambda x: x and x.lower() == "viewport"})
            has_valid_viewport = False
            if viewport and viewport.get("content"):
                v_content = viewport.get("content", "").lower()
                if "width=device-width" in v_content:
                    has_valid_viewport = True

            # Detect fixed wide tables or elements with style="width: 800px" etc.
            fixed_wide_elements = 0
            for tag in soup.find_all(style=True):
                style_str = tag["style"].lower()
                width_match = re.search(r"(?:min-)?width:\s*(\d+)px", style_str)
                if width_match:
                    w_val = int(width_match.group(1))
                    if w_val > 400:
                        fixed_wide_elements += 1

            # Detect unconstrained tables
            wide_tables = len(soup.find_all("table", width=lambda x: x and x.isdigit() and int(x) > 400))

            overflow = not has_valid_viewport or (fixed_wide_elements > 0) or (wide_tables > 0)
            result.horizontal_overflow = overflow
            result.content_overflow = overflow
            result.scroll_width_px = 800 if overflow else 375
            result.responsive = not overflow

        except Exception as exc:
            result.error = f"DOM responsiveness analysis error: {exc}"

        return result

    def check(self, url: str, html_content: Optional[str] = None) -> ResponsivenessResult:
        """Run mobile responsiveness check at 375x812."""
        if self.use_browser:
            browser_result = self._check_with_playwright(url)
            if browser_result:
                return browser_result

        # Fallback to deterministic DOM analysis
        return self._check_with_dom_analysis(html_content or "")
