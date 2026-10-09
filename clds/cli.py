import argparse
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional
from clds.config import settings
from clds.models import SearchCriteria
from clds.database import Database, MongoDBConfigurationError, migrate_sqlite_to_mongodb
from clds.search import LeadDiscoveryService
from clds.providers.google_places import (
    GooglePlacesProvider,
    GooglePlacesAPIError,
    InvalidAPIKeyError,
)
from clds.export import export_to_csv, export_to_json, generate_export_filename


# Attempt to configure UTF-8 stdout if possible on Windows
try:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass


def print_banner() -> None:
    print("\nCLDS - Client Lead Discovery System")
    print("====================================\n")


def cmd_search(args: argparse.Namespace) -> int:
    """Execute business discovery search command."""
    print_banner()

    country_display = args.country.upper() if len(args.country) == 2 else args.country.title()
    category_display = args.category.title()
    city_display = args.city.title() if args.city else "None"
    state_display = args.state.title() if args.state else "None"
    provider_name = getattr(args, "provider", "auto").lower()

    provider_labels = {
        "auto": "Auto (OpenStreetMap + Web Search) [$0 Free]",
        "osm": "OpenStreetMap Overpass API [$0 Free]",
        "web": "Web Search Engine [$0 Free]",
        "google": "Google Places API (New) [Requires API Key]",
    }
    provider_display = provider_labels.get(provider_name, provider_name.title())

    print("Searching:")
    print(f"  Category : {category_display}")
    print(f"  Country  : {country_display}")
    if args.state:
        print(f"  State    : {state_display}")
    if args.city:
        print(f"  City     : {city_display}")
    print(f"  Provider : {provider_display}")
    print(f"  Limit    : {args.limit}\n")

    print(f"Discovering businesses via {provider_name.upper()}...")

    criteria = SearchCriteria(
        category=args.category,
        country=args.country,
        city=args.city,
        state=args.state,
        limit=args.limit,
        provider=provider_name,
    )

    import json
    json_events = getattr(args, "json_events", False)
    if json_events:
        print(json.dumps({"event": "job_started", "type": "discovery", "criteria": {"category": args.category, "country": args.country, "city": args.city, "limit": args.limit}}), flush=True)

    try:
        service = LeadDiscoveryService()
        if json_events:
            print(json.dumps({"event": "progress", "value": 30, "message": f"Querying discovery providers for '{args.category}' in {args.city or args.country}..."}), flush=True)
        summary, leads = service.execute_search(criteria)
    except MongoDBConfigurationError as exc:
        if json_events:
            print(json.dumps({"event": "job_failed", "type": "discovery", "error": str(exc)}), flush=True)
        print(f"\n[!] {exc}\n")
        return 1
    except InvalidAPIKeyError as exc:
        if json_events:
            print(json.dumps({"event": "job_failed", "type": "discovery", "error": str(exc)}), flush=True)
        print(f"\n[!] Configuration Error:\n    {exc}")
        print("\nSetup Guide:")
        print("    1. Copy .env.example to .env: copy .env.example .env")
        print("    2. Add your Google Places API key to .env: GOOGLE_MAPS_API_KEY=your_key")
        print("    3. Or use free mode: python run.py search --provider auto ...")
        return 1
    except GooglePlacesAPIError as exc:
        if json_events:
            print(json.dumps({"event": "job_failed", "type": "discovery", "error": str(exc)}), flush=True)
        print(f"\n[!] Google Places API Error:\n    {exc}")
        return 1
    except Exception as exc:
        if json_events:
            print(json.dumps({"event": "job_failed", "type": "discovery", "error": str(exc)}), flush=True)
        print(f"\n[!] Unexpected error occurred: {exc}")
        return 1

    if json_events:
        print(json.dumps({
            "event": "job_completed",
            "type": "discovery",
            "summary": summary.model_dump(),
            "leads_count": len(leads),
            "message": f"Successfully discovered {len(leads)} leads."
        }), flush=True)

    print(f"\n* {summary.total_discovered} businesses discovered")
    print(f"* {summary.unique_discovered} unique businesses")
    print(f"* {summary.websites_found} websites found")
    print(f"* {summary.no_website_found} businesses without websites")
    print(f"* {summary.records_stored_or_updated} records stored/updated in MongoDB")
    
    if summary.provider_used == "auto":
        print(f"\nSources Breakdown:")
        print(f"  OSM Results        : {summary.osm_results_count}")
        print(f"  Web Search Results : {summary.web_results_count}")
        print(f"  Duplicates Removed : {summary.duplicates_removed}")

    print()
    print(f"International: {summary.international_count}")
    print(f"India:         {summary.india_count}")
    print()
    print("Export:")
    if summary.csv_export_path:
        print(f"  * CSV  : {summary.csv_export_path}")
    if summary.json_export_path:
        print(f"  * JSON : {summary.json_export_path}")
    print()
    return 0


