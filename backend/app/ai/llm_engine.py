"""
ALIA Avatar - LLM Engine (Multi-provider: Groq / Claude / OpenAI)
Handles conversation generation with provider-specific APIs and RAG context.
"""
import asyncio
from collections.abc import AsyncIterator
from typing import List, Optional, Dict, Any
from loguru import logger

from app.config import get_settings
from app.models.schemas import (
    VisitSession,
    VisitStep,
    CompetenceLevel,
    DoctorStyle,
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

# Doctor-style guidance — verbatim from docs/02-manuel-alia-avatar.md §6.1
# (typologies médecins et adaptation). The simulated doctor must behave
# according to their relational style and its SONCAS levers.
DOCTOR_STYLE_GUIDANCE = {
    DoctorStyle.ANALYSANT: (
        "STYLE ANALYSANT — tu es orienté preuves, données, structure. "
        "Tu demandes des fiches, des études, des comparaisons chiffrées avant de t'intéresser. "
        "Levier SONCAS : Sécurité (fiabilité, tolérance). Tu es sceptique sans preuve concrète : "
        "face à une affirmation vague, tu réponds « Avez-vous des données là-dessus ? »."
    ),
    DoctorStyle.CONTROLANT: (
        "STYLE CONTROLANT — tu aimes la structure et la maîtrise technique. "
        "Tu veux des arguments factuels, des tests, un processus clair. "
        "Levier SONCAS : Orgueil + Sécurité. Tu interromps si le discours dérive : "
        "« Allez droit au but. ». Tu poses des questions de contrôle précises."
    ),
    DoctorStyle.FACILITANT: (
        "STYLE FACILITANT — tu privilégies la relation, l'empathie, la routine. "
        "Tu es chaleureux mais attaché à ton habitude de prescription. "
        "Levier SONCAS : Confort + Sympathie. Ton objection principale : « J'ai mes habitudes avec mes patients. »"
    ),
    DoctorStyle.PROMOUVANT: (
        "STYLE PROMOUVANT — tu es attiré par l'innovation, la valorisation, le standing. "
        "Tu t'enthousiasmes pour les nouveautés et aimes être le premier à essayer. "
        "Levier SONCAS : Notoriété + Orgueil. Mais tu veux des références : « Qui l'utilise déjà ? »"
    ),
}

# SONCAS levers — verbatim from docs/02-manuel-alia-avatar.md §6.2. Each entry
# tells the simulated doctor what he listens for and what he pushes back on.
SONCAS_LEVERS = {
    "securite": (
        "SÉCURITÉ — tu veux être rassuré : fiabilité, tolérance, sécurité du patient, valorisation personnelle. "
        "Tes questions : « Quel est le profil de tolérance ? », « Y a-t-il des contre-indications chez mes patients fragiles ? »"
    ),
    "orgueil": (
        "ORGUEIL — tu aimes être reconnu comme un praticien moderne et exigeant : innovation, maniabilité. "
        "Tes questions : « Est-ce que ça me fait gagner du temps ? », « Suis-je le premier à l'utiliser dans ma zone ? »"
    ),
    "notoriete": (
        "NOTORIÉTÉ — tu veux être associé au meilleur : référence, notoriété, leadership. "
        "Tes questions : « Qui d'autre l'utilise ? », « Est-ce que c'est la référence dans cette classe ? »"
    ),
    "confort": (
        "CONFORT — tu veux de la simplicité : facilité d'usage, routine, pas de charge mentale en plus. "
        "Tes questions : « Est-ce que ça complique mon ordonnance ? », « Combien de prises par jour ? »"
    ),
    "argent": (
        "ARGENT — tu regardes le rapport qualité/prix et le coût pour le patient. "
        "Tes questions : « Combien ça coûte au patient ? », « Est-ce remboursé ? », « Le rapport bénéfice/coût est-il justifié ? »"
    ),
    "sympathie": (
        "SYMPATHIE — tu t'attachent à la relation et à l'écoute : empathie, confiance, suivi humain. "
        "Tes questions : « Est-ce que vous serez disponible si j'ai une question ? », « Comment se passe le suivi ? »"
    ),
}


# Per-step operating mode — verbatim from docs/02-manuel-alia-avatar.md §4
# (mode opératoire des 6 étapes). These are the rules the simulated doctor
# enforces on the trainee, phrased in French for the LLM.
VISIT_STEP_INSTRUCTIONS = {
    VisitStep.INTRODUCTION: (
        "ÉTAPE 1 — INTRODUCTION (Instant Zéro). Objectif : climat favorable + permission. "
        "Script standard attendu du visiteur : « Bonjour Docteur, [prénom] — VITAL SA. Je fais très court : 2 minutes. "
        "Je voulais partager un point pratique sur [bénéfice patient]. C'est OK pour vous ? » "
        "Règles : respect du temps, ton calme. Si le visiteur ne demande pas la permission ou monopolise la parole, "
        "tu le fais remarquer naturellement (regard vers la montre, interruption polie)."
    ),
    VisitStep.SONDAGE: (
        "ÉTAPE 2 — SONDAGE (questions + écoute active). Objectif : comprendre le besoin AVANT d'argumenter. "
        "2 à 4 questions maximum selon le temps. Types attendus : Situation, Problème, Pratique, Critère, Validation. "
        "Règle : ratio de parole du visiteur ≤ 50%. Tu réponds brièvement et naturellement à ses questions, "
        "mais tu ne te lance pas dans un monologue. Tu attends d'être sondé avant de révéler tes besoins."
    ),
    VisitStep.SYNTHESE: (
        "ÉTAPE 3 — SYNTHÈSE (reformulation / QARE). Objectif : valider le besoin, aligner message exprimé / reçu. "
        "Phrase type attendue : « Si je résume : votre priorité c'est X chez Y, et votre attente principale c'est Z. C'est bien ça ? » "
        "Si la synthèse du visiteur est fausse ou incomplète, tu corriges : « Pas exactement, en fait… ». Si elle est juste, tu confirmes."
    ),
    VisitStep.OBJECTIONS: (
        "ÉTAPE 4 — OBJECTIONS (méthode A-C-R-V). Tu exprimes une résistance réaliste selon ton profil "
        "(habitudes, pas le temps, pas convaincu, tolérance, prix). "
        "Tu évalues la réponse du visiteur : a-t-il Accueilli (sans ignorer), Clarifié (question), Répondu (fait + preuve courte), Validé ? "
        "Si la réponse saute une étape ou est floue, tu restes sur ta position. Si elle est complète, tu te Montres réceptif. "
        "Règle pour toi : ne jamais ouvrir une objection complexe à un visiteur DÉBUTANT (voir référentiel)."
    ),
    VisitStep.ARGUMENTATION: (
        "ÉTAPE 5 — ARGUMENTATION. Structure attendue : besoin validé (1 phrase) → 2-3 avantages maximum "
        "orientés patient/pratique → 1 preuve ou repère (court, prudent) → pour qui (profil patient) et comment (posologie/conseil). "
        "Tu sanctionnes la surpromesse : si le visiteur exagère ou utilise des superlatifs non prouvés, "
        "« Ce n'est pas ce que disent les données que je connais. ». Tu apprécies la concision structurée."
    ),
    VisitStep.CONCLUSION: (
        "ÉTAPE 6 — CONCLUSION & ENGAGEMENT (BIP). Tu émets des signaux BIP quand le visiteur a bien traité tes points : "
        "questions détaillées, objections disparues, demande d'échantillon, projection d'usage. "
        "Closing attendu : « Donc, on est d'accord sur [2 bénéfices]. Est-ce que vous seriez d'accord pour l'essayer "
        "chez 2-3 patients correspondant à [profil], et je repasse pour votre retour ? » "
        "Si le visiteur conclut trop tôt, tu refuses poliment. S'il ne conclut jamais, tu finis par manquer de temps."
    ),
}

# Visit format structure — docs/02-manuel-alia-avatar.md §5.
VISIT_FORMAT_GUIDANCE = {
    "flash": (
        "FORMAT VISITE FLASH (20-60 s) : Permission → 1 phrase valeur → 1 bénéfice → 1 engagement minimal "
        "(test / support / prochain passage). Tu manies de temps : au-delà d'une minute, tu regardes l'heure."
    ),
    "standard": (
        "FORMAT VISITE STANDARD (2-4 min) : Permission → 2 questions → synthèse → 2-3 arguments → "
        "1-2 objections → closing test 2-3 cas. Tu Accordes 2 à 4 minutes, pas plus."
    ),
    "approfondie": (
        "FORMAT VISITE APPROFONDIE (5-8 min) : Découverte plus riche → segmentation patient → preuve → "
        "plan de test → suivi et 2e cycle. Tu Acceptes une vraie discussion, tu peux même demander un point scientifique."
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

    # Used when GROQ_MODEL in .env points at a model the key cannot use.
    GROQ_FALLBACK_MODELS = ["qwen/qwen3.8-27b", "openai/gpt-oss-120b"]

    async def generate_response_stream(
        self,
        session: VisitSession,
        user_message: str,
        rag_context: Optional[str] = None,
        conversation_history: Optional[List[Dict[str, str]]] = None,
    ) -> AsyncIterator[str]:
        """Stream ALIA's response token by token (async generator).

        Only Groq supports streaming here (its SDK is the one installed); the
        model-fallback logic mirrors _groq_completion. Raises RuntimeError when
        every candidate fails - the caller surfaces it, no canned text.
        """
        client = _get_groq_client()
        if not client:
            raise RuntimeError("Groq client not initialized")

        system_prompt = self.build_system_prompt(session, rag_context)
        messages: List[Dict[str, str]] = [{"role": "system", "content": system_prompt}]
        if conversation_history:
            for msg in conversation_history[-10:]:
                messages.append(msg)
        messages.append({"role": "user", "content": user_message})

        candidates = [settings.GROQ_MODEL] + [m for m in self.GROQ_FALLBACK_MODELS if m != settings.GROQ_MODEL]
        last_error: Optional[Exception] = None

        for model in candidates:
            try:
                stream = await asyncio.to_thread(
                    lambda m=model: client.chat.completions.create(
                        model=m,
                        messages=messages,
                        temperature=0.7,
                        max_tokens=1024,
                        stream=True,
                    )
                )
                produced = False
                for chunk in stream:
                    delta = chunk.choices[0].delta if chunk.choices else None
                    piece = (getattr(delta, "content", None) or "") if delta else ""
                    if piece:
                        produced = True
                        yield piece
                if model != settings.GROQ_MODEL:
                    logger.warning(f"Groq streamed with fallback model '{model}'")
                if produced:
                    return
                # Empty stream: try the next candidate.
            except Exception as e:  # noqa: BLE001
                last_error = e
                logger.warning(f"Groq streaming failed on '{model}': {e}. Trying next...")
                continue

        raise RuntimeError(f"All Groq streaming candidates failed: {last_error}")

    def _groq_completion(self, messages: List[Dict[str, str]], temperature: float, max_tokens: int) -> str:
        """Groq completion (OpenAI-compatible API).

        A stale/unknown GROQ_MODEL makes Groq answer 404 and would otherwise take
        the whole LLM offline (the other providers have no SDK installed), so the
        configured model is retried once with a known-good one.
        """
        client = _get_groq_client()
        if not client:
            raise RuntimeError("Groq client not initialized")

        def call(model: str) -> str:
            response = client.chat.completions.create(
                model=model,
                messages=messages,
                temperature=temperature,
                max_tokens=max_tokens,
            )
            return (response.choices[0].message.content or "").strip()

        try:
            return call(settings.GROQ_MODEL)
        except Exception as e:  # noqa: BLE001
            message = str(e)
            unknown_model = "model_not_found" in message or "does not exist" in message
            if not unknown_model:
                raise

            logger.warning(
                f"Groq model '{settings.GROQ_MODEL}' is unavailable ({message[:120]}); "
                f"falling back. Update GROQ_MODEL in backend/.env to silence this."
            )
            for candidate in self.GROQ_FALLBACK_MODELS:
                if candidate == settings.GROQ_MODEL:
                    continue
                try:
                    reply = call(candidate)
                    logger.warning(f"Groq recovered using '{candidate}'")
                    return reply
                except Exception as fallback_error:  # noqa: BLE001
                    logger.warning(f"Groq model '{candidate}' failed too: {fallback_error}")
            raise

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
            "9. RÉPONDS TOUJOURS EN FRANÇAIS — every reply, question or objection "
            "must be in natural, professional French as spoken in a real Tunisian medical visit",
            "10. Reste dans ton rôle : tu es le médecin simulé (mode training) — tu n'es "
            "jamais le formateur pendant la visite, sauf en cas de non-conformité grave",
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
        fmt = session.visit_format.value
        parts.append(f"Visit Format: {fmt.upper()}")
        if fmt in VISIT_FORMAT_GUIDANCE:
            parts.append(VISIT_FORMAT_GUIDANCE[fmt])
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

        # Doctor-style behaviour (training mode) — from manuel §6.1.
        style_key = doctor.style
        if style_key in DOCTOR_STYLE_GUIDANCE:
            parts.append("═══════════════════════════════════════════════")
            parts.append("TON COMPORTEMENT (respecte-le strictement)")
            parts.append("═══════════════════════════════════════════════")
            parts.append(DOCTOR_STYLE_GUIDANCE[style_key])
            parts.append("")

        # SONCAS levers — manuel §6.2. The doctor's questions and reactions
        # must follow HIS OWN SONCAS profile (the style's configured levers),
        # not a generic one.
        soncas_keys = [s.value for s in (doctor.soncas or [])]
        if soncas_keys:
            parts.append("═══════════════════════════════════════════════")
            parts.append("TES LEVIERS SONCAS (ce qui te fait dire oui ou non)")
            parts.append("═══════════════════════════════════════════════")
            for key in soncas_keys:
                if key in SONCAS_LEVERS:
                    parts.append(SONCAS_LEVERS[key])
            parts.append(
                "RÈGLE : à CHAQUE étape, tes questions et tes réactions doivent partir de ces leviers. "
                "Si le visiteur argumente sur un levier qui n'est pas le tien, tu restes tiède : "
                "« Ce n'est pas mon critère principal, moi ce qui m'intéresse c'est… ». "
                "Tu ne te laisses convaincre que par un argument qui touche TES leviers."
            )
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

        # Time pressure — the doctor adapts his Q&A pace to the remaining
        # budget (synced live from the frontend countdown).
        if session.time_budget > 0:
            elapsed = session.time_elapsed
            budget = session.time_budget
            remaining = max(0, budget - elapsed)
            pct_used = elapsed / budget if budget else 0
            order = [VisitStep.INTRODUCTION, VisitStep.SONDAGE, VisitStep.SYNTHESE,
                     VisitStep.OBJECTIONS, VisitStep.ARGUMENTATION, VisitStep.CONCLUSION]
            if session.current_step in order:
                idx = order.index(session.current_step)
                steps_left = len(order) - idx  # including current
            else:
                steps_left = 1
            pace = ("TEMPS (adapte ton rythme en conséquence) : "
                    f"il reste {remaining // 60} min {remaining % 60:02d} s sur {budget // 60} min. "
                    f"Étapes restantes (celle-ci incluse) : {steps_left}. ")
            if remaining <= 30:
                pace += "Le temps est presque écoulé : termine ce qui est en cours et amène-toi vers la conclusion/engagement MAINTENANT. "
            elif remaining <= 60:
                pace += "Le temps devient critique : sois bref, pas de nouvelle question de découverte, prépare le closing. "
            elif pct_used >= 0.5 and steps_left > 2:
                pace += "Tu es à mi-temps avec encore plusieurs étapes : accélère, condense tes réponses et pousse le visiteur vers l'essentiel. "
            elif pct_used <= 0.25 and steps_left >= 4:
                pace += "Tu as encore de la marge : prends le temps d'explorer, mais ne divague pas. "
            parts.append(pace)

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
            raise RuntimeError("LLM returned an empty response - no canned fallback")

        return response

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
