"""
ALIA Avatar - Visit Flow State Machine
Encodes the 6-step VITAL SA medical visit process with branching logic.
"""
from typing import Optional, Dict, List, Tuple
from datetime import datetime
from loguru import logger
from uuid import uuid4

from app.models.schemas import (
    VisitStep,
    VisitFormat,
    VisitSession,
    ConversationMessage,
    DoctorProfile,
    DoctorStyle,
    CompetenceLevel,
    ConversationMode,
    IntentType,
    SentimentType,
    SONCASFactor,
)


# ──────────────────────────────────────────────
# Step Transition Rules
# ──────────────────────────────────────────────

STEP_TRANSITIONS: Dict[VisitStep, VisitStep] = {
    VisitStep.INTRODUCTION: VisitStep.SONDAGE,
    VisitStep.SONDAGE: VisitStep.SYNTHESE,
    VisitStep.SYNTHESE: VisitStep.OBJECTIONS,
    VisitStep.OBJECTIONS: VisitStep.ARGUMENTATION,
    VisitStep.ARGUMENTATION: VisitStep.CONCLUSION,
    VisitStep.CONCLUSION: VisitStep.COMPLETED,
}

# Step time limits per format (seconds)
STEP_TIME_LIMITS: Dict[VisitFormat, Dict[VisitStep, int]] = {
    VisitFormat.FLASH: {
        VisitStep.INTRODUCTION: 20,
        VisitStep.SONDAGE: 0,      # skipped
        VisitStep.SYNTHESE: 0,     # skipped
        VisitStep.OBJECTIONS: 0,   # skipped
        VisitStep.ARGUMENTATION: 15,
        VisitStep.CONCLUSION: 15,
    },
    VisitFormat.STANDARD: {
        VisitStep.INTRODUCTION: 30,
        VisitStep.SONDAGE: 60,
        VisitStep.SYNTHESE: 30,
        VisitStep.OBJECTIONS: 60,
        VisitStep.ARGUMENTATION: 45,
        VisitStep.CONCLUSION: 30,
    },
    VisitFormat.APPROFONDIE: {
        VisitStep.INTRODUCTION: 30,
        VisitStep.SONDAGE: 120,
        VisitStep.SYNTHESE: 45,
        VisitStep.OBJECTIONS: 120,
        VisitStep.ARGUMENTATION: 90,
        VisitStep.CONCLUSION: 45,
    },
}

# For Flash mode, skip steps 2-4
FLASH_SKIP_STEPS = {VisitStep.SONDAGE, VisitStep.SYNTHESE, VisitStep.OBJECTIONS}

# Step completion criteria
STEP_CRITERIA: Dict[VisitStep, Dict[str, any]] = {
    VisitStep.INTRODUCTION: {
        "description": "Instant Zero: Create favorable climate, get permission",
        "required_elements": ["greeting", "time_permission", "value_statement"],
        "max_attempts": 2,
    },
    VisitStep.SONDAGE: {
        "description": "Questions + Active Listening (2-4 questions)",
        "required_elements": ["questions_asked", "active_listening", "follow_up"],
        "min_questions": 2,
        "max_questions": 4,
        "max_attempts": 5,
    },
    VisitStep.SYNTHESE: {
        "description": "Reformulation / QARE - validate the need",
        "required_elements": ["reformulation", "need_validation"],
        "max_attempts": 2,
    },
    VisitStep.OBJECTIONS: {
        "description": "A-C-R-V: Welcome-Clarify-Respond-Validate",
        "required_elements": ["acknowledge", "clarify", "respond", "validate"],
        "min_objections_handled": 1,
        "max_attempts": 5,
    },
    VisitStep.ARGUMENTATION: {
        "description": "Need → Benefits → Proof → Usage",
        "required_elements": ["need_referenced", "benefits", "proof_or_reference", "usage_profile"],
        "min_benefits": 1,
        "max_benefits": 3,
        "max_attempts": 3,
    },
    VisitStep.CONCLUSION: {
        "description": "Engagement at the right moment (BIP signals)",
        "required_elements": ["commitment", "concrete_action", "follow_up_plan"],
        "max_attempts": 3,
    },
}


