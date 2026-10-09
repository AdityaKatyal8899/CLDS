"""Check 6 — Basic Accessibility Signals Checker."""

from typing import Optional
from bs4 import BeautifulSoup
from clds.verification.models import AccessibilityResult


class AccessibilityChecker:
    """Checks missing alt attributes, unlabelled form inputs, missing lang, and empty buttons."""

    def check(self, html_content: str) -> AccessibilityResult:
        result = AccessibilityResult()
        if not html_content:
            result.error = "Empty or missing HTML content"
            return result

        try:
            soup = BeautifulSoup(html_content, "html.parser")

            # 1. HTML lang attribute
            html_tag = soup.find("html")
            if html_tag:
                lang = html_tag.get("lang")
                if lang and str(lang).strip():
                    result.html_lang = str(lang).strip()
                    result.missing_lang_attribute = False
                else:
                    result.missing_lang_attribute = True
            else:
                result.missing_lang_attribute = True

            # 2. Image alt attributes
            images = soup.find_all("img")
            result.total_images = len(images)
            no_alt_count = 0
            for img in images:
                alt = img.get("alt")
                # None means missing attribute entirely
                if alt is None:
                    no_alt_count += 1
            result.images_without_alt = no_alt_count

            # 3. Form input labels
            inputs = soup.find_all(["input", "select", "textarea"])
            valid_inputs = [
                i for i in inputs 
                if i.get("type", "text").lower() not in ["hidden", "submit", "button", "reset", "image"]
            ]
            result.total_inputs = len(valid_inputs)
            
            unlabelled = 0
            for inp in valid_inputs:
                input_id = inp.get("id")
                has_label = False
                # Check explicit <label for="id">
                if input_id:
                    label = soup.find("label", attrs={"for": input_id})
                    if label and label.get_text(strip=True):
                        has_label = True
                
                # Check wrapping parent <label>
                if not has_label and inp.find_parent("label"):
                    has_label = True

                # Check aria-label or aria-labelledby or title or placeholder
                if not has_label and (inp.get("aria-label") or inp.get("aria-labelledby") or inp.get("title")):
                    has_label = True

                if not has_label:
                    unlabelled += 1
            result.inputs_without_labels = unlabelled

            # 4. Empty buttons or icon-only links without accessible text
            buttons = soup.find_all(["button", "a"])
            empty_btns = 0
            for btn in buttons:
                text = btn.get_text(strip=True)
                has_accessible_name = bool(
                    text or btn.get("aria-label") or btn.get("title") or btn.find("img", alt=True) or btn.find("svg")
                )
                if not has_accessible_name:
                    empty_btns += 1
            result.empty_buttons = empty_btns

            # 5. Heading hierarchy anomalies
            headings = soup.find_all(["h1", "h2", "h3", "h4", "h5", "h6"])
            h1_tags = soup.find_all("h1")
            result.h1_count = len(h1_tags)

            anomalies = []
            if result.h1_count == 0:
                anomalies.append("Missing <h1> element")
            elif result.h1_count > 1:
                anomalies.append(f"Multiple <h1> elements ({result.h1_count})")

            levels = []
            for h in headings:
                try:
                    lvl = int(h.name[1])
                    levels.append(lvl)
                except Exception:
                    pass

            for i in range(len(levels) - 1):
                if levels[i + 1] > levels[i] + 1:
                    anomalies.append(f"Skipped heading level: h{levels[i]} to h{levels[i+1]}")
                    break

            result.heading_structure_anomalies = anomalies

        except Exception as exc:
            result.error = f"Accessibility analysis error: {exc}"

        return result
