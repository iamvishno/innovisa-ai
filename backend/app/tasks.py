"""
Background tasks using APScheduler.

Provides scheduled jobs for scraping (Apify + RSS), trend updates,
deadline alerts, and a monthly Claude-powered content refresh.
"""

from __future__ import annotations

import json
import logging
from datetime import datetime, timezone, timedelta

from anthropic import Anthropic
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import SessionLocal
from app.models import (
    Sector, Document, Idea, Competition,
    CompetitionStatus, TrendDirection, DocType,
)
from app.scraper import (
    RSSFeedScraper, ApifyNewsScraper,
    ApifyCompetitionScraper, UKRIApiScraper,
)

logger = logging.getLogger(__name__)
settings = get_settings()

_job_stats: dict[str, dict] = {}


def _record(job_name: str, success: bool) -> None:
    stats = _job_stats.setdefault(job_name, {"success_count": 0, "failure_count": 0, "last_run": None})
    stats["last_run"] = datetime.now(timezone.utc)
    if success:
        stats["success_count"] += 1
    else:
        stats["failure_count"] += 1


def get_job_stats() -> dict[str, dict]:
    return dict(_job_stats)


# ---------------------------------------------------------------------------
# Scraping jobs (Apify + RSS + UKRI API, no Playwright)
# ---------------------------------------------------------------------------

def weekly_scrape_competitions() -> None:
    logger.info("Running weekly_scrape_competitions (Apify + UKRI)")
    db: Session = SessionLocal()
    try:
        apify_count = ApifyCompetitionScraper().scrape_competitions(db)
        logger.info("Scraped %d competitions via Apify", apify_count)
        _record("weekly_scrape_competitions", True)
    except Exception:
        logger.exception("weekly_scrape_competitions failed")
        _record("weekly_scrape_competitions", False)
    finally:
        db.close()


def weekly_scrape_funded_projects() -> None:
    logger.info("Running weekly_scrape_funded_projects (UKRI GTR API)")
    db: Session = SessionLocal()
    try:
        count = UKRIApiScraper().scrape_funded_projects(db)
        logger.info("Scraped %d funded projects via UKRI API", count)
        _record("weekly_scrape_funded_projects", True)
    except Exception:
        logger.exception("weekly_scrape_funded_projects failed")
        _record("weekly_scrape_funded_projects", False)
    finally:
        db.close()


def daily_scrape_news() -> None:
    logger.info("Running daily_scrape_news (RSS + Apify)")
    db: Session = SessionLocal()
    try:
        rss_count = RSSFeedScraper().scrape_all_feeds(db)
        apify_count = ApifyNewsScraper().scrape_news(db)
        total = rss_count + apify_count
        logger.info("Scraped %d news articles (RSS=%d, Apify=%d)", total, rss_count, apify_count)
        _record("daily_scrape_news", True)
    except Exception:
        logger.exception("daily_scrape_news failed")
        _record("daily_scrape_news", False)
    finally:
        db.close()


def daily_update_sector_trends() -> None:
    """Recalculate trend direction for each sector based on recent document counts."""
    logger.info("Running daily_update_sector_trends")
    db: Session = SessionLocal()
    try:
        thirty_days_ago = datetime.now(timezone.utc) - timedelta(days=30)
        sixty_days_ago = datetime.now(timezone.utc) - timedelta(days=60)

        sectors = db.query(Sector).all()
        for sector in sectors:
            recent = (
                db.query(Document)
                .filter(Document.sector_id == sector.id, Document.scraped_at >= thirty_days_ago)
                .count()
            )
            previous = (
                db.query(Document)
                .filter(
                    Document.sector_id == sector.id,
                    Document.scraped_at >= sixty_days_ago,
                    Document.scraped_at < thirty_days_ago,
                )
                .count()
            )
            if recent > previous * 1.2:
                sector.trend_direction = TrendDirection.up
            elif recent < previous * 0.8:
                sector.trend_direction = TrendDirection.down
            else:
                sector.trend_direction = TrendDirection.stable

            sector.last_updated = datetime.now(timezone.utc)

        db.commit()
        _record("daily_update_sector_trends", True)
    except Exception:
        logger.exception("daily_update_sector_trends failed")
        db.rollback()
        _record("daily_update_sector_trends", False)
    finally:
        db.close()


