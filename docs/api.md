# CLDS API Contract & Architecture Specification

This document provides the complete API specification for the **CLDS Next.js Application Layer**.
The frontend (generated via v0 or custom React components) communicates exclusively with these endpoints.

---

## 1. System Architecture Overview

```
 ┌────────────────────────────────────────────────────────┐
 │                      v0 Frontend                       │
 │               (React / Next.js Client)                 │
 └──────────────────────────┬─────────────────────────────┘
                            │ HTTP JSON / SSE Stream
                            ▼
 ┌────────────────────────────────────────────────────────┐
 │           Next.js Control Plane (App Router)           │
 │  - /api/search, /api/verify, /api/jobs, /api/leads     │
 │  - Asynchronous Job Dispatching & PID Lifecycle        │
 └──────────┬─────────────────────────────────┬───────────┘
            │ child_process.spawn()           │ Native Driver
            ▼                                 ▼
 ┌──────────────────────────┐     ┌───────────────────────┐
 │    Python CLDS Engine    │     │     MongoDB Atlas     │
 │ - OSM / Web Search       ├────►│  - leads collection   │
 │ - 7-Point Verification   │     │  - verifications      │
 │ - Playwright Browser     │     │  - jobs collection    │
 └──────────────────────────┘     └───────────────────────┘
```

---

## 2. Job Lifecycle & State Transitions

Every discovery or verification operation runs asynchronously in the background.

```
       ┌──────────┐
       │  Queued  │ (Job created in MongoDB)
       └────┬─────┘
            │ child_process spawned
            ▼
       ┌──────────┐
 ┌────►│ Running  │ (Streaming logs & progress updates)
 │     └────┬─────┘
 │          │
 │   ┌──────┴───────────────┬────────────────┐
 │   ▼                      ▼                ▼
 │ ┌───────────┐      ┌───────────┐    ┌───────────┐
 │ │ Completed │      │  Failed   │    │ Cancelled │
 │ └───────────┘      └───────────┘    └───────────┘
```

---

## 3. API Endpoints

### 3.1 Start Business Discovery Job
Starts Stage 1 Discovery in the background via Python subprocess.

- **Method**: `POST`
- **Path**: `/api/search`
- **Request Headers**: `Content-Type: application/json`
- **Request Body**:
```json
{
  "category": "gift stores",
  "country": "US",
  "city": "Austin",
  "state": "Texas",
  "provider": "auto",
  "limit": 20
}
```
*Field Notes:*
* `category` *(string, required)*: Business niche (e.g. `"cafes"`, `"wedding planners"`).
* `country` *(string, required)*: ISO 2-letter country code or name (e.g. `"US"`, `"IN"`, `"GB"`).
* `city` *(string, optional)*: Target city.
* `state` *(string, optional)*: State / province.
* `provider` *(string, optional)*: `"auto"` ($0 OSM + Web), `"osm"` ($0), `"web"` ($0), or `"google"`. Default: `"auto"`.
* `limit` *(integer, optional)*: Max results (1 to 100). Default: `20`.

- **Response `202 Accepted`**:
```json
{
  "job_id": "67059a4b1234567890abcdef",
  "status": "queued",
  "type": "discovery",
  "created_at": "2026-10-09T02:30:00.000Z",
  "message": "Discovery job queued successfully"
}
```

---

### 3.2 Start Website Verification Job
Starts Stage 2 Fast Deterministic Verification (7 checks) in the background.

- **Method**: `POST`
- **Path**: `/api/verify`
- **Request Body Options**:
  1. **Batch Verify Unverified Leads**:
     ```json
     {
       "limit": 20
     }
     ```
  2. **Verify Single URL Directly**:
     ```json
     {
       "url": "https://example.com"
     }
     ```
  3. **Verify Lead by `place_id`**:
     ```json
     {
       "lead_id": "osm_node_123456"
     }
     ```

- **Response `202 Accepted`**:
```json
{
  "job_id": "67059a4b1234567890fedcba",
  "status": "queued",
  "type": "verification",
  "created_at": "2026-10-09T02:31:00.000Z",
  "message": "Verification job queued successfully"
}
```

---

### 3.3 Get Job Status
Retrieves current snapshot of a job from MongoDB.

- **Method**: `GET`
- **Path**: `/api/jobs/:id`
- **Response `200 OK`**:
```json
{
  "id": "67059a4b1234567890abcdef",
  "type": "discovery",
  "status": "completed",
  "command": "search",
  "args": ["--category", "gift stores", "--country", "US", "--city", "Austin", "--limit", "20"],
  "pid": 12480,
  "started_at": "2026-10-09T02:30:01.120Z",
  "completed_at": "2026-10-09T02:30:14.340Z",
  "progress": 100,
  "logs": [
    "Searching: Category: Gift Stores, Country: US, City: Austin",
    "Discovering businesses via AUTO...",
    "* 20 businesses discovered",
    "* 18 unique businesses stored/updated in MongoDB"
  ],
  "result": {
    "total_discovered": 20,
    "unique_discovered": 18,
    "websites_found": 15,
    "no_website_found": 3
  },
  "error": null,
  "created_at": "2026-10-09T02:30:00.000Z",
  "updated_at": "2026-10-09T02:30:14.350Z"
}
```

