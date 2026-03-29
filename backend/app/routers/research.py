import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Document
from app.schemas import SearchRequest, SearchResultItem, DocumentDetail

router = APIRouter(prefix="/api/v1/research", tags=["research"])


def _get_rag():
    from app.main import get_rag_engine
    return get_rag_engine()


def _parse_published_at(value) -> datetime | None:
    """Coerce a published_at value from RAG search results to a datetime or None."""
    if value is None:
        return None
    if isinstance(value, datetime):
        return value
    if isinstance(value, str) and value:
        try:
            return datetime.fromisoformat(value)
        except (ValueError, TypeError):
            return None
    return None


@router.post("/search", response_model=list[SearchResultItem])
def search_documents(body: SearchRequest, db: Session = Depends(get_db)):
    rag = _get_rag()
    # SearchRequest enforces 1..50; keep an explicit cap so RAG never allocates for huge candidate sets.
    top_k = min(body.limit, 50)
    results = rag.search(
        query=body.query,
        db=db,
        sector_id=body.sector_id,
        doc_types=body.doc_types or None,
        top_k=top_k,
    )

    items = []
    for r in results:
        doc_id = r.get("doc_id", "")
        try:
            parsed_id = uuid.UUID(doc_id)
        except (ValueError, AttributeError):
            continue

        items.append(SearchResultItem(
            doc_id=parsed_id,
            title=r.get("title", ""),
            snippet=r.get("snippet", ""),
            relevance_score=r.get("relevance_score", 0.0),
            doc_type=r.get("doc_type", ""),
            url=r.get("url"),
            published_at=_parse_published_at(r.get("published_at")),
        ))
    return items


@router.get("/citations/{doc_id}", response_model=DocumentDetail)
def get_citation(doc_id: uuid.UUID, db: Session = Depends(get_db)):
    doc = db.query(Document).filter(Document.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    return DocumentDetail(
        id=doc.id,
        title=doc.title,
        content=doc.content,
        url=doc.url,
        doc_type=doc.doc_type.value if doc.doc_type else "unknown",
        published_at=doc.published_at,
        metadata_=doc.metadata_,
    )
