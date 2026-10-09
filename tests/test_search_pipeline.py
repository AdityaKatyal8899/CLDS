"""Integration tests for LeadDiscoveryService orchestration."""

from pathlib import Path
from typing import List
from clds.models import SearchCriteria, BusinessLead
from clds.providers.base import BaseDiscoveryProvider
from clds.database import Database
from clds.search import LeadDiscoveryService


class MockProvider(BaseDiscoveryProvider):
    def __init__(self, leads: List[BusinessLead]):
        self.leads = leads

    def search(self, criteria: SearchCriteria) -> List[BusinessLead]:
        return self.leads


def test_full_search_workflow(tmp_path: Path, monkeypatch):
    import mongomock
    export_dir = tmp_path / "exports"
    db = Database(database_name="test_pipeline_clds", client=mongomock.MongoClient())

    mock_leads = [
        BusinessLead(
            place_id="p1",
            business_name="Downtown Gifts",
            category="gift stores",
            country="US",
            city="Austin",
            address="100 Congress Ave",
            website="https://downtowngifts.com",
            phone="+15125550111",
            rating=4.8,
            review_count=50,
        ),
        BusinessLead(
            place_id="p2",
            business_name="Airport Gifts",
            category="gift stores",
            country="US",
            city="Austin",
            address="3600 Presidential Blvd",
            website=None,
            phone="+15125550222",
            rating=4.0,
            review_count=12,
        ),
        # Duplicated lead in mock to test deduplication
        BusinessLead(
            place_id="p1",
            business_name="Downtown Gifts Updated",
            category="gift stores",
            country="US",
            city="Austin",
            address="100 Congress Ave",
            website="https://downtowngifts.com",
            phone="+15125550111",
            rating=4.9,
            review_count=55,
        ),
    ]

    provider = MockProvider(mock_leads)
    service = LeadDiscoveryService(provider=provider, db=db, export_dir=export_dir)

    criteria = SearchCriteria(category="gift stores", country="US", city="Austin", limit=10)
    summary, leads = service.execute_search(criteria)

    assert summary.total_discovered == 3
    assert summary.unique_discovered == 2
    assert summary.websites_found == 1
    assert summary.no_website_found == 1
    assert summary.records_stored_or_updated == 2
    assert summary.international_count == 2
    assert summary.india_count == 0

    assert db.count_leads() == 2
    assert Path(summary.csv_export_path).exists()
    assert Path(summary.json_export_path).exists()
