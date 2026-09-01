# ALIA Avatar — Full Implementation Plan

> Current state: Skeleton code exists, data is extracted, ChromaDB has 628 documents.
> Goal: Working MVP that can run training sessions end-to-end.

---

## Phase 1: Make the Backend Run (Days 1-2)

### 1.1 Install Dependencies & Fix Config
```bash
cd backend
pip install -r requirements.txt
```

**What exists:** `requirements.txt` with all deps, `.env.example` with config template
**What to do:**
- Create `.env` from `.env.example` with your Groq API key
- Verify all imports resolve
- Test `uvicorn app.main:app --reload` starts without errors

**Files:** `backend/.env`, `backend/.env.example`, `backend/requirements.txt`

### 1.2 Test RAG Pipeline
```bash
python -c "from app.ai.rag import rag_pipeline; rag_pipeline.initialize(); print(rag_pipeline.collection.count())"
```

**What exists:** `rag.py` with ChromaDB persistent client, `full_ingestion.py` with all data
**What to do:**
- Run `python -m app.products.full_ingestion` to populate ChromaDB
- Verify retrieval works: query for a product, doctor, objection
- Test `build_rag_context()` returns useful context

**Files:** `backend/app/ai/rag.py`, `backend/app/products/full_ingestion.py`

### 1.3 Test LLM Engine
```bash
python -c "
from app.ai.llm_engine import LLMEngine
llm = LLMEngine()
print(llm._chat_completion([{'role': 'user', 'content': 'Bonjour'}]))
"
```

**What exists:** `llm_engine.py` with Groq/Anthropic/OpenAI providers
**What to do:**
- Set `GROQ_API_KEY` in `.env`
- Test single completion
- Test system prompt building
- Test intent/sentiment detection

**Files:** `backend/app/ai/llm_engine.py`

---

## Phase 2: Wire Everything Together (Days 3-4)

### 2.1 Test Conversation Orchestrator
```bash
python -c "
import asyncio
from app.conversation.orchestrator import orchestrator
from app.models.schemas import StartSessionRequest, ConversationMode, CompetenceLevel, VisitFormat

async def test():
    req = StartSessionRequest(
        mode=ConversationMode.TRAINING,
        level=CompetenceLevel.JUNIOR,
        visit_format=VisitFormat.STANDARD,
        product_focus='FERBIOTIC',
    )
    resp = await orchestrator.start_session(req)
    print(f'Session: {resp.session_id}')
    print(f'Greeting: {resp.greeting[:200]}')

    from app.models.schemas import ConversationRequest
    msg = ConversationRequest(session_id=resp.session_id, message='Bonjour Docteur, je suis Alia de VITAL SA.')
    reply = await orchestrator.send_message(msg)
    print(f'Reply: {reply.message[:200]}')

asyncio.run(test())
"
```

**What exists:** `orchestrator.py` with full session management, `visit_flow.py` with FSM
**What to do:**
- Test session creation with different modes/levels/formats
- Test full conversation flow (6 steps)
- Verify step transitions work correctly
- Test Flash/Standard/Approfondie modes

**Files:** `backend/app/conversation/orchestrator.py`, `backend/app/conversation/visit_flow.py`

### 2.2 Test Scoring System
```bash
python -c "
from app.evaluation.scorer import VisitScorer
scorer = VisitScorer()
print('Scorer initialized OK')
"
```

**What exists:** `scorer.py` with step scoring, CRM report generation
**What to do:**
- Test scoring after a complete session
- Verify CRM report generation
- Check level progression thresholds work

**Files:** `backend/app/evaluation/scorer.py`

### 2.3 Test API Routes
```bash
curl http://localhost:8000/health
curl http://localhost:8000/api/v1/products
curl http://localhost:8000/api/v1/doctors
```

**What exists:** `api/routes.py` with REST endpoints
**What to do:**
- Verify all endpoints respond
- Test session creation via API
- Test chat via API
- Test dashboard endpoints

**Files:** `backend/app/api/routes.py`, `backend/app/api/dashboard.py`

---

## Phase 3: Build the Frontend (Days 5-8)

### 3.1 Setup Next.js
```bash
cd frontend
npm install
npm run dev
```

**What exists:** `package.json` with Next.js + Tailwind, basic layout
**What to do:**
- Install dependencies
- Configure API proxy to backend (localhost:8000)
- Test dev server starts

**Files:** `frontend/package.json`, `frontend/next.config.js`

### 3.2 Build Landing Page
**What exists:** `page.tsx` with hero section
**What to do:**
- Add project description and features
- Add "Start Training" and "Commercial Mode" buttons
- Style with Tailwind

**Files:** `frontend/src/app/page.tsx`

### 3.3 Build Setup Panel (Session Config)
**What exists:** `SetupPanel.tsx` with mode/level/format selection
**What to do:**
- Wire to API (POST /api/v1/sessions)
- Add product selection dropdown (from API)
- Add doctor profile customization
- Add level/format/mode selectors

**Files:** `frontend/src/components/SetupPanel.tsx`

### 3.4 Build Chat Interface
**What exists:** `ChatInterface.tsx` with message list
**What to do:**
- Wire to WebSocket or polling API
- Add step progress bar (6 steps visualization)
- Add typing indicator
- Add score display (live scoring)
- Add session controls (pause, end, restart)

