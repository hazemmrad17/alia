"""
ALIA Avatar - LLM Engine (Multi-provider: Groq / Claude / OpenAI)
Handles conversation generation with provider-specific APIs and RAG context.
"""
from typing import List, Optional, Dict, Any
from loguru import logger

from app.config import get_settings
from app.models.schemas import (
    VisitSession,
    VisitStep,
    CompetenceLevel,
    IntentType,
    SentimentType,
)

settings = get_settings()

# ──────────────────────────────────────────────
# Provider Clients (lazy init)
# ──────────────────────────────────────────────
_groq_client = None
_anthropic_client = None
_openai_client = None


def _get_groq_client():
    global _groq_client
    if _groq_client is None:
        try:
            from groq import Groq
            _groq_client = Groq(api_key=settings.GROQ_API_KEY)
        except Exception as e:
            logger.error(f"Failed to init Groq client: {e}")
    return _groq_client


def _get_anthropic_client():
    global _anthropic_client
    if _anthropic_client is None:
        try:
            import anthropic
            _anthropic_client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
        except Exception as e:
            logger.error(f"Failed to init Anthropic client: {e}")
    return _anthropic_client


def _get_openai_client():
    global _openai_client
    if _openai_client is None:
        try:
            from openai import OpenAI
            _openai_client = OpenAI(api_key=settings.OPENAI_API_KEY)
        except Exception as e:
            logger.error(f"Failed to init OpenAI client: {e}")
    return _openai_client


# ──────────────────────────────────────────────
# System Prompt Builder
# ──────────────────────────────────────────────

LEVEL_CONSTRAINTS = {
    CompetenceLevel.DEBUTANT: (
        "LEVEL: DEBUTANT (Beginner)\n"
        "- Be somewhat scripted, follow the process closely\n"
        "- Ask 1-2 simple questions (often closed or semi-open)\n"
        "- Handle 1 standard objection with a prepared answer\n"
        "- Give a basic summary\n"
        "- Conclude with a simple micro-commitment\n"
        "- Knowledge: basic product info (name, 2 benefits, simple dosage)"
    ),
    CompetenceLevel.JUNIOR: (
        "LEVEL: JUNIOR\n"
        "- Be interactive: 2-4 pertinent questions with follow-ups\n"
        "- Use active listening (silence, reformulation)\n"
        "- Handle 2 frequent objections (habitudes, pas le temps, pas convaincu)\n"
        "- 2-3 arguments: need → advantage → proof → usage\n"
        "- Detect 2 BIP signals to conclude\n"
        "- Knowledge: complete sheets on 5-10 priority products, can mention alternatives"
    ),
    CompetenceLevel.CONFIRME: (
        "LEVEL: CONFIRMÉ (Confirmed)\n"
        "- Adapt fluidly to doctor's style (4 styles + SONCAS) in real-time\n"
        "- Handle 3 varied objections and differentiate types\n"
        "- Segment patient profiles in argumentation\n"
        "- Compare products intelligently when asked (without denigrating)\n"
        "- Manage interruptions, still conclude cleanly\n"
        "- Follow up: return of test, 2nd cycle\n"
        "- Knowledge: 15-30 references, summarize evidence in 20s"
    ),
    CompetenceLevel.EXPERT: (
        "LEVEL: EXPERT (Top Performer)\n"
        "- Instant relational diagnosis + strategic conduct\n"
        "- Master difficult visits: hostile doctors, multiple objections, belief conflicts\n"
        "- High-precision argumentation: patient benefit, care strategy place, clearly stated limits\n"
        "- Compare products across gammes, position in market context\n"
        "- Ability to coach/teach\n"
        "- Orchestrate long cycle: initiation → test → return → optimization → loyalty\n"
        "- Knowledge: complete portfolio + inter-gamme mastery"
    ),
}

COMMERCIAL_MODE_INSTRUCTIONS = (
    "MODE: COMMERCIAL\n"
    "You are presenting VITAL SA products to a healthcare professional.\n"
    "- Focus on product benefits and clinical positioning\n"
    "- Be persuasive but factually grounded\n"
    "- Always maintain pharmaceutical ethics\n"
    "- Never make unverified medical claims\n"
    "- Provide product sheets and evidence when asked\n"
    "- When asked about other products, provide客观 comparisons without denigrating competitors\n"
)

