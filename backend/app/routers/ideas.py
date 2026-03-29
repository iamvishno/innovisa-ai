import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user, get_optional_user
from app.models import Idea, Sector, SavedIdea, UserAnalysis, User
from app.schemas import (
    IdeaDetail, IdeaCard, GenerateIdeasRequest, AnalyzeIdeaRequest,
    SaveIdeaRequest, SavedIdeaResponse, MessageResponse,
)

router = APIRouter(prefix="/api/v1/ideas", tags=["ideas"])


def _get_rag():
    from app.main import rag_engine
    return rag_engine


@router.get("/{idea_id}", response_model=IdeaDetail)
def get_idea(
    idea_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User | None = Depends(get_optional_user),
):
    idea = db.query(Idea).filter(Idea.id == idea_id).first()
    if not idea:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Idea not found")

    idea.view_count = (idea.view_count or 0) + 1
    db.commit()

    sector = db.query(Sector).filter(Sector.id == idea.sector_id).first()

    # Fetch related ideas in the same sector
    related = (
        db.query(Idea)
        .filter(Idea.sector_id == idea.sector_id, Idea.id != idea.id, Idea.is_active == True)  # noqa: E712
        .order_by(Idea.overall_probability.desc())
        .limit(5)
        .all()
    )

    is_saved = False
    if user:
        is_saved = db.query(SavedIdea).filter(SavedIdea.user_id == user.id, SavedIdea.idea_id == idea.id).first() is not None

    return IdeaDetail(
        id=idea.id,
        title=idea.title,
        description=idea.description,
        overall_probability=idea.overall_probability,
        innovation_score=idea.innovation_score,
        viability_score=idea.viability_score,
        scalability_score=idea.scalability_score,
        uk_benefit_score=idea.uk_benefit_score,
        tech_stack=idea.tech_stack or [],
        market_size_gbp=idea.market_size_gbp,
        job_creation_potential=idea.job_creation_potential,
        sector_id=idea.sector_id,
        sector_name=sector.name if sector else "",
        created_at=idea.created_at,
        view_count=idea.view_count,
        is_saved=is_saved,
        related_ideas=[
            IdeaCard(
                id=r.id, title=r.title, description=r.description[:300],
                overall_probability=r.overall_probability,
                innovation_score=r.innovation_score, viability_score=r.viability_score,
                scalability_score=r.scalability_score, uk_benefit_score=r.uk_benefit_score,
                tech_stack=r.tech_stack or [], sector_id=r.sector_id,
                sector_name=sector.name if sector else "",
            )
            for r in related
        ],
    )


@router.post("/generate", response_model=list[IdeaCard])
def generate_ideas(
    body: GenerateIdeasRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    rag = _get_rag()
    raw_ideas = rag.generate_custom_ideas(
        skills=body.skills,
        interests=body.interests,
        db=db,
        sector_id=body.sector_id,
        constraints=body.constraints,
    )

    results: list[IdeaCard] = []
    for raw in raw_ideas:
        # Map sector name to sector_id
        sector_name = raw.get("sector", "")
        sector = db.query(Sector).filter(Sector.name.ilike(f"%{sector_name}%")).first() if sector_name else None
        sid = sector.id if sector else (body.sector_id or 1)

        idea = Idea(
            sector_id=sid,
            title=raw.get("title", "Untitled")[:200],
            description=raw.get("description", ""),
            tech_stack=raw.get("tech_stack", []),
            innovation_score=float(raw.get("innovation_score", 5)),
            viability_score=float(raw.get("viability_score", 5)),
            scalability_score=float(raw.get("scalability_score", 5)),
            uk_benefit_score=float(raw.get("uk_benefit_score", 5)),
            overall_probability=float(raw.get("overall_probability", 50)),
            market_size_gbp=raw.get("market_size_gbp"),
            job_creation_potential=raw.get("job_creation_potential"),
            is_active=True,
        )
        db.add(idea)
        db.flush()

        s = db.query(Sector).filter(Sector.id == sid).first()
        results.append(IdeaCard(
            id=idea.id, title=idea.title, description=idea.description[:300],
            overall_probability=idea.overall_probability,
            innovation_score=idea.innovation_score, viability_score=idea.viability_score,
            scalability_score=idea.scalability_score, uk_benefit_score=idea.uk_benefit_score,
            tech_stack=idea.tech_stack or [], sector_id=idea.sector_id,
            sector_name=s.name if s else "",
        ))

    db.commit()
    return results


@router.post("/analyze")
def analyze_idea(
    body: AnalyzeIdeaRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    sector = db.query(Sector).filter(Sector.id == body.sector_id).first()
    if not sector:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sector not found")

    rag = _get_rag()
    analysis = rag.generate_idea_analysis(body.idea_description, body.sector_id, db)

    probability = float(analysis.get("overall_probability", 50))
    record = UserAnalysis(
        user_id=user.id,
        submitted_idea=body.idea_description,
        sector_id=body.sector_id,
        analysis_result=analysis,
        probability_score=probability,
    )
    db.add(record)
    db.commit()
    db.refresh(record)

    analysis["analysis_id"] = str(record.id)
    return analysis


@router.post("/save", response_model=MessageResponse)
def save_idea(
    body: SaveIdeaRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    idea = db.query(Idea).filter(Idea.id == body.idea_id).first()
    if not idea:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Idea not found")

    existing = db.query(SavedIdea).filter(SavedIdea.user_id == user.id, SavedIdea.idea_id == body.idea_id).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Idea already saved")

    saved = SavedIdea(user_id=user.id, idea_id=body.idea_id, user_notes=body.notes)
    db.add(saved)
    db.commit()
    return MessageResponse(message="Idea saved successfully")


@router.delete("/saved/{saved_id}", response_model=MessageResponse)
def unsave_idea(
    saved_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    saved = db.query(SavedIdea).filter(SavedIdea.id == saved_id, SavedIdea.user_id == user.id).first()
    if not saved:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Saved idea not found")
    db.delete(saved)
    db.commit()
    return MessageResponse(message="Idea removed from saved")


@router.get("/saved/list", response_model=list[SavedIdeaResponse])
def list_saved_ideas(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    saved = (
        db.query(SavedIdea)
        .filter(SavedIdea.user_id == user.id)
        .order_by(SavedIdea.saved_at.desc())
        .all()
    )

    results = []
    for s in saved:
        idea = db.query(Idea).filter(Idea.id == s.idea_id).first()
        if not idea:
            continue
        sector = db.query(Sector).filter(Sector.id == idea.sector_id).first()
        results.append(SavedIdeaResponse(
            id=s.id,
            idea=IdeaCard(
                id=idea.id, title=idea.title, description=idea.description[:300],
                overall_probability=idea.overall_probability,
                innovation_score=idea.innovation_score, viability_score=idea.viability_score,
                scalability_score=idea.scalability_score, uk_benefit_score=idea.uk_benefit_score,
                tech_stack=idea.tech_stack or [], sector_id=idea.sector_id,
                sector_name=sector.name if sector else "",
            ),
            user_notes=s.user_notes,
            visa_check_result=s.visa_check_result,
            saved_at=s.saved_at,
        ))
    return results
