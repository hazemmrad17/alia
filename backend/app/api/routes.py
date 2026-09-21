"""
ALIA Avatar - Core API Routes
"""
import json
import os

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from loguru import logger

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
async def start_session(request: StartSessionRequest):
    """Start a new ALIA conversation session."""
    try:
        response = await orchestrator.start_session(request)
        return response
    except Exception as e:
        logger.error(f"Failed to start session: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/session/start/stream")
async def start_session_stream(request: StartSessionRequest):
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
async def chat(request: ConversationRequest):
    """Send a message to ALIA and receive a response."""
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


@router.post("/session/{session_id}/complete")
async def complete_session(session_id: str, payload: Optional[SessionComplete] = None):
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

        path = os.path.abspath(
            os.path.join(os.path.dirname(__file__), "..", "..", "data", "session_reports.json")
        )
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

            record = {
                "session_id": session_id,
                "level": _val(session.level),
                "visit_format": _val(session.visit_format),
                "doctor_style": _val(getattr(session.doctor_profile, "style", None)),
                "product_focus": session.product_focus,
                "overall_score": scoring.overall_score,
                "step_scores": scoring.step_scores,
                "strengths": scoring.strengths,
                "areas_for_improvement": scoring.areas_for_improvement,
                "level_progression": scoring.level_progression,
                "crm_report": crm.model_dump(),
                "messages": len(session.messages),
                "duration_seconds": round(float(duration), 1),
                "completed_at": session.ended_at.isoformat(timespec="seconds"),
            }
            logger.info(f"Private report saved for session {session_id} (score {scoring.overall_score}/10)")
        else:
            # The visit outlived the process that created it. Keep whatever the
            # client reports so the dashboard still counts it (no scoring).
            if not (info.level or info.visit_format or info.doctor_style):
                raise HTTPException(status_code=404, detail="Session not found")
            record = {
                "session_id": session_id,
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

    path = os.path.join(os.path.dirname(__file__), "..", "..", "data", "session_feedback.json")
    path = os.path.abspath(path)
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

    logger.info(f"Feedback saved for session {session_id}: {feedback.rating}/5")
    return {"saved": True, "session_id": session_id, "total_feedback": len(records)}


# ── Support: problem reports & feedback about ALIA ────────────────────────
# Kept apart from the session feedback above: that one rates a finished visit,
# these are the "something is wrong / here is my idea" notes a trainee (or
# anyone testing ALIA) sends while troubleshooting.

def _support_reports_path() -> str:
    return os.path.abspath(
        os.path.join(os.path.dirname(__file__), "..", "..", "data", "support_reports.json")
    )


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
async def chat_stream(request: ConversationRequest):
    """Send a message to ALIA and stream the reply token by token.

    The body is a newline-delimited JSON stream:
      {"type":"token","value":" Bon"}
      {"type":"token","value":"jour"}
      ...
      {"type":"reply_end","interrupted":false,"current_step":"introduction"}
    """
    from fastapi.responses import StreamingResponse

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
    data_path = os.path.join(os.path.dirname(__file__), "..", "..", "data", "processed", "products_llm.json")
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
