import uuid

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models import User, UserAnalysis, Sector, Document, DocType
from app.schemas import (
    VisaComplianceRequest, VisaComplianceResponse,
    ApplicationDraftRequest, ApplicationDraftResponse,
)

router = APIRouter(prefix="/api/v1/visa", tags=["visa"])


def _get_rag():
    from app.main import rag_engine
    return rag_engine


@router.post("/compliance-check", response_model=VisaComplianceResponse)
def compliance_check(
    body: VisaComplianceRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    idea_text = body.idea_description or ""

    # If an analysis_id was provided, pull the submitted idea from it
    if body.analysis_id:
        analysis = db.query(UserAnalysis).filter(UserAnalysis.id == body.analysis_id, UserAnalysis.user_id == user.id).first()
        if not analysis:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Analysis not found")
        idea_text = analysis.submitted_idea

    if not idea_text or len(idea_text) < 50:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Idea description must be at least 50 characters")

    rag = _get_rag()
    result = rag.check_visa_compliance(idea_text, db, sector_id=body.sector_id)

    # Persist result on the analysis record if we have one
    if body.analysis_id:
        analysis_rec = db.query(UserAnalysis).filter(UserAnalysis.id == body.analysis_id).first()
        if analysis_rec:
            existing = analysis_rec.analysis_result or {}
            existing["visa_check"] = result
            analysis_rec.analysis_result = existing
            db.commit()

    return VisaComplianceResponse(**result)


@router.post("/generate-application", response_model=ApplicationDraftResponse)
def generate_application(
    body: ApplicationDraftRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    analysis = db.query(UserAnalysis).filter(UserAnalysis.id == body.analysis_id, UserAnalysis.user_id == user.id).first()
    if not analysis:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Analysis not found")

    rag = _get_rag()
    draft = rag.generate_application_draft(
        analysis=analysis.analysis_result or {},
        idea_description=analysis.submitted_idea,
        db=db,
    )

    return ApplicationDraftResponse(**draft)


@router.get("/success-stories")
def success_stories(
    sector_id: int | None = Query(default=None),
    limit: int = Query(default=5, ge=1, le=20),
    db: Session = Depends(get_db),
):
    q = db.query(Document).filter(Document.doc_type == DocType.funded_project)
    if sector_id is not None:
        q = q.filter(Document.sector_id == sector_id)

    docs = q.order_by(Document.published_at.desc()).limit(limit).all()

    return [
        {
            "id": str(d.id),
            "title": d.title,
            "summary": d.content[:500],
            "url": d.url,
            "published_at": d.published_at.isoformat() if d.published_at else None,
            "sector_id": d.sector_id,
        }
        for d in docs
    ]
