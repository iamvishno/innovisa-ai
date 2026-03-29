import logging
import os
from contextlib import asynccontextmanager

os.environ.setdefault("ANONYMIZED_TELEMETRY", "False")

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.middleware.gzip import GZipMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from app.config import get_settings
from app.rag_engine import RAGEngine
from app.tasks import start_scheduler, stop_scheduler

from app.routers import auth, sectors, ideas, visa, funding, research

settings = get_settings()
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger(__name__)

limiter = Limiter(key_func=get_remote_address)

# Module-level RAG engine instance, initialised at startup
rag_engine: RAGEngine | None = None  # type: ignore[assignment]


def get_rag_engine() -> RAGEngine:
    global rag_engine
    if rag_engine is None:
        rag_engine = RAGEngine()
    return rag_engine


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting InnoVisa AI backend...")
    start_scheduler()
    logger.info("Scheduler ready — RAG engine will initialise on first request")
    yield
    stop_scheduler()
    logger.info("Shutdown complete")


app = FastAPI(
    title="InnoVisa AI",
    description="RAG-powered UK Innovator Founder Visa project discovery API",
    version="1.0.0",
    lifespan=lifespan,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        settings.FRONTEND_URL,
        "http://localhost:3000",
        "http://localhost:5173",
        "https://innovisa-ai-web.fly.dev",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
        return response


app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(GZipMiddleware, minimum_size=500)

# Routers
app.include_router(auth.router)
app.include_router(sectors.router)
app.include_router(ideas.router)
app.include_router(visa.router)
app.include_router(funding.router)
app.include_router(research.router)


# Admin endpoints (inline to avoid a separate router file for 3 endpoints)
from fastapi import Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.dependencies import get_current_user
from app.models import User, UserAnalysis, Idea, Document, Competition
from app.tasks import trigger_job, get_job_stats
from app.schemas import ScrapeRequest, MessageResponse, AnalyticsResponse


@app.post("/api/v1/admin/scrape/trigger", response_model=MessageResponse, tags=["admin"])
@limiter.limit("5/minute")
def admin_trigger_scrape(request: Request, body: ScrapeRequest, user: User = Depends(get_current_user)):
    msg = trigger_job(body.job_type)
    return MessageResponse(message=msg)


@app.get("/api/v1/admin/scrape/status", tags=["admin"])
@limiter.limit("30/minute")
def admin_scrape_status(request: Request, user: User = Depends(get_current_user)):
    return get_job_stats()


@app.get("/api/v1/admin/analytics", response_model=AnalyticsResponse, tags=["admin"])
@limiter.limit("30/minute")
def admin_analytics(request: Request, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return AnalyticsResponse(
        total_users=db.query(User).count(),
        total_analyses=db.query(UserAnalysis).count(),
        total_ideas=db.query(Idea).count(),
        total_documents=db.query(Document).count(),
        total_competitions=db.query(Competition).count(),
    )


# Global exception handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})


@app.get("/api/v1/health", tags=["system"])
def health_check():
    return {"status": "ok", "service": "innovisa-ai"}
