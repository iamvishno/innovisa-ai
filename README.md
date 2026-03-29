<div align="center">

# InnoVisa AI

### Discover Fundable UK Innovation Ideas with AI

**AI-powered platform helping international founders discover, validate, and fund UK Innovator Founder Visa project ideas**

[**Live Demo**](https://innovisa-ai-web.fly.dev/) | [**API Docs**](https://innovisa-ai-api.fly.dev/docs) | [**Contributing**](CONTRIBUTING.md)

[![Live on Fly.io](https://img.shields.io/badge/LIVE-innovisa--ai--web.fly.dev-00C853?style=for-the-badge&logo=fly-dot-io&logoColor=white)](https://innovisa-ai-web.fly.dev/)

[![MIT License](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](LICENSE)
[![Python 3.11+](https://img.shields.io/badge/Python-3.11+-3776AB.svg?style=flat-square&logo=python&logoColor=white)](https://www.python.org/)
[![React 18](https://img.shields.io/badge/React-18-61DAFB.svg?style=flat-square&logo=react&logoColor=black)](https://react.dev/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688.svg?style=flat-square&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6.svg?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Fly.io](https://img.shields.io/badge/Deploy-Fly.io-8B5CF6.svg?style=flat-square&logo=fly-dot-io&logoColor=white)](https://fly.io/)

</div>

---

## What is InnoVisa AI?

InnoVisa AI is a **Retrieval-Augmented Generation (RAG)** application that helps international founders navigate the UK Innovator Founder Visa pathway. It combines real-time UK innovation data with Claude AI to generate, analyse, and validate startup ideas against actual visa endorsement criteria.

| Feature | Description |
|---------|-------------|
| **Idea Generation** | Claude AI generates tailored project ideas based on your skills, interests, and chosen sector |
| **Visa Compliance Check** | AI evaluates ideas against the 5 official endorsement criteria (innovation, viability, scalability) |
| **RAG-Powered Research** | Hybrid search across 80+ real UK funded projects, policy documents, and research papers |
| **Funding Tracker** | Browse active Innovate UK competitions with deadlines, amounts, and sector matching |
| **Sector Intelligence** | Live dashboards for 6 UK priority sectors with trend data and funding levels |
| **Visa Resources Guide** | Complete guide to endorsing bodies, application timeline, and assessment criteria |

---

## Live Application

> **Try it now:** [**https://innovisa-ai-web.fly.dev/**](https://innovisa-ai-web.fly.dev/)

**Demo credentials:**

| Email | Password |
|-------|----------|
| `test@innovisa.ai` | `InnoVisaTest2024!` |

**Endpoints:**

| Service | URL |
|---------|-----|
| Frontend | [innovisa-ai-web.fly.dev](https://innovisa-ai-web.fly.dev/) |
| Backend API | [innovisa-ai-api.fly.dev](https://innovisa-ai-api.fly.dev/api/v1/health) |
| Swagger Docs | [innovisa-ai-api.fly.dev/docs](https://innovisa-ai-api.fly.dev/docs) |

---

## System Architecture

```
                              USERS
                          (Browser / Mobile)
                                |
                                | HTTPS
                                v
                 +------------------------------+
                 |     FRONTEND  (Fly.io)       |
                 |     React + Nginx            |
                 |  innovisa-ai-web.fly.dev     |
                 +------------------------------+
                                |
                                | /api/* proxy
                                v
+----------------------------------------------------------------+
|                    BACKEND  (Fly.io)                            |
|                    FastAPI + Python 3.11                        |
|                  innovisa-ai-api.fly.dev                        |
|                                                                |
|   +------------------+    +------------------+                 |
|   |   API Routers    |    |  Auth & Security |                 |
|   |                  |    |                  |                 |
|   |  auth   sectors  |    |  JWT tokens      |                 |
|   |  ideas  visa     |    |  bcrypt hashing  |                 |
|   |  funding research|    |  rate limiting   |                 |
|   +--------+---------+    +------------------+                 |
|            |                                                   |
|   +--------v---------+    +------------------+                 |
|   |   RAG Engine     |    | Background Jobs  |                 |
|   |                  |    |  (APScheduler)   |                 |
|   |  Hybrid Search   |    |                  |                 |
|   |  Vector + FTS    |    |  Daily: news,    |                 |
|   |  RRF merge       |    |    trends        |                 |
|   |  Claude analysis |    |  Weekly: comps,  |                 |
|   +------+---+-------+    |    projects      |                 |
|          |   |             |  Monthly: Claude |                 |
|   +------v-+ +-v--------+ |    refresh       |                 |
|   |ChromaDB| |PostgreSQL | +------------------+                 |
|   |Vectors | |Data + FTS |                                     |
|   +--------+ +----------+                                      |
|                                                                |
|   External: Claude AI | OpenAI Embeddings | Apify | RSS | UKRI |
+----------------------------------------------------------------+
```

---

## User Workflow

```
  Visit Site           Browse Sectors         Register / Login
      |                     |                       |
      v                     v                       v
 +---------+         +------------+          +-------------+
 |Dashboard|-------->|  Sector    |          |  Generate   |
 | 6 sector|         |  Details   |          |  Ideas      |
 |  cards  |         |  + Trends  |          |  (AI-powered|
 +---------+         |  + Ideas   |          |   wizard)   |
                     +------+-----+          +------+------+
                            |                       |
                            v                       v
                     +------------+          +-------------+
                     |  Idea      |          | Visa        |
                     |  Report    |          | Compliance  |
                     |  (Scores,  |          | Check       |
                     |   Market,  |          | (5 criteria)|
                     |   Tech)    |          +------+------+
                     +------+-----+                 |
                            |                       v
                            v              +-----------------+
                     +-----------+         | User Dashboard  |
                     | Funding   |         | Save ideas,     |
                     | Tracker   |         | track progress  |
                     | (Active   |         +-----------------+
                     | comps)    |
                     +-----------+
```

---

## Data Freshness Strategy

InnoVisa AI keeps its data current through automated background jobs:

| Schedule | Jobs | Data Sources |
|----------|------|--------------|
| **Daily** | UK innovation news, sector trends, competition deadline alerts | RSS (UKRI, Gov.uk, TechCrunch, Sifted), Apify |
| **Weekly** | Active competitions, newly funded projects | Apify Google Search, UKRI Gateway to Research API |
| **Monthly** | Claude AI refreshes sector analysis, generates new ideas, creates trend summaries | Claude API |

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | React 18, TypeScript, Vite | UI framework + build |
| | Tailwind CSS, shadcn/ui | Styling + components |
| | TanStack Query, Zustand | Server state + client state |
| | Recharts, Framer Motion | Data visualization + animation |
| **Backend** | FastAPI, Python 3.11 | REST API framework |
| | SQLAlchemy 2.0, PostgreSQL | ORM + database |
| | ChromaDB | Vector store for RAG |
| | APScheduler | Background job scheduling |
| | SlowAPI | Rate limiting |
| **AI/ML** | Claude (Anthropic) | Analysis + idea generation |
| | OpenAI `text-embedding-3-large` | 1536-dim text embeddings |
| **Data** | Apify | Web scraping API |
| | RSS Feeds, UKRI API | News + funded projects |
| **Infrastructure** | Docker, Fly.io | Containers + hosting |
| | GitHub Actions | CI/CD pipeline |
| | Nginx | Frontend reverse proxy |

---

## Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Python | 3.11+ | With pip |
| Node.js | 18+ | With npm |
| PostgreSQL | 15+ | Running locally on port 5432 |
| Git | 2.0+ | Version control |

**API keys required:**
- [**Anthropic**](https://console.anthropic.com/) — Claude AI analysis
- [**OpenAI**](https://platform.openai.com/) — text embeddings
- [**Apify**](https://console.apify.com/) (optional) — web scraping

---

## Local Development Setup

### 1. Clone and enter the project

```bash
git clone https://github.com/YOUR_USERNAME/innovisa-ai.git
cd innovisa-ai
```

### 2. Create the PostgreSQL database

```bash
psql -U postgres -c "CREATE DATABASE innovisa;"
```

### 3. Set up the backend

```bash
cd backend
python -m venv venv

# Windows
venv\Scripts\activate

# macOS / Linux
source venv/bin/activate

pip install -r requirements.txt
cp .env.example .env
```

Edit `.env` with your API keys. Generate a secret key:

```bash
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

### 4. Seed the database

```bash
python seed.py
```

This creates 6 sectors, 43 ideas, 82 documents, 10 competitions, and a test user.

### 5. Start the backend

```bash
python -m uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload
```

Swagger UI at: http://localhost:8001/docs

### 6. Set up and start the frontend

```bash
cd ../frontend
npm install
cp .env.example .env
npm run dev
```

App at: http://localhost:3000

---

## API Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/api/v1/auth/register` | No | Create account |
| `POST` | `/api/v1/auth/login` | No | Get JWT tokens |
| `POST` | `/api/v1/auth/refresh` | No | Refresh access token |
| `GET` | `/api/v1/auth/me` | Yes | Current user profile |
| `PUT` | `/api/v1/auth/onboarding` | Yes | Update onboarding data |
| `GET` | `/api/v1/sectors` | No | List all sectors |
| `GET` | `/api/v1/sectors/:id` | No | Sector details |
| `GET` | `/api/v1/sectors/:id/ideas` | No | Paginated ideas |
| `GET` | `/api/v1/sectors/:id/trends` | No | 12-month trend data |
| `GET` | `/api/v1/ideas/:id` | No | Idea detail + scores |
| `POST` | `/api/v1/ideas/generate` | Yes | AI idea generation |
| `POST` | `/api/v1/ideas/analyze` | Yes | AI idea analysis |
| `POST` | `/api/v1/ideas/save` | Yes | Save idea |
| `GET` | `/api/v1/ideas/saved/list` | Yes | List saved ideas |
| `DELETE` | `/api/v1/ideas/saved/:id` | Yes | Remove saved idea |
| `POST` | `/api/v1/visa/compliance-check` | Yes | Visa compliance check |
| `POST` | `/api/v1/visa/generate-application` | Yes | Application draft |
| `GET` | `/api/v1/visa/success-stories` | No | Similar funded projects |
| `GET` | `/api/v1/funding/active-competitions` | No | Open competitions |
| `GET` | `/api/v1/funding/deadlines` | No | Upcoming deadlines |
| `POST` | `/api/v1/funding/match` | Yes | Match idea to funding |
| `POST` | `/api/v1/research/search` | No | RAG hybrid search |
| `GET` | `/api/v1/research/citations/:id` | No | Full source document |
| `POST` | `/api/v1/admin/scrape/trigger` | Yes | Trigger scraping |
| `GET` | `/api/v1/admin/scrape/status` | Yes | Job status |
| `GET` | `/api/v1/admin/analytics` | Yes | System analytics |
| `GET` | `/api/v1/health` | No | Health check |

---

## Deployment to Fly.io

### Quick deploy (if Fly CLI is installed)

```bash
# 1. Login
fly auth login

# 2. Create PostgreSQL
fly postgres create --name innovisa-db --region ams --vm-size shared-cpu-1x --volume-size 1

# 3. Deploy backend
cd backend
fly apps create innovisa-ai-api --machines
fly secrets set DATABASE_URL="..." ANTHROPIC_API_KEY="..." OPENAI_API_KEY="..." SECRET_KEY="..." FRONTEND_URL="https://innovisa-ai-web.fly.dev" -a innovisa-ai-api
fly volumes create innovisa_data --size 1 --region ams -a innovisa-ai-api
fly deploy -a innovisa-ai-api --remote-only

# 4. Seed production database
fly ssh console -a innovisa-ai-api -C "python seed.py"

# 5. Deploy frontend
cd ../frontend
fly apps create innovisa-ai-web --machines
fly deploy -a innovisa-ai-web --remote-only
```

### CI/CD with GitHub Actions

Every push to `main` auto-deploys both services:

```
Cursor IDE  -->  git push  -->  GitHub Actions  -->  Fly.io  -->  Live
```

**Setup:**

```bash
# Generate Fly API token
fly tokens create deploy -x 999999h

# Add to GitHub: Settings > Secrets > Actions > New secret
# Name: FLY_API_TOKEN
# Value: (paste token)
```

---

## Deployment Cost Estimate

| Service | Spec | Monthly Cost |
|---------|------|-------------|
| Backend VM | shared-cpu-1x, 1GB RAM | ~$5-7 |
| Frontend VM | shared-cpu-1x, 256MB RAM | ~$2-3 |
| PostgreSQL | shared-cpu-1x, 1GB disk | Free tier |
| ChromaDB Volume | 1GB persistent | $0.15 |
| OpenAI Embeddings | ~1000/month | $0.10-0.50 |
| Claude AI | ~50-200 analyses/month | $1-5 |
| Apify | ~100 runs/month | Free tier |
| **Total** | | **~$8-16/month** |

---

## Project Structure

```
innovisa-ai/
├── .github/workflows/deploy.yml     # CI/CD auto-deploy on push to main
├── backend/
│   ├── app/
│   │   ├── main.py                  # FastAPI app + middleware + admin
│   │   ├── config.py                # Pydantic settings
│   │   ├── database.py              # SQLAlchemy engine + session
│   │   ├── models.py                # 7 ORM models with enums
│   │   ├── schemas.py               # Request/response schemas
│   │   ├── dependencies.py          # JWT + password + auth
│   │   ├── rag_engine.py            # ChromaDB + embeddings + hybrid search
│   │   ├── scraper.py               # Apify + RSS + UKRI scrapers
│   │   ├── tasks.py                 # APScheduler background jobs
│   │   └── routers/                 # auth, sectors, ideas, visa, funding, research
│   ├── seed.py                      # Database seeding (sectors, ideas, docs, comps)
│   ├── requirements.txt
│   ├── Dockerfile
│   └── fly.toml
├── frontend/
│   ├── src/
│   │   ├── App.tsx                  # Routes with lazy loading
│   │   ├── components/              # Dashboard, IdeaReport, VisaCompliance, etc.
│   │   ├── pages/                   # Login, Register
│   │   ├── lib/api.ts               # Axios client + interceptors
│   │   └── hooks/useAuth.ts         # Zustand auth store
│   ├── Dockerfile
│   ├── nginx.conf                   # Reverse proxy to backend
│   └── fly.toml
├── LICENSE                          # MIT
├── CONTRIBUTING.md
└── README.md
```

---

## Security

| Feature | Implementation |
|---------|---------------|
| Authentication | JWT access (1h) + refresh (7d) tokens with unique `jti` claims |
| Password hashing | bcrypt with strong validation (upper, lower, digit, special char) |
| Rate limiting | Auth: 5/min login, 10/min refresh. Admin: 5/min |
| Security headers | X-Content-Type-Options, X-Frame-Options, X-XSS-Protection, Referrer-Policy, Permissions-Policy |
| Compression | GZip on responses > 500 bytes |
| CORS | Specific allowed origins only |
| Input validation | Pydantic v2 on all endpoints |
| SQL injection | Prevented via SQLAlchemy ORM parameterized queries |

---

## Troubleshooting

<details>
<summary><strong>Backend won't start</strong></summary>

- Check PostgreSQL is running: `pg_isready`
- Verify `DATABASE_URL` in `.env`
- Reinstall dependencies: `pip install -r requirements.txt`
</details>

<details>
<summary><strong>Frontend shows API errors</strong></summary>

- Ensure backend is running on port 8001
- Check `frontend/.env` has `VITE_API_URL=http://localhost:8001`
- Check `vite.config.ts` proxy target matches backend port
</details>

<details>
<summary><strong>Port already in use</strong></summary>

```bash
# Find process
netstat -ano | findstr :8001
# Kill it
taskkill /PID <PID> /F
```
</details>

<details>
<summary><strong>Fly.io deployment fails</strong></summary>

- Login: `fly auth login`
- Check logs: `fly logs -a innovisa-ai-api`
- Verify secrets: `fly secrets list -a innovisa-ai-api`
- Use `--remote-only` if local Docker builds fail
</details>

---

## Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on development workflow, commit conventions, and pull request process.

## License

This project is licensed under the [MIT License](LICENSE).

---

<div align="center">

**Built with Claude AI, FastAPI, React, and real UK innovation data.**

[**Try the Live App**](https://innovisa-ai-web.fly.dev/)

</div>

---

> **Disclaimer:** This application provides AI-generated insights for research and exploration purposes only. It does not constitute legal, immigration, or professional advice. Always consult a qualified immigration solicitor or endorsed body before making visa application decisions.
