"""
Data ingestion via Apify API and RSS feeds.

Replaces the old Playwright-based scrapers with:
  - Apify Google News actor for UK innovation news
  - Apify Google Search actor for UKRI competitions & funded projects
  - RSS feed parsing for structured news sources
  - UKRI Gateway to Research public API for funded projects

All external calls use httpx (already a dependency). No browser needed.
"""

from __future__ import annotations

import hashlib
import logging
import time
import xml.etree.ElementTree as ET
from datetime import datetime, timezone, date, timedelta

import httpx
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models import Document, Competition, DocType, CompetitionStatus

logger = logging.getLogger(__name__)
settings = get_settings()

APIFY_BASE = "https://api.apify.com/v2"
HTTP_TIMEOUT = 60.0


def _content_hash(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def _doc_exists(db: Session, chash: str) -> bool:
    return db.query(Document).filter(Document.content_hash == chash).first() is not None


# ---------------------------------------------------------------------------
# Sector keyword mapping (used to auto-assign sector_id to scraped content)
# ---------------------------------------------------------------------------

SECTOR_KEYWORDS: dict[str, list[str]] = {
    "Health": ["health", "nhs", "medtech", "biotech", "clinical", "patient", "pharma", "medical", "genomic", "diagnostic"],
    "IT": ["ai ", "artificial intelligence", "cyber", "software", "cloud", "quantum", "machine learning", "data science", "digital"],
    "Ecommerce": ["ecommerce", "e-commerce", "retail", "marketplace", "delivery", "supply chain", "logistics", "shopping"],
    "Agriculture": ["agri", "farm", "crop", "soil", "food", "vertical farm", "livestock", "sustainable agriculture"],
    "IoT": ["iot", "sensor", "smart city", "connected", "5g", "edge computing", "smart building", "wearable"],
    "Business": ["fintech", "regtech", "legaltech", "hrtech", "open banking", "compliance", "sme", "accounting"],
}


def _guess_sector_id(text: str, sector_map: dict[str, int]) -> int | None:
    """Match text content to a sector based on keyword frequency."""
    text_lower = text.lower()
    best_sector = None
    best_count = 0
    for sector_name, keywords in SECTOR_KEYWORDS.items():
        count = sum(1 for kw in keywords if kw in text_lower)
        if count > best_count:
            best_count = count
            best_sector = sector_name
    if best_sector and best_count >= 2:
        return sector_map.get(best_sector)
    return None


def _get_sector_map(db: Session) -> dict[str, int]:
    from app.models import Sector
    return {s.name: s.id for s in db.query(Sector).all()}


# ---------------------------------------------------------------------------
# Apify helpers
# ---------------------------------------------------------------------------

def _apify_run_actor(actor_id: str, input_data: dict, *, timeout_secs: int = 120) -> list[dict]:
    """Run an Apify actor synchronously and return the dataset items."""
    if not settings.APIFY_API_KEY:
        logger.warning("APIFY_API_KEY not set, skipping Apify actor %s", actor_id)
        return []

    headers = {"Authorization": f"Bearer {settings.APIFY_API_KEY}"}

    # Start the actor run
    try:
        resp = httpx.post(
            f"{APIFY_BASE}/acts/{actor_id}/runs",
            json=input_data,
            headers=headers,
            timeout=HTTP_TIMEOUT,
        )
        resp.raise_for_status()
        run_data = resp.json().get("data", {})
        run_id = run_data.get("id")
        if not run_id:
            logger.error("No run ID returned from Apify actor %s", actor_id)
            return []
    except Exception as exc:
        logger.error("Failed to start Apify actor %s: %s", actor_id, exc)
        return []

    # Poll until finished
    status = ""
    start = time.time()
    while time.time() - start < timeout_secs:
        try:
            status_resp = httpx.get(
                f"{APIFY_BASE}/actor-runs/{run_id}",
                headers=headers,
                timeout=HTTP_TIMEOUT,
            )
            status_resp.raise_for_status()
            status = status_resp.json().get("data", {}).get("status", "")
            if status in ("SUCCEEDED", "FAILED", "ABORTED", "TIMED-OUT"):
                break
        except Exception:
            pass
        time.sleep(5)

    if status != "SUCCEEDED":
        logger.error("Apify actor %s run %s ended with status %s", actor_id, run_id, status)
        return []

    # Fetch dataset items
    dataset_id = run_data.get("defaultDatasetId")
    if not dataset_id:
        logger.error("No dataset ID for Apify run %s", run_id)
        return []

    try:
        items_resp = httpx.get(
            f"{APIFY_BASE}/datasets/{dataset_id}/items",
            headers=headers,
            params={"format": "json", "limit": 50},
            timeout=HTTP_TIMEOUT,
        )
        items_resp.raise_for_status()
        return items_resp.json() if isinstance(items_resp.json(), list) else []
    except Exception as exc:
        logger.error("Failed to fetch Apify dataset %s: %s", dataset_id, exc)
        return []


# ---------------------------------------------------------------------------
# RSS feed parser (no external dependency, uses stdlib xml.etree)
# ---------------------------------------------------------------------------

RSS_FEEDS = [
    {"name": "UKRI News", "url": "https://www.ukri.org/feed/", "doc_type": DocType.news},
    {"name": "Gov.uk Business", "url": "https://www.gov.uk/search/news-and-communications.atom?topics%5B%5D=business-and-industry", "doc_type": DocType.policy},
    {"name": "Sifted", "url": "https://sifted.eu/feed", "doc_type": DocType.news},
    {"name": "TechCrunch UK", "url": "https://techcrunch.com/tag/uk/feed/", "doc_type": DocType.news},
]


def _parse_rss_items(xml_text: str) -> list[dict]:
    """Parse RSS/Atom XML into a list of {title, link, description, pubDate}."""
    items: list[dict] = []
    try:
        root = ET.fromstring(xml_text)
    except ET.ParseError:
        return items

    # RSS 2.0 format
    for item in root.iter("item"):
        title = (item.findtext("title") or "").strip()
        link = (item.findtext("link") or "").strip()
        desc = (item.findtext("description") or "").strip()
        pub = (item.findtext("pubDate") or "").strip()
        if title and len(title) > 10:
            items.append({"title": title[:500], "link": link, "description": desc[:3000], "pubDate": pub})

    # Atom format (Gov.uk uses this)
    ns = {"atom": "http://www.w3.org/2005/Atom"}
    for entry in root.iter("{http://www.w3.org/2005/Atom}entry"):
        title = (entry.findtext("atom:title", namespaces=ns) or entry.findtext("{http://www.w3.org/2005/Atom}title") or "").strip()
        link_el = entry.find("atom:link", namespaces=ns) or entry.find("{http://www.w3.org/2005/Atom}link")
        link = link_el.get("href", "") if link_el is not None else ""
        summary = (entry.findtext("atom:summary", namespaces=ns) or entry.findtext("{http://www.w3.org/2005/Atom}summary") or "").strip()
        updated = (entry.findtext("atom:updated", namespaces=ns) or entry.findtext("{http://www.w3.org/2005/Atom}updated") or "").strip()
        if title and len(title) > 10:
            items.append({"title": title[:500], "link": link, "description": summary[:3000], "pubDate": updated})

    return items


class RSSFeedScraper:
    """Fetch and store articles from RSS/Atom feeds."""

    def scrape_all_feeds(self, db: Session) -> int:
        sector_map = _get_sector_map(db)
        total_stored = 0

        for feed in RSS_FEEDS:
            try:
                resp = httpx.get(feed["url"], timeout=30.0, follow_redirects=True, headers={
                    "User-Agent": "InnoVisaAI/1.0 (RSS Reader)"
                })
                if resp.status_code != 200:
                    logger.warning("RSS feed %s returned %d", feed["name"], resp.status_code)
                    continue

                items = _parse_rss_items(resp.text)
                logger.info("RSS %s: parsed %d items", feed["name"], len(items))

                for item in items[:15]:
                    content = item["description"] or item["title"]
                    if len(content) < 50:
                        continue

                    chash = _content_hash(content)
                    if _doc_exists(db, chash):
                        continue

                    sid = _guess_sector_id(content + " " + item["title"], sector_map)

                    doc = Document(
                        url=item["link"],
                        title=item["title"],
                        content=content,
                        content_hash=chash,
                        doc_type=feed["doc_type"],
                        sector_id=sid,
                        published_at=datetime.now(timezone.utc),
                        metadata_={"source": feed["name"], "feed_url": feed["url"]},
                    )
                    db.add(doc)
                    total_stored += 1

            except Exception as exc:
                logger.warning("Error fetching RSS feed %s: %s", feed["name"], exc)
                continue

        if total_stored:
            db.commit()
        logger.info("RSS feeds: stored %d new articles total", total_stored)
        return total_stored


# ---------------------------------------------------------------------------
# Apify-powered scrapers
# ---------------------------------------------------------------------------

class ApifyNewsScraper:
    """Use Apify's Google Search Results Scraper to find UK innovation news."""

    ACTOR_ID = "apify/google-search-scraper"

    SEARCH_QUERIES = [
        "UK innovation funding 2026",
        "UK Innovate UK grants startups",
        "UK tech startup funding news",
        "UKRI innovation competition open",
        "UK AI healthtech fintech investment",
    ]

    def scrape_news(self, db: Session) -> int:
        sector_map = _get_sector_map(db)
        total_stored = 0

        for query in self.SEARCH_QUERIES:
            items = _apify_run_actor(self.ACTOR_ID, {
                "queries": query,
                "resultsPerPage": 10,
                "maxPagesPerQuery": 1,
                "languageCode": "en",
                "countryCode": "gb",
            })

            for item in items:
                organic = item.get("organicResults", [])
                for result in organic[:10]:
                    title = (result.get("title") or "").strip()
                    description = (result.get("description") or "").strip()
                    url = result.get("url", "")

                    content = f"{title}\n\n{description}" if description else title
                    if len(content) < 60:
                        continue

                    chash = _content_hash(content)
                    if _doc_exists(db, chash):
                        continue

                    sid = _guess_sector_id(content, sector_map)

                    doc = Document(
                        url=url,
                        title=title[:500],
                        content=content,
                        content_hash=chash,
                        doc_type=DocType.news,
                        sector_id=sid,
                        published_at=datetime.now(timezone.utc),
                        metadata_={"source": "Apify Google Search", "query": query},
                    )
                    db.add(doc)
                    total_stored += 1

        if total_stored:
            db.commit()
        logger.info("Apify news scraper: stored %d new articles", total_stored)
        return total_stored


class ApifyCompetitionScraper:
    """Use Apify Google Search to find open UKRI/Innovate UK competitions."""

    ACTOR_ID = "apify/google-search-scraper"

    def scrape_competitions(self, db: Session) -> int:
        sector_map = _get_sector_map(db)
        total_stored = 0

        items = _apify_run_actor(self.ACTOR_ID, {
            "queries": "site:ukri.org OR site:apply-for-innovation-funding.service.gov.uk open competition funding 2026",
            "resultsPerPage": 20,
            "maxPagesPerQuery": 1,
            "languageCode": "en",
            "countryCode": "gb",
        })

        for item in items:
            organic = item.get("organicResults", [])
            for result in organic[:20]:
                title = (result.get("title") or "").strip()
                description = (result.get("description") or "").strip()
                url = result.get("url", "")

                if not title or len(title) < 15:
                    continue

                existing = db.query(Competition).filter(Competition.title == title).first()
                if existing:
                    continue

                sid_val = _guess_sector_id(title + " " + description, sector_map)
                deadline = date.today() + timedelta(days=60)

                comp = Competition(
                    title=title[:300],
                    description=description[:2000] or "See link for full details.",
                    url=url,
                    deadline=deadline,
                    sector_id=sid_val,
                    funding_amount_gbp=0,
                    applicant_requirements="UK registered business. See competition page for full requirements.",
                    status=CompetitionStatus.open,
                    scraped_at=datetime.now(timezone.utc),
                )
                db.add(comp)
                total_stored += 1

        if total_stored:
            db.commit()
        logger.info("Apify competition scraper: stored %d new competitions", total_stored)
        return total_stored


# ---------------------------------------------------------------------------
# UKRI Gateway to Research API (free, structured, no browser)
# ---------------------------------------------------------------------------

class UKRIApiScraper:
    """Fetch funded projects from the UKRI Gateway to Research REST API."""

    GTR_API = "https://gtr.ukri.org/gtr/api/projects"

    def scrape_funded_projects(self, db: Session) -> int:
        sector_map = _get_sector_map(db)
        total_stored = 0

        try:
            resp = httpx.get(
                self.GTR_API,
                params={"q": "innovation", "p": 1, "s": 25, "f": "pro.sd", "so": "desc"},
                headers={"Accept": "application/json"},
                timeout=30.0,
            )
            if resp.status_code != 200:
                logger.warning("UKRI GTR API returned %d", resp.status_code)
                return 0

            data = resp.json()
            projects = data.get("project", [])
            if isinstance(projects, dict):
                projects = [projects]

            for proj in projects:
                title = (proj.get("title") or "").strip()
                abstract = (proj.get("abstractText") or "").strip()

                if not title or len(abstract) < 50:
                    continue

                content = f"{title}\n\n{abstract}"
                chash = _content_hash(content)
                if _doc_exists(db, chash):
                    continue

                fund = proj.get("fund", {})
                funding_str = ""
                if isinstance(fund, dict):
                    val = fund.get("valuePounds", {})
                    if isinstance(val, dict):
                        funding_str = f"Funding: £{val.get('amount', 'unknown')}"

                sid = _guess_sector_id(content, sector_map)

                doc = Document(
                    url=f"https://gtr.ukri.org/projects?ref={proj.get('id', '')}",
                    title=title[:500],
                    content=f"{content}\n\n{funding_str}".strip(),
                    content_hash=chash,
                    doc_type=DocType.funded_project,
                    sector_id=sid,
                    published_at=datetime.now(timezone.utc),
                    metadata_={"source": "UKRI GTR API", "project_id": proj.get("id", "")},
                )
                db.add(doc)
                total_stored += 1

        except Exception as exc:
            logger.error("UKRI GTR API scraper failed: %s", exc)

        if total_stored:
            db.commit()
        logger.info("UKRI API scraper: stored %d new funded projects", total_stored)
        return total_stored