class VisitFlowEngine:
    """
    Manages the state machine for a medical visit conversation.
    Controls step transitions, timing, and completion criteria.
    """

    def __init__(self, session: VisitSession):
        self.session = session
        self.questions_asked = 0
        self.objections_handled = 0
        self.benefits_delivered = 0
        self.step_attempts = {step: 0 for step in VisitStep if step != VisitStep.COMPLETED}
        self._bip_signals_detected = False

    @property
    def current_step(self) -> VisitStep:
        return self.session.current_step

    @property
    def is_flash_mode(self) -> VisitStep:
        return self.session.visit_format == VisitFormat.FLASH

    def get_step_criteria(self) -> Dict[str, any]:
        """Get the current step's completion criteria."""
        return STEP_CRITERIA.get(self.current_step, {})

    def get_system_prompt_for_step(self) -> str:
        """Generate system instructions for the current step based on ALIA level."""
        level = self.session.level
        step = self.current_step
        doctor = self.session.doctor_profile

        base_prompt = self._base_alia_persona()
        step_prompt = self._step_specific_prompt(step, level, doctor)

        return f"{base_prompt}\n\n{step_prompt}"

    def _base_alia_persona(self) -> str:
        """Base persona definition for ALIA."""
        level = self.session.level
        mode = self.session.mode
        product = self.session.product_focus or "VITAL SA products"

        return f"""You are ALIA, an intelligent avatar created by VITAL SA for pharmaceutical sales training.

MODE: {mode.value.upper()}
COMPETENCE LEVEL: {level.value.upper()}
PRODUCT FOCUS: {product}

PERSONALITY & RULES:
- You are a professional, warm, and knowledgeable virtual medical representative.
- Your goal is to simulate a realistic medical visit with a doctor/pharmacist.
- Follow the VITAL SA visit process strictly.
- NEVER invent medical data or make unverified claims.
- NEVER promise patient results.
- Always refer to product sheets and official documentation.
- Keep responses concise and natural (like a real visit).

LEVEL-SPECIFIC BEHAVIOR:
{self._level_behavior()}
"""

    def _level_behavior(self) -> str:
        """Level-specific behavioral instructions."""
        behaviors = {
            CompetenceLevel.DEBUTANT: """- Follow scripts closely, be somewhat scripted.
- Ask 1-2 simple questions (often closed or semi-opened).
- Handle 1 standard objection with a prepared response.
- Give a basic summary ("If I understand correctly...").
- Conclude with a simple micro-commitment.
- Keep it short and structured.""",

            CompetenceLevel.JUNIOR: """- Be more interactive with 2-4 pertinent questions and follow-ups.
- Use active listening (silence, reformulation).
- Handle 2 common objections using A-C-R-V method.
- Give 2-3 arguments following: need → advantage → proof → usage.
- Detect BIP signals to conclude at the right moment.
- Provide structured CRM report with follow-up plan.""",

            CompetenceLevel.CONFIRME: """- Adapt fluidly to the doctor's style (4 styles + SONCAS) in real-time.
- Handle 3 varied objections and differentiate their types.
- Segment patient profiles in argumentation.
- Manage interruptions and still conclude properly.
- Even after interruptions, provide a clean closing.
- Follow up with the visit: return test, 2nd cycle.""",

            CompetenceLevel.EXPERT: """- Instant relational diagnosis + strategic conduct.
- Master difficult visits: hostile doctor, multiple objections, belief conflicts.
- High-precision argumentation: patient benefit, place in care strategy, clearly stated limits.
- Ability to coach/teach (explain to junior how to improve).
- Orchestrate long cycle: initiation → test → return → optimization → loyalty.
- Produce rich CRM reports and propose actions.""",
        }
        return behaviors.get(self.session.level, "")

    def _step_specific_prompt(self, step: VisitStep, level: CompetenceLevel, doctor: DoctorProfile) -> str:
        """Step-specific instructions."""
        style_desc = self._doctor_style_description(doctor.style)
        soncas_desc = ", ".join([s.value for s in doctor.soncas]) if doctor.soncas else "not detected"

        prompts = {
            VisitStep.INTRODUCTION: f"""CURRENT STEP: INTRODUCTION (Instant Zero)
Doctor style: {style_desc} | SONCAS: {soncas_desc}

OBJECTIVE: Create a favorable climate and get permission to speak.
- Greet the doctor naturally (use "Bonjour Docteur").
- Introduce yourself as ALIA from VITAL SA.
- Ask for 2 minutes (or appropriate time based on format).
- State 1 practical benefit to capture attention.
- If refused or interrupted, exit professionally.

Example: "Bonjour Docteur, I'm Alia from VITAL SA. I'll be very brief — 2 minutes. I wanted to share something practical about [benefit]. Is that OK for you?"

After the doctor responds, move to the next step automatically.""",

            VisitStep.SONDAGE: f"""CURRENT STEP: SONDAGE (Questions + Active Listening)
Doctor style: {style_desc} | SONCAS: {soncas_desc}

OBJECTIVE: Understand the doctor's needs BEFORE arguing.
- Ask 2-4 questions maximum (adapt to time available).
- Types: Situation, Problem, Practice, Criteria, Validation.
- Use active listening: silence, reformulation, follow-ups.
- Your speaking time should be ≤ 50%.
- Don't interrupt. Let the doctor speak.

Example questions:
- "On this type of patients, you mostly see...?"
- "What bothers you most: effectiveness, tolerance, compliance?"
- "What's your #1 criterion in this case?"
- "So if we improve X, that really changes the care?"

After 2-4 meaningful exchanges, provide a synthesis.""",

            VisitStep.SYNTHESE: f"""CURRENT STEP: SYNTHESE (Reformulation / QARE)
Doctor style: {style_desc} | SONCAS: {soncas_desc}

OBJECTIVE: Validate the need and align expressed message / received message.

Example: "If I summarize: your priority is X for patients with Y, and your main expectation is Z. Is that correct?"

- If confirmed → proceed to argumentation
- If corrected → adjust and re-confirm
- Keep it brief (1-2 sentences)

Then transition smoothly: "Based on what you've told me, let me share something relevant...""",

            VisitStep.OBJECTIONS: f"""CURRENT STEP: OBJECTIONS (A-C-R-V Method)
Doctor style: {style_desc} | SONCAS: {soncas_desc}

OBJECTIVE: Transform resistance into progress.
Method: A-C-R-V (Welcome - Clarify - Respond - Validate)

- WELCOME: "I understand" / "You're right"
- CLARIFY: "When you say X, you mean...?" / "What specifically concerns you?"
- RESPOND: Short fact + practical option + proof if available
- VALIDATE: "Does this address your concern?"

Common objections and responses:
- "I don't have time" → "Would 20 seconds work, or should I come back?"
- "I have my habits" → "Which patients are you least satisfied with?"
- "Not convinced" → "What's missing: proof, tolerance, or patient profile?"
- "Too expensive" → "In which cases does cost block the most?"

NEVER ignore an objection. Stay calm. Don't counter-argue.

After handling objections, proceed to argumentation.""",

            VisitStep.ARGUMENTATION: f"""CURRENT STEP: ARGUMENTATION (Need → Benefits → Proof → Usage)
Doctor style: {style_desc} | SONCAS: {soncas_desc}

OBJECTIVE: Convince without overloading.
Structure:
1. Reference the validated need (1 sentence)
2. 2-3 max benefits (patient/practice oriented)
3. 1 proof or reference (short, prudent)
4. For which patient profile + how to use

Rules:
- No over-promising, no vagueness, no superlatives
- If uncertain: "Let me verify and come back"
- Adapt to doctor's SONCAS factors
- Benefits should be concrete and measurable

After delivering arguments, check for reactions and be ready for objections or move to conclusion.""",

            VisitStep.CONCLUSION: f"""CURRENT STEP: CONCLUSION & ENGAGEMENT (BIP)
Doctor style: {style_desc} | SONCAS: {soncas_desc}

OBJECTIVE: Obtain a concrete action (micro-commitment).

BIP Signals (Buy-In Point):
- Doctor asks detailed questions
- Disappearance of objections
- Request for support/samples
- Projection of usage

Closing template:
"So we agree on [2 benefits]. Would you be open to trying it with 2-3 patients matching [profile], and I'll come back for your feedback?"

Errors to avoid:
- Concluding too early
- Concluding too late
- Re-arguing after agreement

After closing, provide the CRM report summary.""",
        }

        return prompts.get(step, "Continue the conversation naturally.")

    def _doctor_style_description(self, style: DoctorStyle) -> str:
        """Describe doctor style for context."""
        descriptions = {
            DoctorStyle.ANALYSANT: "Proof-oriented — needs data, studies, evidence",
            DoctorStyle.CONTROLANT: "Structure-oriented — needs clear process, organization",
            DoctorStyle.FACILITANT: "Relationship-oriented — values rapport, trust, listening",
            DoctorStyle.PROMOUVANT: "Innovation-oriented — likes new approaches, novelty",
        }
        return descriptions.get(style, "Unknown style")

    def should_advance_step(self, ai_response: str, user_intent: Optional[IntentType] = None) -> bool:
        """Determine if the conversation should advance to the next step."""
        if self.current_step == VisitStep.COMPLETED:
            return False

        if self.is_flash_mode and self.current_step in FLASH_SKIP_STEPS:
            return True

        criteria = STEP_CRITERIA.get(self.current_step, {})
        max_attempts = criteria.get("max_attempts", 3)

        if self.step_attempts[self.current_step] >= max_attempts:
            return True

        # Step-specific advancement logic
        if self.current_step == VisitStep.INTRODUCTION:
            return True  # Auto-advance after greeting

        if self.current_step == VisitStep.SONDAGE:
            if self.questions_asked >= criteria.get("min_questions", 2):
                return True

        if self.current_step == VisitStep.OBJECTIONS:
            if user_intent == IntentType.AGREEMENT or user_intent == IntentType.ANSWER:
                self.objections_handled += 1
            if self.objections_handled >= criteria.get("min_objections_handled", 1):
                return True

        if self.current_step == VisitStep.CONCLUSION:
            if user_intent in (IntentType.AGREEMENT, IntentType.REQUEST_SAMPLE):
                self._bip_signals_detected = True
                return True

        return False

    def advance_step(self) -> VisitStep:
        """Advance to the next step in the flow."""
        if self.current_step == VisitStep.COMPLETED:
            return VisitStep.COMPLETED

        next_step = STEP_TRANSITIONS.get(self.current_step, VisitStep.COMPLETED)

        # Skip steps in flash mode
        if self.is_flash_mode:
            while next_step in FLASH_SKIP_STEPS and next_step != VisitStep.COMPLETED:
                next_step = STEP_TRANSITIONS.get(next_step, VisitStep.COMPLETED)

        self.session.current_step = next_step
        logger.info(f"Step advanced to: {next_step.value}")
        return next_step

    def track_interaction(self, user_message: str, ai_response: str, intent: Optional[IntentType] = None):
        """Track interaction details for scoring."""
        self.step_attempts[self.current_step] += 1

        # Count questions in SONDAGE step
        if self.current_step == VisitStep.SONDAGE:
            if intent == IntentType.ANSWER:
                self.questions_asked += 1

        # Track benefits in ARGUMENTATION step
        if self.current_step == VisitStep.ARGUMENTATION:
            benefit_keywords = ["benefit", "advantage", "helps", "improves", "supports", "bénéfice", "avantage"]
            if any(kw in ai_response.lower() for kw in benefit_keywords):
                self.benefits_delivered += 1

    def get_flow_state(self) -> Dict[str, any]:
        """Get the current flow state for scoring."""
        return {
            "current_step": self.current_step.value,
            "format": self.session.visit_format.value,
            "level": self.session.level.value,
            "questions_asked": self.questions_asked,
            "objections_handled": self.objections_handled,
            "benefits_delivered": self.benefits_delivered,
            "step_attempts": {k.value: v for k, v in self.step_attempts.items()},
            "bip_signals_detected": self._bip_signals_detected,
            "is_completed": self.current_step == VisitStep.COMPLETED,
        }


def create_session(
    mode: ConversationMode,
    level: CompetenceLevel,
    visit_format: VisitFormat,
    product_focus: Optional[str] = None,
    doctor_profile: Optional[DoctorProfile] = None,
    user_id: Optional[str] = None,
) -> VisitSession:
    """Create a new visit session."""
    if doctor_profile is None:
        doctor_profile = DoctorProfile()

    # For flash mode, adjust format
    effective_format = visit_format
    if visit_format == VisitFormat.FLASH:
        effective_format = VisitFormat.FLASH

    session = VisitSession(
        id=str(uuid4()),
        user_id=user_id,
        mode=mode,
        level=level,
        product_focus=product_focus,
        doctor_profile=doctor_profile,
        visit_format=effective_format,
        current_step=VisitStep.INTRODUCTION,
    )

    return session