---

### 3.4 Live Job Streaming (Server-Sent Events / SSE)
Streams live stdout, progress updates, and terminal events directly into UI components.

- **Method**: `GET`
- **Path**: `/api/jobs/:id/stream`
- **Response Headers**: `Content-Type: text/event-stream`
- **Event Types**:
  1. `init` — Initial full job snapshot from MongoDB.
  2. `log` — Standard stdout/stderr text chunk:
     ```
     event: log
     data: {"jobId":"...","type":"log","message":"[1/20] Verifying Bloom Florist...","timestamp":"..."}
     ```
  3. `progress` — Progress percentage update (0–100):
     ```
     event: progress
     data: {"jobId":"...","type":"progress","progress":45,"message":"Verified 9/20 leads","timestamp":"..."}
     ```
  4. `status` — Status transition (`running`, `completed`, `failed`, `cancelled`).
  5. `done` — Terminal event indicating stream is closing.

*Frontend Consumption Example:*
```javascript
const eventSource = new EventSource(`/api/jobs/${jobId}/stream`);

eventSource.addEventListener("log", (e) => {
  const data = JSON.parse(e.data);
  console.log("Log:", data.message);
});

eventSource.addEventListener("progress", (e) => {
  const data = JSON.parse(e.data);
  setProgress(data.progress);
});

eventSource.addEventListener("done", () => {
  eventSource.close();
});
```

---

### 3.5 Cancel Running Job
Kills the underlying Python subprocess and sets job status to `"cancelled"`.

- **Method**: `POST`
- **Path**: `/api/jobs/:id/cancel`
- **Response `200 OK`**:
```json
{
  "message": "Job cancelled successfully",
  "job": {
    "id": "67059a4b1234567890abcdef",
    "status": "cancelled"
  }
}
```

---

### 3.6 List & Filter Leads
Queries stored leads directly from MongoDB Atlas.

- **Method**: `GET`
- **Path**: `/api/leads`
- **Query Parameters**:
  * `country`: Country ISO code (e.g. `US`, `IN`).
  * `city`: City name (e.g. `Austin`, `Mumbai`).
  * `category`: Business category keyword search.
  * `source`: `osm_overpass`, `web_search`, or `google_places`.
  * `website_status`: `website_found` or `no_website_found`.
  * `page`: Page number (default: `1`).
  * `limit`: Page size (default: `20`, max: `100`).

- **Response `200 OK`**:
```json
{
  "leads": [
    {
      "_id": "67059a4b1234567890111111",
      "place_id": "osm_node_987654",
      "business_name": "Austin Artisan Florist",
      "category": "gift stores",
      "country": "US",
      "city": "Austin",
      "address": "1200 S Congress Ave, Austin, TX",
      "website": "https://austinartisan.com",
      "website_status": "website_found",
      "phone": "+15125550199",
      "rating": 4.8,
      "review_count": 86,
      "discovered_at": "2026-10-09T01:00:00.000Z"
    }
  ],
  "pagination": {
    "total": 78,
    "page": 1,
    "limit": 20,
    "pages": 4
  }
}
```

---

### 3.7 Get Lead Detail + Latest Verification
- **Method**: `GET`
- **Path**: `/api/leads/:id`
- **Response `200 OK`**:
```json
{
  "lead": {
    "place_id": "osm_node_987654",
    "business_name": "Austin Artisan Florist",
    "website": "https://austinartisan.com"
  },
  "latest_verification": {
    "overall_status": "verified",
    "verification_duration_ms": 480,
    "verified_at": "2026-10-09T02:00:00.000Z",
    "availability": { "reachable": true, "status_code": 200, "https": true },
    "responsiveness": { "viewport": "375x812", "responsive": true, "horizontal_overflow": false },
    "performance": { "ttfb_ms": 210, "document_size_kb": 18.4, "compression_status": "gzip" },
    "caching": { "cache_control": "public, max-age=3600", "etag": true },
    "technical_seo": { "title": true, "title_length": 24, "meta_description": true },
    "accessibility": { "images_missing_alt": 0, "missing_lang_attribute": false },
    "conversion": { "phone_present": true, "email_present": true, "booking_cta": false }
  }
}
```

---

### 3.8 Get Verification History for Lead
Retrieves 1-to-many historical verification timeline.

- **Method**: `GET`
- **Path**: `/api/leads/:id/verifications`
- **Response `200 OK`**:
```json
{
  "lead_id": "osm_node_987654",
  "count": 2,
  "verifications": [
    {
      "verified_at": "2026-10-09T02:00:00.000Z",
      "overall_status": "verified",
      "verification_duration_ms": 480
    },
    {
      "verified_at": "2026-10-01T10:00:00.000Z",
      "overall_status": "unreachable",
      "verification_duration_ms": 3000
    }
  ]
}
```