TRAINING_MODE_INSTRUCTIONS = (
    "MODE: TRAINING\n"
    "You are simulating a doctor/pharmacist to train a medical representative.\n"
    "- Act as a realistic doctor with a defined style and personality\n"
    "- React naturally: some resistance, some curiosity, some urgency\n"
    "- Test the trainee's ability to handle objections\n"
    "- Provide realistic interruptions (patient, phone, secretary)\n"
    "- At the end, provide feedback on the trainee's performance\n"
)

VISIT_STEP_INSTRUCTIONS = {
    VisitStep.INTRODUCTION: (
        "You are at the INTRODUCTION step. "
        "Create a favorable climate, greet naturally, ask for permission to speak briefly (2 minutes). "
        "State 1 practical value proposition."
    ),
    VisitStep.SONDAGE: (
        "You are at the SONDAGE (Discovery) step. "
        "Ask 2-4 pertinent questions to understand the doctor's needs. "
        "Use active listening. Your speaking time ≤ 50%. "
        "Don't argue yet — only listen and ask."
    ),
    VisitStep.SYNTHESE: (
        "You are at the SYNTHESE step. "
        "Reformulate what you heard to confirm understanding. "
        "Use QARE format: 'If I summarize: your priority is X, and your main expectation is Z. Is that correct?'"
    ),
    VisitStep.OBJECTIONS: (
        "You are at the OBJECTIONS step. "
        "Use A-C-R-V method: Acknowledge, Clarify, Respond, Validate. "
        "Never ignore an objection. Stay calm. Don't counter-argue."
    ),
    VisitStep.ARGUMENTATION: (
        "You are at the ARGUMENTATION step. "
        "Structure: Reference validated need → 2-3 benefits → 1 proof → patient profile + usage. "
        "No over-promising. No superlatives. Keep it concise."
    ),
    VisitStep.CONCLUSION: (
        "You are at the CONCLUSION step. "
        "Detect BIP signals (detailed questions, no more objections, request for samples). "
        "Get a concrete micro-commitment: 'Would you try it with 2-3 patients?' "
        "Prepare CRM report."
    ),
}


