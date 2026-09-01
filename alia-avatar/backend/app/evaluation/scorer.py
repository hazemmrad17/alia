"""
ALIA Avatar - Visit Scorer
Evaluates visit sessions against VITAL SA competency standards.
"""
from typing import Dict, List, Optional, Any
from datetime import datetime
from loguru import logger

from app.models.schemas import (
    VisitSession,
    VisitStep,
    VisitFormat,
    CompetenceLevel,
    DoctorStyle,
    VisitReport,
    ScoringResult,
)
from app.conversation.visit_flow import VisitFlowEngine, STEP_CRITERIA


# ──────────────────────────────────────────────
# Level Thresholds
# ──────────────────────────────────────────────

LEVEL_THRESHOLDS = {
    CompetenceLevel.DEBUTANT: {
        "overall": 7.0,
        "structure_respected": 0.90,
        "engagement_rate": 0.60,
        "compliance_errors": 0,
        "next_level": CompetenceLevel.JUNIOR,
    },
    CompetenceLevel.JUNIOR: {
        "overall": 8.0,
        "objection_handling": 0.70,
        "adaptation_rate": 0.60,
        "crm_completeness": 0.80,
        "compliance_errors": 0,
        "next_level": CompetenceLevel.CONFIRME,
    },
    CompetenceLevel.CONFIRME: {
        "overall": 9.0,
        "difficult_visits": 0.70,
        "long_cycle": 0.60,
        "clean_language": 0.95,
        "compliance_errors": 0,
        "next_level": CompetenceLevel.EXPERT,
    },
    CompetenceLevel.EXPERT: {
        "overall": 9.5,
        "coaching_quality": 0.80,
        "portfolio_mastery": 0.90,
        "compliance_errors": 0,
        "next_level": None,
    },
}

# Step scoring weights
STEP_WEIGHTS = {
    VisitStep.INTRODUCTION: 0.15,
    VisitStep.SONDAGE: 0.20,
    VisitStep.SYNTHESE: 0.10,
    VisitStep.OBJECTIONS: 0.20,
    VisitStep.ARGUMENTATION: 0.25,
    VisitStep.CONCLUSION: 0.10,
}


