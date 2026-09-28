"""
ALIA Avatar - Core API Routes
"""
import json
import os
from typing import Any, Dict

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from typing import List, Optional
from loguru import logger

from app.auth.deps import get_current_user
from app.config import data_dir

from app.models.schemas import (
    StartSessionRequest,
    StartSessionResponse,
    ConversationRequest,
    ConversationResponse,
    SessionStats,
    ProductKnowledge,
)
from app.conversation.orchestrator import orchestrator

router = APIRouter(tags=["alia"])


@router.post("/session/start", response_model=StartSessionResponse)
async def start_session(request: StartSessionRequest, user: Dict[str, Any] = Depends(get_current_user)):
    """Start a new ALIA conversation session.

    The session belongs to the authenticated account: any client-sent user_id is
    ignored so a session can never be misattributed by the caller.
    """
    request.user_id = user["id"]
    try:
        response = await orchestrator.start_session(request)
        return response
    except Exception as e:
        logger.error(f"Failed to start session: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/session/start/stream")
async def start_session_stream(request: StartSessionRequest, user: Dict[str, Any] = Depends(get_current_user)):
    """Start a session and stream the LLM greeting token by token.

    NDJSON frames:
      {"type":"session","session_id":"…","current_step":"introduction"}
      {"type":"token","value":" Bon"}
      ...
      {"type":"greeting_end"}
    Errors come as {"type":"error","message":"…"}.
    """
    from fastapi.responses import StreamingResponse

    async def body():
        # Reuse start_session for all the defaults/bookkeeping, then stream
        # the greeting directly from the LLM (true token stream, no replay).
        request.user_id = user["id"]
        try:
            response = await orchestrator.start_session(request)
        except Exception as e:  # noqa: BLE001
            logger.error(f"Session start failed: {e}")
            yield json.dumps({"type": "error", "message": str(e)}, ensure_ascii=False) + "\n"
            return
        yield json.dumps(
            {
                "type": "session",
                "session_id": response.session_id,
                "current_step": getattr(response.current_step, "value", None),
            },
            ensure_ascii=False,
        ) + "\n"

        session = orchestrator.sessions[response.session_id]
        accumulated: list[str] = []
        try:
            async for piece in orchestrator.stream_greeting(session, request.mode):
                accumulated.append(piece)
                yield json.dumps({"type": "token", "value": piece}, ensure_ascii=False) + "\n"
        except Exception as e:  # noqa: BLE001
            logger.error(f"Greeting stream failed: {e}")
            yield json.dumps({"type": "error", "message": str(e)}, ensure_ascii=False) + "\n"
            return

        # Persist the greeting in the conversation history.
        from app.models.schemas import ConversationMessage
        text = "".join(accumulated)
        session.messages.append(ConversationMessage(
            role="assistant", content=text, step=session.current_step
        ))
        orchestrator.conversation_histories[session.id].append(
            {"role": "assistant", "content": text}
        )
        yield json.dumps({"type": "greeting_end"}, ensure_ascii=False) + "\n"

    return StreamingResponse(
        body(),
        media_type="application/x-ndjson",
        headers={"Cache-Control": "no-store", "X-Accel-Buffering": "no"},
    )