def cmd_list(args: argparse.Namespace) -> int:
    """List stored leads from MongoDB database."""
    print_banner()
    try:
        db = Database()
        total_in_db = db.count_leads()

        leads = db.get_leads(
            country=args.country,
            city=args.city,
            category=args.category,
            source=args.source,
            website_status=args.website_status,
            limit=args.limit,
        )
    except MongoDBConfigurationError as exc:
        print(f"[!] {exc}\n")
        return 1

    print(f"Total leads in database: {total_in_db}")
    print(f"Matching query: {len(leads)}\n")

    if not leads:
        print("No matching leads found.")
        return 0

    header = f"{'#':<4} | {'Business Name':<28} | {'Category':<16} | {'City':<14} | {'Website Status':<16} | {'Source':<14}"
    print(header)
    print("-" * len(header))

    for idx, lead in enumerate(leads, 1):
        b_name = (lead.business_name[:25] + "...") if len(lead.business_name) > 28 else lead.business_name
        b_cat = (lead.category[:13] + "...") if len(lead.category) > 16 else lead.category
        b_city = (lead.city[:11] + "...") if lead.city and len(lead.city) > 14 else (lead.city or "N/A")
        status = lead.website_status
        src = lead.source[:14]
        print(f"{idx:<4} | {b_name:<28} | {b_cat:<16} | {b_city:<14} | {status:<16} | {src:<14}")

    print()
    return 0


def cmd_export(args: argparse.Namespace) -> int:
    """Export stored leads from MongoDB to CSV and/or JSON."""
    print_banner()
    try:
        db = Database()
        leads = db.get_leads(
            country=args.country,
            city=args.city,
            category=args.category,
            source=args.source,
        )
    except MongoDBConfigurationError as exc:
        print(f"[!] {exc}\n")
        return 1

    if not leads:
        print("No leads found matching criteria to export.")
        return 0

    out_dir = Path(args.output_dir) if args.output_dir else settings.export_dir
    out_dir.mkdir(parents=True, exist_ok=True)

    category_label = args.category or "all_leads"
    csv_filename = generate_export_filename(category_label, args.city, args.country, "csv")
    json_filename = generate_export_filename(category_label, args.city, args.country, "json")

    fmt = (args.format or "both").lower()

    print(f"Exporting {len(leads)} leads to '{out_dir}':")
    if fmt in ["csv", "both"]:
        csv_path = export_to_csv(leads, out_dir / csv_filename)
        print(f"  * CSV  : {csv_path}")
    if fmt in ["json", "both"]:
        json_path = export_to_json(leads, out_dir / json_filename)
        print(f"  * JSON : {json_path}")

    print()
    return 0