**Files:** `frontend/src/components/ChatInterface.tsx`

### 3.5 Build Dashboard
**What exists:** `Dashboard.tsx` with stats cards
**What to do:**
- Wire to dashboard API endpoints
- Add session history table
- Add level progression chart
- Add product performance stats

**Files:** `frontend/src/components/Dashboard.tsx`

---

## Phase 4: Polish & Deploy (Days 9-10)

### 4.1 Docker Compose
```bash
docker-compose up -d
```

**What exists:** `docker-compose.yml` with PostgreSQL, ChromaDB, FastAPI, Next.js
**What to do:**
- Fix paths in docker-compose.yml (currently points to old alia-avatar/)
- Test all services start correctly
- Test networking between services

**Files:** `docker-compose.yml`, `backend/Dockerfile`, `frontend/Dockerfile`

### 4.2 Integration Testing
- Run a full training session end-to-end
- Test all 3 visit formats (Flash, Standard, Approfondie)
- Test all 4 competence levels
- Verify scoring works correctly
- Verify CRM reports are generated

### 4.3 README & Documentation
**What exists:** `README.md` with basic setup
**What to do:**
- Update paths (remove alia-avatar/ references)
- Add API documentation
- Add architecture diagram
- Add development guide

---

## File Structure (Target)

```
alia/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py              ← FastAPI app (✅ exists, needs testing)
│   │   ├── config.py            ← Settings (✅ exists, needs .env)
│   │   ├── ai/
│   │   │   ├── llm_engine.py    ← LLM provider routing (✅ exists, needs API key)
│   │   │   └── rag.py           ← ChromaDB RAG (✅ exists, needs data)
│   │   ├── conversation/
│   │   │   ├── orchestrator.py  ← Session management (✅ exists, needs testing)
│   │   │   ├── visit_flow.py    ← 6-step FSM (✅ exists, needs testing)
│   │   │   └── routes.py        ← WebSocket endpoints (⚠️ needs implementation)
│   │   ├── evaluation/
│   │   │   └── scorer.py        ← Scoring system (✅ exists, needs testing)
│   │   ├── api/
│   │   │   ├── routes.py        ← REST endpoints (⚠️ needs implementation)
│   │   │   └── dashboard.py     ← Analytics (⚠️ needs implementation)
│   │   ├── crm/
│   │   │   ├── schema.py        ← SQLAlchemy models (✅ just created)
│   │   │   └── connector.py     ← DB connection (⚠️ needs implementation)
│   │   ├── products/
│   │   │   ├── full_ingestion.py ← Data pipeline (✅ exists, works)
│   │   │   ├── medtn_scraper.py  ← Doctor scraper (✅ exists, works)
│   │   │   └── llm_extract_v2.py ← LLM extraction (✅ exists, works)
│   │   ├── models/
│   │   │   └── schemas.py       ← Pydantic schemas (✅ exists)
│   │   └── avatar/
│   │       ├── tts.py           ← Text-to-speech (⚠️ needs implementation)
│   │       └── video.py         ← Avatar video (⚠️ needs implementation)
│   ├── data/
│   │   ├── processed/           ← JSON data files (✅ exists)
│   │   ├── raw/                 ← PPTX source files (✅ exists)
│   │   └── vector_store/        ← ChromaDB persistence (✅ exists)
│   ├── tests/                   ← Empty (needs tests)
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── layout.tsx
│   │   │   └── page.tsx         ← Landing page (⚠️ needs improvement)
│   │   └── components/
│   │       ├── SetupPanel.tsx   ← Session config (⚠️ needs API wiring)
│   │       ├── ChatInterface.tsx ← Chat UI (⚠️ needs API wiring)
│   │       └── Dashboard.tsx    ← Analytics (⚠️ needs API wiring)
│   ├── package.json
│   └── Dockerfile
├── docs/                        ← 9 markdown reference docs (✅ exists)
├── docker-compose.yml           ← Deployment config (⚠️ needs path fixes)
└── README.md                    ← Documentation (⚠️ needs update)
```

## Priority Order

| Priority | Task | Effort | Impact |
|----------|------|--------|--------|
| 🔴 P0 | Make backend start (`uvicorn`) | 1h | Unblocks everything |
| 🔴 P0 | Test RAG retrieval | 1h | Core functionality |
| 🔴 P0 | Test LLM completion | 1h | Core functionality |
| 🔴 P0 | Test orchestrator end-to-end | 2h | Core functionality |
| 🟡 P1 | Implement REST API routes | 3h | Frontend needs this |
| 🟡 P1 | Build frontend chat UI | 4h | User-facing |
| 🟡 P1 | Wire frontend to backend | 2h | Integration |
| 🟢 P2 | Add scoring/evaluation | 2h | Training value |
| 🟢 P2 | Add CRM integration | 3h | Business value |
| 🟢 P2 | Docker deployment | 2h | Production |
| ⚪ P3 | TTS/STT integration | 4h | Nice to have |
| ⚪ P3 | Avatar video integration | 5h | Nice to have |
| ⚪ P3 | Tests | 3h | Quality |
