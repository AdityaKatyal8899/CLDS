# Client Lead Discovery System (CLDS) — Stage 1 (V1)

**CLDS V1** is a focused, high-precision business lead discovery system built for freelance web development client acquisition. 

> **Scope Notice:** This is **Stage 1 (Discovery Layer Only)**. It discovers real businesses, captures their official contact and location metadata, detects their official website presence status, deduplicates results, persists them to SQLite, and exports structured CSV/JSON datasets. It does not perform audits, screenshots, scoring, or outreach.

---

## Features

- **Google Places API (New) Integration:** Uses official `searchText` endpoints with strict field masking to retrieve only required fields.
- **Strict Data Integrity:** No invented or hallucinated data. If a field is not verified by the provider, it is stored as `null` / empty.
- **Website Status Detection:** Explicitly tracks `website_found` (with official URI) vs `no_website_found` (null website) without judging or visiting the site.
- **Multi-Market Targeting:**
  - **International:** Supports US, UK, CA, AU, AE, DE, and any standard country code.
  - **India:** Supports country-level, state-level (e.g., `Maharashtra`), and city-level (e.g., `Mumbai`, `Bengaluru`) searches.
- **Intelligent Deduplication:**
  - Priority 1: Google `place_id`
  - Priority 2: Normalized website
  - Priority 3: Normalized phone
  - Priority 4: Business name + address
  - **Branch Preservation:** Separate branches (e.g., *Starbucks Downtown* vs *Starbucks Airport*) maintain distinct records if identified as separate places.
- **Persistent Storage:** SQLite database (`data/clds.db`) prevents duplicate records on repeated searches and updates existing business data gracefully.
- **Dual Export:** Automatic and manual exports to structured CSV and JSON in `data/exports/`.

---

## Project Structure

```text
CLDS/
├── clds/
│   ├── __init__.py          # Package initialization
│   ├── __main__.py          # CLI entrypoint for python -m clds
│   ├── cli.py               # CLI parser and command handlers (search, list, export)
│   ├── config.py            # Environment and path settings
│   ├── database.py          # SQLite database connection & deduplication logic
│   ├── export.py            # CSV & JSON exporter utilities
│   ├── models.py            # Pydantic data schemas & normalization functions
│   ├── search.py            # Search orchestration pipeline & metrics
│   └── providers/
│       ├── __init__.py      # Provider registry
│       ├── base.py          # Abstract BaseDiscoveryProvider interface
│       └── google_places.py # Google Places API (New) provider implementation
├── data/
│   ├── clds.db              # SQLite persistent lead database (created automatically)
│   └── exports/             # Default folder for generated CSV and JSON files
├── tests/
│   ├── test_cli.py          # CLI parsing & command execution tests
│   ├── test_database.py     # SQLite persistence & deduplication tests
│   ├── test_export.py       # CSV and JSON export formatting tests
│   ├── test_google_places.py# Places API parsing, error handling & mock tests
│   ├── test_models.py       # Pydantic validation & normalization unit tests
│   └── test_search_pipeline.py # End-to-end service orchestration tests
├── .env.example             # Template for API credentials
├── .gitignore               # Git ignore rules for virtualenvs, keys, databases
├── pyproject.toml           # Package metadata and pytest configuration
├── requirements.txt         # Core dependencies
├── run.py                   # Root execution script
└── README.md                # Documentation
```

---

## Installation & Setup

### 1. Prerequisites
- **Python 3.10+** (Tested on Python 3.11)
- Google Cloud Account with billing enabled

### 2. Clone / Open the Workspace & Install Dependencies
```bash
# Install required dependencies
pip install -r requirements.txt

# (Optional) Install in editable mode for global `clds` CLI command
pip install -e .
```

### 3. Google Cloud Configuration
1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Create or select a project.
3. Enable the **Places API (New)** (Note: Ensure it is the *New* Places API, not legacy Places API).
4. Navigate to **APIs & Services > Credentials** and generate an **API Key**.
5. *(Recommended)* Restrict the API key to the "Places API (New)" and set HTTP/IP restrictions as appropriate.

### 4. Configure Environment Variables
Copy `.env.example` to `.env`:

```bash
# On Windows (cmd/PowerShell)
copy .env.example .env

# On Linux/macOS
cp .env.example .env
```

Edit `.env` and set your API key:
```env
GOOGLE_MAPS_API_KEY=AIzaSyYourActualGooglePlacesApiKeyHere
```

---

## Google Places API Details & Technical Limitations

- **Endpoint:** `POST https://places.googleapis.com/v1/places:searchText`
- **Field Masking:** CLDS strictly requests only required V1 fields to optimize latency and minimize costs:
  `places.id,places.displayName,places.primaryType,places.formattedAddress,places.websiteUri,places.googleMapsUri,places.rating,places.userRatingCount,nextPageToken`
- **Quotas & Limitations:**
  - Google Places Text Search returns up to 20 places per page. CLDS automatically pages using `nextPageToken` when `--limit` exceeds 20.
  - Google Cloud provides $200 free monthly credit across Maps Platform APIs.
  - Check current Google Cloud Maps Platform pricing for the exact per-SKU rates for *Places Text Search (New)* with Pro/Enterprise field masks.

---

## CLI Usage Guide

You can run CLDS using either `python run.py`, `python -m clds`, or the installed `clds` command.

### 1. Search for Leads (`search`)

#### International Example (Austin, US):
```bash
python run.py search --category "gift stores" --country "US" --city "Austin" --limit 20
```
or simply:
```bash
python run.py --category "gift stores" --country "US" --city "Austin" --limit 20
```

#### India State & City Example (Mumbai, Maharashtra):
```bash
python run.py search --category "cafes" --country "IN" --state "Maharashtra" --city "Mumbai" --limit 20
```

