# InnoVisa AI

> AI-powered platform helping international founders discover fundable UK Innovator Founder Visa project ideas by analysing innovation trends and funded projects.

[![MIT License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Python 3.11+](https://img.shields.io/badge/Python-3.11+-green.svg)](https://www.python.org/)
[![React 18](https://img.shields.io/badge/React-18-blue.svg)](https://react.dev/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-teal.svg)](https://fastapi.tiangolo.com/)
[![Deploy on Fly.io](https://img.shields.io/badge/Deploy-Fly.io-purple.svg)](https://fly.io/)

---

## What is InnoVisa AI?

InnoVisa AI is a **Retrieval-Augmented Generation (RAG)** application that:

- **Generates** tailored innovation project ideas for international founders
- **Analyses** ideas against real UK funded projects and Innovate UK data
- **Checks** visa compliance against Innovator Founder Visa endorsement criteria
- **Matches** ideas with active UK innovation funding competitions
- **Tracks** UK innovation trends, funding, and competition deadlines
- **Provides** a comprehensive Visa Resources guide with endorsing bodies and timelines

---

## How It Works — System Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                        USER (Browser)                        │
│              Desktop / Mobile / Tablet                        │
└──────────────────────┬───────────────────────────────────────┘
                       │ HTTPS
                       ▼
┌──────────────────────────────────────────────────────────────┐
│                 FRONTEND (React + Vite)                       │
│                                                              │
│  ┌─────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────────┐ │
│  │Dashboard│ │  Idea    │ │  Visa    │ │ Funding Tracker  │ │
│  │(Sectors)│ │Generator │ │Compliance│ │ (Competitions)   │ │
│  └─────────┘ └──────────┘ └──────────┘ └──────────────────┘ │
│  ┌──────────┐ ┌──────────┐ ┌──────────────────────────────┐ │
│  │  Idea    │ │   User   │ │      Visa Resources          │ │
│  │  Report  │ │Dashboard │ │  (Guide, Endorsing Bodies)   │ │
│  └──────────┘ └──────────┘ └──────────────────────────────┘ │
│                                                              │
│  Tech: React 18, TypeScript, TanStack Query, Zustand,        │
│        Tailwind CSS, Recharts, Framer Motion                 │
└──────────────────────┬───────────────────────────────────────┘
                       │ REST API (Axios)
                       ▼
┌──────────────────────────────────────────────────────────────┐
│                  BACKEND (FastAPI + Python)                   │
│                                                              │
│  ┌──────────────────────────────────────────────────┐        │
│  │               API Layer (Routers)                │        │
│  │  auth │ sectors │ ideas │ visa │ funding │ search │        │
│  └──────────┬───────────────────────┬───────────────┘        │
│             │                       │                        │
│  ┌──────────▼──────────┐ ┌─────────▼─────────────┐          │
│  │   RAG Engine        │ │   Auth & Security      │          │
│  │                     │ │                        │          │
│  │  • Hybrid Search    │ │  • JWT (access+refresh)│          │
│  │    (Vector + FTS)   │ │  • bcrypt passwords    │          │
│  │  • RRF Merge        │ │  • Rate limiting       │          │
│  │  • Temporal Weight  │ │  • Security headers    │          │
│  │  • Claude Analysis  │ │  • GZip compression    │          │
│  └──────┬──────┬───────┘ └────────────────────────┘          │
│         │      │                                             │
│  ┌──────▼──┐ ┌─▼──────────────┐ ┌────────────────────┐      │
│  │ChromaDB │ │  PostgreSQL    │ │  Background Jobs   │      │
│  │(Vectors)│ │  (Data + FTS)  │ │  (APScheduler)     │      │
│  └─────────┘ └────────────────┘ │                    │      │
│                                 │  • Daily: news,    │      │
│  ┌─────────────────────────┐    │    trends, deadlines│      │
│  │     External APIs       │    │  • Weekly: comps,  │      │
│  │                         │    │    funded projects  │      │
│  │  • Claude (Analysis)    │    │  • Monthly: Claude │      │
│  │  • OpenAI (Embeddings)  │    │    idea refresh    │      │
│  │  • Apify (Scraping)     │    └────────────────────┘      │
│  │  • RSS Feeds (News)     │                                 │
│  │  • UKRI API (Projects)  │                                 │
│  └─────────────────────────┘                                 │
└──────────────────────────────────────────────────────────────┘
```

---

## User Workflow — How the Website Works

```
┌─────────────────────────────────────────────────────────┐
│                    VISITOR LANDS ON SITE                  │
│              Sees Dashboard with 6 Sectors               │
│         (Health, IT, Ecommerce, Agriculture, IoT,        │
│              Business Services)                          │
└─────────────────────┬───────────────────────────────────┘
                      │
          ┌───────────┼──────────────┬─────────────┐
          ▼           ▼              ▼             ▼
   ┌─────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐
   │ Browse  │  │ Generate │  │  Check   │  │  Visa    │
   │ Sectors │  │  Ideas   │  │  Visa    │  │Resources │
   │(Public) │  │(Login)   │  │Compliance│  │ (Public) │
   └────┬────┘  └────┬─────┘  │ (Login)  │  └──────────┘
        │             │        └────┬─────┘
        ▼             │             │
   ┌─────────┐        │             │
   │  View   │        │             │
   │ Sector  │        ▼             ▼
   │ Details │  ┌───────────┐  ┌───────────┐
   │ + Trends│  │ AI fills  │  │ AI checks │
   │ + Ideas │  │ skills,   │  │ against   │
   └────┬────┘  │ interests │  │ 5 visa    │
        │       │  + sector │  │ criteria  │
        ▼       └─────┬─────┘  └─────┬─────┘
   ┌─────────┐        │              │
   │  View   │        ▼              ▼
   │  Idea   │  ┌───────────┐  ┌───────────┐
   │ Report  │  │ Claude AI │  │  Verdict: │
   │ (Score, │  │ generates │  │  PASS /   │
   │  Market,│  │ 3-5 ideas │  │  BORDERLINE│
   │  Tech)  │  │ scored on │  │  / NOT     │
   └────┬────┘  │ 4 criteria│  │  READY    │
        │       └─────┬─────┘  └───────────┘
        │             │
        ▼             ▼
   ┌──────────────────────────────┐
   │      USER DASHBOARD          │
   │                              │
   │  • Save ideas                │
   │  • View saved collection     │
   │  • Run visa checks on ideas  │
   │  • Update profile & skills   │
   └──────────────────────────────┘
        │
        ▼
   ┌──────────────────────────────┐
   │     FUNDING TRACKER          │
   │                              │
   │  • Browse active competitions│
   │  • Filter by sector/status   │
   │  • See deadlines & amounts   │
   │  • Match ideas to funding    │
   └──────────────────────────────┘
```

---

## Data Freshness — How Data Stays Current

```
┌──────────────────────────────────────────────────────────┐
│                   BACKGROUND SCHEDULER                    │
│                    (APScheduler)                          │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  DAILY (every 24 hours):                                 │
│    • Scrape UK innovation news via RSS + Apify           │
│    • Update sector trend data                            │
│    • Check competition deadline alerts                   │
│                                                          │
│  WEEKLY (every 7 days):                                  │
│    • Scrape Innovate UK competitions via Apify           │
│    • Fetch funded projects from UKRI Gateway API         │
│                                                          │
│  MONTHLY (1st of each month):                            │
│    • Claude AI refreshes sector descriptions             │
│    • Claude AI generates new innovation ideas            │
│    • Claude AI creates trend summary reports             │
│                                                          │
│  DATA SOURCES:                                           │
│    • Apify Google Search Scraper → News + Competitions   │
│    • RSS Feeds → UKRI, Gov.uk, TechCrunch, Sifted       │
│    • UKRI Gateway to Research API → Funded projects      │
│    • Claude AI → Analysis, ideas, trend summaries        │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | React 18 + TypeScript | UI framework |
| | Vite | Build tool, dev server |
| | Tailwind CSS | Utility-first styling |
| | TanStack Query | Server state + caching |
| | Zustand | Client state (auth) |
| | Recharts | Charts + data viz |
| | Framer Motion | Animations |
| **Backend** | FastAPI | REST API framework |
| | SQLAlchemy 2.0 | ORM + database toolkit |
| | PostgreSQL | Primary database |
| | ChromaDB | Vector store for RAG |
| | APScheduler | Background job scheduling |
| | slowapi | Rate limiting |
| **AI/ML** | Claude (Anthropic) | Analysis + idea generation |
| | OpenAI | Text embeddings (1536-dim) |
| **Data** | Apify | Web scraping API |
| | RSS Feeds | News ingestion |
| | UKRI API | Funded projects |
| **Infra** | Docker | Containerization |
| | Fly.io | Deployment platform |
| | GitHub Actions | CI/CD pipeline |

---

## Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Python | 3.11+ | With pip |
| Node.js | 18+ | With npm |
| PostgreSQL | 15+ | Running locally on port 5432 |
| Git | 2.0+ | For version control |

**API Keys Required:**
- **Anthropic API key** — for Claude AI analysis ([get one](https://console.anthropic.com/))
- **OpenAI API key** — for text embeddings ([get one](https://platform.openai.com/))
- **Apify API key** (optional) — for web scraping ([get one](https://console.apify.com/))

---

## Local Development Setup

### 1. Clone the Repository

```bash
git clone https://github.com/YOUR_USERNAME/innovisa-ai.git
cd innovisa-ai
```

### 2. Create the PostgreSQL Database

```bash
psql -U postgres
CREATE DATABASE innovisa;
\q
```

### 3. Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv

# Activate it
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Copy and configure environment variables
cp .env.example .env
# Edit .env with your actual API keys and database credentials
```

**Generate a secret key:**
```bash
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

### 4. Initialize Database + Seed Data

```bash
# Create tables
python -c "from app.database import engine, Base; import app.models; Base.metadata.create_all(bind=engine)"

# Seed with sample data
python seed.py
```

This creates:
- 6 sectors (Health, IT, Ecommerce, Agriculture, IoT, Business)
- 43 innovation ideas with realistic scores
- 82 documents for the RAG corpus (with embeddings)
- 10 competitions (5 open, 3 upcoming, 2 closed)
- Test user: `test@innovisa.ai` / `InnoVisaTest2024!`

### 5. Start the Backend

```bash
python -m uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload
```

Verify at: http://localhost:8001/docs (Swagger UI)

### 6. Frontend Setup

```bash
cd ../frontend

# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Start dev server
npm run dev
```

Access at: http://localhost:3000

---

## Testing the Application

1. Open http://localhost:3000
2. **Dashboard** loads with 6 sector cards showing trends and funding
3. Click a **sector** to see top ideas with scores
4. Click an **idea** to view the full analysis report (scores, market, tech stack)
5. **Login** with `test@innovisa.ai` / `InnoVisaTest2024!`
6. **Generate Ideas** at `/generate` — enter skills and interests
7. **Visa Compliance** at `/visa-check` — paste an idea description (200+ chars)
8. **Funding Tracker** at `/funding` — browse open competitions
9. **Visa Resources** at `/visa-resources` — view endorsing bodies and timeline
10. **My Dashboard** at `/dashboard` — view saved ideas and settings

---

## API Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/v1/auth/register` | No | Create account |
| POST | `/api/v1/auth/login` | No | Get JWT tokens |
| POST | `/api/v1/auth/refresh` | No | Refresh access token |
| GET | `/api/v1/auth/me` | Yes | Current user profile |
| PUT | `/api/v1/auth/onboarding` | Yes | Update onboarding data |
| GET | `/api/v1/sectors` | No | List all sectors |
| GET | `/api/v1/sectors/:id` | No | Sector details |
| GET | `/api/v1/sectors/:id/ideas` | No | Paginated ideas for a sector |
| GET | `/api/v1/sectors/:id/trends` | No | 12-month trend data |
| GET | `/api/v1/ideas/:id` | No | Idea detail |
| POST | `/api/v1/ideas/generate` | Yes | Generate custom ideas via RAG + Claude |
| POST | `/api/v1/ideas/analyze` | Yes | Analyse an idea via Claude |
| POST | `/api/v1/ideas/save` | Yes | Save idea to dashboard |
| GET | `/api/v1/ideas/saved/list` | Yes | List saved ideas |
| DELETE | `/api/v1/ideas/saved/:id` | Yes | Remove saved idea |
| POST | `/api/v1/visa/compliance-check` | Yes | Check visa compliance |
| POST | `/api/v1/visa/generate-application` | Yes | Generate application draft |
| GET | `/api/v1/visa/success-stories` | No | Similar funded projects |
| GET | `/api/v1/funding/active-competitions` | No | Open competitions |
| GET | `/api/v1/funding/deadlines` | No | Upcoming deadlines |
| POST | `/api/v1/funding/match` | Yes | Match idea to competitions |
| POST | `/api/v1/research/search` | No | RAG hybrid search |
| GET | `/api/v1/research/citations/:id` | No | Full source document |
| POST | `/api/v1/admin/scrape/trigger` | Yes | Trigger scraping jobs |
| GET | `/api/v1/admin/scrape/status` | Yes | Background job status |
| GET | `/api/v1/admin/analytics` | Yes | System analytics |
| GET | `/api/v1/health` | No | Health check |

---

## Deployment to Fly.io — Complete Guide

### Step 1: Install Fly CLI

```bash
# Windows (PowerShell)
powershell -Command "iwr https://fly.io/install.ps1 -useb | iex"

# macOS
brew install flyctl

# Linux
curl -L https://fly.io/install.sh | sh
```

### Step 2: Login to Fly.io

```bash
fly auth login
```

### Step 3: Create a PostgreSQL Database on Fly

```bash
fly postgres create --name innovisa-db --region lhr --vm-size shared-cpu-1x --volume-size 1
```

Save the connection string that Fly outputs.

### Step 4: Deploy the Backend

```bash
cd backend

# Create the app on Fly
fly apps create innovisa-ai-api --machines

# Set environment secrets (use YOUR actual keys)
fly secrets set \
  DATABASE_URL="postgres://YOUR_FLY_DB_CONNECTION_STRING" \
  ANTHROPIC_API_KEY="sk-ant-your-key" \
  OPENAI_API_KEY="sk-your-key" \
  SECRET_KEY="$(python -c 'import secrets; print(secrets.token_urlsafe(48))')" \
  ALGORITHM="HS256" \
  ACCESS_TOKEN_EXPIRE_MINUTES="60" \
  REFRESH_TOKEN_EXPIRE_DAYS="7" \
  FRONTEND_URL="https://innovisa-ai-web.fly.dev" \
  APIFY_API_KEY="your-apify-key" \
  -a innovisa-ai-api

# Create a volume for ChromaDB persistence
fly volumes create innovisa_data --size 1 --region lhr -a innovisa-ai-api

# Deploy
fly deploy -a innovisa-ai-api
```

### Step 5: Initialize the Database

```bash
# SSH into the backend machine
fly ssh console -a innovisa-ai-api

# Inside the machine, run:
python -c "from app.database import engine, Base; import app.models; Base.metadata.create_all(bind=engine)"
python seed.py
exit
```

### Step 6: Deploy the Frontend

```bash
cd ../frontend

# Create the app on Fly
fly apps create innovisa-ai-web --machines

# Deploy
fly deploy -a innovisa-ai-web
```

### Step 7: Verify Deployment

```
Backend:  https://innovisa-ai-api.fly.dev/api/v1/health
Frontend: https://innovisa-ai-web.fly.dev
```

### Step 8: Set Up GitHub CI/CD (Optional)

```bash
# Generate a Fly API token
fly tokens create deploy -x 999999h

# Add to GitHub repo secrets:
# Settings → Secrets → Actions → New repository secret
# Name: FLY_API_TOKEN
# Value: (paste the token)
```

Now every push to `main` auto-deploys both backend and frontend.

---

## Deployment Cost Estimate (Fly.io)

| Service | Spec | Est. Monthly Cost |
|---------|------|-------------------|
| Backend VM | shared-cpu-1x, 512MB RAM | $3-5 |
| Frontend VM | shared-cpu-1x, 256MB RAM | $2-3 |
| PostgreSQL | shared-cpu-1x, 1GB disk | $0 (free tier) |
| ChromaDB Volume | 1GB persistent | $0.15 |
| **Hosting Total** | | **~$5-8/month** |

| API | Usage | Est. Monthly Cost |
|-----|-------|-------------------|
| OpenAI Embeddings | ~1000 embeddings/month | $0.10-0.50 |
| Claude AI | ~50-200 analyses/month | $1-5 |
| Apify | ~100 scraping runs/month | $0 (free tier 100 runs) |
| **API Total** | | **~$1-6/month** |

**Total estimated cost: $6-14/month** for low-to-moderate traffic.

---

## Project Structure

```
innovisa-ai/
├── .github/
│   └── workflows/
│       └── deploy.yml              # CI/CD: auto-deploy to Fly.io on push
├── backend/
│   ├── app/
│   │   ├── main.py                 # FastAPI app, middleware, admin endpoints
│   │   ├── config.py               # Environment settings (Pydantic)
│   │   ├── database.py             # SQLAlchemy engine, session, Base
│   │   ├── models.py               # 7 ORM models with enums and indexes
│   │   ├── schemas.py              # Pydantic v2 request/response schemas
│   │   ├── dependencies.py         # JWT, password hashing, auth deps
│   │   ├── rag_engine.py           # ChromaDB, embeddings, hybrid search, Claude
│   │   ├── scraper.py              # Apify + RSS + UKRI API scrapers
│   │   ├── tasks.py                # APScheduler background jobs
│   │   └── routers/
│   │       ├── auth.py             # Register, login, refresh, profile
│   │       ├── sectors.py          # Sector list, details, trends, paginated ideas
│   │       ├── ideas.py            # Idea detail, generation, analysis, save/unsave
│   │       ├── visa.py             # Compliance check, application draft
│   │       ├── funding.py          # Competitions, deadlines, matching
│   │       └── research.py         # RAG search, citations
│   ├── seed.py                     # Database seeding script
│   ├── requirements.txt            # Python dependencies
│   ├── Dockerfile                  # Backend container
│   ├── fly.toml                    # Fly.io backend config
│   ├── .env.example                # Environment variable template
│   └── .dockerignore
├── frontend/
│   ├── src/
│   │   ├── App.tsx                 # Routes with lazy loading
│   │   ├── main.tsx                # React root with providers
│   │   ├── components/
│   │   │   ├── Dashboard.tsx       # Sector grid, hero section
│   │   │   ├── SectorDetail.tsx    # Trends chart, paginated ideas
│   │   │   ├── IdeaReport.tsx      # Tabbed analysis (5 tabs)
│   │   │   ├── IdeaGenerator.tsx   # 3-step wizard + AI generation
│   │   │   ├── VisaCompliance.tsx  # Compliance checker with results
│   │   │   ├── VisaResources.tsx   # Guide: endorsing bodies, timeline, links
│   │   │   ├── FundingTracker.tsx  # Competition browser with filters
│   │   │   ├── UserDashboard.tsx   # Saved ideas, analyses, settings
│   │   │   ├── Navbar.tsx          # Responsive nav with dark mode
│   │   │   └── Footer.tsx          # Links, resources, legal
│   │   ├── pages/
│   │   │   ├── Login.tsx
│   │   │   └── Register.tsx
│   │   ├── lib/
│   │   │   ├── api.ts              # Axios client with interceptors
│   │   │   └── utils.ts            # Formatting + utility helpers
│   │   ├── hooks/
│   │   │   └── useAuth.ts          # Zustand auth store
│   │   └── styles/
│   │       └── globals.css         # Tailwind + CSS variables
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   ├── Dockerfile                  # Frontend container (nginx)
│   ├── nginx.conf                  # Nginx config with API proxy
│   ├── fly.toml                    # Fly.io frontend config
│   ├── .env.example
│   └── .dockerignore
├── .gitignore
├── .dockerignore
├── LICENSE                         # MIT License
├── CONTRIBUTING.md                 # Contribution guidelines
└── README.md                       # This file
```

---

## Security Features

- **JWT Authentication** with access (1h) + refresh (7d) tokens and unique `jti` claims
- **bcrypt** password hashing with strong validation (uppercase, lowercase, digit, special char)
- **Rate limiting** on all auth endpoints (5/min login, 10/min refresh) and admin (5/min trigger)
- **Security headers**: `X-Content-Type-Options`, `X-Frame-Options`, `X-XSS-Protection`, `Referrer-Policy`, `Permissions-Policy`
- **GZip compression** on all API responses > 500 bytes
- **CORS** configured for specific origins only
- **Input validation** via Pydantic v2 on all endpoints
- **Parameterized SQL** queries (no SQL injection via SQLAlchemy ORM)

---

## Troubleshooting

**Backend won't start:**
- Check PostgreSQL is running: `pg_isready`
- Verify `DATABASE_URL` in `.env` matches your PostgreSQL credentials
- Ensure all pip packages installed: `pip install -r requirements.txt`

**Seed script fails on embeddings:**
- Documents are saved but without embeddings — set a valid `OPENAI_API_KEY` and re-run

**Frontend shows API errors:**
- Ensure backend is running on port 8001
- Check that `frontend/.env` has `VITE_API_URL=http://localhost:8001`
- Check that `vite.config.ts` proxy target matches backend port

**Port already in use:**
```bash
# Find what's using the port
netstat -ano | findstr :8001

# Kill the process
taskkill /PID <PID> /F
```

**Fly.io deployment fails:**
- Ensure you're logged in: `fly auth login`
- Check logs: `fly logs -a innovisa-ai-api`
- Verify secrets are set: `fly secrets list -a innovisa-ai-api`

---

## Contributing

We welcome contributions! Please read [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

This project is licensed under the MIT License — see [LICENSE](LICENSE) for details.

## Disclaimer

This application provides AI-generated insights for **research and exploration purposes only**. It does not constitute legal, immigration, or professional advice. Always consult a qualified immigration solicitor or endorsing body before making visa application decisions.
