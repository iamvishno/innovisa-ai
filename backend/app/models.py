import uuid
import enum
from datetime import datetime, date

from sqlalchemy import (
    Column, String, Text, Float, BigInteger, Integer, Boolean, DateTime,
    Date, ForeignKey, JSON, Enum, UniqueConstraint, Index
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------

class SubscriptionTier(str, enum.Enum):
    free = "free"
    pro = "pro"
    enterprise = "enterprise"


class TrendDirection(str, enum.Enum):
    up = "up"
    down = "down"
    stable = "stable"


class DocType(str, enum.Enum):
    competition = "competition"
    funded_project = "funded_project"
    research = "research"
    news = "news"
    policy = "policy"


class CompetitionStatus(str, enum.Enum):
    open = "open"
    closed = "closed"
    upcoming = "upcoming"


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------

class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    onboarding_data = Column(JSON, nullable=True)
    subscription_tier = Column(Enum(SubscriptionTier), default=SubscriptionTier.free, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)

    saved_ideas = relationship("SavedIdea", back_populates="user", cascade="all, delete-orphan")
    analyses = relationship("UserAnalysis", back_populates="user", cascade="all, delete-orphan")


class Sector(Base):
    __tablename__ = "sectors"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), unique=True, nullable=False)
    description = Column(Text, nullable=True)
    icon_name = Column(String(50), nullable=True)
    priority_score = Column(Float, default=5.0)
    funding_available_gbp = Column(BigInteger, default=0)
    trend_direction = Column(Enum(TrendDirection), default=TrendDirection.stable)
    last_updated = Column(DateTime(timezone=True), server_default=func.now())

    ideas = relationship("Idea", back_populates="sector")
    documents = relationship("Document", back_populates="sector")
    competitions = relationship("Competition", back_populates="sector")


class Idea(Base):
    __tablename__ = "ideas"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    sector_id = Column(Integer, ForeignKey("sectors.id"), nullable=False)
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=False)
    tech_stack = Column(JSON, default=list)
    innovation_score = Column(Float, default=0.0)
    viability_score = Column(Float, default=0.0)
    scalability_score = Column(Float, default=0.0)
    uk_benefit_score = Column(Float, default=0.0)
    overall_probability = Column(Float, default=0.0)
    market_size_gbp = Column(BigInteger, nullable=True)
    job_creation_potential = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    is_active = Column(Boolean, default=True)
    view_count = Column(Integer, default=0)

    sector = relationship("Sector", back_populates="ideas")
    saved_by = relationship("SavedIdea", back_populates="idea", cascade="all, delete-orphan")

    __table_args__ = (
        Index("ix_ideas_sector_probability", "sector_id", "overall_probability"),
    )


class Document(Base):
    __tablename__ = "documents"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    url = Column(Text, nullable=True, index=True)
    title = Column(String(500), nullable=False)
    content = Column(Text, nullable=False)
    content_hash = Column(String(64), unique=True, nullable=False, index=True)
    doc_type = Column(Enum(DocType), nullable=False)
    scraped_at = Column(DateTime(timezone=True), server_default=func.now())
    published_at = Column(DateTime(timezone=True), nullable=True)
    sector_id = Column(Integer, ForeignKey("sectors.id"), nullable=True)
    metadata_ = Column("metadata", JSON, nullable=True)
    embedding_stored = Column(Boolean, default=False)

    sector = relationship("Sector", back_populates="documents")

    __table_args__ = (
        Index("ix_documents_type_sector", "doc_type", "sector_id"),
    )


class SavedIdea(Base):
    __tablename__ = "saved_ideas"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    idea_id = Column(UUID(as_uuid=True), ForeignKey("ideas.id"), nullable=False)
    user_notes = Column(Text, nullable=True)
    visa_check_result = Column(JSON, nullable=True)
    saved_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="saved_ideas")
    idea = relationship("Idea", back_populates="saved_by")

    __table_args__ = (
        UniqueConstraint("user_id", "idea_id", name="uq_user_idea"),
    )


class Competition(Base):
    __tablename__ = "competitions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title = Column(String(300), nullable=False)
    description = Column(Text, nullable=True)
    url = Column(Text, nullable=True)
    deadline = Column(Date, nullable=True)
    sector_id = Column(Integer, ForeignKey("sectors.id"), nullable=True)
    funding_amount_gbp = Column(BigInteger, default=0)
    applicant_requirements = Column(Text, nullable=True)
    status = Column(Enum(CompetitionStatus), default=CompetitionStatus.upcoming)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    scraped_at = Column(DateTime(timezone=True), server_default=func.now())

    sector = relationship("Sector", back_populates="competitions")

    __table_args__ = (
        Index("ix_competitions_status_deadline", "status", "deadline"),
    )


class UserAnalysis(Base):
    __tablename__ = "user_analyses"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    submitted_idea = Column(Text, nullable=False)
    sector_id = Column(Integer, ForeignKey("sectors.id"), nullable=True)
    analysis_result = Column(JSON, nullable=True)
    probability_score = Column(Float, default=0.0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="analyses")
    sector = relationship("Sector")