def cmd_batch(args: argparse.Namespace) -> int:
    """Execute a batch of discovery searches from a JSON file and export a single combined file."""
    import json
    print_banner()

    batch_file_path = Path(args.file) if args.file else Path("batch_queries.json")
    if not batch_file_path.exists():
        print(f"[!] Batch configuration file not found: {batch_file_path}")
        print("    Create a JSON file containing a list of search objects or use default batch_queries.json.")
        return 1

    try:
        with open(batch_file_path, "r", encoding="utf-8") as f:
            query_configs = json.load(f)
    except Exception as exc:
        print(f"[!] Failed to parse batch JSON file: {exc}")
        return 1

    if not isinstance(query_configs, list) or not query_configs:
        print("[!] Batch file must contain a non-empty JSON list of query objects.")
        return 1

    print(f"Loaded {len(query_configs)} search tasks from '{batch_file_path}'\n")

    service = LeadDiscoveryService()
    all_discovered_leads = []
    total_found = 0
    total_websites = 0

    for idx, item in enumerate(query_configs, 1):
        cat = item.get("category", "")
        country = item.get("country", "")
        city = item.get("city")
        state = item.get("state")
        limit = int(item.get("limit", 30))
        provider_name = item.get("provider", args.provider or "auto")

        loc_str = f"{city}, {country}" if city else country
        print(f"[{idx}/{len(query_configs)}] Searching '{cat}' in {loc_str} (Limit: {limit})...")

        criteria = SearchCriteria(
            category=cat,
            country=country,
            city=city,
            state=state,
            limit=limit,
            provider=provider_name,
        )

        try:
            summary, leads = service.execute_search(criteria)
            all_discovered_leads.extend(leads)
            total_found += summary.unique_discovered
            total_websites += summary.websites_found
            print(f"    * {summary.unique_discovered} unique leads ({summary.websites_found} websites found)")
        except Exception as exc:
            print(f"    [!] Error during task: {exc}")

    # Deduplicate combined leads across all batch tasks
    from clds.search import deduplicate_lead_list
    final_unique_leads = deduplicate_lead_list(all_discovered_leads)

    out_dir = Path(args.output_dir) if args.output_dir else settings.export_dir
    out_dir.mkdir(parents=True, exist_ok=True)

    date_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    batch_json_filename = f"batch_combined_leads_{date_str}.json"
    batch_csv_filename = f"batch_combined_leads_{date_str}.csv"

    json_path = export_to_json(final_unique_leads, out_dir / batch_json_filename)
    csv_path = export_to_csv(final_unique_leads, out_dir / batch_csv_filename)

    print("\n" + "=" * 50)
    print("BATCH DISCOVERY SUMMARY")
    print("=" * 50)
    print(f"Tasks Completed      : {len(query_configs)}")
    print(f"Total Unique Leads   : {len(final_unique_leads)}")
    print(f"Websites Found       : {sum(1 for l in final_unique_leads if l.website_status == 'website_found')}")
    print(f"No Website Found     : {sum(1 for l in final_unique_leads if l.website_status == 'no_website_found')}")
    print(f"Total Stored in DB   : {service.db.count_leads()}")
    print("\nCombined Exports:")
    print(f"  * JSON : {json_path}")
    print(f"  * CSV  : {csv_path}")
    print()
    return 0


def _print_single_verification(record) -> None:
    """Format single verification result to terminal."""
    av = record.availability
    rs = record.responsiveness
    pf = record.performance
    ca = record.caching
    se = record.seo
    ac = record.accessibility
    cv = record.conversion

    print(f"Target URL : {record.target_url}")
    if record.lead_id:
        print(f"Lead ID    : {record.lead_id}")
    print("\nRunning 7 Fast Deterministic Checks...\n")

    # 1. Availability
    if av.reachable:
        https_str = "HTTPS" if av.https else "HTTP (Insecure)"
        print(f"  [1] Availability    : [OK] Status {av.status_code} ({https_str}, {av.response_time_ms}ms)")
    else:
        print(f"  [1] Availability    : [FAILED] {av.error or 'Unreachable'}")

    if not av.reachable:
        print(f"\nStatus: UNREACHABLE (Duration: {record.verification_duration_ms}ms)\n")
        return

    # 2. Responsiveness
    if rs.error:
        print(f"  [2] Responsiveness  : [ERROR] {rs.error}")
    elif rs.responsive:
        print(f"  [2] Responsiveness  : [OK] Mobile Friendly ({rs.viewport}, No overflow)")
    else:
        print(f"  [2] Responsiveness  : [WARN] Overflow detected (Scroll Width: {rs.scroll_width_px}px, Overflowing Imgs: {rs.images_exceeding_viewport})")

    # 3. Performance
    if pf.error:
        print(f"  [3] Performance     : [ERROR] {pf.error}")
    else:
        comp_str = f", {pf.compression_type.upper()}" if pf.compression_enabled and pf.compression_type else ""
        print(f"  [3] Performance     : [OK] TTFB: {pf.ttfb_ms or 'N/A'}ms, Size: {pf.document_size_kb or 'N/A'}KB, Resources: {pf.resource_count or 0}{comp_str}")

    # 4. HTTP Caching
    if ca.error:
        print(f"  [4] HTTP Caching    : [ERROR] {ca.error}")
    else:
        signals = []
        if ca.cache_control:
            signals.append(f"Cache-Control: {ca.cache_control[:20]}")
        if ca.etag:
            signals.append("ETag: Yes")
        if ca.last_modified:
            signals.append("Last-Mod: Yes")
        sig_str = ", ".join(signals) if signals else "No standard caching headers"
        print(f"  [4] HTTP Caching    : [OK] {sig_str}")

    # 5. Technical SEO
    if se.error:
        print(f"  [5] Technical SEO   : [ERROR] {se.error}")
    else:
        title_str = f"Title: {se.title_length} chars" if se.title else "Title: Missing"
        desc_str = f"Desc: {se.meta_description_length} chars" if se.meta_description else "Desc: Missing"
        vp_str = "Viewport: Yes" if se.viewport else "Viewport: Missing"
        print(f"  [5] Technical SEO   : [OK] {title_str}, {desc_str}, {vp_str}")

    # 6. Accessibility
    if ac.error:
        print(f"  [6] Accessibility   : [ERROR] {ac.error}")
    else:
        lang_str = f"Lang: {ac.html_lang}" if not ac.missing_lang_attribute else "Lang: Missing"
        print(f"  [6] Accessibility   : [OK] Missing Alt: {ac.images_without_alt}/{ac.total_images}, Unlabelled Inputs: {ac.inputs_without_labels}, {lang_str}")

    # 7. Conversion / UX
    if cv.error:
        print(f"  [7] Conversion / UX : [ERROR] {cv.error}")
    else:
        conv_items = []
        if cv.phone_present:
            conv_items.append(f"Phone: {cv.phone_numbers[0] if cv.phone_numbers else 'Yes'}")
        if cv.email_present:
            conv_items.append(f"Email: {cv.emails[0] if cv.emails else 'Yes'}")
        if cv.booking_cta:
            conv_items.append(f"Booking CTA: '{cv.booking_cta_matches[0]}'")
        elif cv.primary_cta:
            conv_items.append(f"Primary CTA: '{cv.primary_cta_matches[0]}'")
        if cv.social_links_present:
            conv_items.append(f"Socials: {', '.join(cv.social_platforms[:2])}")
        conv_str = ", ".join(conv_items) if conv_items else "No clear conversion triggers detected"
        print(f"  [7] Conversion / UX : [OK] {conv_str}")

    print(f"\nDuration: {record.verification_duration_ms}ms")


