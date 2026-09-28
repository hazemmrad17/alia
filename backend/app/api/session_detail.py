"""
ALIA Avatar - Detailed session view.

One endpoint that returns everything the detail drawer needs about a finished
session: the persisted report (scores, strengths, CRM summary), the full
message-by-message transcript, and the feedback the trainee left. Access
follows the same rules as every other dashboard read: an admin sees the
sessions of his tenant, everyone else only their own.
"""
import json
import os
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from loguru import logger

from app.auth import store
from app.auth.deps import get_current_user
from app.config import data_dir

router = APIRouter(tags=["session-detail"])


def _tenant_of(user: Dict[str, Any]) -> Optional[str]:
    return store.tenant_of(str(user.get("id") or "")) or user.get("tenant_id")


def _is_admin(user: Dict[str, Any]) -> bool:
    return str(user.get("role") or "") == "admin"


def _visible_reports(user: Dict[str, Any]) -> List[Dict[str, Any]]:
    """The session reports the caller is allowed to read, newest first.

    Admins see every report of their tenant; delegates and doctors only their
    own rows. Mirrors the scoping of dashboard._visible_reports so a link
    shared inside one tenant behaves the same on both screens.
    """
    path = os.path.join(data_dir(), "session_reports.json")
    rows: List[Dict[str, Any]] = []
    if os.path.exists(path):
        try:
            with open(path, "r", encoding="utf-8") as f:
                raw = json.load(f)
            if isinstance(raw, list):
                rows = [r for r in raw if isinstance(r, dict)]
        except Exception as e:  # noqa: BLE001
            logger.error(f"Failed to read session_reports.json: {e}")

    if _is_admin(user):
        tenant = _tenant_of(user)
        rows = [r for r in rows if str(r.get("tenant_id") or "") == str(tenant or "")]
    else:
        uid = str(user.get("id") or "")
        rows = [r for r in rows if str(r.get("user_id") or "") == uid]

    rows.sort(key=lambda r: r.get("completed_at") or "", reverse=True)
    return rows


@router.get("/sessions/{session_id}/detail")
async def get_session_detail(session_id: str, user: Dict[str, Any] = Depends(get_current_user)):
    """Full detail of one finished session: report + transcript + feedback."""
    row = next((r for r in _visible_reports(user) if r.get("session_id") == session_id), None)
    if not row:
        raise HTTPException(status_code=404, detail="Session introuvable.")

    # ── Transcript: prefer the CRM report's transcript, fall back to the
    # in-memory conversation history (covers a session that finished in this
    # process before its report was written).
    crm = row.get("crm_report") if isinstance(row.get("crm_report"), dict) else {}
    transcript: List[Dict[str, str]] = list(crm.get("raw_transcript") or [])

    # ── Feedback left by the trainee on this session ──
    feedback_path = os.path.join(data_dir(), "session_feedback.json")
    feedback: Optional[Dict[str, Any]] = None
    if os.path.exists(feedback_path):
        try:
            with open(feedback_path, "r", encoding="utf-8") as f:
                all_feedback = json.load(f)
            if isinstance(all_feedback, list):
                feedback = next(
                    (fb for fb in all_feedback if isinstance(fb, dict) and fb.get("session_id") == session_id),
                    None,
                )
        except Exception as e:  # noqa: BLE001
            logger.error(f"Failed to read session_feedback.json: {e}")

    # ── Owner display name ──
    owner = store.get_user(str(row.get("user_id") or ""))
    owner_name = store.public_user(owner).get("full_name") if owner else None

    return {
        "session_id": session_id,
        "mode": row.get("mode"),
        "level": row.get("level"),
        "visit_format": row.get("visit_format"),
        "doctor_style": row.get("doctor_style"),
        "product_focus": row.get("product_focus"),
        "duration_seconds": row.get("duration_seconds"),
        "completed_at": row.get("completed_at"),
        "unscored": bool(row.get("unscored", False)),
        "overall_score": row.get("overall_score"),
        "step_scores": row.get("step_scores") or {},
        "strengths": row.get("strengths") or [],
        "areas_for_improvement": row.get("areas_for_improvement") or [],
        "level_progression": row.get("level_progression"),
        "messages": row.get("messages"),
        "owner_name": owner_name,
        "transcript": transcript,
        "crm": {
            "context": crm.get("context"),
            "doctor_specialty": crm.get("doctor_specialty"),
            "material_left": crm.get("material_left") or [],
            "level_at_session": crm.get("level_at_session"),
            "engagement_level": crm.get("engagement_level"),
            "need_identified": crm.get("need_identified"),
            "message_delivered": crm.get("message_delivered"),
            "objections_encountered": crm.get("objections_encountered"),
            "soncas_detected": crm.get("soncas_detected"),
            "next_step": crm.get("next_step"),
            "next_step_date": crm.get("next_step_date"),
        },
        "feedback": feedback,
    }
