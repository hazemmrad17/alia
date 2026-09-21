# User Story: Doctor / Pharmacist — Commercial Mode

> **Persona:** Médecin / Pharmacien (Healthcare Professional)
> **Mode:** Commercial (Product Presentation)
> **Goal:** Discover VITAL SA products through an intelligent virtual presentation

---

## 1. Overview

As a **Doctor or Pharmacist**, I use ALIA in **Commercial Mode** to receive product presentations from VITAL SA. The avatar acts as a **virtual presenter** that introduces products tailored to my specialty, answers my questions about indications/composition/dosage, and generates a CRM report after each session.

This is **not training** — it's a real commercial interaction where I learn about products I might prescribe or recommend to my patients.

---

## 2. Entry Point

On the landing page, I click **"I'm a Doctor / Pharmacist"** card → Commercial Mode is selected → The Commercial Setup panel appears.

---

## 3. Session Configuration

### 3.1 Product Selection

I choose a product from the VITAL SA catalog to learn about:

| Category | Example Products |
|----------|-----------------|
| **Iron / Energy** | LV Fersang, FERBIOTIC |
| **Vitamins** | LV Tétra B, Oligovit Vit.C, Oligovit Zinc |
| **Respiratory** | PULMAX antitussif, Apitou N°1/N°2 |
| **Digestive** | PHYTOLAX, PHYTODIGEST, HEMOSTOP |
| **Dermatology** | DERMACNÉ, DERMASOUFRE, UNIDERM |
| **Women's Health** | Vitonic Allaitement, FERTICARE, GROSSIVIT |
| **Wellness** | VITONIC, CALMOSS, OMEVIE |
| **Babies/Kids** | Pédiakids Crème Change, Apigrip |
| **Sexual Health** | NORMAPROST, VIAMEN |
| **Slimming** | MINCILIGNE, MINCIVIT |

### 3.2 Visit Format

| Format | Duration | What happens |
|--------|----------|-------------|
| ⚡ **Flash** | 20-60s | Quick product info: 1 key benefit + leave a leaflet |
| 📋 **Standard** | 2-4 min | Full presentation: discovery questions → product info → Q&A |
| 🔬 **Approfondie** | 5-8 min | Deep dive: indications, composition, evidence, positioning |

---

## 4. What ALIA Presents

For each product, ALIA has knowledge from the official gamme files:

### 4.1 Product Information
- **Name** and **category** (e.g., "LV Fersang — Iron supplement")
- **Therapeutic area** (e.g., "Iron deficiency, Energy")
- **Target specialties** (e.g., "MG, Gynéco")
- **Presentation** (forms, packaging)
- **Composition** and mechanism (simplified)
- **Dosage** and administration
- **Precautions** and contraindications

### 4.2 Key Benefits
- **Patient benefit**: Improved outcomes, easier routine
- **Practice benefit**: Simple to prescribe, good observance
- **Differentiation**: What makes it different from alternatives

### 4.3 Clinical Evidence
- References to published data (if available)
- Key study results (summarized simply)
- Practical observations from similar practices

---

## 5. Session Flow

### Flash Format (20-60 seconds)
```
1. ALIA: "Bonjour Docteur, 20 seconds... I'll leave you a leaflet and come back."
2. ALIA: Presents 1 key benefit in 1-2 sentences
3. ALIA: "Here's the product information. I'll check back next week."
4. Session ends → CRM report generated
```

### Standard Format (2-4 minutes)
```
1. ALIA: "Bonjour Docteur, may I have 2 minutes?"
2. ALIA: "Do you currently see patients with [indication]?"
3. [Discovery 1-2 questions about practice patterns]
4. ALIA: Presents product with 2-3 key messages
5. [I ask questions about composition, dosage, etc.]
6. ALIA: Answers with official product information
7. ALIA: "Would you like to try it with 2-3 patients?"
8. Session ends → CRM report with follow-up plan
```

### Approfondie Format (5-8 minutes)
```
1. ALIA: Full introduction and permission
2. ALIA: Detailed discovery (3-4 questions about my practice)
3. ALIA: Synthesis of my needs
4. ALIA: Full product presentation (benefits, evidence, positioning)
5. ALIA: Addresses my specific questions and concerns
6. ALIA: Proposes a trial plan with specific patient profiles
7. ALIA: Sets follow-up timeline (J+7 tolerance, J+14 decision)
8. Session ends → Detailed CRM report + trial plan
```