def cmd_verify(args: argparse.Namespace) -> int:
    """Execute Stage 2 Fast Website Verification."""
    import json
    from clds.verification.runner import WebsiteVerificationRunner
    print_banner()

    json_events = getattr(args, "json_events", False)

    try:
        db = Database()
    except MongoDBConfigurationError as exc:
        if json_events:
            print(json.dumps({"event": "job_failed", "type": "verification", "error": str(exc)}), flush=True)
        print(f"[!] {exc}\n")
        return 1

    runner = WebsiteVerificationRunner()

    # Case 1: Direct single URL
    if args.url:
        if json_events:
            print(json.dumps({"event": "job_started", "type": "verification", "target_url": args.url}), flush=True)
        print(f"Verifying target URL: {args.url}\n")
        record = runner.verify(args.url)
        db.save_verification(record)
        _print_single_verification(record)
        if json_events:
            print(json.dumps({
                "event": "job_completed",
                "type": "verification",
                "status": record.overall_status,
                "duration_ms": record.verification_duration_ms,
                "summary": record.model_dump(),
                "message": f"Verified {args.url} ({record.overall_status})"
            }), flush=True)
        print("✓ Verification stored in MongoDB.\n")
        return 0

    # Case 2: Specific Lead ID
    if args.lead_id:
        if json_events:
            print(json.dumps({"event": "job_started", "type": "verification", "lead_id": args.lead_id}), flush=True)
        leads = db.get_leads(limit=1000)
        matched_lead = next((l for l in leads if l.place_id == args.lead_id), None)
        if not matched_lead or not matched_lead.website:
            err_msg = f"Lead '{args.lead_id}' not found or has no official website."
            if json_events:
                print(json.dumps({"event": "job_failed", "type": "verification", "error": err_msg}), flush=True)
            print(f"[!] {err_msg}")
            return 1

        print(f"Verifying lead: {matched_lead.business_name} ({matched_lead.website})\n")
        record = runner.verify(matched_lead.website, lead_id=matched_lead.place_id)
        db.save_verification(record)
        _print_single_verification(record)
        if json_events:
            print(json.dumps({
                "event": "job_completed",
                "type": "verification",
                "status": record.overall_status,
                "duration_ms": record.verification_duration_ms,
                "summary": record.model_dump(),
                "message": f"Verified {matched_lead.business_name} ({record.overall_status})"
            }), flush=True)
        print("✓ Verification stored in MongoDB.\n")
        return 0

    # Case 3: Batch verification of unverified leads
    limit = args.limit or 20
    unverified_leads = db.get_unverified_leads(limit=limit)

    if not unverified_leads:
        if json_events:
            print(json.dumps({
                "event": "job_completed",
                "type": "verification",
                "processed": 0,
                "verified": 0,
                "unreachable": 0,
                "message": "No unverified leads with websites found."
            }), flush=True)
        print("No unverified leads with websites found in database.")
        return 0

    if json_events:
        print(json.dumps({"event": "job_started", "type": "verification", "total_leads": len(unverified_leads)}), flush=True)

    print(f"Starting batch verification for {len(unverified_leads)} unverified leads...\n")
    success_cnt = 0
    unreachable_cnt = 0
    start_all = time.perf_counter()

    for idx, lead in enumerate(unverified_leads, 1):
        if not lead.website:
            continue
        print(f"[{idx}/{len(unverified_leads)}] Verifying {lead.business_name} ({lead.website})...")
        record = runner.verify(lead.website, lead_id=lead.place_id)
        db.save_verification(record)

        pct = int((idx / len(unverified_leads)) * 100)
        if record.overall_status == "verified":
            success_cnt += 1
            print(f"    * Verified ({record.verification_duration_ms}ms) | Mobile: {'OK' if record.responsiveness.responsive else 'No'} | TTFB: {record.performance.ttfb_ms}ms")
        else:
            unreachable_cnt += 1
            print(f"    * Unreachable ({record.verification_duration_ms}ms) | {record.availability.error or 'Failed'}")

        if json_events:
            print(json.dumps({
                "event": "progress",
                "value": pct,
                "current": idx,
                "total": len(unverified_leads),
                "lead_id": lead.place_id,
                "business_name": lead.business_name,
                "status": record.overall_status,
                "message": f"[{idx}/{len(unverified_leads)}] Verified {lead.business_name}: {record.overall_status}"
            }), flush=True)

    total_time = round(time.perf_counter() - start_all, 2)
    print("\n" + "=" * 50)
    print("STAGE 2 BATCH VERIFICATION SUMMARY")
    print("=" * 50)
    print(f"Total Processed      : {len(unverified_leads)}")
    print(f"Reachable & Verified : {success_cnt}")
    print(f"Unreachable / Errors : {unreachable_cnt}")
    print(f"Total Duration       : {total_time}s")
    print(f"Stored in Database   : {db.count_verifications()} records")
    print()

    if json_events:
        print(json.dumps({
            "event": "job_completed",
            "type": "verification",
            "processed": len(unverified_leads),
            "verified": success_cnt,
            "unreachable": unreachable_cnt,
            "total_duration_seconds": total_time,
            "message": f"Batch verification finished: {success_cnt} verified, {unreachable_cnt} unreachable."
        }), flush=True)

    return 0


