# ALIA Avatar - VITAL SA

**Intelligent Conversational Avatar for Pharmaceutical Sales Training**

> An AI-powered conversational avatar for training medical representatives and conducting commercial presentations in the pharmaceutical sector.

---

## 🎯 Overview

ALIA is designed for **VITAL SA** (Tunisian pharmaceutical company) to:

1. **Train medical representatives** by simulating realistic doctor/pharmacist interactions
2. **Present products** in commercial mode with real-time feedback
3. **Track progression** through 4 competence levels (Débutant → Expert)
4. **Generate CRM reports** automatically after each session

---

## 🏗 Architecture

```
┌─────────────────────────────────────────────────┐
│                   Frontend (Next.js)             │
│  Chat UI + Dashboard + Avatar Display            │
└────────────────────┬────────────────────────────┘
                     │ REST / WebSocket
┌────────────────────┼────────────────────────────┐
│              Backend (FastAPI)                    │
│  ┌──────────────────────────────────────┐       │
│  │  Conversation Orchestrator            │       │
│  │  • Visit Flow FSM (6 steps)           │       │
│  │  • Level System (4 levels)            │       │
│  │  • Doctor Profiles (4 styles+SONCAS)  │       │
│  ├──────────────────────────────────────┤       │
│  │  AI Engine                            │       │
│  │  • LLM (GPT-4)  • RAG (ChromaDB)     │       │
│  │  • Intent Detection  • Sentiment      │       │
│  ├──────────────────────────────────────┤       │
│  │  Integrations                         │       │
│  │  • TTS (ElevenLabs) • STT (Whisper)  │       │
│  │  • Avatar (HeyGen) • CRM (PostgreSQL) │       │
│  └──────────────────────────────────────┘       │
└──────────────────────────────────────────────────┘
```

---

## 📁 Project Structure

```
alia-avatar/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI entry point
│   │   ├── config.py            # Configuration
│   │   ├── api/
│   │   │   ├── routes.py        # Core API routes
│   │   │   └── dashboard.py     # Dashboard analytics
│   │   ├── conversation/
│   │   │   ├── visit_flow.py    # 6-step visit FSM
│   │   │   ├── orchestrator.py  # Conversation orchestrator
│   │   │   └── routes.py        # WebSocket routes
│   │   ├── ai/
│   │   │   ├── llm_engine.py    # LLM + intent/sentiment
│   │   │   └── rag.py           # RAG pipeline
│   │   ├── evaluation/
│   │   │   └── scorer.py        # Scoring & level progression
│   │   ├── products/
│   │   │   └── parser.py        # Product catalog parser
│   │   ├── crm/
│   │   │   └── connector.py     # CRM database connector
│   │   └── avatar/
│   │       ├── tts.py           # Text-to-Speech
│   │       └── video.py         # Avatar video generation
│   ├── data/
│   │   ├── raw/                 # Original PPTX catalogs
│   │   └── processed/           # Parsed JSON data
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx         # Main page
│   │   │   ├── layout.tsx       # Root layout
│   │   │   └── globals.css      # Global styles
│   │   └── components/
│   │       ├── ChatInterface.tsx # Main chat UI
│   │       ├── SetupPanel.tsx    # Session configuration
│   │       └── Dashboard.tsx     # Analytics dashboard
│   ├── package.json
│   └── Dockerfile
├── docker-compose.yml
└── README.md
```

---

## 🚀 Quick Start

### Prerequisites

- Docker & Docker Compose
- OpenAI API key
- (Optional) ElevenLabs API key for TTS
- (Optional) HeyGen API key for avatar video

### 1. Clone & Setup

```bash
git clone <repository>
cd alia-avatar
```

### 2. Configure Environment

```bash
cp backend/.env.example backend/.env
# Edit backend/.env with your API keys
```

### 3. Start with Docker

```bash
docker-compose up -d
```

### 4. Access

- **Frontend:** http://localhost:3000
- **Backend API:** http://localhost:8000
- **API Docs:** http://localhost:8000/docs

---

## 🔧 Manual Setup (without Docker)

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate  # or venv\Scripts\activate on Windows
pip install -r requirements.txt
python -m spacy download fr_core_news_md