class LLMEngine:
    """Multi-provider LLM engine for generating ALIA responses."""

    def __init__(self):
        self.provider = settings.LLM_PROVIDER.lower()

    def _chat_completion(self, messages: List[Dict[str, str]], temperature: float = 0.7, max_tokens: int = 1024) -> str:
        """Route to the right provider and get a completion."""

        # Try configured provider first, then fallback chain
        providers = [self.provider] + [p for p in ["groq", "anthropic", "openai"] if p != self.provider]

        for provider in providers:
            try:
                if provider == "groq":
                    return self._groq_completion(messages, temperature, max_tokens)
                elif provider == "anthropic":
                    return self._anthropic_completion(messages, temperature, max_tokens)
                elif provider == "openai":
                    return self._openai_completion(messages, temperature, max_tokens)
            except Exception as e:
                logger.warning(f"Provider {provider} failed: {e}. Trying next...")
                continue

        logger.error("All LLM providers failed")
        return ""

    def _groq_completion(self, messages: List[Dict[str, str]], temperature: float, max_tokens: int) -> str:
        """Groq completion (OpenAI-compatible API)."""
        client = _get_groq_client()
        if not client:
            raise RuntimeError("Groq client not initialized")

        response = client.chat.completions.create(
            model=settings.GROQ_MODEL,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
        )
        return response.choices[0].message.content.strip()

    def _anthropic_completion(self, messages: List[Dict[str, str]], temperature: float, max_tokens: int) -> str:
        """Anthropic Claude completion."""
        client = _get_anthropic_client()
        if not client:
            raise RuntimeError("Anthropic client not initialized")

        # Extract system message (Anthropic separates it)
        system_msg = ""
        chat_messages = []
        for msg in messages:
            if msg["role"] == "system":
                system_msg = msg["content"]
            else:
                chat_messages.append(msg)

        # Anthropic requires alternating user/assistant messages
        # Ensure first message is from user
        if chat_messages and chat_messages[0]["role"] != "user":
            chat_messages.insert(0, {"role": "user", "content": "Continue."})

        response = client.messages.create(
            model=settings.ANTHROPIC_MODEL,
            max_tokens=max_tokens,
            temperature=temperature,
            system=system_msg if system_msg else None,
            messages=chat_messages,
        )
        return response.content[0].text.strip()

    def _openai_completion(self, messages: List[Dict[str, str]], temperature: float, max_tokens: int) -> str:
        """OpenAI completion."""
        client = _get_openai_client()
        if not client:
            raise RuntimeError("OpenAI client not initialized")

        response = client.chat.completions.create(
            model=settings.OPENAI_MODEL,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
            presence_penalty=0.3,
            frequency_penalty=0.3,
        )
        return response.choices[0].message.content.strip()

    def build_system_prompt(
        self,
        session: VisitSession,
        rag_context: Optional[str] = None,
    ) -> str:
        """Build the complete system prompt."""
        parts = [
            "You are ALIA, an intelligent conversational avatar for VITAL SA pharmaceutical company.",
            "",
            "═══════════════════════════════════════════════",
            "CORE IDENTITY",
            "═══════════════════════════════════════════════",
            "- Name: ALIA",
            "- Company: VITAL SA (Tunisian pharmaceutical company)",
            "- Role: Virtual Medical Representative",
            "- Language: French (primary), English (for reports)",
            "- Personality: Professional, warm, knowledgeable, empathetic",
            "",
            "═══════════════════════════════════════════════",
            "RULES (NEVER BREAK)",
            "═══════════════════════════════════════════════",
            "1. NEVER invent medical data or make unverified claims",
            "2. NEVER promise patient results or outcomes",
            "3. NEVER cite studies unless you're sure they're real",
            "4. ALWAYS refer to official product information",
            "5. If uncertain: 'Let me verify and come back with a confirmed answer'",
            "6. Keep responses natural and concise (like a real visit)",
            "7. Adapt to the doctor's communication style",
            "8. Respect pharmaceutical ethics at all times",
            "",
            "═══════════════════════════════════════════════",
            "VITAL SA VISIT PROCESS (6 STEPS)",
            "═══════════════════════════════════════════════",
            "1. Introduction (Instant Zero) → Get permission",
            "2. Sondage (Discovery) → Understand needs",
            "3. Synthèse (QARE) → Validate understanding",
            "4. Objections (A-C-R-V) → Transform resistance",
            "5. Argumentation → Need → Benefits → Proof → Usage",
            "6. Conclusion (BIP) → Get micro-commitment",
            "",
        ]

        # Level constraints
        if session.level in LEVEL_CONSTRAINTS:
            parts.append(LEVEL_CONSTRAINTS[session.level])
            parts.append("")

        # Mode
        if session.mode.value == "training":
            parts.append(TRAINING_MODE_INSTRUCTIONS)
        else:
            parts.append(COMMERCIAL_MODE_INSTRUCTIONS)
        parts.append("")

        # Visit format
        parts.append(f"Visit Format: {session.visit_format.value.upper()}")
        if session.visit_format.value == "flash":
            parts.append("- Flash visit (20-60s): Permission → 1 value sentence → 1 benefit → 1 minimal commitment")
        elif session.visit_format.value == "standard":
            parts.append("- Standard visit (2-4 min): Permission → 2 questions → Synthèse → 2-3 arguments → 1-2 objections → Closing")
        else:
            parts.append("- Deep visit (5-8 min): Rich discovery → Patient segmentation → Evidence → Test plan → Follow-up")
        parts.append("")

        # Doctor profile
        doctor = session.doctor_profile
        parts.append(f"═══════════════════════════════════════════════")
        parts.append(f"DOCTOR PROFILE")
        parts.append(f"═══════════════════════════════════════════════")
        parts.append(f"- Name: {doctor.name}")
        parts.append(f"- Style: {doctor.style.value}")
        parts.append(f"- Specialty: {doctor.specialty}")
        if doctor.soncas:
            parts.append(f"- SONCAS: {', '.join([s.value for s in doctor.soncas])}")
        parts.append(f"- Mood: {doctor.mood.value}")
        parts.append(f"- Time: {doctor.time_available.value}")
        if doctor.custom_notes:
            parts.append(f"- Notes: {doctor.custom_notes}")
        parts.append("")

        # RAG context (this includes cross-product awareness)
        if rag_context:
            parts.append("═══════════════════════════════════════════════")
            parts.append("PRODUCT KNOWLEDGE BASE (from official VITAL SA documents)")
            parts.append("You have access to the full VITAL SA product catalog.")
            parts.append("Use this information to answer questions about ANY product.")
            parts.append("When comparing products, be客观 and factual.")
            parts.append("═══════════════════════════════════════════════")
            parts.append(rag_context)
            parts.append("")

        # Step-specific
        step_key = session.current_step
        if step_key in VISIT_STEP_INSTRUCTIONS:
            parts.append(VISIT_STEP_INSTRUCTIONS[step_key])

        return "\n".join(parts)

    def generate_response(
        self,
        session: VisitSession,
        user_message: str,
        rag_context: Optional[str] = None,
        conversation_history: Optional[List[Dict[str, str]]] = None,
    ) -> str:
        """Generate ALIA's response to the user."""
        system_prompt = self.build_system_prompt(session, rag_context)

        messages = [{"role": "system", "content": system_prompt}]

        # Add conversation history (last 10 messages for context)
        if conversation_history:
            for msg in conversation_history[-10:]:
                messages.append(msg)

        # Add current user message
        messages.append({"role": "user", "content": user_message})

        response = self._chat_completion(messages, temperature=0.7, max_tokens=1024)

        if not response:
            return self._fallback_response(session.current_step)

        return response

    def _fallback_response(self, step: VisitStep) -> str:
        """Fallback responses if all providers fail."""
        fallbacks = {
            VisitStep.INTRODUCTION: "Bonjour Docteur, je suis Alia de VITAL SA. Je serai très brève — 2 minutes. J'avais quelque chose de pratique à partager. C'est OK ?",
            VisitStep.SONDAGE: "Pourriez-vous me dire quel est votre principal défi avec ce type de patients ?",
            VisitStep.SYNTHESE: "Si je résume bien, votre priorité est X chez vos patients. C'est bien cela ?",
            VisitStep.OBJECTIONS: "Je comprends votre point. Permettez-moi d'apporter une précision...",
            VisitStep.ARGUMENTATION: "Ce produit offre 2-3 avantages pratiques pour vos patients. Laissez-moi vous expliquer...",
            VisitStep.CONCLUSION: "Est-ce que vous seriez d'accord pour l'essayer chez 2-3 patients, et je reviens pour votre retour ?",
        }
        return fallbacks.get(step, "Je suis là pour vous aider. Que souhaitez-vous savoir ?")

    def detect_intent(self, user_message: str) -> IntentType:
        """Detect the user's intent from their message."""
        message_lower = user_message.lower()

        objection_patterns = [
            "pas le temps", "j'ai mes habitudes", "pas convaincu",
            "trop cher", "trop d'intolérance", "je préfère", "non",
            "ça ne marche pas", "je n'aime pas", "je ne vois pas",
            "i don't have time", "too expensive", "not convinced",
        ]
        if any(p in message_lower for p in objection_patterns):
            return IntentType.OBJECTION

        agreement_patterns = [
            "d'accord", "oui", "pourquoi pas", "essayons", "ok",
            "ça me semble bien", "volontiers", "je veux bien",
            "yes", "sure", "sounds good", "let's try",
        ]
        if any(p in message_lower for p in agreement_patterns):
            return IntentType.AGREEMENT

        if "?" in user_message or any(w in message_lower for w in ["comment", "combien", "pourquoi", "quel", "quelle", "how", "what", "why"]):
            return IntentType.QUESTION

        if any(w in message_lower for w in ["échantillon", "sample", "essai", "dossier", "fiche"]):
            return IntentType.REQUEST_SAMPLE

        if any(w in message_lower for w in ["non merci", "pas intéressé", "no thanks", "pas besoin"]):
            return IntentType.REFUSAL

        if any(w in message_lower for w in ["prouvez", "quel est le", "quelle est la preuve", "source", "étude"]):
            return IntentType.CHALLENGE

        return IntentType.ANSWER

    def detect_sentiment(self, user_message: str) -> SentimentType:
        """Detect the sentiment of the user's message."""
        message_lower = user_message.lower()

        hostile_words = ["non", "allez-vous-en", "pas le temps", "dérange", "gênant"]
        negative_words = ["mauvais", "nul", "horrible", "pas bien", "déçu"]
        receptive_words = ["dites-moi", "continuez", "intéressant", "montrez"]
        hesitant_words = ["peut-être", "je ne sais pas", "hmm", "bah", "euh"]
        positive_words = ["merci", "bien", "intéressant", "excellent", "bravo", "parfait"]

        if any(w in message_lower for w in hostile_words):
            return SentimentType.HOSTILE
        elif any(w in message_lower for w in negative_words):
            return SentimentType.NEGATIVE
        elif any(w in message_lower for w in receptive_words):
            return SentimentType.RECEPTIVE
        elif any(w in message_lower for w in hesitant_words):
            return SentimentType.HESITANT
        elif any(w in message_lower for w in positive_words):
            return SentimentType.POSITIVE
        else:
            return SentimentType.NEUTRAL