#### UK Example (London):
```bash
python run.py search --category "wedding planners" --country "GB" --city "London" --limit 25
```

#### Example Terminal Output:
```text
CLDS - Client Lead Discovery System
====================================

Searching:
  Category : Gift Stores
  Country  : US
  City     : Austin
  Limit    : 20

Searching Google Places...

* 20 businesses discovered
* 19 unique businesses
* 15 websites found
* 4 businesses without websites
* 19 records stored/updated in SQLite

International: 19
India:         0

Export:
  C:\Users\...\CLDS\data\exports\gift_stores_austin_2026-10-09.csv
  C:\Users\...\CLDS\data\exports\gift_stores_austin_2026-10-09.json
```

---

### 2. List Stored Leads (`list`)

List discovered leads from the persistent SQLite database with optional filters:

```bash
# List all leads
python run.py list

# Filter by country
python run.py list --country "US"

# Filter by businesses that do not have a website
python run.py list --website-status "no_website_found"

# Filter by city and limit output
python run.py list --city "Mumbai" --limit 10
```

---

### 3. Export Leads (`export`)

Export stored leads to CSV, JSON, or both:

```bash
# Export all leads to both CSV and JSON
python run.py export --format both

# Export only US leads to CSV
python run.py export --format csv --country "US"

# Export to a custom folder
python run.py export --format json --output-dir "my_exports"
```

---

## Output Data Schema

Every lead is stored with the following schema:

| Field | Type | Description |
| :--- | :--- | :--- |
| `place_id` | String | Unique Google Place ID |
| `business_name` | String | Official registered name |
| `category` | String | Search category |
| `country` | String | Country name or ISO code |
| `state` | String / Null | State or province |
| `city` | String / Null | City or locality |
| `address` | String | Full formatted address |
| `website` | String / Null | Official website URL (or `null` if none) |
| `website_status` | String | `"website_found"` or `"no_website_found"` |
| `maps_url` | String / Null | Direct Google Maps URL |
| `phone` | String / Null | Public contact phone number |
| `rating` | Float / Null | Star rating (e.g., `4.8`) |
| `review_count` | Int / Null | Total review count |
| `latitude` | Float / Null | Latitude coordinate |
| `longitude` | Float / Null | Longitude coordinate |
| `discovered_at` | String | ISO 8601 UTC timestamp |

### Sample JSON Record:
```json
{
  "place_id": "ChIJbX7QJ7S1RIYRFh9A_x9j8d4",
  "business_name": "Austin Artisan Blooms & Gifts",
  "category": "gift stores",
  "country": "United States",
  "state": "Texas",
  "city": "Austin",
  "address": "1204 S Congress Ave, Austin, TX 78704, USA",
  "website": "https://austinartisanblooms.com",
  "website_status": "website_found",
  "maps_url": "https://maps.google.com/?cid=108273618273618",
  "phone": "+15125550198",
  "rating": 4.8,
  "review_count": 142,
  "latitude": 30.25201,
  "longitude": -97.74952,
  "discovered_at": "2026-10-09T01:30:00.000000+00:00"
}
```

---

## Running the Automated Test Suite

CLDS includes a comprehensive test suite covering data models, normalization, deduplication, SQLite operations, Google Places parsing, error handling, CSV/JSON exporters, and CLI arguments:

```bash
pytest -v
```

Expected output:
```text
============================= test session starts =============================
collected 27 items

tests/test_cli.py::test_cli_search_parser_valid PASSED                   [  3%]
tests/test_cli.py::test_cli_search_parser_india PASSED                   [  7%]
tests/test_cli.py::test_cli_list_parser PASSED                           [ 11%]
tests/test_cli.py::test_cli_export_parser PASSED                         [ 14%]
tests/test_cli.py::test_cli_missing_required_search_args PASSED          [ 18%]
tests/test_cli.py::test_cli_search_missing_key PASSED                    [ 22%]
tests/test_cli.py::test_cli_list_and_export_execution PASSED             [ 25%]
tests/test_database.py::test_insert_and_count_lead PASSED                [ 29%]
tests/test_database.py::test_update_existing_lead_on_same_place_id PASSED [ 33%]
tests/test_database.py::test_separate_branches_are_kept_separate PASSED  [ 37%]
tests/test_database.py::test_query_filters PASSED                        [ 40%]
tests/test_database.py::test_repeated_searches_do_not_duplicate PASSED   [ 44%]
tests/test_export.py::test_export_filenames PASSED                       [ 48%]
tests/test_export.py::test_export_to_csv PASSED                          [ 51%]
tests/test_export.py::test_export_to_json PASSED                         [ 55%]
tests/test_export.py::test_export_leads_both PASSED                      [ 56%]
tests/test_google_places.py::test_missing_api_key_raises_error PASSED    [ 62%]
tests/test_google_places.py::test_invalid_placeholder_key_raises_error PASSED [ 66%]
tests/test_google_places.py::test_successful_search_parsing_us PASSED    [ 70%]
tests/test_google_places.py::test_successful_search_parsing_india PASSED [ 74%]
tests/test_models.py::test_normalize_website PASSED                      [ 77%]
tests/test_models.py::test_normalize_phone PASSED                        [ 81%]
tests/test_models.py::test_normalize_name_address PASSED                 [ 85%]
tests/test_models.py::test_business_lead_with_website PASSED             [ 88%]
tests/test_models.py::test_business_lead_without_website PASSED          [ 92%]
tests/test_models.py::test_search_criteria_validation PASSED             [ 96%]
tests/test_search_pipeline.py::test_full_search_workflow PASSED          [100%]

============================= 27 passed in 1.48s ==============================
```