# Start PostgreSQL and ChromaDB, then:
uvicorn app.main:app --reload
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

---

## 📖 Usage

### Training Mode

1. Select **Training** mode
2. Choose a competence level (Débutant → Expert)
3. Select visit format (Flash / Standard / Approfondie)
4. Pick a product and doctor style
5. Start the session and practice your visit
6. Receive real-time scoring and feedback

### Commercial Mode

1. Select **Commercial** mode
2. Choose the product to present
3. Present to the simulated doctor
4. Get a CRM report after the session

### Visit Flow (6 Steps)

```
1. Introduction → Get permission
2. Sondage → Understand needs (2-4 questions)
3. Synthèse → Validate understanding (QARE)
4. Objections → Handle resistance (A-C-R-V)
5. Argumentation → Need → Benefits → Proof → Usage
6. Conclusion → Get commitment (BIP)
```

---

## 🎓 Competence Levels

| Level | Score | Requirements |
|-------|-------|-------------|
| **Débutant** | ≥ 7.0 | Structured visit, basic product knowledge |
| **Junior** | ≥ 8.0 | Interactive, A-C-R-V objections, CRM complete |
| **Confirmé** | ≥ 9.0 | Adapts to style, difficult visits, long cycle |
| **Expert** | ≥ 9.5 | Top performer, coaching, full portfolio |

---

## 🏥 Doctor Profiles

| Style | Trait | Adaptation |
|-------|-------|-----------|
| **Analysant** | Proof-oriented | Data, studies, evidence |
| **Controlant** | Structure-oriented | Clear process, organization |
| **Facilitant** | Relationship-oriented | Rapport, trust, listening |
| **Promouvant** | Innovation-oriented | Novelty, new approaches |

---

## 📊 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/session/start` | Start a new session |
| POST | `/api/v1/chat` | Send a message |
| GET | `/api/v1/session/{id}` | Get session details |
| GET | `/api/v1/session/{id}/history` | Get conversation history |
| GET | `/api/v1/sessions` | List all sessions |
| GET | `/api/v1/products` | List products |
| GET | `/api/v1/levels` | List competence levels |
| GET | `/api/v1/formats` | List visit formats |
| GET | `/api/v1/dashboard/stats` | Dashboard statistics |
| WS | `/ws/{session_id}` | WebSocket for real-time chat |

---

## 📈 Evaluation Phases

| Phase | Weeks | Deliverable |
|-------|-------|-------------|
| **Phase 1** | W1-W3 | Business understanding, SMART objectives, architecture |
| **Phase 2** | W4-W6 | Data parsing, RAG pipeline, product catalog, CRM schema |
| **Phase 3** | W7-W11 | Conversation engine, AI models, TTS/STT, avatar integration |
| **Phase 4** | W12-W14 | Deployment, dashboard, commercial video, marketing assets |

---

## 🛠 Technologies

| Layer | Technology |
|-------|-----------|
| Backend | FastAPI (Python) |
| Frontend | Next.js (TypeScript) |
| LLM | OpenAI GPT-4 |
| Vector DB | ChromaDB (pgvector) |
| TTS | ElevenLabs |
| STT | OpenAI Whisper |
| Avatar | HeyGen / D-ID |
| Database | PostgreSQL (Sequelize) |
| NLU | spaCy + custom classifiers |
| Deployment | Docker |

---

## 📋 Data Sources

- **Product Catalog:** 21 gamme PPTX files (VITAL SA)
- **Scripts:** Top sellers scripts (PDF)
- **Visit Process:** 6-step VITAL SA method
- **Competency Levels:** 4-level referential
- **CRM Database:** Sequelize models (MySQL)

---

## ⚠️ Compliance Rules

1. **NEVER** invent medical data or make unverified claims
2. **NEVER** promise patient results
3. **NEVER** cite uncertain studies
4. **ALWAYS** refer to official product information
5. If uncertain: "Let me verify and come back with a confirmed answer"

---

## 📝 License

This project is part of the ESPRIT Data Science Project Module (PI-DS 2025/2026).

---

*Built with ❤️ for VITAL SA by the ALIA Team*
