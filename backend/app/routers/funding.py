import uuid
from datetime import datetime, timezone, timedelta, date

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models import Competition, CompetitionStatus, Sector, User, UserAnalysis
from app.schemas import CompetitionResponse, FundingMatchRequest, FundingMatchResponse

router = APIRouter(prefix="/api/v1/funding", tags=["funding"])


def _get_rag():
    from app.main import get_rag_engine
    return get_rag_engine()


def _competition_to_response(comp: Competition, db: Session) -> CompetitionResponse:
    sector = db.query(Sector).filter(Sector.id == comp.sector_id).first() if comp.sector_id else None
    days_until = None
    if comp.deadline:
        delta = comp.deadline - date.today()
        days_until = delta.days if delta.days >= 0 else None
    return CompetitionResponse(
        id=comp.id,
        title=comp.title,
        description=comp.description,
        url=comp.url,
        deadline=comp.deadline,
        sector_id=comp.sector_id,
        sector_name=sector.name if sector else "",
        funding_amount_gbp=comp.funding_amount_gbp or 0,
        applicant_requirements=comp.applicant_requirements,
        status=comp.status.value if comp.status else "upcoming",
        days_until_deadline=days_until,
    )


@router.get("/active-competitions", response_model=list[CompetitionResponse])
def active_competitions(db: Session = Depends(get_db)):
    comps = (
        db.query(Competition)
        .filter(Competition.status == CompetitionStatus.open)
        .order_by(Competition.deadline.asc())
        .all()
    )
    return [_competition_to_response(c, db) for c in comps]


@router.get("/deadlines", response_model=list[CompetitionResponse])
def upcoming_deadlines(
    days_ahead: int = Query(default=30, ge=1, le=365),
    db: Session = Depends(get_db),
):
    cutoff = date.today() + timedelta(days=days_ahead)
    comps = (
        db.query(Competition)
        .filter(
            Competition.status == CompetitionStatus.open,
            Competition.deadline != None,  # noqa: E711
            Competition.deadline <= cutoff,
            Competition.deadline >= date.today(),
        )
        .order_by(Competition.deadline.asc())
        .all()
    )
    return [_competition_to_response(c, db) for c in comps]


@router.post("/match", response_model=list[FundingMatchResponse])
def match_funding(
    body: FundingMatchRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    idea_text = body.idea_description or ""

    if body.analysis_id:
        analysis = db.query(UserAnalysis).filter(
            UserAnalysis.id == body.analysis_id, UserAnalysis.user_id == user.id
        ).first()
        if not analysis:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Analysis not found")
        idea_text = analysis.submitted_idea

    if not idea_text:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Provide idea_description or analysis_id")

    rag = _get_rag()
    search_results = rag.search(idea_text, db, doc_types=["competition"], top_k=10)

    open_comps = (
        db.query(Competition)
        .filter(Competition.status == CompetitionStatus.open)
        .all()
    )

    # Rank competitions by text similarity to search results
    comp_scores: dict[str, float] = {}
    for r in search_results:
        for comp in open_comps:
            title_lower = comp.title.lower()
            snippet_lower = r.get("snippet", "").lower()
            if any(word in snippet_lower for word in title_lower.split()[:3]):
                comp_scores[str(comp.id)] = comp_scores.get(str(comp.id), 0) + r["relevance_score"]

    # Also give a base score to all open competitions based on keyword overlap
    idea_words = set(idea_text.lower().split())
    for comp in open_comps:
        cid = str(comp.id)
        comp_words = set((comp.title + " " + (comp.description or "")).lower().split())
        overlap = len(idea_words & comp_words) / max(len(idea_words), 1)
        comp_scores[cid] = comp_scores.get(cid, 0) + overlap * 0.5

    sorted_comps = sorted(comp_scores.items(), key=lambda x: -x[1])[:10]

    results = []
    for cid, score in sorted_comps:
        comp = next((c for c in open_comps if str(c.id) == cid), None)
        if comp:
            fit = min(round(score * 100, 1), 100.0)
            results.append(FundingMatchResponse(
                competition=_competition_to_response(comp, db),
                fit_score=fit,
            ))

    # If no matches from scoring, return all open competitions with low fit scores
    if not results:
        for comp in open_comps[:5]:
            results.append(FundingMatchResponse(
                competition=_competition_to_response(comp, db),
                fit_score=25.0,
            ))

    return results