def cmd_migrate(args: argparse.Namespace) -> int:
    """Migrate historical data from SQLite to MongoDB Atlas."""
    print_banner()
    sqlite_path = Path(args.sqlite_path) if getattr(args, "sqlite_path", None) else None
    print("Starting migration from SQLite to MongoDB Atlas...\n")

    try:
        result = migrate_sqlite_to_mongodb(sqlite_path=sqlite_path)
    except MongoDBConfigurationError as exc:
        print(f"[!] {exc}\n")
        return 1
    except Exception as exc:
        print(f"[!] Migration failed: {exc}\n")
        return 1

    if result["status"] == "no_data":
        print(f"[-] {result['message']}")
        print(f"    Inspected SQLite path: {result['sqlite_path']}\n")
        return 0

    print("=" * 50)
    print("SQLITE TO MONGODB MIGRATION SUMMARY")
    print("=" * 50)
    print(f"SQLite Source        : {result['sqlite_path']}")
    print(f"MongoDB Database     : {result['database_name']}")
    print(f"Leads Read           : {result['leads_read']}")
    print(f"Leads Inserted       : {result['leads_inserted']}")
    print(f"Leads Updated        : {result['leads_updated']}")
    print(f"Verifications Read   : {result['verifications_read']}")
    print(f"Verifications Stored : {result['verifications_migrated']}")

    if result["errors"]:
        print(f"\nErrors Encountered   : {len(result['errors'])}")
        for err in result["errors"]:
            print(f"  * {err}")
    else:
        print(f"Errors Encountered   : 0")

    print(f"\n✓ {result['message']}\n")
    return 0


