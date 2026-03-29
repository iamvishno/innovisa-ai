from __future__ import annotations

import uuid
from datetime import datetime, date
from typing import Optional

from pydantic import BaseModel, EmailStr, Field, field_validator


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------

class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    full_name: str = Field(min_length=1, max_length=255)

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if not any(c.isupper() for c in v):
            raise ValueError("Password must contain at least one uppercase letter")
        if not any(c.islower() for c in v):
            raise ValueError("Password must contain at least one lowercase letter")
        if not any(c.isdigit() for c in v):
            raise ValueError("Password must contain at least one digit")
        if not any(c in '!@#$%^&*()_+-=[]{}|;:,.<>?' for c in v):
            raise ValueError("Password must contain at least one special character")
        return v


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshRequest(BaseModel):
    refresh_token: str


class OnboardingRequest(BaseModel):
    skills: list[str] = Field(default_factory=list)
    interests: list[str] = Field(default_factory=list)
    background: str = ""
    timeline: str = ""


class UserResponse(BaseModel):
    id: uuid.UUID
    email: str
    full_name: str
    created_at: datetime
    onboarding_data: Optional[dict] = None
    subscription_tier: str
    is_active: bool

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Sectors
# ---------------------------------------------------------------------------

class SectorSummary(BaseModel):
    id: int
    name: str
    icon_name: Optional[str] = None
    priority_score: float
    trend_direction: str
    funding_available_gbp: int
    top_ideas_count: int = 0

    model_config = {"from_attributes": True}


class SectorDetail(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    icon_name: Optional[str] = None
    priority_score: float
    funding_available_gbp: int
    trend_direction: str
    last_updated: Optional[datetime] = None

    model_config = {"from_attributes": True}


class SectorTrendPoint(BaseModel):
    month: str
    funding: float
    idea_count: int
    avg_score: float


# ---------------------------------------------------------------------------
# Ideas
# ---------------------------------------------------------------------------

class IdeaCard(BaseModel):
    id: uuid.UUID
    title: str
    description: str
    overall_probability: float
    innovation_score: float
    viability_score: float
    scalability_score: float
    uk_benefit_score: float
    tech_stack: list[str] = Field(default_factory=list)
    sector_id: int
    sector_name: str = ""
    view_count: int = 0

    model_config = {"from_attributes": True}


class PaginatedSectorIdeas(BaseModel):
    items: list[IdeaCard]
    total: int
    page: int
    per_page: int
    pages: int


class IdeaDetail(BaseModel):
    id: uuid.UUID
    title: str
    description: str
    overall_probability: float
    innovation_score: float
    viability_score: float
    scalability_score: float
    uk_benefit_score: float
    tech_stack: list[str] = Field(default_factory=list)
    market_size_gbp: Optional[int] = None
    job_creation_potential: Optional[dict] = None
    sector_id: int
    sector_name: str = ""
    created_at: Optional[datetime] = None
    view_count: int = 0
    is_saved: bool = False
    related_ideas: list[IdeaCard] = Field(default_factory=list)

    model_config = {"from_attributes": True}


class GenerateIdeasRequest(BaseModel):
    skills: list[str] = Field(default_factory=list)
    interests: list[str] = Field(default_factory=list)
    sector_id: Optional[int] = None
    constraints: str = ""


class AnalyzeIdeaRequest(BaseModel):
    idea_description: str = Field(min_length=200, max_length=2000)
    sector_id: int


class SaveIdeaRequest(BaseModel):
    idea_id: uuid.UUID
    notes: Optional[str] = None


class SavedIdeaResponse(BaseModel):
    id: uuid.UUID
    idea: IdeaCard
    user_notes: Optional[str] = None
    visa_check_result: Optional[dict] = None
    saved_at: datetime

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Visa
# ---------------------------------------------------------------------------

class VisaComplianceRequest(BaseModel):
    idea_description: Optional[str] = None
    analysis_id: Optional[uuid.UUID] = None
    sector_id: Optional[int] = None


class CriterionResult(BaseModel):
    name: str
    passed: bool
    score: float
    explanation: str
    how_to_improve: str


class VisaComplianceResponse(BaseModel):
    overall_verdict: str
    probability_score: float
    criteria: list[CriterionResult]
    strengths: list[str]
    weaknesses: list[str]
    recommendations: list[dict]
    similar_projects: list[dict] = Field(default_factory=list)


class ApplicationDraftRequest(BaseModel):
    analysis_id: uuid.UUID


class ApplicationDraftResponse(BaseModel):
    executive_summary: str
    innovation_statement: str
    market_analysis: str
    scalability_plan: str
    uk_benefit: str


# ---------------------------------------------------------------------------
# Funding
# ---------------------------------------------------------------------------

class CompetitionResponse(BaseModel):
    id: uuid.UUID
    title: str
    description: Optional[str] = None
    url: Optional[str] = None
    deadline: Optional[date] = None
    sector_id: Optional[int] = None
    sector_name: str = ""
    funding_amount_gbp: int
    applicant_requirements: Optional[str] = None
    status: str
    days_until_deadline: Optional[int] = None

    model_config = {"from_attributes": True}


class FundingMatchRequest(BaseModel):
    idea_description: Optional[str] = None
    analysis_id: Optional[uuid.UUID] = None


class FundingMatchResponse(BaseModel):
    competition: CompetitionResponse
    fit_score: float


# ---------------------------------------------------------------------------
# Research
# ---------------------------------------------------------------------------

class SearchRequest(BaseModel):
    query: str = Field(min_length=3, max_length=500)
    sector_id: Optional[int] = None
    doc_types: list[str] = Field(default_factory=list)
    limit: int = Field(default=10, ge=1, le=50)


class SearchResultItem(BaseModel):
    doc_id: uuid.UUID
    title: str
    snippet: str
    relevance_score: float
    doc_type: str
    url: Optional[str] = None
    published_at: Optional[datetime] = None


class DocumentDetail(BaseModel):
    id: uuid.UUID
    title: str
    content: str
    url: Optional[str] = None
    doc_type: str
    published_at: Optional[datetime] = None
    metadata_: Optional[dict] = None

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Admin
# ---------------------------------------------------------------------------

class ScrapeRequest(BaseModel):
    job_type: str = Field(pattern="^(competitions|projects|news|refresh|all)$")


class JobStatusResponse(BaseModel):
    job_name: str
    last_run: Optional[datetime] = None
    next_run: Optional[datetime] = None
    success_count: int = 0
    failure_count: int = 0


class AnalyticsResponse(BaseModel):
    total_users: int
    total_analyses: int
    total_ideas: int
    total_documents: int
    total_competitions: int


# ---------------------------------------------------------------------------
# Shared
# ---------------------------------------------------------------------------

class PaginatedResponse(BaseModel):
    items: list
    total: int
    page: int
    per_page: int
    pages: int


class MessageResponse(BaseModel):
    message: str
    detail: Optional[str] = None
