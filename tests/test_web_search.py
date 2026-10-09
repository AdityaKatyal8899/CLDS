"""Unit tests for Web Search Discovery Provider and domain filtering."""

import pytest
from clds.models import (
    is_blacklisted_domain,
    is_likely_official_domain,
    extract_domain,
    SearchCriteria,
)
from clds.providers.web_search import (
    WebSearchProvider,
    clean_title_to_business_name,
)


def test_extract_domain():
    assert extract_domain("https://www.austinbloom.com/about?ref=1") == "austinbloom.com"
    assert extract_domain("http://subko.cr/contact") == "subko.cr"
    assert extract_domain("https://m.yelp.com/biz/123") == "m.yelp.com"
    assert extract_domain("") is None


def test_blacklist_directories_and_social():
    assert is_blacklisted_domain("https://www.yelp.com/biz/some-store") is True
    assert is_blacklisted_domain("https://tripadvisor.com/restaurant_review") is True
    assert is_blacklisted_domain("https://instagram.com/business") is True
    assert is_blacklisted_domain("https://facebook.com/page") is True
    assert is_blacklisted_domain("https://justdial.com/mumbai/cafes") is True
    assert is_blacklisted_domain("https://zomato.com/mumbai/subko") is True
    assert is_blacklisted_domain("https://yellowpages.com/austin-tx/gift-shops") is True
    
    # Real business domains should NOT be blacklisted
    assert is_blacklisted_domain("https://www.austinbloomflorist.com") is False
    assert is_blacklisted_domain("https://subkocoffee.cr") is False
    assert is_blacklisted_domain("https://artisanboutique.co.uk") is False


def test_is_likely_official_domain():
    # Matching tokens
    assert is_likely_official_domain("Austin Bloom Florist", "https://www.austinbloomflorist.com") is True
    assert is_likely_official_domain("Subko Coffee Roasters", "https://subko.cr") is True
    assert is_likely_official_domain("The Velvet Box", "https://thevelvetbox.in") is True

    # Blacklisted domain should return False
    assert is_likely_official_domain("Austin Bloom Florist", "https://yelp.com/biz/austin-bloom") is False

    # Completely unrelated domain should return False
    assert is_likely_official_domain("Austin Bloom Florist", "https://genericnewsjournal.com") is False


def test_clean_title_to_business_name():
    assert clean_title_to_business_name("Austin Flower Co. | Official Website", "Austin") == "Austin Flower Co."
    assert clean_title_to_business_name("Subko Coffee Roasters - Bandra West, Mumbai", "Mumbai") == "Subko Coffee Roasters"
    assert clean_title_to_business_name("Top 10 Gift Stores in Austin - Yelp", "Austin") == "Gift Stores"


def test_parse_duckduckgo_html():
    provider = WebSearchProvider()
    sample_html = """
    <div class="results">
      <div class="result">
        <a class="result__a" href="https://duckduckgo.com/l/?uddg=https%3A%2F%2Fwww.austinbloom.com%2F">
          Austin Bloom Florist | Official Website
        </a>
      </div>
      <div class="result">
        <a class="result__a" href="https://duckduckgo.com/l/?uddg=https%3A%2F%2Fwww.yelp.com%2Fbiz%2Faustin-bloom">
          Top 10 Gift Stores in Austin - Yelp
        </a>
      </div>
    </div>
    """
    items = provider._parse_duckduckgo_html(sample_html)
    assert len(items) == 2
    assert items[0]["url"] == "https://www.austinbloom.com/"
    assert "Austin Bloom Florist" in items[0]["title"]
    assert items[1]["url"] == "https://www.yelp.com/biz/austin-bloom"


def test_evaluate_candidate():
    provider = WebSearchProvider()
    criteria = SearchCriteria(category="gift stores", country="US", city="Austin")

    # Candidate 1: Real business website
    item1 = {
        "url": "https://www.austinbloom.com",
        "title": "Austin Bloom - Local Florist & Gift Store",
    }
    lead1 = provider._evaluate_candidate(item1, criteria)
    assert lead1 is not None
    assert lead1.business_name == "Austin Bloom"
    assert lead1.website == "https://www.austinbloom.com"
    assert lead1.website_status == "website_found"
    assert lead1.source == "web_search"

    # Candidate 2: Yelp Directory link (should identify business name, but mark website as no_website_found)
    item2 = {
        "url": "https://www.yelp.com/biz/heritage-gifts-austin",
        "title": "Heritage Gifts - Austin, TX - Yelp",
    }
    lead2 = provider._evaluate_candidate(item2, criteria)
    assert lead2 is not None
    assert lead2.business_name == "Heritage Gifts"
    assert lead2.website is None
    assert lead2.website_status == "no_website_found"
    assert lead2.source == "web_search"