def create_parser() -> argparse.ArgumentParser:
    """Build command line argument parser."""
    parser = argparse.ArgumentParser(
        prog="clds",
        description="CLDS - Client Lead Discovery System (Stage 1 & 2)",
    )
    subparsers = parser.add_subparsers(dest="command", help="Available commands")

    # Migration command
    migrate_parser = subparsers.add_parser("migrate-to-mongodb", help="Migrate historical leads and verifications from SQLite to MongoDB Atlas")
    migrate_parser.add_argument("--sqlite-path", help="Custom path to SQLite database (default: from CLDS_DB_PATH or data/clds.db)")
    migrate_parser.set_defaults(func=cmd_migrate)

    # Verify command (Stage 2)
    verify_parser = subparsers.add_parser("verify", help="Stage 2 Fast Website Verification (7 checks)")
    verify_parser.add_argument("--url", help="Verify a single direct URL")
    verify_parser.add_argument("--lead-id", help="Verify a specific lead from database by place_id")
    verify_parser.add_argument("--limit", type=int, default=20, help="Max unverified leads to verify in batch (default: 20)")
    verify_parser.add_argument("--json-events", action="store_true", help="Output machine-readable JSON events")
    verify_parser.set_defaults(func=cmd_verify)

    # Batch command
    batch_parser = subparsers.add_parser("batch", help="Execute batch discovery from JSON config and export single combined file")
    batch_parser.add_argument("--file", default="batch_queries.json", help="Path to batch JSON config (default: batch_queries.json)")
    batch_parser.add_argument(
        "--provider",
        choices=["auto", "osm", "web", "google"],
        default="auto",
        help="Default provider for batch queries (default: auto)",
    )
    batch_parser.add_argument("--output-dir", help="Custom output directory (default: data/exports)")
    batch_parser.set_defaults(func=cmd_batch)

    # Search command
    search_parser = subparsers.add_parser("search", help="Discover businesses and store leads")
    search_parser.add_argument("--category", required=True, help="Business category (e.g., 'gift stores', 'cafes')")
    search_parser.add_argument("--country", required=True, help="Target country (e.g., 'US', 'UK', 'CA', 'IN')")
    search_parser.add_argument("--city", help="Target city (e.g., 'Austin', 'Mumbai', 'London')")
    search_parser.add_argument("--state", help="Target state/province (e.g., 'Texas', 'Maharashtra')")
    search_parser.add_argument(
        "--provider",
        choices=["auto", "osm", "web", "google"],
        default="auto",
        help="Discovery provider: auto (OSM + Web $0), osm (Overpass $0), web (Web Search $0), google (Places API)",
    )
    search_parser.add_argument("--limit", type=int, default=20, help="Max businesses to retrieve (default: 20, max: 100)")
    search_parser.add_argument("--json-events", action="store_true", help="Output machine-readable JSON events")
    search_parser.set_defaults(func=cmd_search)

    # List command
    list_parser = subparsers.add_parser("list", help="List stored leads from database")
    list_parser.add_argument("--country", help="Filter by country")
    list_parser.add_argument("--city", help="Filter by city")
    list_parser.add_argument("--category", help="Filter by category")
    list_parser.add_argument("--source", choices=["osm_overpass", "web_search", "google_places"], help="Filter by discovery source")
    list_parser.add_argument("--website-status", choices=["website_found", "no_website_found"], help="Filter by website status")
    list_parser.add_argument("--limit", type=int, default=50, help="Max records to display (default: 50)")
    list_parser.set_defaults(func=cmd_list)

    # Export command
    export_parser = subparsers.add_parser("export", help="Export stored leads to CSV or JSON")
    export_parser.add_argument("--format", choices=["csv", "json", "both"], default="both", help="Export format (default: both)")
    export_parser.add_argument("--output-dir", help="Custom output directory (default: data/exports)")
    export_parser.add_argument("--country", help="Filter leads by country")
    export_parser.add_argument("--city", help="Filter leads by city")
    export_parser.add_argument("--category", help="Filter leads by category")
    export_parser.add_argument("--source", choices=["osm_overpass", "web_search", "google_places"], help="Filter leads by source")
    export_parser.set_defaults(func=cmd_export)

    return parser


def main() -> None:
    """Main CLI entrypoint."""
    parser = create_parser()
    if len(sys.argv) == 1:
        parser.print_help()
        sys.exit(0)

    args = parser.parse_args()
    if not hasattr(args, "func"):
        parser.print_help()
        sys.exit(1)

    exit_code = args.func(args)
    sys.exit(exit_code or 0)


if __name__ == "__main__":
    main()
