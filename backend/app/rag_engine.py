"""
Core RAG (Retrieval-Augmented Generation) engine.

Orchestrates ChromaDB vector storage, OpenAI embeddings, hybrid search with
Reciprocal Rank Fusion, and Claude-powered idea generation / analysis.
"""

from __future__ import annotations

import hashlib
import json
import logging
import time
import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional

import chromadb
import tiktoken
from anthropic import Anthropic
from openai import OpenAI
from sqlalchemy import text as sql_text
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models import Document, Idea, Sector

logger = logging.getLogger(__name__)
settings = get_settings()

# Shared tokenizer for chunk size estimation
_enc = tiktoken.get_encoding("cl100k_base")


def _token_count(text: str) -> int:
    return len(_enc.encode(text))


def _content_hash(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


class RAGEngine:
    """Singleton-style engine initialised once at app startup."""

    def __init__(self) -> None:
        self._chroma = chromadb.PersistentClient(path=settings.CHROMA_PERSIST_DIRECTORY)
        self._collection = self._chroma.get_or_create_collection(
            name="innovisa_docs",
            metadata={"hnsw:space": "cosine"},
        )
        self._openai = OpenAI(api_key=settings.OPENAI_API_KEY)
        self._anthropic = Anthropic(api_key=settings.ANTHROPIC_API_KEY)

    # ------------------------------------------------------------------
    # Document chunking
    # ------------------------------------------------------------------

    def chunk_document(self, text: str, doc_metadata: dict | None = None) -> list[dict]:
        """Split *text* into overlapping token-based chunks.

        Returns a list of dicts with keys ``text``, ``chunk_index``,
        and any extra fields from *doc_metadata*.
        """
        tokens = _enc.encode(text)
        chunks: list[dict] = []
        start = 0
        idx = 0
        while start < len(tokens):
            end = min(start + settings.CHUNK_SIZE_TOKENS, len(tokens))
            chunk_text = _enc.decode(tokens[start:end])
            meta = dict(doc_metadata or {})
            meta["chunk_index"] = idx
            chunks.append({"text": chunk_text, **meta})
            start += settings.CHUNK_SIZE_TOKENS - settings.CHUNK_OVERLAP_TOKENS
            idx += 1
        return chunks

    # ------------------------------------------------------------------
    # Embedding helpers
    # ------------------------------------------------------------------

    def _embed_texts(self, texts: list[str]) -> list[list[float]]:
        """Call OpenAI embeddings API.  Batches up to 20 texts at a time."""
        all_embeddings: list[list[float]] = []
        batch_size = 20
        for i in range(0, len(texts), batch_size):
            batch = texts[i : i + batch_size]
            resp = self._openai.embeddings.create(
                model=settings.EMBEDDING_MODEL,
                input=batch,
                dimensions=settings.EMBEDDING_DIMENSIONS,
            )
            all_embeddings.extend([d.embedding for d in resp.data])
        return all_embeddings

    def _embed_query(self, query: str) -> list[float]:
        return self._embed_texts([query])[0]

    # ------------------------------------------------------------------
    # Ingest
    # ------------------------------------------------------------------

    def ingest_document(self, doc: Document, db: Session) -> int:
        """Chunk, embed, and store a Document in ChromaDB.

        Returns the number of chunks stored.
        """
        chunks = self.chunk_document(
            doc.content,
            {
                "doc_id": str(doc.id),
                "url": doc.url or "",
                "doc_type": doc.doc_type.value if doc.doc_type else "unknown",
                "sector_id": str(doc.sector_id) if doc.sector_id else "",
                "title": doc.title[:200],
            },
        )
        if not chunks:
            return 0

        ids = [f"{doc.id}_{c['chunk_index']}" for c in chunks]
        texts = [c["text"] for c in chunks]
        metadatas = [
            {
                "doc_id": str(doc.id),
                "url": doc.url or "",
                "doc_type": c.get("doc_type", ""),
                "sector_id": c.get("sector_id", ""),
                "title": c.get("title", ""),
                "chunk_index": c["chunk_index"],
                "published_at": doc.published_at.isoformat() if doc.published_at else "",
            }
            for c in chunks
        ]

        embeddings = self._embed_texts(texts)

        self._collection.upsert(
            ids=ids,
            embeddings=embeddings,
            documents=texts,
            metadatas=metadatas,
        )

        doc.embedding_stored = True
        db.commit()
        logger.info("Ingested %d chunks for document %s", len(chunks), doc.id)
        return len(chunks)

    # ------------------------------------------------------------------
    # Hybrid search (vector + full-text with RRF merge)
    # ------------------------------------------------------------------

    def search(
        self,
        query: str,
        db: Session,
        *,
        sector_id: int | None = None,
        doc_types: list[str] | None = None,
        top_k: int = 10,
    ) -> list[dict]:
        """Hybrid search: ChromaDB vectors + Postgres full-text, merged via RRF."""

        # --- Vector search ---
        where_filter: dict | None = None
        conditions = []
        if sector_id is not None:
            conditions.append({"sector_id": str(sector_id)})
        if doc_types:
            conditions.append({"doc_type": {"$in": doc_types}})

        if len(conditions) == 1:
            where_filter = conditions[0]
        elif len(conditions) > 1:
            where_filter = {"$and": conditions}

        query_embedding = self._embed_query(query)
        # Cap candidate chunks so we never pull unbounded rows from Chroma into memory.
        n_chroma = min(max(top_k, settings.RAG_TOP_K), 50)
        chroma_results = self._collection.query(
            query_embeddings=[query_embedding],
            n_results=n_chroma,
            where=where_filter if where_filter else None,
            include=["documents", "metadatas", "distances"],
        )

        vector_ranked: list[dict] = []
        if chroma_results and chroma_results["ids"] and chroma_results["ids"][0]:
            for i, cid in enumerate(chroma_results["ids"][0]):
                meta = chroma_results["metadatas"][0][i] if chroma_results["metadatas"] else {}
                vector_ranked.append({
                    "doc_id": meta.get("doc_id", ""),
                    "chunk_id": cid,
                    "text": (chroma_results["documents"][0][i] if chroma_results["documents"] else ""),
                    "distance": (chroma_results["distances"][0][i] if chroma_results["distances"] else 1.0),
                    "metadata": meta,
                })

        # --- Postgres full-text search ---
        ts_query = " & ".join(query.split()[:8])  # first 8 words as AND-query
        # Select only a short text prefix for snippets — avoid loading full document bodies into Python.
        sql = """
            SELECT id, title,
                   LEFT(content, 500) AS snippet_text,
                   doc_type, url, published_at,
                   ts_rank(to_tsvector('english', content), plainto_tsquery('english', :q)) AS rank
            FROM documents
            WHERE to_tsvector('english', content) @@ plainto_tsquery('english', :q)
        """
        params: dict = {"q": ts_query}
        if sector_id is not None:
            sql += " AND sector_id = :sid"
            params["sid"] = sector_id
        if doc_types:
            sql += " AND doc_type::text = ANY(:dtypes)"
            params["dtypes"] = doc_types
        sql += " ORDER BY rank DESC LIMIT :lim"
        params["lim"] = min(max(top_k, settings.RAG_TOP_K), 50)

        rows = db.execute(sql_text(sql), params).fetchall()
        text_ranked: list[dict] = []
        for row in rows:
            snippet_raw = row[2] or ""
            text_ranked.append({
                "doc_id": str(row[0]),
                "title": row[1],
                "snippet": snippet_raw[:400],
                "doc_type": row[3],
                "url": row[4],
                "published_at": row[5],
                "rank": float(row[6]),
            })

        # --- Reciprocal Rank Fusion ---
        RRF_K = 60
        scores: dict[str, float] = {}
        vector_map: dict[str, dict] = {}
        text_map: dict[str, dict] = {}

        for rank, item in enumerate(vector_ranked):
            did = item["doc_id"]
            scores[did] = scores.get(did, 0.0) + 1.0 / (RRF_K + rank + 1)
            if did not in vector_map:
                vector_map[did] = item

        for rank, item in enumerate(text_ranked):
            did = item["doc_id"]
            scores[did] = scores.get(did, 0.0) + 1.0 / (RRF_K + rank + 1)
            if did not in text_map:
                text_map[did] = item

        # Temporal boost: docs published in last 6 months get 1.2x score
        six_months_ago = datetime.now(timezone.utc) - timedelta(days=180)

        def _resolve_published_at(did: str) -> datetime | None:
            """Get published_at from the best available source."""
            txt = text_map.get(did, {})
            if txt.get("published_at") and isinstance(txt["published_at"], datetime):
                return txt["published_at"]
            vec = vector_map.get(did, {})
            pub_str = vec.get("metadata", {}).get("published_at", "")
            if pub_str and isinstance(pub_str, str):
                try:
                    return datetime.fromisoformat(pub_str)
                except (ValueError, TypeError):
                    pass
            return None

        for did in scores:
            pub_dt = _resolve_published_at(did)
            if pub_dt:
                if pub_dt.tzinfo is None:
                    pub_dt = pub_dt.replace(tzinfo=timezone.utc)
                if pub_dt > six_months_ago:
                    scores[did] = scores[did] * 1.2

        sorted_ids = sorted(scores, key=lambda d: -scores[d])[:top_k]
        results: list[dict] = []
        for did in sorted_ids:
            txt = text_map.get(did, {})
            vec = vector_map.get(did, {})
            vec_meta = vec.get("metadata", {})
            pub_dt = _resolve_published_at(did)

            results.append({
                "doc_id": did,
                "title": txt.get("title") or vec_meta.get("title", ""),
                "snippet": (txt.get("snippet") or vec.get("text", ""))[:500],
                "relevance_score": round(scores[did], 6),
                "doc_type": txt.get("doc_type") or vec_meta.get("doc_type", ""),
                "url": txt.get("url") or vec_meta.get("url", ""),
                "published_at": pub_dt,
            })
        return results

    # ------------------------------------------------------------------
    # Build RAG context string from search results
    # ------------------------------------------------------------------

    def _build_context(self, results: list[dict], budget_tokens: int | None = None) -> str:
        budget = budget_tokens or settings.RAG_CONTEXT_BUDGET_TOKENS
        parts: list[str] = []
        used = 0
        for r in results:
            snippet = r.get("snippet", "")
            tokens = _token_count(snippet)
            if used + tokens > budget:
                break
            parts.append(
                f"[Source: {r.get('title','')} | Type: {r.get('doc_type','')} | URL: {r.get('url','')}]\n{snippet}"
            )
            used += tokens
        return "\n\n---\n\n".join(parts)

    # ------------------------------------------------------------------
    # Claude call with exponential back-off retry
    # ------------------------------------------------------------------

    def _call_claude(self, system: str, user_msg: str, *, max_tokens: int = 4096, retries: int = 3) -> str:
        for attempt in range(retries):
            try:
                resp = self._anthropic.messages.create(
                    model=settings.CLAUDE_MODEL,
                    max_tokens=max_tokens,
                    system=system,
                    messages=[{"role": "user", "content": user_msg}],
                )
                return resp.content[0].text
            except Exception as exc:
                wait = 2 ** attempt
                logger.warning("Claude API attempt %d failed: %s – retrying in %ds", attempt + 1, exc, wait)
                if attempt == retries - 1:
                    raise
                time.sleep(wait)
        raise RuntimeError("Claude API call failed after all retries")

    # ------------------------------------------------------------------
    # Idea analysis
    # ------------------------------------------------------------------

    def generate_idea_analysis(
        self,
        idea_description: str,
        sector_id: int,
        db: Session,
    ) -> dict:
        """Analyze a user's idea against the RAG corpus and return structured JSON."""

        search_results = self.search(idea_description, db, sector_id=sector_id, top_k=15)
        context = self._build_context(search_results)

        system = (
            "You are InnoVisa AI, a senior UK innovation funding analyst with deep expertise in "
            "Innovate UK programmes, the UK Innovator Founder Visa endorsement process, and the "
            "UK startup ecosystem. You have reviewed thousands of successful and unsuccessful "
            "visa applications and understand exactly what endorsing bodies look for.\n\n"
            "SCORING RULES (you must follow these precisely):\n"
            "- innovation_score (0-10): 8+ means genuinely novel IP or approach with no direct UK competitor; "
            "5-7 means incremental improvement; below 5 means derivative or already exists in the UK market.\n"
            "- viability_score (0-10): 8+ means clear revenue model, validated demand, and realistic unit economics; "
            "5-7 means plausible but unvalidated; below 5 means unclear or unrealistic business model.\n"
            "- scalability_score (0-10): 8+ means proven ability to scale beyond UK with network effects or platform dynamics; "
            "5-7 means can scale domestically; below 5 means limited to niche or local market.\n"
            "- uk_benefit_score (0-10): 8+ means directly creates UK jobs, exports, or addresses a UK government priority area; "
            "5-7 means indirect benefit; below 5 means minimal UK-specific impact.\n"
            "- overall_probability (0-100): Weighted composite reflecting realistic chance of endorsing body approval. "
            "60+ is strong. 40-59 is borderline. Below 40 is unlikely without significant changes.\n\n"
            "Be honest and rigorous. Do not inflate scores to be encouraging. Endorsing bodies reject "
            "vague or over-optimistic applications.\n"
            "Always respond with valid JSON only. No markdown, no explanation outside the JSON."
        )
        user_msg = f"""Perform a comprehensive analysis of this project idea for a UK Innovator Founder Visa application.

PROJECT IDEA:
{idea_description}

RELEVANT UK INNOVATION DATA (real funded projects, news, and policy from our database):
{context}

ANALYSIS REQUIREMENTS:
1. Compare this idea against the real funded projects and trends shown above.
2. Identify specific UK competitors or similar existing solutions.
3. Estimate market size based on UK government data and industry reports where possible.
4. Job creation estimates must be realistic for a startup (Year 1: typically 3-8 employees, scaling from there).
5. Tech stack should list the specific technologies actually needed, not generic terms.
6. Citations must reference the real sources provided above where applicable.
7. Recommendations must be specific and actionable (e.g., "Apply to Innovate UK Smart Grant Round 14" not "Seek funding").

Return a JSON object with this exact structure:
{{
  "title": "A clear, specific project title (not generic)",
  "description": "A detailed 200-300 word description covering: the problem, the proposed solution, why it is innovative compared to existing UK solutions, the target market, the revenue model, and the UK economic benefit",
  "innovation_score": 0-10,
  "viability_score": 0-10,
  "scalability_score": 0-10,
  "uk_benefit_score": 0-10,
  "overall_probability": 0-100,
  "tech_stack": ["specific_technology_1", "specific_technology_2", "specific_technology_3", "specific_technology_4", "specific_technology_5"],
  "market_size_gbp": realistic_estimated_number,
  "job_creation_potential": {{"year_1": realistic_number, "year_2": realistic_number, "year_3": realistic_number}},
  "market_analysis": {{
    "growth_rate": "X% CAGR with source or reasoning",
    "competitors": ["Specific UK competitor 1", "Specific UK competitor 2", "Specific UK competitor 3"],
    "competitive_advantage": "Precisely what makes this different from existing solutions in the UK",
    "target_segments": ["Specific segment 1", "Specific segment 2", "Specific segment 3"],
    "segment_sizes": {{"Segment 1": estimated_gbp, "Segment 2": estimated_gbp}}
  }},
  "strengths": ["Specific strength tied to evidence", "Another specific strength", "Third strength"],
  "weaknesses": ["Honest specific weakness", "Another specific weakness"],
  "recommendations": [
    {{"text": "Specific actionable recommendation with detail", "priority": "High"}},
    {{"text": "Another specific recommendation", "priority": "Medium"}},
    {{"text": "Third recommendation", "priority": "Low"}}
  ],
  "citations": [
    {{"title": "Source title from the data above", "url": "source url", "relevance": "Why this source supports or challenges the idea"}}
  ]
}}"""

        raw = self._call_claude(system, user_msg, max_tokens=4096)

        # Parse the JSON from Claude's response (strip markdown fences if present)
        clean = raw.strip()
        if clean.startswith("```"):
            clean = clean.split("\n", 1)[1] if "\n" in clean else clean[3:]
            if clean.endswith("```"):
                clean = clean[:-3]
            clean = clean.strip()

        try:
            return json.loads(clean)
        except json.JSONDecodeError:
            logger.error("Failed to parse Claude analysis response: %s", raw[:300])
            return {
                "title": "Analysis Error",
                "description": idea_description,
                "innovation_score": 5,
                "viability_score": 5,
                "scalability_score": 5,
                "uk_benefit_score": 5,
                "overall_probability": 50,
                "tech_stack": [],
                "market_size_gbp": 0,
                "job_creation_potential": {"year_1": 0, "year_2": 0, "year_3": 0},
                "market_analysis": {},
                "strengths": [],
                "weaknesses": [],
                "recommendations": [],
                "citations": [],
                "_raw_response": raw[:2000],
            }

    # ------------------------------------------------------------------
    # Custom idea generation
    # ------------------------------------------------------------------

    def generate_custom_ideas(
        self,
        skills: list[str],
        interests: list[str],
        db: Session,
        *,
        sector_id: int | None = None,
        constraints: str = "",
    ) -> list[dict]:
        """Generate 5-10 novel project ideas tailored to the user."""

        query = f"innovative UK startup ideas for someone with skills in {', '.join(skills)} interested in {', '.join(interests)}"
        search_results = self.search(query, db, sector_id=sector_id, top_k=15)
        context = self._build_context(search_results)

        system = (
            "You are InnoVisa AI, a senior UK innovation strategist who has helped hundreds of international "
            "founders successfully obtain the UK Innovator Founder Visa. You deeply understand what Innovate UK "
            "and endorsing bodies (such as Tech Nation, Envestors, and SEED) look for in applications.\n\n"
            "YOUR TASK: Generate project ideas that are:\n"
            "1. GENUINELY NOVEL - Not repackaged versions of existing UK solutions. Each must have a clear "
            "differentiator that an endorsing body would recognise as innovative.\n"
            "2. FUNDABLE - Aligned with current Innovate UK priority areas and active funding programmes.\n"
            "3. REALISTIC - Achievable by a small founding team within 12-24 months with reasonable seed funding.\n"
            "4. UK-BENEFICIAL - Must demonstrably create UK jobs, exports, or address a UK government priority.\n"
            "5. TAILORED - Directly leverage the user's specific skills and interests.\n\n"
            "SCORING RULES:\n"
            "- Scores use 0-10 scale (be realistic, not all ideas are 8+)\n"
            "- overall_probability uses 0-100 scale (realistic visa approval chance)\n"
            "- Vary scores across ideas -- not all should score similarly\n"
            "- At least 2 ideas should be ambitious (higher risk, higher innovation)\n"
            "- At least 2 ideas should be practical (higher viability, lower risk)\n\n"
            "Always respond with valid JSON only. No markdown, no explanation outside the JSON."
        )
        user_msg = f"""Generate 7 innovative UK Innovator Founder Visa project ideas tailored to this founder.

FOUNDER PROFILE:
- Technical skills: {', '.join(skills)}
- Domain interests: {', '.join(interests)}
- Additional context: {constraints or 'No additional constraints specified'}

CURRENT UK INNOVATION LANDSCAPE (real data from our database):
{context}

REQUIREMENTS FOR EACH IDEA:
- Title must be specific and descriptive (not generic like "AI Platform")
- Description must cover: the specific problem in the UK market, the proposed technical solution,
  how it differs from existing UK competitors, the target customer segment, and the revenue model
- Tech stack must list 4-6 specific technologies the founder would actually use
- Market size must be realistic for the UK market specifically
- Job creation must be realistic for a startup (Year 1: 3-8, Year 2: 8-20, Year 3: 15-50 typically)
- Sector must match one of: Health, IT, Ecommerce, Agriculture, IoT, Business
- Include at least 1 citation from the real data above per idea where applicable

Return a JSON array of exactly 7 objects:
{{
  "title": "Specific descriptive project title",
  "description": "250-350 word detailed description covering problem, solution, differentiation, target market, and revenue model",
  "tech_stack": ["Specific Tech 1", "Specific Tech 2", "Specific Tech 3", "Specific Tech 4", "Specific Tech 5"],
  "innovation_score": realistic 0-10,
  "viability_score": realistic 0-10,
  "scalability_score": realistic 0-10,
  "uk_benefit_score": realistic 0-10,
  "overall_probability": realistic 0-100,
  "market_size_gbp": realistic_uk_market_estimate,
  "job_creation_potential": {{"year_1": realistic, "year_2": realistic, "year_3": realistic}},
  "sector": "one of Health|IT|Ecommerce|Agriculture|IoT|Business",
  "citations": [{{"title": "source from data above", "url": "url", "relevance": "how it relates"}}]
}}"""

        raw = self._call_claude(system, user_msg, max_tokens=6000)

        clean = raw.strip()
        if clean.startswith("```"):
            clean = clean.split("\n", 1)[1] if "\n" in clean else clean[3:]
            if clean.endswith("```"):
                clean = clean[:-3]
            clean = clean.strip()

        try:
            ideas = json.loads(clean)
            if isinstance(ideas, dict) and "ideas" in ideas:
                ideas = ideas["ideas"]
            return ideas if isinstance(ideas, list) else [ideas]
        except json.JSONDecodeError:
            logger.error("Failed to parse idea generation response: %s", raw[:300])
            return []

    # ------------------------------------------------------------------
    # Visa compliance check
    # ------------------------------------------------------------------

    def check_visa_compliance(
        self,
        idea_description: str,
        db: Session,
        *,
        sector_id: int | None = None,
    ) -> dict:
        """Check an idea against UK Innovator Founder Visa criteria."""

        search_results = self.search(
            f"UK innovator visa funded projects similar to: {idea_description}",
            db,
            sector_id=sector_id,
            doc_types=["funded_project", "policy"],
            top_k=10,
        )
        context = self._build_context(search_results)

        system = (
            "You are a senior UK Innovator Founder Visa endorsement assessor with direct experience "
            "at endorsing bodies such as Tech Nation (now closed, replaced by others), Envestors, SEED, "
            "and Innovate UK. You have personally reviewed over 500 applications and understand the exact "
            "standards endorsing bodies apply.\n\n"
            "ASSESSMENT STANDARDS:\n"
            "- PASS: The idea would likely receive endorsement with the current description. "
            "Typically requires scores of 7+ across most criteria and no critical weaknesses.\n"
            "- NEEDS WORK: The idea has promise but has specific gaps that endorsing bodies would flag. "
            "Most applications fall here initially.\n"
            "- NOT READY: Fundamental issues that would lead to immediate rejection - "
            "e.g., idea already exists widely in the UK, no clear innovation, or no realistic business model.\n\n"
            "SCORING RULES:\n"
            "- Each criterion scored 0-10. A score of 7+ means the criterion is met at endorsement level.\n"
            "- probability_score (0-100): Realistic chance of receiving endorsement. "
            "Most first drafts score 30-60. Only exceptionally strong applications score 70+.\n"
            "- Be HONEST and RIGOROUS. Endorsing bodies reject roughly 50-60%% of applications. "
            "Sugar-coating does not help the applicant.\n"
            "- 'how_to_improve' must contain specific, actionable steps (not generic advice like 'do more research').\n\n"
            "Always respond with valid JSON only. No markdown, no explanation outside the JSON."
        )
        user_msg = f"""Perform a rigorous UK Innovator Founder Visa compliance assessment for this project idea.

PROJECT IDEA:
{idea_description}

SIMILAR FUNDED UK PROJECTS & POLICY DATA (from our database):
{context}

ASSESSMENT CRITERIA (based on actual endorsing body requirements):

1. INNOVATION - Does this idea offer something genuinely new to the UK market? Is there existing IP
   or a novel technical approach? Would an endorsing body recognise this as innovative, not just
   an incremental improvement or copy of an existing UK business?

2. VIABILITY - Is there clear evidence of market demand? Is the business model specific and realistic?
   Are the revenue projections credible? Has the founder demonstrated any traction or validation?

3. SCALABILITY - Can this business realistically scale beyond its initial market? Is there a credible
   path to international expansion or significant UK market share? Does the business model support scaling?

4. UK ECONOMIC BENEFIT - Will this create skilled UK jobs within 2-3 years? Will it generate exports,
   improve UK productivity, or address a UK government priority area (e.g., Net Zero, NHS transformation,
   levelling up, digital infrastructure)?

5. FOUNDER FIT - Does the described approach suggest the founder has relevant skills and realistic
   expectations? Is the scope appropriate for a founding team? Are the timelines credible?

Return JSON:
{{
  "overall_verdict": "PASS" or "NEEDS WORK" or "NOT READY",
  "probability_score": 0-100,
  "criteria": [
    {{
      "name": "Innovation",
      "passed": true or false,
      "score": 0-10,
      "explanation": "Detailed assessment referencing specific aspects of the idea and comparing to existing UK solutions",
      "how_to_improve": "Specific actionable steps, e.g., 'File a provisional patent for the X algorithm' or 'Differentiate from CompetitorY by focusing on Z'"
    }},
    {{
      "name": "Viability",
      "passed": true or false,
      "score": 0-10,
      "explanation": "Assessment of business model, market evidence, and revenue credibility",
      "how_to_improve": "Specific steps to strengthen viability evidence"
    }},
    {{
      "name": "Scalability",
      "passed": true or false,
      "score": 0-10,
      "explanation": "Assessment of scaling potential within UK and internationally",
      "how_to_improve": "Specific scaling strategy improvements"
    }},
    {{
      "name": "UK Economic Benefit",
      "passed": true or false,
      "score": 0-10,
      "explanation": "Assessment of job creation, exports, and alignment with UK priorities",
      "how_to_improve": "Specific ways to strengthen UK benefit narrative"
    }},
    {{
      "name": "Founder Fit",
      "passed": true or false,
      "score": 0-10,
      "explanation": "Assessment of whether scope matches typical successful founder profiles",
      "how_to_improve": "Specific advice on positioning founder credentials"
    }}
  ],
  "strengths": ["Specific strength 1", "Specific strength 2", "Specific strength 3"],
  "weaknesses": ["Specific weakness 1", "Specific weakness 2"],
  "recommendations": [
    {{"text": "Most critical specific recommendation", "priority": "High"}},
    {{"text": "Important specific recommendation", "priority": "Medium"}},
    {{"text": "Helpful specific recommendation", "priority": "Low"}}
  ],
  "similar_projects": [
    {{"title": "Real or plausible UK project name", "summary": "Brief description and why it is similar"}}
  ]
}}"""

        raw = self._call_claude(system, user_msg, max_tokens=4096)

        clean = raw.strip()
        if clean.startswith("```"):
            clean = clean.split("\n", 1)[1] if "\n" in clean else clean[3:]
            if clean.endswith("```"):
                clean = clean[:-3]
            clean = clean.strip()

        try:
            return json.loads(clean)
        except json.JSONDecodeError:
            logger.error("Failed to parse visa compliance response: %s", raw[:300])
            return {
                "overall_verdict": "NEEDS WORK",
                "probability_score": 50,
                "criteria": [],
                "strengths": [],
                "weaknesses": ["Could not fully parse analysis"],
                "recommendations": [{"text": "Please try again or refine your idea description.", "priority": "High"}],
                "similar_projects": [],
            }

    # ------------------------------------------------------------------
    # Generate visa application draft
    # ------------------------------------------------------------------

    def generate_application_draft(self, analysis: dict, idea_description: str, db: Session) -> dict:
        search_results = self.search(idea_description, db, top_k=8)
        context = self._build_context(search_results, budget_tokens=8000)

        system = (
            "You are a professional UK Innovator Founder Visa application writer who has drafted "
            "successful applications for over 200 founders. You understand exactly the tone, evidence "
            "standard, and structure that endorsing bodies expect.\n\n"
            "WRITING STANDARDS:\n"
            "- Use confident but factual language. Avoid superlatives ('revolutionary', 'ground-breaking') "
            "unless backed by specific evidence. Endorsing bodies distrust hyperbole.\n"
            "- Cite specific numbers: market size in GBP, job creation projections, growth percentages.\n"
            "- Reference real UK programmes, policies, or organisations where applicable.\n"
            "- Each section must directly address what the endorsing body is looking for.\n"
            "- Write in first person as the founder ('We will...', 'Our solution...').\n"
            "- Be concise and structured. Use bullet points within markdown for key claims.\n\n"
            "Always respond with valid JSON only. No markdown fences around the JSON itself."
        )
        user_msg = f"""Write a compelling UK Innovator Founder Visa application draft based on this analysis.

PROJECT ANALYSIS (scores, strengths, weaknesses from our assessment):
{json.dumps(analysis, indent=2, default=str)[:4000]}

SUPPORTING EVIDENCE FROM UK INNOVATION DATA:
{context}

Write each section as markdown text. Each section must be persuasive, evidence-based, and directly
address what endorsing bodies evaluate.

Return JSON:
{{
  "executive_summary": "300-word markdown: What is the business, what problem does it solve, why is the founder uniquely qualified, and what is the UK opportunity? Open with a strong hook.",
  "innovation_statement": "400-word markdown: What is specifically innovative about this approach? How does it differ from existing UK and global solutions? What is the technical or business model novelty? Reference any IP, patents, or proprietary methods.",
  "market_analysis": "400-word markdown: UK market size with specific figures, target customer segments with estimated numbers, competitive landscape naming specific UK competitors, go-to-market strategy with timeline, revenue model with projected figures for Years 1-3.",
  "scalability_plan": "300-word markdown: How will the business scale from initial UK launch to national coverage and international expansion? What are the key scaling milestones? What infrastructure, partnerships, or funding rounds are needed?",
  "uk_benefit": "300-word markdown: Specific UK job creation numbers by year, alignment with UK government priorities (reference specific programmes like UKRI, Net Zero strategy, NHS Long Term Plan, etc.), expected exports or import substitution, regional economic impact if applicable."
}}"""

        raw = self._call_claude(system, user_msg, max_tokens=5000)

        clean = raw.strip()
        if clean.startswith("```"):
            clean = clean.split("\n", 1)[1] if "\n" in clean else clean[3:]
            if clean.endswith("```"):
                clean = clean[:-3]
            clean = clean.strip()

        try:
            return json.loads(clean)
        except json.JSONDecodeError:
            return {
                "executive_summary": raw[:1000],
                "innovation_statement": "",
                "market_analysis": "",
                "scalability_plan": "",
                "uk_benefit": "",
            }