def daily_check_competition_deadlines() -> None:
    """Mark competitions as closed if their deadline has passed."""
    logger.info("Running daily_check_competition_deadlines")
    db: Session = SessionLocal()
    try:
        today = datetime.now(timezone.utc).date()
        upcoming_cutoff = today + timedelta(days=7)

        expired = (
            db.query(Competition)
            .filter(
                Competition.status == CompetitionStatus.open,
                Competition.deadline != None,  # noqa: E711
                Competition.deadline < today,
            )
            .all()
        )
        for comp in expired:
            comp.status = CompetitionStatus.closed
            logger.info("Closed expired competition: %s", comp.title)

        upcoming = (
            db.query(Competition)
            .filter(
                Competition.status == CompetitionStatus.open,
                Competition.deadline != None,  # noqa: E711
                Competition.deadline <= upcoming_cutoff,
                Competition.deadline >= today,
            )
            .all()
        )
        for comp in upcoming:
            days_left = (comp.deadline - today).days
            logger.info("DEADLINE ALERT: '%s' due in %d days", comp.title, days_left)

        db.commit()
        _record("daily_check_competition_deadlines", True)
    except Exception:
        logger.exception("daily_check_competition_deadlines failed")
        db.rollback()
        _record("daily_check_competition_deadlines", False)
    finally:
        db.close()


# ---------------------------------------------------------------------------
# Monthly Claude-powered content refresh
# ---------------------------------------------------------------------------

