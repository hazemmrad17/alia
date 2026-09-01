# ALIA Avatar — Project Overview

> Source : `Students/PresProjetsDS_2526.pdf` (Project 5: Avatar)

---

## Context

This project aims to design an **intelligent conversational avatar**, embodied in the form of realistic video or professional 3D modeling, intended for the **pharmaceutical and medical sectors**.

The solution covers the **entire value cycle**, from training medical representatives to real-time commercial interaction with healthcare professionals, while ensuring complete traceability via CRM systems.

## Two Complementary Modes

### 1. Training Mode
The avatar plays the role of a **simulated doctor or pharmacist**.
- Reps practice their pitch in a safe environment
- AI evaluates performance against the 6-step visit process
- Progression through 4 competency levels (Débutant → Expert)
- Real-time feedback on objections, argumentation, closing

### 2. Commercial Mode
The avatar acts as a **virtual presenter of medical products**.
- Presents product catalogs to healthcare professionals
- Answers questions about indications, composition, posologie
- Generates CRM reports automatically
- Multi-format: Flash (20s), Standard (2-4min), Approfondie (5-8min)

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | FastAPI + Python |
| LLM | Groq (llama-3.3-70b) / Claude fallback |
| RAG | ChromaDB (vector store) |
| Database | PostgreSQL (pgvector) |
| Frontend | Next.js + Tailwind CSS |
| Avatar Video | HeyGen / D-ID |
| TTS/STT | ElevenLabs / OpenAI Whisper |
| Deployment | Docker Compose |

## Project Team

- 5-6 students per team
- TDSP methodology (Team Data Science Process)
- 14 weeks / 84 hours (42h tutored + 42h non-tutored)

## Module Info

- **Code :** INFPDS4009
- **ECTS :** 8
- **Coordinator :** Wiem Trabelsi
- **Institution :** ESPRIT (École Supérieure Privée d'Ingénierie et de Technologie)