class VisitScorer:
    """Scores visit sessions based on VITAL SA standards."""

    def score_session(self, session: VisitSession, flow: VisitFlowEngine) -> ScoringResult:
        """Score a complete visit session."""
        step_scores = {}
        strengths = []
        improvements = []

        # Score each step
        for step in [VisitStep.INTRODUCTION, VisitStep.SONDAGE, VisitStep.SYNTHESE,
                     VisitStep.OBJECTIONS, VisitStep.ARGUMENTATION, VisitStep.CONCLUSION]:

            if step.value in [s.value for s in session.messages and session.messages[0].step]:
                score = self._score_step(step, session, flow)
                step_scores[step.value] = score

                if score >= 7.0:
                    strengths.append(f"{step.value}: {self._step_strength(step, score)}")
                elif score < 6.0:
                    improvements.append(f"{step.value}: {self._step_improvement(step, score)}")
            else:
                # Step was skipped (flash mode or incomplete)
                if step in [VisitStep.SONDAGE, VisitStep.SYNTHESE, VisitStep.OBJECTIONS]:
                    if session.visit_format == VisitFormat.FLASH:
                        step_scores[step.value] = 10.0  # Not applicable
                    else:
                        step_scores[step.value] = 3.0
                        improvements.append(f"{step.value}: Step not properly completed")
                else:
                    step_scores[step.value] = 5.0
                    improvements.append(f"{step.value}: Partial completion")

        # Calculate overall score (weighted average)
        overall = 0.0
        total_weight = 0.0
        for step, score in step_scores.items():
            weight = STEP_WEIGHTS.get(VisitStep(step), 0.1)
            overall += score * weight
            total_weight += weight

        if total_weight > 0:
            overall /= total_weight

        # Check compliance
        compliance_issues = self._check_compliance(session)
        if compliance_issues:
            for issue in compliance_issues:
                improvements.append(f"Compliance: {issue}")
            overall = max(0, overall - (len(compliance_issues) * 0.5))

        # Level progression check
        level_progression = self._check_level_progression(session, overall, step_scores)

        # Determine level
        level = session.level

        return ScoringResult(
            session_id=session.id,
            overall_score=round(overall, 1),
            step_scores={k: round(v, 1) for k, v in step_scores.items()},
            level=level,
            strengths=strengths[:5],  # Top 5 strengths
            areas_for_improvement=improvements[:5],  # Top 5 improvements
            level_progression=level_progression,
        )

    def _score_step(self, step: VisitStep, session: VisitSession, flow: VisitFlowEngine) -> float:
        """Score an individual step."""
        criteria = STEP_CRITERIA.get(step, {})
        state = flow.get_flow_state()
        score = 5.0  # Base score

        messages = [m for m in session.messages if m.step == step]
        ai_messages = [m for m in messages if m.role == "assistant"]

        if not ai_messages:
            return 3.0

        if step == VisitStep.INTRODUCTION:
            # Check greeting, permission, value statement
            first_msg = ai_messages[0].content.lower() if ai_messages else ""
            if "bonjour" in first_msg or "hello" in first_msg:
                score += 2.0
            if any(w in first_msg for w in ["minute", "brève", "brief"]):
                score += 2.0
            if any(w in first_msg for w in ["vital", "alia"]):
                score += 1.0

        elif step == VisitStep.SONDAGE:
            # Check question count and quality
            questions_count = state.get("questions_asked", 0)
            min_q = criteria.get("min_questions", 2)
            max_q = criteria.get("max_questions", 4)
            if min_q <= questions_count <= max_q:
                score += 3.0
            elif questions_count < min_q:
                score += 1.0
            # Check if questions are open-ended
            if ai_messages:
                q_count = sum(1 for m in ai_messages if "?" in m.content)
                if q_count >= min_q:
                    score += 2.0

        elif step == VisitStep.SYNTHESE:
            # Check reformulation quality
            if ai_messages:
                synth_msg = " ".join([m.content for m in ai_messages]).lower()
                if any(w in synth_msg for w in ["résume", "si je résume", "if i summarize", "si je comprends"]):
                    score += 3.0
                if any(w in synth_msg for w in ["est-ce correct", "is that correct", "c'est bien"]):
                    score += 2.0

        elif step == VisitStep.OBJECTIONS:
            # Check A-C-R-V
            handled = state.get("objections_handled", 0)
            min_h = criteria.get("min_objections_handled", 1)
            if handled >= min_h:
                score += 3.0
            if ai_messages:
                response = " ".join([m.content for m in ai_messages]).lower()
                acrv_markers = ["comprends", "clarifier", "understand", "permettez"]
                if any(m in response for m in acrv_markers):
                    score += 2.0

        elif step == VisitStep.ARGUMENTATION:
            # Check structure: need → benefits → proof → usage
            benefits = state.get("benefits_delivered", 0)
            min_b = criteria.get("min_benefits", 1)
            max_b = criteria.get("max_benefits", 3)
            if min_b <= benefits <= max_b:
                score += 3.0
            elif benefits > max_b:
                score += 1.0  # Overloaded
            if ai_messages:
                arg_msg = " ".join([m.content for m in ai_messages]).lower()
                if any(w in arg_msg for w in ["bénéfice", "advantage", "benefit", "aide"]):
                    score += 1.0
                if any(w in arg_msg for w in ["preuve", "proof", "étude", "study"]):
                    score += 1.0

        elif step == VisitStep.CONCLUSION:
            # Check commitment and follow-up
            if state.get("bip_signals_detected"):
                score += 3.0
            if ai_messages:
                close_msg = " ".join([m.content for m in ai_messages]).lower()
                if any(w in close_msg for w in ["essayer", "try", "accord", "agree"]):
                    score += 2.0
                if any(w in close_msg for w in ["retour", "feedback", "reviens"]):
                    score += 1.0

        return min(10.0, max(0.0, score))

    def _step_strength(self, step: VisitStep, score: float) -> str:
        """Generate strength description for a step."""
        strengths = {
            VisitStep.INTRODUCTION: "Excellent opening with clear value proposition",
            VisitStep.SONDAGE: "Good discovery questions and active listening",
            VisitStep.SYNTHESE: "Effective reformulation and need validation",
            VisitStep.OBJECTIONS: "Well-handled objections with A-C-R-V",
            VisitStep.ARGUMENTATION: "Strong argumentation with benefits and evidence",
            VisitStep.CONCLUSION: "Effective closing with concrete commitment",
        }
        return strengths.get(step, f"Good performance on {step.value}")

    def _step_improvement(self, step: VisitStep, score: float) -> str:
        """Generate improvement suggestion for a step."""
        improvements = {
            VisitStep.INTRODUCTION: "Improve greeting and get clearer permission",
            VisitStep.SONDAGE: "Ask more open-ended questions and listen actively",
            VisitStep.SYNTHESE: "Better reformulate to validate understanding",
            VisitStep.OBJECTIONS: "Use A-C-R-V method more systematically",
            VisitStep.ARGUMENTATION: "Structure: need → benefits → proof → usage",
            VisitStep.CONCLUSION: "Detect BIP signals and get concrete commitment",
        }
        return improvements.get(step, f"Improve {step.value} performance")

    def _check_compliance(self, session: VisitSession) -> List[str]:
        """Check for compliance violations."""
        issues = []
        for msg in session.messages:
            if msg.role == "assistant":
                content = msg.content.lower()
                # Check for forbidden claims
                forbidden = [
                    "guérir", "guarantee", "certain", "toujours efficace",
                    "aucun effet", "no side effect", "promet",
                    "definitely", "absolutely safe",
                ]
                for word in forbidden:
                    if word in content:
                        issues.append(f"Potential compliance issue: '{word}' detected in response")

        return issues

    def _check_level_progression(
        self,
        session: VisitSession,
        overall_score: float,
        step_scores: Dict[str, float],
    ) -> Optional[Dict[str, Any]]:
        """Check if the user qualifies for level progression."""
        thresholds = LEVEL_THRESHOLDS.get(session.level)
        if not thresholds or not thresholds.get("next_level"):
            return None

        if overall_score >= thresholds["overall"]:
            return {
                "eligible": True,
                "current_level": session.level.value,
                "next_level": thresholds["next_level"].value,
                "score_achieved": overall_score,
                "threshold": thresholds["overall"],
                "message": f"Congratulations! You've reached the level of {thresholds['next_level'].value}!",
            }

        return {
            "eligible": False,
            "current_level": session.level.value,
            "next_level": thresholds["next_level"].value,
            "score_achieved": overall_score,
            "threshold": thresholds["overall"],
            "gap": round(thresholds["overall"] - overall_score, 1),
            "message": f"You need {round(thresholds['overall'] - overall_score, 1)} more points to reach {thresholds['next_level'].value}.",
        }

    def get_running_score(self, flow: VisitFlowEngine) -> Dict[str, float]:
        """Get the running score during a session."""
        state = flow.get_flow_state()
        score = 5.0

        # Questions asked bonus
        if state["questions_asked"] >= 2:
            score += 1.0

        # Objections handled bonus
        if state["objections_handled"] >= 1:
            score += 1.0

        # Benefits delivered bonus
        if state["benefits_delivered"] >= 1:
            score += 1.0

        # BIP signals bonus
        if state["bip_signals_detected"]:
            score += 1.0

        return {"running_score": min(10.0, score)}

    def generate_crm_report(
        self,
        session: VisitSession,
        flow: VisitFlowEngine,
        scoring: ScoringResult,
    ) -> VisitReport:
        """Generate an auto CRM visit report."""
        # Analyze conversation for report
        user_msgs = [m for m in session.messages if m.role == "user"]
        ai_msgs = [m for m in session.messages if m.role == "assistant"]

        # Calculate duration
        duration = 0
        if session.started_at and session.ended_at:
            duration = int((session.ended_at - session.started_at).total_seconds())

        # Extract information
        need_identified = self._extract_need(session)
        message_delivered = self._extract_message(session)
        objections = self._extract_objections(session)
        engagement = self._assess_engagement(session, scoring)
        next_step = self._determine_next_step(session, scoring)

        return VisitReport(
            session_id=session.id,
            duration_seconds=duration,
            context=session.mode.value,
            visit_format=session.visit_format,
            doctor_specialty=session.doctor_profile.specialty or "General",
            doctor_style=session.doctor_profile.style,
            soncas_detected=session.doctor_profile.soncas,
            need_identified=need_identified,
            message_delivered=message_delivered,
            objections_encountered=objections,
            engagement_level=engagement,
            material_left=[],
            next_step=next_step,
            next_step_date=None,
            level_at_session=session.level,
            score=scoring.overall_score,
            raw_transcript=[
                {"role": m.role, "content": m.content[:200]}
                for m in session.messages
            ],
        )

    def _extract_need(self, session: VisitSession) -> str:
        """Extract the identified need from conversation."""
        for msg in session.messages:
            if msg.step == VisitStep.SONDAGE and msg.role == "user":
                return msg.content[:200]
        return "Need analysis pending"

    def _extract_message(self, session: VisitSession) -> str:
        """Extract the main message delivered."""
        for msg in session.messages:
            if msg.step == VisitStep.ARGUMENTATION and msg.role == "assistant":
                return msg.content[:200]
        return "Message delivery pending"

    def _extract_objections(self, session: VisitSession) -> List[Dict[str, str]]:
        """Extract objections encountered."""
        objections = []
        for msg in session.messages:
            if msg.step == VisitStep.OBJECTIONS and msg.role == "user":
                objections.append({"objection": msg.content[:100], "handled": "Yes"})
        return objections

    def _assess_engagement(self, session: VisitSession, scoring: ScoringResult) -> str:
        """Assess the engagement level."""
        if scoring.overall_score >= 8:
            return "High - Clear commitment obtained"
        elif scoring.overall_score >= 6:
            return "Medium - Partial engagement"
        else:
            return "Low - Needs follow-up"

    def _determine_next_step(self, session: VisitSession, scoring: ScoringResult) -> str:
        """Determine the recommended next step."""
        if scoring.overall_score >= 8:
            return "Follow-up visit with test results (J+7)"
        elif scoring.overall_score >= 6:
            return "Second visit to reinforce (J+14)"
        else:
            return "Revisit with adjusted approach (J+21)"