def monthly_claude_refresh() -> None:
    """
    Uses Claude to generate fresh ideas, update sector descriptions/funding,
    and create synthetic news summaries based on current trends.

    Runs on the 1st of each month. Costs ~$0.10-0.30 per run.
    """
    logger.info("Running monthly_claude_refresh")
    db: Session = SessionLocal()
    try:
        if not settings.ANTHROPIC_API_KEY:
            logger.warning("ANTHROPIC_API_KEY not set, skipping Claude refresh")
            _record("monthly_claude_refresh", False)
            return

        client = Anthropic(api_key=settings.ANTHROPIC_API_KEY)
        sectors = db.query(Sector).all()
        now = datetime.now(timezone.utc)
        year = now.year
        month_name = now.strftime("%B %Y")
        new_ideas = 0
        new_docs = 0

        for sector in sectors:
            # --- Refresh sector description and funding estimate ---
            try:
                sector_resp = client.messages.create(
                    model=settings.CLAUDE_MODEL,
                    max_tokens=600,
                    messages=[{
                        "role": "user",
                        "content": (
                            f"You are a senior UK innovation funding analyst with access to the latest Innovate UK "
                            f"data, UKRI funding announcements, and UK government innovation policy as of {month_name}.\n\n"
                            f"For the '{sector.name}' sector in the UK right now:\n\n"
                            "1. DESCRIPTION: Write a precise 2-3 sentence summary of the current state of this sector. "
                            "Mention specific recent developments: new funding programmes, policy changes, notable UK "
                            "startups or scale-ups, or technology breakthroughs. Do NOT write generic statements.\n\n"
                            "2. FUNDING: Estimate the total currently available Innovate UK and UKRI grant funding in GBP "
                            "for this sector. Consider active competitions, Smart Grants, ISCF challenges, and sector-specific "
                            "programmes. Be realistic -- typical sector funding ranges from £20M to £200M.\n\n"
                            "3. PRIORITY SCORE (1-10): Rate how much the UK government is currently prioritising this sector "
                            "based on recent policy announcements, budget allocations, and strategic frameworks. "
                            "10 = top government priority with major new funding; 5 = moderate priority; 1 = minimal focus.\n\n"
                            "Respond ONLY as JSON with no other text:\n"
                            "{\"description\": \"Specific current description...\", \"funding_available_gbp\": 50000000, \"priority_score\": 8.5}"
                        ),
                    }],
                )
                raw = sector_resp.content[0].text.strip()
                if raw.startswith("```"):
                    raw = raw.split("\n", 1)[-1].rsplit("```", 1)[0]
                parsed = json.loads(raw)
                if "description" in parsed:
                    sector.description = parsed["description"]
                if "funding_available_gbp" in parsed:
                    sector.funding_available_gbp = int(parsed["funding_available_gbp"])
                if "priority_score" in parsed:
                    sector.priority_score = float(parsed["priority_score"])
                sector.last_updated = now
                db.flush()
            except Exception as exc:
                logger.warning("Claude sector refresh failed for %s: %s", sector.name, exc)

            # --- Generate 2 fresh ideas per sector ---
            try:
                ideas_resp = client.messages.create(
                    model=settings.CLAUDE_MODEL,
                    max_tokens=1500,
                    messages=[{
                        "role": "user",
                        "content": (
                            f"You are a senior UK Innovator Founder Visa advisor as of {month_name}. "
                            f"Generate 2 innovative project ideas for the '{sector.name}' sector.\n\n"
                            "REQUIREMENTS FOR EACH IDEA:\n"
                            "- Must be genuinely novel -- not a copy of an existing UK startup\n"
                            "- Must address a real, current problem in the UK market\n"
                            "- Must be feasible for a small founding team (2-4 people) with seed funding\n"
                            "- Must align with current Innovate UK priority areas\n"
                            "- Description should be 150-250 words covering: the specific UK problem, the technical "
                            "solution, why it is innovative, the target customer, and the revenue model\n"
                            "- Tech stack should list 4-5 specific technologies (not generic terms like 'AI')\n"
                            "- The 2 ideas should be different in approach -- one more technically ambitious, one more practical\n\n"
                            "SCORING RULES:\n"
                            "- Scores use 0-10 scale. Be realistic and vary between the 2 ideas.\n"
                            "- overall_probability uses 0-100 scale (realistic visa endorsement chance).\n"
                            "- market_size_gbp should be realistic UK market estimate.\n\n"
                            "Respond ONLY as a JSON array with no other text:\n"
                            "[{\"title\": \"Specific descriptive title\", "
                            "\"description\": \"Detailed 150-250 word description...\", "
                            "\"innovation_score\": 7.5, \"viability_score\": 7.0, "
                            "\"scalability_score\": 6.5, \"uk_benefit_score\": 8.0, "
                            "\"overall_probability\": 72, \"market_size_gbp\": 5000000, "
                            "\"tech_stack\": [\"FastAPI\", \"PyTorch\", \"PostgreSQL\", \"React\", \"AWS\"]}]"
                        ),
                    }],
                )
                raw = ideas_resp.content[0].text.strip()
                if raw.startswith("```"):
                    raw = raw.split("\n", 1)[-1].rsplit("```", 1)[0]
                idea_list = json.loads(raw)
                for idea_data in idea_list[:2]:
                    idea = Idea(
                        sector_id=sector.id,
                        title=idea_data.get("title", "Untitled")[:200],
                        description=idea_data.get("description", "")[:5000],
                        tech_stack=idea_data.get("tech_stack", []),
                        innovation_score=idea_data.get("innovation_score", 0.75),
                        viability_score=idea_data.get("viability_score", 0.70),
                        scalability_score=idea_data.get("scalability_score", 0.70),
                        uk_benefit_score=idea_data.get("uk_benefit_score", 0.70),
                        overall_probability=idea_data.get("overall_probability", 0.72),
                        market_size_gbp=idea_data.get("market_size_gbp"),
                    )
                    db.add(idea)
                    new_ideas += 1
            except Exception as exc:
                logger.warning("Claude idea generation failed for %s: %s", sector.name, exc)

            # --- Generate 1 trend summary document per sector ---
            try:
                doc_resp = client.messages.create(
                    model=settings.CLAUDE_MODEL,
                    max_tokens=800,
                    messages=[{
                        "role": "user",
                        "content": (
                            f"You are a UK innovation journalist writing for an audience of international founders "
                            f"considering the UK Innovator Founder Visa.\n\n"
                            f"Write a detailed, factual news-style briefing (250-350 words) about the current state of "
                            f"the UK '{sector.name}' innovation sector as of {month_name}.\n\n"
                            "YOUR ARTICLE MUST INCLUDE:\n"
                            "1. The most significant recent development or trend in this sector (be specific, name real "
                            "UK organisations, programmes, or companies where possible)\n"
                            "2. Current or recently announced Innovate UK / UKRI funding opportunities relevant to this sector\n"
                            "3. Any recent UK government policy changes or strategic announcements affecting this sector\n"
                            "4. 1-2 notable UK startups or scale-ups that have recently raised funding or launched in this space\n"
                            "5. What this means for international founders looking to enter this sector in the UK\n\n"
                            "STYLE: Professional, factual, data-driven. Use specific numbers and dates where possible. "
                            "Do not use marketing language or hype. Write as a knowledgeable analyst, not a promoter."
                        ),
                    }],
                )
                summary_text = doc_resp.content[0].text.strip()
                import hashlib
                chash = hashlib.sha256(summary_text.encode("utf-8")).hexdigest()

                existing = db.query(Document).filter(Document.content_hash == chash).first()
                if not existing and len(summary_text) > 100:
                    doc = Document(
                        url=f"https://innovisa.ai/trends/{sector.name.lower()}/{year}/{now.month}",
                        title=f"{sector.name} Innovation Trends - {month_name}",
                        content=summary_text,
                        content_hash=chash,
                        doc_type=DocType.research,
                        sector_id=sector.id,
                        published_at=now,
                        metadata_={"source": "Claude monthly refresh", "month": month_name},
                    )
                    db.add(doc)
                    new_docs += 1
            except Exception as exc:
                logger.warning("Claude trend summary failed for %s: %s", sector.name, exc)

        db.commit()
        logger.info("Monthly Claude refresh: %d new ideas, %d new documents", new_ideas, new_docs)
        _record("monthly_claude_refresh", True)

    except Exception:
        logger.exception("monthly_claude_refresh failed")
        db.rollback()
        _record("monthly_claude_refresh", False)
    finally:
        db.close()


