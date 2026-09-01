"""
ALIA Avatar - Dashboard API Routes
"""
from fastapi import APIRouter
from typing import Dict, Any, List
from loguru import logger

from app.conversation.orchestrator import orchestrator
from app.models.schemas import SessionStats, CompetenceLevel

router = APIRouter(tags=["dashboard"])


@router.get("/stats", response_model=SessionStats)
async def get_dashboard_stats():
    """Get overall dashboard statistics."""
    sessions = orchestrator.get_all_sessions()

    total = len(sessions)
    avg_score = 0.0
    level_dist = {"debutant": 0, "junior": 0, "confirme": 0, "expert": 0}
    product_counts: Dict[str, int] = {}

    for s in sessions:
        if s.scores:
            avg_score += s.scores.get("overall", 0)
        level_dist[s.level.value] = level_dist.get(s.level.value, 0) + 1
        if s.product_focus:
            product_counts[s.product_focus] = product_counts.get(s.product_focus, 0) + 1

    if total > 0:
        avg_score /= total

    top_products = sorted(product_counts.items(), key=lambda x: x[1], reverse=True)[:10]

    recent = sessions[-10:] if sessions else []

    return SessionStats(
        total_sessions=total,
        average_score=round(avg_score, 1),
        level_distribution=level_dist,
        top_products=[{"name": p, "count": c} for p, c in top_products],
        recent_sessions=[
            {
                "id": s.id,
                "mode": s.mode.value,
                "level": s.level.value,
                "product": s.product_focus,
                "score": s.scores.get("overall", 0),
                "started_at": s.started_at.isoformat() if s.started_at else None,
            }
            for s in recent
        ],
    )


@router.get("/scores/level-distribution")
async def get_level_distribution():
    """Get score distribution by level."""
    sessions = orchestrator.get_all_sessions()
    distribution = {}

    for level in CompetenceLevel:
        level_sessions = [s for s in sessions if s.level == level]
        scores = [s.scores.get("overall", 0) for s in level_sessions if s.scores]
        distribution[level.value] = {
            "count": len(level_sessions),
            "avg_score": round(sum(scores) / len(scores), 1) if scores else 0,
            "min_score": min(scores) if scores else 0,
            "max_score": max(scores) if scores else 0,
        }

    return distribution


@router.get("/scores/step-analysis")
async def get_step_analysis():
    """Get average scores per visit step."""
    sessions = orchestrator.get_all_sessions()
    step_totals: Dict[str, List[float]] = {}

    for s in sessions:
        for step, score in s.scores.items():
            if step != "overall":
                if step not in step_totals:
                    step_totals[step] = []
                step_totals[step].append(score)

    return {
        step: {
            "avg_score": round(sum(scores) / len(scores), 1) if scores else 0,
            "count": len(scores),
        }
        for step, scores in step_totals.items()
    }


@router.get("/sessions/{session_id}/report")
async def get_session_report(session_id: str):
    """Get the CRM report for a session."""
    session = orchestrator.get_session(session_id)
    if not session:
        return {"error": "Session not found"}

    # Find the CRM report in messages
    for msg in reversed(session.messages):
        if "crm_report" in msg.metadata:
            return msg.metadata["crm_report"]

    return {"error": "CRM report not yet generated"}
