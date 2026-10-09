"""MongoDB Atlas repository layer for CLDS."""

import hashlib
import re
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional, Tuple
from pymongo import MongoClient, ASCENDING, DESCENDING
from pymongo.errors import PyMongoError, ConnectionFailure, ServerSelectionTimeoutError

from clds.config import settings
from clds.models import (
    BusinessLead,
    normalize_website,
    normalize_phone,
    normalize_name_address,
)
from clds.verification.models import VerificationRecord


class MongoDBConfigurationError(Exception):
    """Raised when MongoDB configuration (MONGODB_URI) is missing or invalid."""
    pass


class MongoDBDatabase:
    """MongoDB repository for persistent lead storage, deduplication, and verification records."""

    def __init__(
        self,
        uri: Optional[str] = None,
        database_name: Optional[str] = None,
        client: Optional[Any] = None,
    ):
        self.db_name = database_name or settings.mongodb_database or "clds"
        
        if client is not None:
            self.client = client
        else:
            conn_uri = (uri or settings.mongodb_uri or "").strip()
            if not conn_uri:
                raise MongoDBConfigurationError(
                    "MongoDB configuration missing.\n"
                    "Set MONGODB_URI in your .env file."
                )
            try:
                self.client = MongoClient(conn_uri, serverSelectionTimeoutMS=5000)
            except Exception as e:
                # Do not leak credentials in error message
                raise MongoDBConfigurationError(f"Failed to initialize MongoDB client: {type(e).__name__}")

        self.db = self.client[self.db_name]
        self.leads_col = self.db["leads"]
        self.verifications_col = self.db["verifications"]
        self._ensure_indexes()

    def _ensure_indexes(self) -> None:
        """Create necessary indexes on leads and verifications collections."""
        try:
            # Leads indexes
            self.leads_col.create_index([("place_id", ASCENDING)], unique=True)
            self.leads_col.create_index([("normalized_website", ASCENDING)], sparse=True)
            self.leads_col.create_index([("name_address_key", ASCENDING)])
            self.leads_col.create_index([("country", ASCENDING), ("city", ASCENDING), ("category", ASCENDING)])
            self.leads_col.create_index([("source", ASCENDING)])
            self.leads_col.create_index([("website_status", ASCENDING)])
            self.leads_col.create_index([("discovered_at", DESCENDING)])

            # Verifications indexes
            self.verifications_col.create_index([("lead_id", ASCENDING), ("verified_at", DESCENDING)])
            self.verifications_col.create_index([("target_url", ASCENDING), ("verified_at", DESCENDING)])
            self.verifications_col.create_index([("overall_status", ASCENDING)])
            self.verifications_col.create_index([("verified_at", DESCENDING)])
        except Exception:
            # In mock or restricted environments, index creation might be ignored or handled gracefully
            pass

    def _ensure_place_id(self, lead: BusinessLead, name_addr: str) -> str:
        """Generate deterministic identifier if place_id is not provided by provider."""
        if lead.place_id and str(lead.place_id).strip():
            return str(lead.place_id).strip()
        seed = f"{lead.country}|{name_addr}".encode("utf-8")
        hash_digest = hashlib.sha256(seed).hexdigest()[:16]
        return f"{lead.source}_{hash_digest}"

    def save_lead(self, lead: BusinessLead) -> Tuple[bool, str]:
        """
        Save or update a single lead based on deduplication rules.
        Preserves branch separation for physical locations.
        Returns (is_new, action_description).
        """
        norm_web = normalize_website(lead.website)
        norm_ph = normalize_phone(lead.phone)
        name_addr = normalize_name_address(lead.business_name, lead.address)
        effective_place_id = self._ensure_place_id(lead, name_addr)
        now_iso = datetime.now(timezone.utc).isoformat()

        doc_update = {
            "business_name": lead.business_name,
            "category": lead.category,
            "country": lead.country,
            "state": lead.state,
            "city": lead.city,
            "address": lead.address,
            "website": lead.website,
            "website_status": lead.website_status,
            "source": lead.source,
            "source_url": lead.source_url,
            "maps_url": lead.maps_url,
            "phone": lead.phone,
            "rating": lead.rating,
            "review_count": lead.review_count,
            "latitude": lead.latitude,
            "longitude": lead.longitude,
            "normalized_website": norm_web,
            "normalized_phone": norm_ph,
            "name_address_key": name_addr,
            "updated_at": now_iso,
        }

        # Priority 1: Match by exact place_id
        existing_lead = self.leads_col.find_one({"place_id": effective_place_id})
        if existing_lead:
            self.leads_col.update_one(
                {"place_id": effective_place_id},
                {"$set": doc_update}
            )
            return False, "updated"

        # Priority 2: Match by name + physical address (branch deduplication)
        if name_addr:
            existing_name_match = self.leads_col.find_one({"name_address_key": name_addr})
            if existing_name_match:
                self.leads_col.update_one(
                    {"_id": existing_name_match["_id"]},
                    {"$set": doc_update}
                )
                return False, "updated"

        # Priority 3: Match by normalized website only if no physical address was provided
        if norm_web and not lead.address:
            existing_web_match = self.leads_col.find_one({"normalized_website": norm_web})
            if existing_web_match:
                self.leads_col.update_one(
                    {"_id": existing_web_match["_id"]},
                    {"$set": doc_update}
                )
                return False, "updated"

        # Brand new lead insertion
        insert_doc = {
            "place_id": effective_place_id,
            "discovered_at": lead.discovered_at or now_iso,
            **doc_update,
        }
        self.leads_col.insert_one(insert_doc)
        return True, "inserted"

    def save_leads(self, leads: List[BusinessLead]) -> Tuple[int, int]:
        """
        Save or update a list of leads.
        Returns (new_inserted_count, updated_count).
        """
        inserted = 0
        updated = 0
        for lead in leads:
            is_new, _ = self.save_lead(lead)
            if is_new:
                inserted += 1
            else:
                updated += 1
        return inserted, updated

    def get_leads(
        self,
        country: Optional[str] = None,
        city: Optional[str] = None,
        category: Optional[str] = None,
        source: Optional[str] = None,
        website_status: Optional[str] = None,
        limit: Optional[int] = None,
    ) -> List[BusinessLead]:
        """Query stored leads with optional filters and sorting."""
        filter_query: Dict[str, Any] = {}

        if country:
            # Case-insensitive country match
            filter_query["country"] = {"$regex": f"^{re.escape(country)}$", "$options": "i"}
        if city:
            filter_query["city"] = {"$regex": f"^{re.escape(city)}$", "$options": "i"}
        if category:
            filter_query["category"] = {"$regex": re.escape(category), "$options": "i"}
        if source:
            filter_query["source"] = source
        if website_status:
            filter_query["website_status"] = website_status

        cursor = self.leads_col.find(filter_query).sort("discovered_at", DESCENDING)

        if limit is not None and limit > 0:
            cursor = cursor.limit(limit)

        leads = []
        for doc in cursor:
            leads.append(
                BusinessLead(
                    place_id=doc.get("place_id"),
                    business_name=doc.get("business_name", ""),
                    category=doc.get("category", ""),
                    country=doc.get("country", ""),
                    state=doc.get("state"),
                    city=doc.get("city"),
                    address=doc.get("address", ""),
                    website=doc.get("website"),
                    website_status=doc.get("website_status", "no_website_found"),
                    source=doc.get("source", "web_search"),
                    source_url=doc.get("source_url"),
                    maps_url=doc.get("maps_url"),
                    phone=doc.get("phone"),
                    rating=doc.get("rating"),
                    review_count=doc.get("review_count"),
                    latitude=doc.get("latitude"),
                    longitude=doc.get("longitude"),
                    discovered_at=doc.get("discovered_at", ""),
                )
            )
        return leads

    def count_leads(self) -> int:
        """Total number of leads stored."""
        return self.leads_col.count_documents({})

    def save_verification(self, record: VerificationRecord) -> str:
        """
        Save a Stage 2 website verification record to MongoDB.
        Preserves complete verification history (inserts a new record).
        """
        now_iso = datetime.now(timezone.utc).isoformat()
        doc = {
            "lead_id": record.lead_id or record.target_url,
            "target_url": record.target_url,
            "final_url": getattr(record, "final_url", None) or (record.availability.final_url if record.availability else None),
            "overall_status": record.overall_status,
            "verification_duration_ms": record.verification_duration_ms,
            "checker_version": record.checker_version,
            "verified_at": record.verified_at or now_iso,
            "availability": record.availability.model_dump(),
            "responsiveness": record.responsiveness.model_dump(),
            "performance": record.performance.model_dump(),
            "caching": record.caching.model_dump(),
            "technical_seo": record.seo.model_dump(),
            "accessibility": record.accessibility.model_dump(),
            "conversion": record.conversion.model_dump(),
            "raw_record": record.model_dump(),
        }
        res = self.verifications_col.insert_one(doc)
        return str(res.inserted_id)

    def get_verification(self, lead_id_or_url: str) -> Optional[VerificationRecord]:
        """Retrieve the most recent verification record for a lead or URL."""
        query = {
            "$or": [
                {"lead_id": lead_id_or_url},
                {"target_url": lead_id_or_url},
            ]
        }
        doc = self.verifications_col.find_one(query, sort=[("verified_at", DESCENDING)])
        if not doc:
            return None

        if "raw_record" in doc and doc["raw_record"]:
            return VerificationRecord.model_validate(doc["raw_record"])

        # Fallback reconstruction
        return VerificationRecord(
            lead_id=doc.get("lead_id"),
            target_url=doc.get("target_url", ""),
            final_url=doc.get("final_url"),
            overall_status=doc.get("overall_status", "verified"),
            verification_duration_ms=doc.get("verification_duration_ms", 0),
            checker_version=doc.get("checker_version", "1.0.0"),
            verified_at=doc.get("verified_at", ""),
            availability=doc.get("availability", {}),
            responsiveness=doc.get("responsiveness", {}),
            performance=doc.get("performance", {}),
            caching=doc.get("caching", {}),
            seo=doc.get("technical_seo", {}),
            accessibility=doc.get("accessibility", {}),
            conversion=doc.get("conversion", {}),
        )

    def get_verification_history(self, lead_id_or_url: str, limit: int = 10) -> List[VerificationRecord]:
        """Retrieve full verification history for a lead or URL, newest first."""
        query = {
            "$or": [
                {"lead_id": lead_id_or_url},
                {"target_url": lead_id_or_url},
            ]
        }
        cursor = self.verifications_col.find(query).sort("verified_at", DESCENDING).limit(limit)
        history = []
        for doc in cursor:
            if "raw_record" in doc and doc["raw_record"]:
                history.append(VerificationRecord.model_validate(doc["raw_record"]))
            else:
                history.append(
                    VerificationRecord(
                        lead_id=doc.get("lead_id"),
                        target_url=doc.get("target_url", ""),
                        final_url=doc.get("final_url"),
                        overall_status=doc.get("overall_status", "verified"),
                        verification_duration_ms=doc.get("verification_duration_ms", 0),
                        checker_version=doc.get("checker_version", "1.0.0"),
                        verified_at=doc.get("verified_at", ""),
                        availability=doc.get("availability", {}),
                        responsiveness=doc.get("responsiveness", {}),
                        performance=doc.get("performance", {}),
                        caching=doc.get("caching", {}),
                        seo=doc.get("technical_seo", {}),
                        accessibility=doc.get("accessibility", {}),
                        conversion=doc.get("conversion", {}),
                    )
                )
        return history

    def get_unverified_leads(
        self,
        limit: int = 20,
        unverified_since_days: Optional[int] = None,
    ) -> List[BusinessLead]:
        """
        Get leads that have an official website and:
        - Have never been verified, OR
        - Have not been verified within the last `unverified_since_days` days.
        """
        if unverified_since_days is not None and unverified_since_days > 0:
            cutoff = (datetime.now(timezone.utc) - timedelta(days=unverified_since_days)).isoformat()
            # Find lead_ids verified recently
            recent_lead_ids = self.verifications_col.distinct(
                "lead_id",
                {"lead_id": {"$ne": None}, "verified_at": {"$gte": cutoff}}
            )
            query = {
                "website_status": "website_found",
                "website": {"$ne": None},
                "place_id": {"$nin": recent_lead_ids},
            }
        else:
            # Find all lead_ids that have any verification
            verified_lead_ids = self.verifications_col.distinct(
                "lead_id",
                {"lead_id": {"$ne": None}}
            )
            query = {
                "website_status": "website_found",
                "website": {"$ne": None},
                "place_id": {"$nin": verified_lead_ids},
            }

        cursor = self.leads_col.find(query).sort("discovered_at", DESCENDING).limit(limit)
        leads = []
        for doc in cursor:
            leads.append(
                BusinessLead(
                    place_id=doc.get("place_id"),
                    business_name=doc.get("business_name", ""),
                    category=doc.get("category", ""),
                    country=doc.get("country", ""),
                    state=doc.get("state"),
                    city=doc.get("city"),
                    address=doc.get("address", ""),
                    website=doc.get("website"),
                    website_status=doc.get("website_status", "no_website_found"),
                    source=doc.get("source", "web_search"),
                    source_url=doc.get("source_url"),
                    maps_url=doc.get("maps_url"),
                    phone=doc.get("phone"),
                    rating=doc.get("rating"),
                    review_count=doc.get("review_count"),
                    latitude=doc.get("latitude"),
                    longitude=doc.get("longitude"),
                    discovered_at=doc.get("discovered_at", ""),
                )
            )
        return leads

    def count_verifications(self) -> int:
        """Total number of verifications stored."""
        return self.verifications_col.count_documents({})

    def close(self) -> None:
        """Close MongoDB connection pool."""
        try:
            self.client.close()
        except Exception:
            pass
