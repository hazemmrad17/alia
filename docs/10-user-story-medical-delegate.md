# User Story: Medical Delegate (VM) — Training Mode

> **Persona:** Visiteur Médical (Medical Representative) at VITAL SA
> **Mode:** Training (Entraînement)
> **Goal:** Practice medical visit simulations to improve sales technique and progress through competence levels

---

## 1. Overview

As a **Medical Delegate**, I use ALIA in **Training Mode** to practice my medical visits in a safe, simulated environment. The avatar plays the role of a **simulated doctor** with a specific personality style, and I practice my pitch following the VITAL SA 6-step visit process.

After each session, I receive:
- Real-time scoring on each step of the visit
- Feedback on my technique (objections handled, argumentation quality, closing)
- A progress report toward the next competence level

---

## 2. Entry Point

On the landing page, I click **"I'm a Medical Delegate"** card → Training Mode is selected → The Training Setup panel appears.

---

## 3. Session Configuration

Before starting, I configure:

### 3.1 Competence Level (my current level)

| Level | What I can do | What I'm learning |
|-------|--------------|-------------------|
| 🌱 **Débutant** | Scripted visit, basic product knowledge | Follow the 6-step structure, 1 objection, simple closing |
| 📘 **Junior** | Interactive visit, 2-4 questions | A-C-R-V objections, engagement detection, structured CRM |
| 🏅 **Confirmé** | Autonomous, adapts to doctor style | 3 objections, patient segmentation, interrupted visits |
| 🏆 **Expert** | Top performer, coaching ability | Difficult visits, long cycles, high-precision argumentation |

### 3.2 Doctor Personality (who I'm practicing with)

Each doctor has a **personality style** and a **SONCAS persuasion trigger**:

| Style | SONCAS | Behavior | How I should adapt |
|-------|--------|----------|-------------------|
| 🔬 **Analysant** | Securité | Asks detailed questions, challenges claims, wants numbers | Lead with evidence, studies, clinical data |
| 📋 **Controlant** | Orgueil | Sets the agenda, interrupts, wants clear organization | Be structured, respect their process, clear agenda |
| 🤝 **Facilitant** | Sympathie | Friendly, open, listens but expects rapport first | Build relationship first, be warm, listen actively |
| 💡 **Promouvant** | Notoriété | Enthusiastic about new things, early adopter mindset | Highlight innovation, novelty, being first to try |

### 3.3 Visit Format

| Format | Duration | Steps | When to use |
|--------|----------|-------|-------------|
| ⚡ **Flash** | 20-60s | Introduction → Argumentation → Conclusion | Quick hallway visit, limited time |
| 📋 **Standard** | 2-4 min | All 6 steps | Regular scheduled visit |
| 🔬 **Approfondie** | 5-8 min | All 6 steps (deeper) | New product launch, complex cases |

---

## 4. The 6-Step Visit Process

ALIA evaluates my performance on each step:

```
1. 👋 Introduction (Instant Zero)
   → Get permission, manage time, set the agenda
   
2. 🔍 Sondage (Discovery)
   → Ask 2-4 questions to understand the doctor's needs
   → Active listening, silence, reformulation
   
3. 📝 Synthèse (QARE)
   → Reformulate what I heard, validate understanding
   → "If I understand correctly, your priority is..."
   
4. 🛡️ Objections (A-C-R-V)
   → Handle resistance using the A-C-R-V method:
   A = Accueillir (Acknowledge)
   C = Clarifier (Ask for specifics)
   R = Répondre (Answer with fact + proof)
   V = Valider (Check if satisfied)
   
5. 🎯 Argumentation
   → Need → Benefits → Proof → Usage
   → Tailored to the doctor's personality style
   
6. 🤝 Conclusion (BIP)
   → Get a micro-engagement (BIP = Bonne Idée Pratique)
   → "Would you try it with 2-3 patients?"
   → Set follow-up date (J+7 or J+14)
```

---

## 5. Competence Level Progression

After each session, my score determines if I can level up:

### Débutant → Junior
| Criterion | Threshold |
|-----------|-----------|
| Score global | ≥ 7/10 on 5 simulations |
| Structure 6 steps OK | ≥ 80% |
| Visits with engagement | ≥ 60% |
| Compliance errors | **0** |

### Junior → Confirmé
| Criterion | Threshold |
|-----------|-----------|
| Score global | ≥ 8/10 on 10 simulations |
| A-C-R-V objections validated | ≥ 70% |
| Doctor profile adaptation | ≥ 60% |
| CRM complete + next action | ≥ 80% |

### Confirmé → Expert
| Criterion | Threshold |
|-----------|-----------|
| Score global | ≥ 9/10 on 10 difficult simulations |
| Difficult visits success | ≥ 70% |
| Long cycle (test → return → adjust) | ≥ 60% |
| Zero over-promising, clean language | ≥ 95% |

---

## 6. Session Flow

```
1. Configure session (level, doctor style, format)
2. Click "Start Training Session"
3. ALIA greets me as the simulated doctor:
   "Bonjour ! I'm Dr. Martin, specialist in General Medicine.
    Doctor Personality: 🔬 Analysant — proof-oriented.
    Your Level: Junior. Available for Standard visit."
4. I start the visit (e.g., "Bonjour Docteur, merci de m'accueillir...")
5. The doctor responds according to their personality style
6. I progress through the 6 steps
7. ALIA evaluates each step in real-time
8. Session ends → Score breakdown + CRM report
9. I see my strengths and areas for improvement
```

---

## 7. What ALIA Does (Training Mode)

| Feature | Description |
|---------|-------------|
| **Doctor Simulation** | Responds as a real doctor would, based on the selected personality |
| **Personality Consistency** | Maintains the same style throughout (e.g., Analysant keeps asking for proof) |
| **Objection Management** | Raises realistic objections (habitudes, pas le temps, pas convaincu) |
| **Step Advancement** | Detects when I should move to the next step |
| **Real-time Scoring** | Updates score after each interaction |
| **Compliance Rules** | Never invents data, flags if I make unverified claims |
| **Session Report** | Generates detailed scoring + CRM report at end |

---

## 8. Data Sources

ALIA draws from:
- **Product catalog**: 100+ VITAL SA products (from gamme PPTX files)
- **Visit scripts**: Top sellers scripts with A-C-R-V objection responses
- **Competence referential**: 4-level progression matrix
- **Doctor profiles**: 4 personality styles with behavioral patterns

---

## 9. Compliance Rules

⚠️ **Hard rules that ALIA never breaks:**
1. **NEVER** invents medical data or makes unverified claims
2. **NEVER** promises patient results
3. **NEVER** cites uncertain studies
4. **ALWAYS** refers to official product information
5. If uncertain: *"Let me verify and come back with a confirmed answer"*

---

## 10. Example Scenario

**Setup:** Junior level, Analysant doctor, Standard visit, product: LV Fersang

| Step | What happens |
|------|-------------|
| Introduction | I greet the doctor, ask for 2 minutes. Doctor says "OK, but be brief." |
| Sondage | I ask about iron deficiency patients. Doctor: "Mostly fatigue cases, but I'm skeptical about oral iron supplements — too much intolerance." |
| Synthèse | I reformulate: "So tolerance is your main concern?" Doctor: "Yes, exactly." |
| Objections | Doctor: "I have my habits with another brand." → I use A-C-R-V |
| Argumentation | I present LV Fersang's tolerance profile and simple dosing |
| Conclusion | Doctor: "OK, I'll try it on 2-3 patients." → I set J+7 follow-up |

**Result:** Score 7.5/10, Strength: Good structure, Improvement: Handle objections faster