@router.post("/chat", response_model=ConversationResponse)
async def chat(request: ConversationRequest, user: Dict[str, Any] = Depends(get_current_user)):
    """Send a message to ALIA and receive a response.

    Authenticated, and scoped to the session's owner: a session that belongs to
    another account answers 404 rather than driving someone else's conversation.
    The check only applies while the session is in memory, which is the only
    place a conversation can advance from in the first place.
    """
    session = orchestrator.sessions.get(request.session_id or "")

    if session and session.user_id != user["id"]:
        raise HTTPException(status_code=404, detail="Session introuvable.")

    try:
        response = await orchestrator.send_message(request)
        return response
    except Exception as e:
        logger.error(f"Chat failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


class SessionFeedback(BaseModel):
    """Optional end-of-session feedback (rating stars + free comment)."""
    rating: int = 0
    comment: str = ""
    would_recommend: Optional[bool] = None
    level: Optional[str] = None
    visit_format: Optional[str] = None


class SupportReportInput(BaseModel):
    """A trainee's report: something went wrong, or feedback about ALIA.

    Everything except the message is optional — the scenario context travels
    with it so the team can reproduce what the reporter was actually seeing.
    """
    kind: str = "problem"  # problem | suggestion | feedback
    category: Optional[str] = None
    message: str
    rating: Optional[int] = None  # 1-5, for feedback
    contact: Optional[str] = None
    session_id: Optional[str] = None
    level: Optional[str] = None
    visit_format: Optional[str] = None
    doctor_style: Optional[str] = None
    product_focus: Optional[str] = None
    step: Optional[str] = None
    page: Optional[str] = None


class SessionComplete(BaseModel):
    """What the client knows when a visit ends.

    Sent so the visit still reaches the dashboard when the backend no longer
    holds the session in memory (restart, long visit, tab reload).
    """
    duration_seconds: Optional[float] = None
    level: Optional[str] = None
    visit_format: Optional[str] = None
    doctor_style: Optional[str] = None
    product_focus: Optional[str] = None
    messages: Optional[int] = None
    mode: Optional[str] = None


@router.post("/session/{session_id}/complete")
async def complete_session(session_id: str, payload: Optional[SessionComplete] = None, user: Dict[str, Any] = Depends(get_current_user)):
    """Close the session and persist the PRIVATE evaluation for the admin.

    The trainee never sees this report — it is written to disk so a manager
    can review it later, independently of the in-memory session.
    """
    import os
    from datetime import datetime

    try:
        session = orchestrator.sessions.get(session_id)
        flow = orchestrator.flows.get(session_id)
        info = payload or SessionComplete()

        path = os.path.join(data_dir(), "session_reports.json")
        records = []
        if os.path.exists(path):
            try:
                with open(path, "r", encoding="utf-8") as f:
                    records = json.load(f)
            except Exception:  # noqa: BLE001
                records = []

        def _val(x):
            """Enums may arrive as plain strings depending on the payload."""
            return getattr(x, "value", x)

        if session and flow:
            scoring = orchestrator.scorer.score_session(session, flow)
            crm = orchestrator.scorer.generate_crm_report(session, flow, scoring)
            session.ended_at = session.ended_at or datetime.now()
            session.scores = {
                "overall": scoring.overall_score,
                **scoring.step_scores,
            }
            duration = info.duration_seconds if info.duration_seconds is not None else 0.0
            crm.duration_seconds = int(round(float(duration)))

            mode = _val(session.mode)

            # A commercial presentation is not a graded exercise. The visit
            # report is the artefact, so the row is kept and the competence
            # fields are not: the doctor is never scored, and training averages
            # stay training instead of absorbing presentations. Scoring still
            # runs underneath because the report's engagement and next-step
            # read from it.
            is_presentation = mode == "commercial"

            record = {
                "session_id": session_id,
                # Identity comes from the session, stamped at start; the caller
                # is the fallback for a session created before that stamping.
                "user_id": session.user_id or user["id"],
                "tenant_id": user.get("tenant_id"),
                "mode": mode,
                "level": _val(session.level),
                "visit_format": _val(session.visit_format),
                "doctor_style": _val(getattr(session.doctor_profile, "style", None)),
                "product_focus": session.product_focus,
                "overall_score": None if is_presentation else scoring.overall_score,
                "step_scores": {} if is_presentation else scoring.step_scores,
                "strengths": [] if is_presentation else scoring.strengths,
                "areas_for_improvement": [] if is_presentation else scoring.areas_for_improvement,
                "level_progression": None if is_presentation else scoring.level_progression,
                "crm_report": crm.model_dump(),
                "messages": len(session.messages),
                "duration_seconds": round(float(duration), 1),
                "completed_at": session.ended_at.isoformat(timespec="seconds"),
                "unscored": is_presentation,
            }
            kind = "Visit report" if is_presentation else "Private report"
            logger.info(f"{kind} saved for session {session_id} (mode {mode})")
        else:
            # The visit outlived the process that created it. Keep whatever the
            # client reports so the dashboard still counts it (no scoring).
            if not (info.level or info.visit_format or info.doctor_style):
                raise HTTPException(status_code=404, detail="Session not found")
            record = {
                "session_id": session_id,
                # The session is gone from memory, so identity comes from the
                # signed-in caller — the endpoint is auth-guarded.
                "user_id": user["id"],
                "tenant_id": user.get("tenant_id"),
                "mode": info.mode or "training",
                "level": info.level,
                "visit_format": info.visit_format,
                "doctor_style": info.doctor_style,
                "product_focus": info.product_focus,
                "overall_score": None,
                "step_scores": {},
                "strengths": [],
                "areas_for_improvement": [],
                "level_progression": None,
                "crm_report": {},
                "messages": info.messages or 0,
                "duration_seconds": round(float(info.duration_seconds or 0.0), 1),
                "completed_at": datetime.now().isoformat(timespec="seconds"),
                "unscored": True,
            }
            logger.warning(
                f"Session {session_id} was no longer in memory — saved a config-only report for the dashboard"
            )

        # One row per session: a resent completion updates instead of doubling.
        records = [r for r in records if r.get("session_id") != session_id]
        records.append(record)
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(records, f, ensure_ascii=False, indent=2)

        # Loyalty: a completed commercial pitch the doctor received earns
        # Vital Points (idempotent per session — a resent completion does not
        # double-credit). Failures must not break the completion itself.
        try:
            if record.get("mode") == "commercial" and record.get("unscored"):
                from app.api.rewards import grant_pitch_points
                grant_pitch_points(str(record.get("user_id") or ""), str(record.get("tenant_id") or ""), session_id)
        except Exception as e:  # noqa: BLE001
            logger.warning(f"Rewards grant skipped for {session_id}: {e}")

        # Only the confirmation goes back to the client — never the scores.
        return {"saved": True, "session_id": session_id, "scored": not record.get("unscored", False)}
    except HTTPException:
        raise
    except Exception as e:  # noqa: BLE001
        logger.error(f"Failed to complete session: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/session/{session_id}/feedback")
async def save_session_feedback(session_id: str, feedback: SessionFeedback):
    """Persist the optional trainee feedback for a finished simulation."""
    import os
    from datetime import datetime

    path = os.path.join(data_dir(), "session_feedback.json")
    records = []
    if os.path.exists(path):
        try:
            with open(path, "r", encoding="utf-8") as f:
                records = json.load(f)
        except Exception:  # noqa: BLE001
            records = []

    records.append(
        {
            "session_id": session_id,
            "rating": feedback.rating,
            "comment": feedback.comment,
            "would_recommend": feedback.would_recommend,
            "level": feedback.level,
            "visit_format": feedback.visit_format,
            "saved_at": datetime.now().isoformat(timespec="seconds"),
        }
    )
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(records, f, ensure_ascii=False, indent=2)

    # Loyalty: feedback about a received visit earns points too (once per
    # session), attributed to the doctor the visit report belongs to.
    try:
        from app.api.rewards import grant_feedback_points
        reports_path = os.path.join(data_dir(), "session_reports.json")
        reports = []
        if os.path.exists(reports_path):
            with open(reports_path, "r", encoding="utf-8") as f:
                reports = json.load(f)
        report = next((r for r in reports if r.get("session_id") == session_id), None)
        if report:
            grant_feedback_points(str(report.get("user_id") or ""), str(report.get("tenant_id") or ""), session_id)
    except Exception as e:  # noqa: BLE001
        logger.warning(f"Feedback rewards skipped for {session_id}: {e}")

    logger.info(f"Feedback saved for session {session_id}: {feedback.rating}/5")
    return {"saved": True, "session_id": session_id, "total_feedback": len(records)}


# ── Support: problem reports & feedback about ALIA ────────────────────────
# Kept apart from the session feedback above: that one rates a finished visit,
# these are the "something is wrong / here is my idea" notes a trainee (or
# anyone testing ALIA) sends while troubleshooting.

def _support_reports_path() -> str:
    return os.path.join(data_dir(), "support_reports.json")


def _load_support_reports() -> list:
    path = _support_reports_path()
    if not os.path.exists(path):
        return []
    try:
        with open(path, "r", encoding="utf-8") as f:
            records = json.load(f)
        return records if isinstance(records, list) else []
    except Exception:  # noqa: BLE001 - a corrupt file must not 500 the endpoint
        return []


@router.post("/support/reports")
async def create_support_report(report: SupportReportInput):
    """Store a problem report or a feedback note, newest last."""
    import uuid
    from datetime import datetime

    message = (report.message or "").strip()
    if len(message) < 3:
        raise HTTPException(status_code=422, detail="Merci de decrire le probleme en quelques mots.")

    kind = (report.kind or "problem").strip().lower()
    if kind not in {"problem", "suggestion", "feedback"}:
        kind = "problem"

    records = _load_support_reports()
    record = {
        **report.model_dump(),
        "kind": kind,
        "message": message,
        "id": str(uuid.uuid4()),
        "status": "open",
        "created_at": datetime.now().isoformat(timespec="seconds"),
    }
    records.append(record)

    path = _support_reports_path()
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(records, f, ensure_ascii=False, indent=2)

    logger.info(f"Support report stored ({kind}, {len(message)} chars) id={record['id']}")
    return {"saved": True, "id": record["id"], "total": len(records)}


@router.get("/support/reports")
async def list_support_reports(limit: int = 50, kind: Optional[str] = None):
    """Newest first — the team's inbox of reports and feedback."""
    records = _load_support_reports()
    ordered = sorted(records, key=lambda r: r.get("created_at") or "", reverse=True)
    if kind:
        ordered = [r for r in ordered if r.get("kind") == kind]

    return {
        "total": len(records),
        "open": sum(1 for r in records if r.get("status") != "closed"),
        "reports": ordered[: max(1, min(limit, 200))],
    }


@router.post("/session/{session_id}/advance")
async def advance_session_step(session_id: str, body: dict = None):
    """Manually advance the visit step (user clicked 'Étape suivante').

    Accepts an optional {time_elapsed, time_budget} body so the simulated
    doctor knows where the visit stands in its time budget.
    """
    try:
        body = body or {}
        target = body.get("target")
        if target:
            # Time-driven jump: the header bars decide where the visit stands.
            new_step = await orchestrator.set_step(
                session_id,
                str(target),
                time_elapsed=int(body.get("time_elapsed", 0) or 0),
                time_budget=int(body.get("time_budget", 0) or 0),
            )
            return {"session_id": session_id, "current_step": getattr(new_step, "value", str(new_step))}
        new_step = await orchestrator.advance_step_manual(
            session_id,
            time_elapsed=int(body.get("time_elapsed", 0) or 0),
            time_budget=int(body.get("time_budget", 0) or 0),
        )
        return {"session_id": session_id, "current_step": getattr(new_step, "value", str(new_step))}
    except KeyError:
        raise HTTPException(status_code=404, detail="Session not found")
    except Exception as e:
        logger.error(f"Failed to advance step: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/chat/stream")
async def chat_stream(request: ConversationRequest, user: Dict[str, Any] = Depends(get_current_user)):
    """Send a message to ALIA and stream the reply token by token.

    The body is a newline-delimited JSON stream:
      {"type":"token","value":" Bon"}
      {"type":"token","value":"jour"}
      ...
      {"type":"reply_end","interrupted":false,"current_step":"introduction"}

    Authenticated and owner-scoped like /chat: a stream cannot be opened on
    another account's session.
    """
    from fastapi.responses import StreamingResponse

    session = orchestrator.sessions.get(request.session_id or "")

    if session and session.user_id != user["id"]:
        raise HTTPException(status_code=404, detail="Session introuvable.")

    async def body():
        pieces: list[str] = []
        try:
            async for token in orchestrator.send_message_stream(request):
                pieces.append(token)
                yield json.dumps({"type": "token", "value": token}, ensure_ascii=False) + "\n"
            step = orchestrator.sessions.get(request.session_id or "").current_step if orchestrator.sessions.get(request.session_id or "") else None
            yield json.dumps(
                {"type": "reply_end", "interrupted": False, "current_step": getattr(step, "value", None)},
                ensure_ascii=False,
            ) + "\n"
        except Exception as e:  # noqa: BLE001
            logger.error(f"Chat stream failed: {e}")
            if pieces:
                yield json.dumps({"type": "reply_end", "interrupted": True}, ensure_ascii=False) + "\n"
            else:
                yield json.dumps({"type": "error", "code": "chat_failed", "message": str(e)}, ensure_ascii=False) + "\n"

    return StreamingResponse(
        body(),
        media_type="application/x-ndjson",
        headers={"Cache-Control": "no-store", "X-Accel-Buffering": "no"},
    )


@router.get("/session/{session_id}")
async def get_session(session_id: str):
    """Get session details."""
    session = orchestrator.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session.model_dump()


@router.get("/session/{session_id}/history")
async def get_session_history(session_id: str):
    """Get conversation history for a session."""
    history = orchestrator.get_session_history(session_id)
    return {"session_id": session_id, "messages": history}


@router.get("/sessions")
async def list_sessions():
    """List all sessions."""
    sessions = orchestrator.get_all_sessions()
    return {
        "total": len(sessions),
        "sessions": [s.model_dump() for s in sessions],
    }


@router.get("/products")
async def list_products():
    """List all available products from the catalog."""
    import json, os
    data_path = os.path.join(data_dir(), "processed", "products_llm.json")
    if os.path.exists(data_path):
        with open(data_path, "r", encoding="utf-8") as f:
            products = json.load(f)
        return {
            "total": len(products),
            "products": [
                {
                    "name": p.get("name", ""),
                    "gamme": p.get("gamme", ""),
                    "presentation": p.get("presentation", ""),
                    "packaging": p.get("packaging", ""),
                    "indications": p.get("indications", [])[:5],
                    "age_range": p.get("age_range"),
                    "composition": p.get("composition", []),
                    "posologie": p.get("posologie") or {},
                }
                for p in products
            ],
        }
    return {"total": 0, "products": []}


@router.get("/levels")
async def list_levels():
    """List available ALIA competence levels."""
    return {
        "levels": [
            {
                "id": "debutant",
                "name": "Débutant",
                "description": "Scripted, basic product knowledge, 1 objection handling",
                "min_score": 7.0,
                "requirements": ["Structure respected 90%", "1 engagement per 2 visits", "No compliance errors"],
            },
            {
                "id": "junior",
                "name": "Junior",
                "description": "Interactive, 2-4 questions, 2 objections, 5-10 products",
                "min_score": 8.0,
                "requirements": ["A-C-R-V objections 70%", "Engagement 60%", "CRM complete 80%"],
            },
            {
                "id": "confirme",
                "name": "Confirmé",
                "description": "Autonomous, adapts to style, 3 objections, 15-30 products",
                "min_score": 9.0,
                "requirements": ["Difficult visits 70%", "Long cycle 60%", "Clean language 95%"],
            },
            {
                "id": "expert",
                "name": "Expert",
                "description": "Top performer, difficult visits, coaching ability",
                "min_score": 9.5,
                "requirements": ["Coaching quality 80%", "Portfolio mastery 90%"],
            },
        ],
    }


@router.get("/formats")
async def list_visit_formats():
    """List available visit formats."""
    return {
        "formats": [
            {
                "id": "flash",
                "name": "Flash",
                "duration": "20-60 seconds",
                "description": "Quick visit: Permission → 1 value → 1 benefit → 1 commitment",
                "steps": ["introduction", "argumentation", "conclusion"],
            },
            {
                "id": "standard",
                "name": "Standard",
                "duration": "2-4 minutes",
                "description": "Standard visit: Permission → 2 questions → Synthèse → Arguments → Closing",
                "steps": ["introduction", "sondage", "synthese", "objections", "argumentation", "conclusion"],
            },
            {
                "id": "approfondie",
                "name": "Approfondie",
                "duration": "5-8 minutes",
                "description": "Deep visit: Rich discovery → Segmentation → Evidence → Test plan",
                "steps": ["introduction", "sondage", "synthese", "objections", "argumentation", "conclusion"],
            },
        ],
    }


# ── L'équipe: the admin–delegate relationship ─────────────────────────────────

class TeamAssignInput(BaseModel):
    delegate_id: str


class LevelChangeInput(BaseModel):
    level: str


@router.get("/team")
async def get_team(user: Dict[str, Any] = Depends(get_current_user)):
    """The signed-in admin's delegates, with each one's latest session summary.

    A delegate sees their own assignment mirrored back; everyone else is 403 —
    the roster is a management concern, exactly like the account list.
    """
    from app.auth import store, team

    if user["role"] == "delegate":
        manager_id = team.manager_of(user["id"])
        manager = store.get_user(manager_id) if manager_id else None
        me = store.public_user(user)
        me["current_level"] = team.current_level_of(user["id"])
        return {
            "manager": store.public_user(manager) if manager else None,
            "delegates": [me],
        }

    if user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Votre rôle ne permet pas cette action.")

    delegates = []

    for delegate_id in team.delegates_of(user["id"]):
        delegate = store.get_user(delegate_id)

        if not delegate:
            continue

        # A manager only ever sees their own tenant's team, even if an
        # assignment row names someone outside it.
        if not store.same_tenant(delegate.get("tenant_id"), user.get("tenant_id")):
            continue

        delegates.append(
            {
                **store.public_user(delegate),
                "current_level": team.current_level_of(delegate_id),
                "level_history": team.level_history_of(delegate_id),
                "assigned_at": team.assigned_at(delegate_id),
                **_delegate_trace(delegate_id),
            }
        )

    return {"manager": None, "delegates": delegates}


@router.post("/team/{delegate_id}/promote")
async def promote_delegate(
    delegate_id: str,
    payload: LevelChangeInput,
    user: Dict[str, Any] = Depends(get_current_user),
):
    """Grant a delegate a new certified level, on the record. Admin-only.

    Promotion is a decision, not a formula: the level list gives a threshold, but
    autonomy and compliance are a human judgement, so an admin grants the level
    explicitly and the change is appended to an audit trail — who, when, and from
    which level. Only a delegate of the calling admin can be promoted.
    """
    from app.auth import store, team

    if user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Votre rôle ne permet pas cette action.")

    if team.manager_of(delegate_id) != user["id"]:
        raise HTTPException(status_code=404, detail="Ce délégué n'est pas dans votre équipe.")

    delegate = store.get_user(delegate_id)

    if not delegate:
        raise HTTPException(status_code=404, detail="Compte introuvable.")

    if not store.same_tenant(delegate.get("tenant_id"), user.get("tenant_id")):
        raise HTTPException(status_code=404, detail="Ce délégué n'est pas dans votre équipe.")

    target = (payload.level or "").strip().lower()

    if target not in team.LEVEL_ORDER:
        raise HTTPException(status_code=400, detail="Niveau inconnu.")

    if team.current_level_of(delegate_id) == target:
        raise HTTPException(status_code=400, detail="Ce délégué est déjà à ce niveau.")

    change = team.record_level_change(delegate_id, target, changed_by=user["id"])
    logger.info(f"Delegate {delegate_id} promoted to {target} by admin {user['id']}")

    return {
        "change": change,
        "delegate": {
            **store.public_user(delegate),
            "current_level": target,
            "level_history": team.level_history_of(delegate_id),
        },
    }


@router.post("/team")
async def assign_to_team(payload: TeamAssignInput, user: Dict[str, Any] = Depends(get_current_user)):
    """Put a delegate under the signed-in admin. Admin-only, re-assigning is a move."""
    from app.auth import store, team

    if user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Votre rôle ne permet pas cette action.")

    delegate = store.get_user(payload.delegate_id)

    if not delegate:
        raise HTTPException(status_code=404, detail="Compte introuvable.")

    if delegate["role"] != "delegate":
        raise HTTPException(status_code=400, detail="Seul un délégué médical peut être affecté à une équipe.")

    # 404, not 403: an account in another tenant should look absent, not
    # "off limits", so this cannot be used to probe who exists elsewhere.
    if not store.same_tenant(delegate.get("tenant_id"), user.get("tenant_id")):
        raise HTTPException(status_code=404, detail="Compte introuvable.")

    record = team.assign(
        payload.delegate_id,
        user["id"],
        assigned_by=user["id"],
        tenant_id=user.get("tenant_id"),
    )
    logger.info(f"Delegate {payload.delegate_id} assigned to admin {user['id']}")

    return {"assignment": record, "delegate": store.public_user(delegate)}


@router.delete("/team/{delegate_id}")
async def remove_from_team(delegate_id: str, user: Dict[str, Any] = Depends(get_current_user)):
    """Release a delegate from their manager. Admin-only; must be their own delegate."""
    from app.auth import team

    if user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Votre rôle ne permet pas cette action.")

    if team.manager_of(delegate_id) != user["id"]:
        raise HTTPException(status_code=404, detail="Ce délégué n'est pas dans votre équipe.")

    removed = team.unassign(delegate_id)

    if not removed:
        raise HTTPException(status_code=404, detail="Ce délégué n'est pas dans votre équipe.")

    logger.info(f"Delegate {delegate_id} released by admin {user['id']}")

    return {"removed": True}


@router.get("/team/sessions")
async def list_team_sessions(
    delegate: Optional[str] = Query(default=None, description="Restrict the log to one delegate id."),
    level: Optional[str] = Query(default=None, description="Filter by the level the session was played at."),
    visit_format: Optional[str] = Query(default=None, description="Filter by visit format."),
    since: Optional[str] = Query(default=None, description="ISO date — sessions completed on or after it."),
    limit: int = Query(default=100, ge=1, le=500),
    user: Dict[str, Any] = Depends(get_current_user),
):
    """The admin's team session log: every finished session of their delegates.

    This is the per-person counterpart to /dashboard/saved-sessions. That
    endpoint stays anonymous on purpose — it backs pages a delegate may read,
    so widening it would have leaked identity (and, with include_scores, the
    evaluations) to anyone who asked. Identity-scoped reading therefore lives
    here instead, behind the admin guard, and returns the evaluation fields
    because its only audience is the manager.

    Scope is strictly the admin's own delegates: a session belonging to an
    unassigned delegate, or to the admin themselves, is not in this log.
    """
    from app.api.dashboard import _parse_iso, _report_rows, _row_duration, _row_product
    from app.auth import store, team

    if user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Votre rôle ne permet pas cette action.")

    roster = {}

    for delegate_id in team.delegates_of(user["id"]):
        record = store.get_user(delegate_id)

        if record and store.same_tenant(record.get("tenant_id"), user.get("tenant_id")):
            roster[delegate_id] = {
                "id": delegate_id,
                "full_name": record.get("full_name"),
                "email": record.get("email"),
                "is_active": record.get("is_active", True),
                "current_level": team.current_level_of(delegate_id),
                "assigned_at": team.assigned_at(delegate_id),
                **_delegate_trace(delegate_id),
            }

    if delegate:
        if delegate not in roster:
            raise HTTPException(status_code=404, detail="Ce délégué n'est pas dans votre équipe.")
        roster = {delegate: roster[delegate]}

    since_dt = _parse_iso(since)
    sessions: List[Dict[str, Any]] = []

    for row in _report_rows():
        # Presentations do not belong in the training log: the manager reads
        # competence here, and a doctor's visit report is a different object.
        if (row.get("mode") or "training") != "training":
            continue

        user_id = row.get("user_id")

        if user_id not in roster:
            continue

        if level and (row.get("level") or "").lower() != level.lower():
            continue

        if visit_format and (row.get("visit_format") or "").lower() != visit_format.lower():
            continue

        completed = _parse_iso(row.get("completed_at"))

        if since_dt and (not completed or completed < since_dt):
            continue

        sessions.append(
            {
                "session_id": row.get("session_id"),
                "user_id": user_id,
                "user_name": roster[user_id]["full_name"],
                "mode": "training",
                "level": row.get("level"),
                "visit_format": row.get("visit_format"),
                "doctor_style": row.get("doctor_style"),
                "product_focus": _row_product(row),
                "messages": row.get("messages", 0),
                "duration_seconds": round(_row_duration(row)),
                "completed_at": row.get("completed_at"),
                "overall_score": row.get("overall_score"),
                "step_scores": row.get("step_scores", {}),
                "level_progression": row.get("level_progression"),
            }
        )

    sessions.sort(key=lambda s: s.get("completed_at") or "", reverse=True)

    return {
        "total": len(sessions),
        "delegates": list(roster.values()),
        "filters": {"delegate": delegate, "level": level, "visit_format": visit_format, "since": since},
        "sessions": sessions[:limit],
    }


# ── Les médecins: the admin–doctor relationship ────────────────────────────────
#
# The same shape as the team, for the other audience. A doctor is not scored and
# has no level ladder (docs/11-user-story-doctor.md: "Scoring: No", "Levels:
# None"), so the manager's questions are different ones: who is this doctor, and
# what was presented to him.


class DoctorAssignInput(BaseModel):
    doctor_id: str


def _named(user_id: Optional[str]) -> Optional[str]:
    """The full name behind an id, or None when the account is gone.

    An id alone is not an answer to "whose list was this doctor on before"; the
    reader is an admin looking at a roster, not a database.
    """
    from app.auth import store

    if not user_id:
        return None

    record = store.get_user(user_id)

    return record.get("full_name") if record else None


def _delegate_trace(delegate_id: str) -> Dict[str, Any]:
    """The handover trace of a delegate's assignment, for the team roster."""
    from app.auth import team

    previous = team.previous_manager_of(delegate_id)

    return {
        "previous_manager_id": previous,
        "previous_manager_name": _named(previous),
        "assigned_by_name": _named(team.assigned_by_of(delegate_id)),
    }


def _doctor_trace(doctor_id: str) -> Dict[str, Any]:
    """The handover trace of a doctor's assignment, for the doctor roster."""
    from app.auth import team

    previous = team.previous_manager_of_doctor(doctor_id)

    return {
        "previous_manager_id": previous,
        "previous_manager_name": _named(previous),
        "assigned_by_name": _named(team.doctor_assigned_by(doctor_id)),
    }


def _doctor_profile(record: Dict[str, Any]) -> Dict[str, Any]:
    """The doctor fields a manager cares about, without the account plumbing."""
    return {
        "id": record["id"],
        "full_name": record.get("full_name"),
        "email": record.get("email"),
        "specialty": record.get("specialty"),
        "city": record.get("city"),
        "is_active": record.get("is_active", True),
    }


def _doctor_roster(manager: Dict[str, Any]) -> Dict[str, Dict[str, Any]]:
    """The admin's doctors, tenant-filtered, keyed by id."""
    from app.auth import store, team

    roster: Dict[str, Dict[str, Any]] = {}

    for doctor_id in team.doctors_of(manager["id"]):
        record = store.get_user(doctor_id)

        if not record or not store.same_tenant(record.get("tenant_id"), manager.get("tenant_id")):
            continue

        roster[doctor_id] = {
            **_doctor_profile(record),
            "assigned_at": team.doctor_assigned_at(doctor_id),
            **_doctor_trace(doctor_id),
        }

    return roster


@router.get("/doctors")
async def get_doctors(user: Dict[str, Any] = Depends(get_current_user)):
    """The signed-in admin's doctors; a doctor sees their manager mirrored back.

    The doctor counterpart of /team: same relationship, other audience. A doctor
    is never scored, so what the manager needs is the practice (specialty, city)
    and what was presented — not a competence.
    """
    from app.auth import store, team

    if user["role"] == "doctor":
        manager_id = team.manager_of_doctor(user["id"])
        manager = store.get_user(manager_id) if manager_id else None
        return {"manager": store.public_user(manager) if manager else None, "doctors": [store.public_user(user)]}

    if user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Votre rôle ne permet pas cette action.")

    return {"manager": None, "doctors": list(_doctor_roster(user).values())}


@router.post("/doctors")
async def assign_doctor(payload: DoctorAssignInput, user: Dict[str, Any] = Depends(get_current_user)):
    """Put a doctor under the signed-in admin. Admin-only; re-assigning moves."""
    from app.auth import store, team

    if user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Votre rôle ne permet pas cette action.")

    doctor = store.get_user(payload.doctor_id)

    if not doctor:
        raise HTTPException(status_code=404, detail="Compte introuvable.")

    if doctor["role"] != "doctor":
        raise HTTPException(status_code=400, detail="Seul un médecin ou pharmacien peut être suivi ici.")

    # 404, not 403: an account in another tenant should look absent.
    if not store.same_tenant(doctor.get("tenant_id"), user.get("tenant_id")):
        raise HTTPException(status_code=404, detail="Compte introuvable.")

    record = team.assign_doctor(
        payload.doctor_id,
        user["id"],
        assigned_by=user["id"],
        tenant_id=user.get("tenant_id"),
    )
    logger.info(f"Doctor {payload.doctor_id} assigned to admin {user['id']}")

    return {"assignment": record, "doctor": store.public_user(doctor)}


@router.delete("/doctors/{doctor_id}")
async def remove_doctor(doctor_id: str, user: Dict[str, Any] = Depends(get_current_user)):
    """Release a doctor from their manager. Admin-only; must be their own."""
    from app.auth import team

    if user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Votre rôle ne permet pas cette action.")

    if team.manager_of_doctor(doctor_id) != user["id"]:
        raise HTTPException(status_code=404, detail="Ce médecin n'est pas dans votre périmètre.")

    if not team.unassign_doctor(doctor_id):
        raise HTTPException(status_code=404, detail="Ce médecin n'est pas dans votre périmètre.")

    logger.info(f"Doctor {doctor_id} released by admin {user['id']}")

    return {"removed": True}


@router.get("/doctors/sessions")
async def list_doctor_sessions(
    doctor: Optional[str] = Query(default=None, description="Restrict to one doctor id."),
    since: Optional[str] = Query(default=None, description="ISO date — presentations on or after it."),
    limit: int = Query(default=100, ge=1, le=500),
    user: Dict[str, Any] = Depends(get_current_user),
):
    """Presentations, from whichever side of the relationship is asking.

    An admin reads the presentations received by their own doctors; a doctor
    reads his own. Only `commercial` sessions appear: this is the visit-report
    feed, which is why it filters on mode rather than reusing /team/sessions.
    """
    from app.api.dashboard import _parse_iso, _report_rows, _row_duration, _row_product
    from app.auth import team, store

    if user["role"] == "doctor":
        roster = {
            user["id"]: {
                **_doctor_profile(user),
                "assigned_at": team.doctor_assigned_at(user["id"]),
                **_doctor_trace(user["id"]),
            }
        }
        scope = "self"
    elif user["role"] == "admin":
        roster = _doctor_roster(user)
        scope = "team"
    else:
        raise HTTPException(status_code=403, detail="Votre rôle ne permet pas cette action.")

    if doctor:
        if doctor not in roster:
            raise HTTPException(status_code=404, detail="Ce médecin n'est pas dans votre périmètre.")
        roster = {doctor: roster[doctor]}

    since_dt = _parse_iso(since)
    presentations: List[Dict[str, Any]] = []

    for row in _report_rows():
        if (row.get("mode") or "training") != "commercial":
            continue

        owner = row.get("user_id")

        if owner not in roster:
            continue

        completed = _parse_iso(row.get("completed_at"))

        if since_dt and (not completed or completed < since_dt):
            continue

        report = row.get("crm_report") or {}
        presentations.append(
            {
                "session_id": row.get("session_id"),
                "doctor_id": owner,
                "doctor_name": roster[owner]["full_name"],
                "specialty": roster[owner]["specialty"],
                "city": roster[owner]["city"],
                "product_focus": _row_product(row),
                "visit_format": row.get("visit_format"),
                "need_identified": report.get("need_identified"),
                "engagement_level": report.get("engagement_level"),
                "next_step": report.get("next_step"),
                "next_step_date": report.get("next_step_date"),
                "material_left": report.get("material_left", []),
                "duration_seconds": round(_row_duration(row)),
                "completed_at": row.get("completed_at"),
            }
        )

    presentations.sort(key=lambda p: p.get("completed_at") or "", reverse=True)

    return {
        "total": len(presentations),
        "scope": scope,
        "doctors": list(roster.values()),
        "filters": {"doctor": doctor, "since": since},
        "sessions": presentations[:limit],
    }
