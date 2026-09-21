# ALIA Avatar — User Stories Summary

> Two complementary modes, two different personas, one intelligent avatar.

---

## Quick Reference

| | 🎓 Medical Delegate | 💊 Doctor / Pharmacist |
|---|---|---|
| **Mode** | Training (Entraînement) | Commercial (Présentation) |
| **Who** | VITAL SA sales rep | Healthcare professional |
| **ALIA plays** | Simulated doctor | Product presenter |
| **Goal** | Practice & improve technique | Learn about products |
| **Scoring** | ✅ Yes (step-by-step) | ❌ No (engagement only) |
| **Levels** | ✅ Débutant → Expert | ❌ None |
| **Doctor personality** | ✅ 4 styles + SONCAS | ❌ Not applicable |
| **Product selection** | Optional | Required |
| **CRM report** | Evaluation report | Visit report + follow-up |
| **Docs** | [Detailed](./10-user-story-medical-delegate.md) | [Detailed](./11-user-story-doctor.md) |

---

## Visual Flow

### Medical Delegate (Training)
```
Landing Page
  └─ Click "I'm a Medical Delegate"
       └─ Training Setup
            ├─ Select level (Débutant/Junior/Confirmé/Expert)
            ├─ Select doctor personality (Analysant/Controlant/Facilitant/Promouvant)
            ├─ Select visit format (Flash/Standard/Approfondie)
            └─ Start Session
                 └─ Chat with simulated doctor
                      ├─ 6-step visit process
                      ├─ Real-time scoring
                      └─ Session report → Score + Strengths + Improvements
```

### Doctor / Pharmacist (Commercial)
```
Landing Page
  └─ Click "I'm a Doctor / Pharmacist"
       └─ Commercial Setup
            ├─ Select product from VITAL SA catalog (100+ products)
            ├─ Select visit format (Flash/Standard/Approfondie)
            └─ Start Session
                 └─ Receive product presentation from ALIA
                      ├─ ALIA asks discovery questions
                      ├─ ALIA presents product info
                      ├─ I ask questions
                      └─ Session report → CRM report + follow-up plan
```

---

## The 6-Step Visit Process (Training Mode)

Both modes use the same underlying visit structure, but the *perspective* changes:

| Step | Medical Delegate sees | Doctor sees |
|------|----------------------|-------------|
| 1. 👋 Introduction | "I need to get permission" | "ALIA greets me politely" |
| 2. 🔍 Sondage | "I ask discovery questions" | "ALIA asks about my practice" |
| 3. 📝 Synthèse | "I reformulate their needs" | "ALIA summarizes what it understood" |
| 4. 🛡️ Objections | "I handle resistance (A-C-R-V)" | "I ask tough questions" |
| 5. 🎯 Argumentation | "I present product benefits" | "ALIA presents product info" |
| 6. 🤝 Conclusion | "I get a micro-engagement" | "ALIA proposes a trial plan" |

---

## Doctor Personality Styles (Training Mode Only)

The 4 styles simulate different types of doctors a sales rep might encounter:

| Style | Personality | What they want | How to win them |
|-------|------------|----------------|-----------------|
| 🔬 **Analysant** | Skeptical, analytical | Proof, data, studies | Lead with evidence |
| 📋 **Controlant** | Organized, directive | Structure, process | Be structured, respect their time |
| 🤝 **Facilitant** | Warm, relational | Trust, rapport | Build relationship first |
| 💡 **Promouvant** | Enthusiastic, curious | Innovation, novelty | Highlight what's new |

Each style has a **SONCAS** trigger:
- **S**ecurité → wants safety and proof (Analysant)
- **O**rgueil → wants control and respect (Controlant)
- **N**otoriété → wants to be first, innovative (Promouvant)
- **S**ympathie → wants personal connection (Facilitant)

---

## Product Catalog (Commercial Mode)

VITAL SA offers products across these therapeutic areas:

| Category | Products |
|----------|----------|
| Iron / Energy | LV Fersang, FERBIOTIC |
| Vitamins | LV Tétra B, Oligovit (Vit.C, Zinc, etc.) |
| Respiratory | PULMAX, Apitou N°1/N°2, Apigrip |
| Digestive | PHYTOLAX, PHYTODIGEST, HEMOSTOP |
| Dermatology | DERMACNÉ, DERMASOUFRE, UNIDERM, HYDRA |
| Women's Health | Vitonic, FERTICARE, GROSSIVIT |
| Wellness | VITONIC, CALMOSS, OMEVIE |
| Kids | Pédiakids (various) |
| Sexual Health | NORMAPROST, VIAMEN |
| Slimming | MINCILIGNE, MINCIVIT |

---

## API Endpoints Used

| Endpoint | Used by |
|----------|---------|
| `POST /api/v1/session/start` | Both modes — starts a session |
| `POST /api/v1/chat` | Both modes — sends a message |
| `GET /api/v1/products` | Commercial Mode — loads product list |
| `GET /api/v1/levels` | Training Mode — loads level info |
| `GET /api/v1/formats` | Both modes — loads visit formats |
| `GET /api/v1/dashboard/stats` | Dashboard — analytics |
| `WS /api/v1/conversation/ws/{id}` | Both modes — real-time chat |

---

## Files Reference

| Document | Path |
|----------|------|
| Medical Delegate user story | [`docs/10-user-story-medical-delegate.md`](./10-user-story-medical-delegate.md) |
| Doctor / Pharmacist user story | [`docs/11-user-story-doctor.md`](./11-user-story-doctor.md) |
| This summary | [`docs/12-user-stories-summary.md`](./12-user-stories-summary.md) |
| Competence levels referential | [`docs/03-referentiel-niveaux-competence.md`](./03-referentiel-niveaux-competence.md) |
| Progression matrix | [`docs/04-matrice-progression.md`](./04-matrice-progression.md) |
| Top sellers scripts | [`docs/01-scripts-top-sellers.md`](./01-scripts-top-sellers.md) |