---

## 6. Questions I Can Ask

During the presentation, I can ask ALIA about:

| Topic | Example Questions |
|-------|------------------|
| **Indications** | "What is this product indicated for?" |
| **Composition** | "What are the active ingredients?" |
| **Dosage** | "How should patients take it?" |
| **Precautions** | "Are there any contraindications?" |
| **Evidence** | "Is there clinical data supporting this?" |
| **Comparison** | "How does it compare to alternatives?" |
| **Patient profile** | "Which patients would benefit most?" |
| **Availability** | "What packaging is available?" |

---

## 7. What ALIA Does (Commercial Mode)

| Feature | Description |
|---------|-------------|
| **Product Knowledge** | Answers from official gamme files, never invents data |
| **Adaptive Presentation** | Tailors the pitch based on my specialty and questions |
| **Compliance** | Stays within approved claims, refers to official sources |
| **CRM Report** | Auto-generates a visit report after each session |
| **Follow-up Plan** | Proposes J+7 and J+14 follow-up actions |

---

## 8. Compliance Rules (CRITICAL)

⚠️ **ALIA is stricter in Commercial Mode than Training Mode:**

1. **NEVER** invents medical data or makes unverified claims
2. **NEVER** promises patient outcomes ("This will cure...")
3. **NEVER** cites uncertain or unpublished studies
4. **ALWAYS** refers to official product information (fiche produit, notice)
5. **ALWAYS** includes appropriate disclaimers ("This is a supplement, not a medicine")
6. If uncertain: *"I'll verify this information and come back with a confirmed answer"*
7. **NEVER** makes comparisons that haven't been validated by the company

---

## 9. CRM Report

After each session, ALIA generates a structured CRM report:

```json
{
  "session_id": "abc-123",
  "duration_seconds": 180,
  "visit_format": "standard",
  "doctor_specialty": "Médecine Générale",
  "product_presented": "LV Fersang",
  "need_identified": "Iron supplementation for fatigue patients",
  "message_delivered": "Tolerant iron supplement with simple dosing",
  "questions_asked": [
    "What's the composition?",
    "Any side effects?"
  ],
  "engagement_level": "receptive",
  "next_step": "Trial on 2-3 patients",
  "next_step_date": "2026-03-08",
  "material_left": ["Product leaflet", "Clinical data sheet"]
}
```

---

## 10. Example Scenario

**Setup:** Doctor, Standard visit, product: LV Fersang

| Step | What happens |
|------|-------------|
| Introduction | ALIA: "Bonjour Docteur Martin, merci de m'accueillir. I'm ALIA from VITAL SA. Today I'd like to present LV Fersang. May I have 2 minutes?" |
| Discovery | ALIA: "Do you often see patients with fatigue who might have iron deficiency?" Me: "Yes, quite often, but I'm cautious about oral iron." |
| Presentation | ALIA: "LV Fersang is designed for exactly this concern. It offers gentle iron supplementation with improved tolerance..." |
| Q&A | Me: "What's the dosage?" ALIA: "1 capsule daily with a meal. Available in boxes of 30 and 60." |
| Closing | ALIA: "Would you like to try it with 2-3 patients who match this profile? I'll come back next week for your feedback." Me: "OK, sounds good." |

**Result:** Session ends, CRM report generated, follow-up scheduled at J+7

---

## 11. Differences from Training Mode

| Aspect | Training Mode (VM) | Commercial Mode (Doctor) |
|--------|-------------------|------------------------|
| **Who I am** | Medical Delegate practicing | Doctor receiving a presentation |
| **Who ALIA is** | Simulated doctor with personality | Product presenter from VITAL SA |
| **Focus** | My sales technique | Product information |
| **Scoring** | Yes (step-by-step evaluation) | No (engagement tracking only) |
| **Levels** | 4 competence levels | None |
| **Doctor personality** | Yes (4 styles + SONCAS) | No (ALIA is the presenter) |
| **Product selection** | Optional (I choose what to pitch) | Required (ALIA presents it to me) |
| **CRM report** | Post-session evaluation | Visit report with follow-up |
| **Compliance** | Evaluated on compliance | Strictly enforced |