# ---------------------------------------------------------------------------
# Manual trigger
# ---------------------------------------------------------------------------

def trigger_job(job_type: str) -> str:
    mapping = {
        "competitions": weekly_scrape_competitions,
        "projects": weekly_scrape_funded_projects,
        "news": daily_scrape_news,
        "refresh": monthly_claude_refresh,
        "all": None,
    }
    if job_type not in mapping:
        return f"Unknown job type: {job_type}. Valid: {', '.join(mapping.keys())}"

    if job_type == "all":
        weekly_scrape_competitions()
        weekly_scrape_funded_projects()
        daily_scrape_news()
        return "Triggered all scraping jobs"

    mapping[job_type]()  # type: ignore[misc]
    return f"Triggered {job_type} job"


# ---------------------------------------------------------------------------
# Scheduler setup
# ---------------------------------------------------------------------------

_scheduler: BackgroundScheduler | None = None


def start_scheduler() -> BackgroundScheduler:
    global _scheduler
    if _scheduler and _scheduler.running:
        return _scheduler

    _scheduler = BackgroundScheduler(timezone="UTC")

    # Weekly: competitions (Apify) + funded projects (UKRI API) - Sunday 2am, 4am
    _scheduler.add_job(weekly_scrape_competitions, CronTrigger(day_of_week="sun", hour=2), id="weekly_competitions", replace_existing=True)
    _scheduler.add_job(weekly_scrape_funded_projects, CronTrigger(day_of_week="sun", hour=4), id="weekly_projects", replace_existing=True)

    # Daily: RSS + Apify news at 6am, trend recalc at 7am, deadline checks at 8am
    _scheduler.add_job(daily_scrape_news, CronTrigger(hour=6), id="daily_news", replace_existing=True)
    _scheduler.add_job(daily_update_sector_trends, CronTrigger(hour=7), id="daily_trends", replace_existing=True)
    _scheduler.add_job(daily_check_competition_deadlines, CronTrigger(hour=8), id="daily_deadlines", replace_existing=True)

    # Monthly: Claude content refresh on the 1st at 3am
    _scheduler.add_job(monthly_claude_refresh, CronTrigger(day=1, hour=3), id="monthly_refresh", replace_existing=True)

    _scheduler.start()
    logger.info("APScheduler started with 6 jobs (5 recurring + 1 monthly refresh)")
    return _scheduler


def stop_scheduler() -> None:
    global _scheduler
    if _scheduler and _scheduler.running:
        _scheduler.shutdown(wait=False)
        logger.info("APScheduler stopped")
