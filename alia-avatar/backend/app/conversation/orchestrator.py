"""
ALIA Avatar - Conversation Orchestrator
Ties together the visit flow FSM, LLM engine, RAG pipeline, and scoring.
"""
from typing import Optional, Dict, Any, List
from uuid import uuid4
from datetime import datetime
from loguru import logger

from app.models.schemas import (
    VisitSession,
    ConversationMessage,
    ConversationMode,
    CompetenceLevel,
    VisitFormat,
    VisitStep,
    DoctorProfile,
    IntentType,
    SentimentType,
    StartSessionRequest,
    StartSessionResponse,
    ConversationRequest,
    ConversationResponse,
)
from app.conversation.visit_flow import VisitFlowEngine, create_session
from app.ai.llm_engine import LLMEngine
from app.ai.rag import rag_pipeline
from app.evaluation.scorer import VisitScorer


class ConversationOrchestrator:
    """Orchestrates the full ALIA conversation experience."""

    def __init__(self):
        self.llm = LLMEngine()
        self.scorer = VisitScorer()
        self.sessions: Dict[str, VisitSession] = {}
        self.flows: Dict[str, VisitFlowEngine] = {}
        self.conversation_histories: Dict[str, List[Dict[str, str]]] = {}

    async def start_session(self, request: StartSessionRequest) -> StartSessionResponse:
        """Start a new conversation session."""
        # Create session
        session = create_session(
            mode=request.mode,
            level=request.level,
            visit_format=request.visit_format,
            product_focus=request.product_focus,
            doctor_profile=request.doctor_profile,
            user_id=request.user_id,
        )

        # Create flow engine
        flow = VisitFlowEngine(session)

        # Initialize RAG
        rag_pipeline.initialize()

        # Store session data
        self.sessions[session.id] = session
        self.flows[session.id] = flow
        self.conversation_histories[session.id] = []

        # Generate greeting based on mode and level
        if request.mode == ConversationMode.TRAINING:
            greeting = self._generate_training_greeting(session)
        else:
            greeting = self._generate_commercial_greeting(session)

        logger.info(f"Session {session.id} started: mode={request.mode.value}, level={request.level.value}, format={request.visit_format.value}")

        return StartSessionResponse(
            session_id=session.id,
            greeting=greeting,
            doctor_profile=session.doctor_profile,
            current_step=session.current_step,
            level=session.level,
        )

    async def send_message(self, request: ConversationRequest) -> ConversationResponse:
        """Process a user message and return ALIA's response."""
        session_id = request.session_id

        # Create session if needed
        if not session_id or session_id not in self.sessions:
            start_req = StartSessionRequest(
                mode=request.mode,
                product_focus=request.product_focus,
                doctor_profile=request.doctor_profile,
                level=request.level,
                visit_format=request.visit_format,
            )
            start_resp = await self.start_session(start_req)
            session_id = start_resp.session_id

        session = self.sessions[session_id]
        flow = self.flows[session_id]
        history = self.conversation_histories[session_id]

        # Detect intent and sentiment
        intent = self.llm.detect_intent(request.message)
        sentiment = self.llm.detect_sentiment(request.message)

        # Track the interaction
        flow.track_interaction(request.message, "", intent)

        # Add user message to history
        user_msg = ConversationMessage(
            role="user",
            content=request.message,
            step=session.current_step,
            intent=intent,
            sentiment=sentiment,
        )
        session.messages.append(user_msg)
        history.append({"role": "user", "content": request.message})

        # Check if should advance step
        if flow.should_advance_step(request.message, intent):
            new_step = flow.advance_step()
            if new_step == VisitStep.COMPLETED:
                # Generate completion response
                return await self._complete_session(session, flow, session_id)

        # Get RAG context
        rag_context = rag_pipeline.build_rag_context(product_focus=session.product_focus)

        # Get step-specific system instructions
        step_instructions = flow.get_system_prompt_for_step()

        # Generate ALIA's response
        ai_response = self.llm.generate_response(
            session=session,
            user_message=request.message,
            rag_context=rag_context,
            conversation_history=history,
        )

        # Track the response
        flow.track_interaction(request.message, ai_response, intent)

        # Add AI response to history
        ai_msg = ConversationMessage(
            role="assistant",
            content=ai_response,
            step=session.current_step,
            metadata={
                "intent": intent.value,
                "sentiment": sentiment.value,
                "flow_state": flow.get_flow_state(),
            },
        )
        session.messages.append(ai_msg)
        history.append({"role": "assistant", "content": ai_response})

        # Calculate score update
        score_update = self.scorer.get_running_score(flow)

        return ConversationResponse(
            session_id=session_id,
            message=ai_response,
            current_step=session.current_step,
            metadata={
                "intent": intent.value,
                "sentiment": sentiment.value,
                "flow_state": flow.get_flow_state(),
            },
            score_update=score_update,
        )

    async def _complete_session(self, session: VisitSession, flow: VisitFlowEngine, session_id: str) -> ConversationResponse:
        """Handle session completion."""
        # Score the session
        scoring_result = self.scorer.score_session(session, flow)

        # Generate CRM report
        report = self.scorer.generate_crm_report(session, flow, scoring_result)

        # Generate completion message
        completion_msg = self._generate_completion_message(scoring_result, report)

        # Add to history
        ai_msg = ConversationMessage(
            role="assistant",
            content=completion_msg,
            step=VisitStep.COMPLETED,
            metadata={
                "scoring": scoring_result.model_dump(),
                "crm_report": report.model_dump(),
            },
        )
        session.messages.append(ai_msg)
        session.ended_at = datetime.now()
        session.scores = {
            "overall": scoring_result.overall_score,
            **scoring_result.step_scores,
        }

        self.conversation_histories[session_id].append({"role": "assistant", "content": completion_msg})

        return ConversationResponse(
            session_id=session_id,
            message=completion_msg,
            current_step=VisitStep.COMPLETED,
            metadata={
                "scoring": scoring_result.model_dump(),
                "crm_report": report.model_dump(),
            },
            score_update={"overall": scoring_result.overall_score},
        )

    def get_session(self, session_id: str) -> Optional[VisitSession]:
        """Get a session by ID."""
        return self.sessions.get(session_id)

    def get_all_sessions(self) -> List[VisitSession]:
        """Get all sessions."""
        return list(self.sessions.values())

    def get_session_history(self, session_id: str) -> List[Dict[str, str]]:
        """Get conversation history for a session."""
        return self.conversation_histories.get(session_id, [])

    # ──────────────────────────────────────────────
    # Greeting Generators
    # ──────────────────────────────────────────────

    def _generate_training_greeting(self, session: VisitSession) -> str:
        """Generate training mode greeting."""
        doctor = session.doctor_profile
        style_hint = doctor.style.value

        if session.level == CompetenceLevel.DEBUTANT:
            return (
                f"🎬 **Session d'Entraînement - Mode Formation**\n\n"
                f"Bonjour ! Je suis le Docteur {doctor.name}, "
                f"spécialiste en {doctor.specialty}.\n\n"
                f"**Profil du médecin:** Style {style_hint} | Disponible pour {session.visit_format.value}\n"
                f"**Niveau:** {session.level.value}\n\n"
                f"Allez-y, commencez la visite comme vous le feriez en vrai. "
                f"Je réagirai comme un vrai médecin.\n\n"
                f"Quand vous êtes prêt(e), dites bonjour !"
            )
        else:
            return (
                f"🎬 **Training Session Started**\n\n"
                f"Bonjour ! I'm Dr. {doctor.name}, "
                f"specialist in {doctor.specialty}.\n\n"
                f"**Doctor Profile:** Style {style_hint} | Available for {session.visit_format.value}\n"
                f"**Your Level:** {session.level.value}\n"
                f"**Product Focus:** {session.product_focus or 'General'}\n\n"
                f"Go ahead and start the visit as you would in real life. "
                f"I'll respond like a real doctor.\n\n"
                f"When you're ready, say hello!"
            )

    def _generate_commercial_greeting(self, session: VisitSession) -> str:
        """Generate commercial mode greeting."""
        doctor = session.doctor_profile
        return (
            f"💼 **Commercial Presentation Mode**\n\n"
            f"Bonjour Docteur {doctor.name}, merci de m'accueillir.\n"
            f"Je suis ALIA de VITAL SA. Aujourd'hui je souhaite vous présenter "
            f"**{session.product_focus or 'nos solutions'}**.\n\n"
            f"Je serai brève et pratique. Puis-je avoir 2 minutes ?"
        )

    def _generate_completion_message(self, scoring_result, report) -> str:
        """Generate session completion message with scoring."""
        return (
            f"✅ **Visite Terminée !**\n\n"
            f"**Score Global:** {scoring_result.overall_score:.1f}/10\n\n"
            f"**Scores par étape:**\n"
            + "\n".join([f"  • {step}: {score:.1f}/10" for step, score in scoring_result.step_scores.items()])
            + f"\n\n**Points Forts:**\n"
            + "\n".join([f"  ✅ {s}" for s in scoring_result.strengths])
            + f"\n\n**Axes d'Amélioration:**\n"
            + "\n".join([f"  📝 {s}" for s in scoring_result.areas_for_improvement])
            + f"\n\n**Rapport CRM Généré:**\n"
            f"  Durée: {report.duration_seconds}s | Format: {report.visit_format.value}\n"
            f"  Besoin identifié: {report.need_identified}\n"
            f"  Message délivré: {report.message_delivered}\n"
            f"  Prochaine action: {report.next_step}"
        )


# Global instance
orchestrator = ConversationOrchestrator()
