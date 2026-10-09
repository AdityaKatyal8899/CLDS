"""Export utilities for CSV and JSON formats in CLDS."""

import csv
import json
import re
import unicodedata
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Tuple, Optional
from clds.models import BusinessLead
from clds.config import settings


def sanitize_filename(text: str) -> str:
    """Sanitize strings to safe ascii file path segments."""
    # Normalize unicode (e.g. é -> e)
    normalized = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode("utf-8")
    cleaned = re.sub(r"[^\w\s-]", "", normalized.lower())
    return re.sub(r"[-\s]+", "_", cleaned).strip("-_")


def generate_export_filename(
    category: str,
    city: Optional[str] = None,
    country: Optional[str] = None,
    extension: str = "csv",
) -> str:
    """Generate predictable export filename like gift_stores_austin_2026-10-09.csv."""
    parts = [sanitize_filename(category)]
    if city:
        parts.append(sanitize_filename(city))
    elif country:
        parts.append(sanitize_filename(country))
    
    date_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    parts.append(date_str)
    
    clean_ext = extension.lstrip(".")
    return f"{'_'.join(parts)}.{clean_ext}"


def export_to_csv(leads: List[BusinessLead], file_path: Path) -> Path:
    """Export list of leads to CSV."""
    file_path = Path(file_path)
    file_path.parent.mkdir(parents=True, exist_ok=True)

    fieldnames = [
        "place_id",
        "business_name",
        "category",
        "country",
        "state",
        "city",
        "address",
        "website",
        "website_status",
        "source",
        "source_url",
        "maps_url",
        "phone",
        "rating",
        "review_count",
        "latitude",
        "longitude",
        "discovered_at",
    ]

    with open(file_path, mode="w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for lead in leads:
            writer.writerow({
                "place_id": lead.place_id or "",
                "business_name": lead.business_name,
                "category": lead.category,
                "country": lead.country,
                "state": lead.state or "",
                "city": lead.city or "",
                "address": lead.address,
                "website": lead.website or "",
                "website_status": lead.website_status,
                "source": lead.source,
                "source_url": lead.source_url or "",
                "maps_url": lead.maps_url or "",
                "phone": lead.phone or "",
                "rating": lead.rating if lead.rating is not None else "",
                "review_count": lead.review_count if lead.review_count is not None else "",
                "latitude": lead.latitude if lead.latitude is not None else "",
                "longitude": lead.longitude if lead.longitude is not None else "",
                "discovered_at": lead.discovered_at,
            })

    return file_path


def export_to_json(leads: List[BusinessLead], file_path: Path) -> Path:
    """Export list of leads to formatted JSON."""
    file_path = Path(file_path)
    file_path.parent.mkdir(parents=True, exist_ok=True)

    data = [lead.model_dump() for lead in leads]
    with open(file_path, mode="w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

    return file_path


def export_leads_both(
    leads: List[BusinessLead],
    category: str,
    city: Optional[str] = None,
    country: Optional[str] = None,
    output_dir: Optional[Path] = None,
) -> Tuple[Path, Path]:
    """Export leads to both CSV and JSON in target export directory."""
    out_dir = Path(output_dir) if output_dir else settings.export_dir
    out_dir.mkdir(parents=True, exist_ok=True)

    csv_name = generate_export_filename(category, city, country, "csv")
    json_name = generate_export_filename(category, city, country, "json")

    csv_path = out_dir / csv_name
    json_path = out_dir / json_name

    export_to_csv(leads, csv_path)
    export_to_json(leads, json_path)

    return csv_path, json_path
