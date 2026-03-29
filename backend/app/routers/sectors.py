from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timezone, timedelta

from app.database import get_db
from app.models import Sector, Idea
from app.schemas import (
    SectorSummary,
    SectorDetail,
    SectorTrendPoint,
    IdeaCard,
    PaginatedSectorIdeas,
)

router = APIRouter(prefix="/api/v1/sectors", tags=["sectors"])


@router.get("", response_model=list[SectorSummary])
def list_sectors(db: Session = Depends(get_db)):
    sectors = db.query(Sector).order_by(Sector.id).all()
    counts_rows = (
        db.query(Idea.sector_id, func.count(Idea.id))
        .filter(Idea.is_active == True)  # noqa: E712
        .group_by(Idea.sector_id)
        .all()
    )
    count_by_sector = {sid: n for sid, n in counts_rows}
    return [
        SectorSummary(
            id=s.id,
            name=s.name,
            icon_name=s.icon_name,
            priority_score=s.priority_score,
            trend_direction=s.trend_direction.value if s.trend_direction else "stable",
            funding_available_gbp=s.funding_available_gbp or 0,
            top_ideas_count=count_by_sector.get(s.id, 0),
        )
        for s in sectors
    ]


@router.get("/{sector_id}", response_model=SectorDetail)
def get_sector(sector_id: int, db: Session = Depends(get_db)):
    sector = db.query(Sector).filter(Sector.id == sector_id).first()
    if not sector:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sector not found")
    return SectorDetail(
        id=sector.id,
        name=sector.name,
        description=sector.description,
        icon_name=sector.icon_name,
        priority_score=sector.priority_score,
        funding_available_gbp=sector.funding_available_gbp or 0,
        trend_direction=sector.trend_direction.value if sector.trend_direction else "stable",
        last_updated=sector.last_updated,
    )


@router.get("/{sector_id}/ideas", response_model=PaginatedSectorIdeas)
def list_sector_ideas(
    sector_id: int,
    page: int = Query(1, ge=1),
    per_page: int = Query(10, ge=1, le=50),
    sort_by: str = Query(default="probability", pattern="^(probability|innovation|recent)$"),
    db: Session = Depends(get_db),
):
    sector = db.query(Sector).filter(Sector.id == sector_id).first()
    if not sector:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sector not found")

    base = db.query(Idea).filter(Idea.sector_id == sector_id, Idea.is_active == True)  # noqa: E712
    total = base.count()

    q = base
    if sort_by == "probability":
        q = q.order_by(Idea.overall_probability.desc())
    elif sort_by == "innovation":
        q = q.order_by(Idea.innovation_score.desc())
    else:
        q = q.order_by(Idea.created_at.desc())

    offset = (page - 1) * per_page
    ideas = q.offset(offset).limit(per_page).all()
    pages = (total + per_page - 1) // per_page if total else 0

    items = [
        IdeaCard(
            id=idea.id,
            title=idea.title,
            description=idea.description[:300],
            overall_probability=idea.overall_probability,
            innovation_score=idea.innovation_score,
            viability_score=idea.viability_score,
            scalability_score=idea.scalability_score,
            uk_benefit_score=idea.uk_benefit_score,
            tech_stack=idea.tech_stack or [],
            sector_id=idea.sector_id,
            sector_name=sector.name,
            view_count=idea.view_count,
        )
        for idea in ideas
    ]
    return PaginatedSectorIdeas(
        items=items,
        total=total,
        page=page,
        per_page=per_page,
        pages=pages,
    )


@router.get("/{sector_id}/trends", response_model=list[SectorTrendPoint])
def get_sector_trends(sector_id: int, db: Session = Depends(get_db)):
    sector = db.query(Sector).filter(Sector.id == sector_id).first()
    if not sector:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sector not found")

    # Generate 12-month trend data from documents and ideas
    points = []
    now = datetime.now(timezone.utc)
    for months_ago in range(11, -1, -1):
        month_start = (now - timedelta(days=30 * months_ago)).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        month_end = (month_start + timedelta(days=32)).replace(day=1)

        idea_count = (
            db.query(Idea)
            .filter(Idea.sector_id == sector_id, Idea.created_at >= month_start, Idea.created_at < month_end)
            .count()
        )
        avg_score = (
            db.query(func.avg(Idea.overall_probability))
            .filter(Idea.sector_id == sector_id, Idea.created_at >= month_start, Idea.created_at < month_end)
            .scalar()
        ) or 0.0

        funding = (sector.funding_available_gbp or 0) / 12

        points.append(SectorTrendPoint(
            month=month_start.strftime("%b %Y"),
            funding=round(funding / 1_000_000, 1),
            idea_count=idea_count,
            avg_score=round(float(avg_score), 1),
        ))
    return points
