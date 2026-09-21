"""
ALIA Avatar - Dashboard API Routes
"""
from fastapi import APIRouter, Query
from typing import Dict, Any, List, Optional
from loguru import logger
import json
import os
from datetime import datetime, timedelta

from app.conversation.orchestrator import orchestrator
from app.models.schemas import SessionStats, CompetenceLevel

router = APIRouter(tags=["dashboard"])


def _data_path(filename: str) -> str:
    return os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "data", filename))


def _load_records(filename: str) -> List[Dict[str, Any]]:
    path = _data_path(filename)
    if not os.path.exists(path):
        return []
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        return data if isinstance(data, list) else []
    except Exception as e:  # noqa: BLE001
        logger.error(f"Failed to read {filename}: {e}")
        return []


# ── Persisted training sessions (durable source of truth) ─────────────────────
#
# Finished sessions are written to disk by POST /session/{id}/complete. The
# in-memory store only knows the current process, so every dashboard metric is
# built from the reports on disk: the numbers survive a backend restart.

def _report_rows() -> List[Dict[str, Any]]:
    """Every saved session report, newest first."""
    rows = [r for r in _load_records("session_reports.json") if r.get("session_id")]
    rows.sort(key=lambda r: r.get("completed_at") or "", reverse=True)
    return rows


def _row_score(row: Dict[str, Any]) -> Optional[float]:
    value = row.get("overall_score")
    return float(value) if isinstance(value, (int, float)) else None


def _row_duration(row: Dict[str, Any]) -> float:
    duration = row.get("duration_seconds")
    if not isinstance(duration, (int, float)):
        duration = (row.get("crm_report") or {}).get("duration_seconds")
    return float(duration) if isinstance(duration, (int, float)) else 0.0


def _row_product(row: Dict[str, Any]) -> Optional[str]:
    product = row.get("product_focus")
    if isinstance(product, str) and product:
        return product
    left = (row.get("crm_report") or {}).get("material_left")
    if isinstance(left, list) and left:
        return str(left[0])
    return None


def _parse_iso(value: Any) -> Optional[datetime]:
    if not isinstance(value, str) or not value:
        return None
    try:
        return datetime.fromisoformat(value)
    except ValueError:
        return None


def _week_activity(rows: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Sessions and average score for each of the last 7 days (oldest first)."""
    today = datetime.now().date()
    days = [today - timedelta(days=offset) for offset in range(6, -1, -1)]
    buckets: Dict[Any, Dict[str, Any]] = {}
    for day in days:
        buckets[day] = {
            "day": day.strftime("%a"),
            "date": day.isoformat(),
            "sessions": 0,
            "score": 0.0,
            "_scores": [],
        }
    for row in rows:
        when = _parse_iso(row.get("completed_at"))
        bucket = buckets.get(when.date()) if when else None
        if not bucket:
            continue
        bucket["sessions"] += 1
        score = _row_score(row)
        if score is not None:
            bucket["_scores"].append(score)
    activity = []
    for day in days:
        bucket = buckets[day]
        scores = bucket.pop("_scores")
        bucket["score"] = round(sum(scores) / len(scores), 1) if scores else 0.0
        activity.append(bucket)
    return activity


def _window_rows(
    rows: List[Dict[str, Any]], start: datetime, end: Optional[datetime] = None
) -> List[Dict[str, Any]]:
    """Reports completed inside [start, end)."""
    keep: List[Dict[str, Any]] = []
    for row in rows:
        when = _parse_iso(row.get("completed_at"))
        if not when or when < start:
            continue
        if end is not None and when >= end:
            continue
        keep.append(row)
    return keep


@router.get("/saved-sessions")
async def get_saved_sessions(
    include_scores: bool = Query(
        default=False,
        description="Include the private evaluation (scores, step breakdown, CRM). Admin only.",
    ),
    limit: int = Query(default=50, ge=1, le=500),
    level: Optional[str] = Query(default=None, description="Filter by competence level."),
    visit_format: Optional[str] = Query(default=None, description="Filter by visit format."),
    rated_only: bool = Query(default=False, description="Only sessions that received a rating."),
    since: Optional[str] = Query(
        default=None,
        description="ISO date — keep sessions completed on or after it (day/week/month windows).",
    ),
):
    """Finished sessions persisted on disk, newest first.

    By default the response is DELEGATE-SAFE: no scores, no step breakdown, no
    CRM report — only what the trainee already knows (date, config, duration,
    and the feedback/rating he left). Pass `include_scores=true` for the admin
    view.
    """
    reports = _report_rows()
    feedback = {f.get("session_id"): f for f in _load_records("session_feedback.json")}
    since_dt = _parse_iso(since)

    sessions: List[Dict[str, Any]] = []
    for r in reports:
        sid = r.get("session_id")
        fb = feedback.get(sid, {})
        if level and (r.get("level") or "").lower() != level.lower():
            continue
        if visit_format and (r.get("visit_format") or "").lower() != visit_format.lower():
            continue
        rating = fb.get("rating")
        if rated_only and not (isinstance(rating, int) and rating > 0):
            continue
        if since_dt:
            completed = _parse_iso(r.get("completed_at"))
            if not completed or completed < since_dt:
                continue
        entry: Dict[str, Any] = {
            "session_id": sid,
            "level": r.get("level"),
            "visit_format": r.get("visit_format"),
            "doctor_style": r.get("doctor_style"),
            "product_focus": r.get("product_focus"),
            "messages": r.get("messages", 0),
            "duration_seconds": round(_row_duration(r)),
            "completed_at": r.get("completed_at"),
            "rating": rating,
            "comment": fb.get("comment") or None,
            "would_recommend": fb.get("would_recommend"),
            "has_feedback": bool(fb),
        }
        if include_scores:
            entry.update(
                {
                    "overall_score": r.get("overall_score"),
                    "step_scores": r.get("step_scores", {}),
                    "strengths": r.get("strengths", []),
                    "areas_for_improvement": r.get("areas_for_improvement", []),
                    "level_progression": r.get("level_progression"),
                    "crm_report": r.get("crm_report"),
                }
            )
        sessions.append(entry)

    sessions.sort(key=lambda s: s.get("completed_at") or "", reverse=True)
    rated = [s["rating"] for s in sessions if isinstance(s.get("rating"), int) and s["rating"] > 0]
    now = datetime.now()
    week_ago = now - timedelta(days=7)
    this_week_rows = _window_rows(reports, week_ago)
    previous_week_rows = _window_rows(reports, now - timedelta(days=14), week_ago)

    def _avg_score(rows: List[Dict[str, Any]]) -> Optional[float]:
        scores = [s for s in (_row_score(r) for r in rows) if s is not None]
        return round(sum(scores) / len(scores), 2) if scores else None

    scores_all = [s for s in (_row_score(r) for r in reports) if s is not None]
    avg_score = round(sum(scores_all) / len(scores_all), 2) if scores_all else None
    week_score = _avg_score(this_week_rows)
    previous_score = _avg_score(previous_week_rows)
    week_delta = None
    if week_score is not None and previous_score:
        week_delta = round((week_score - previous_score) / previous_score * 100, 1)

    durations = [_row_duration(r) for r in reports if _row_duration(r) > 0]

    return {
        "total": len(sessions),
        "this_week": sum(1 for s in sessions if (s.get("completed_at") or "") >= week_ago.isoformat()),
        "rated": len(rated),
        "average_rating": round(sum(rated) / len(rated), 1) if rated else None,
        "average_score": avg_score,
        "week_score": week_score,
        "week_delta_percent": week_delta,
        "average_duration_seconds": round(sum(durations) / len(durations)) if durations else None,
        "weekly": _week_activity(reports),
        "filters": {
            "level": level,
            "visit_format": visit_format,
            "rated_only": rated_only,
            "since": since,
        },
        "include_scores": include_scores,
        "sessions": sessions[:limit],
    }


@router.get("/stats", response_model=SessionStats)
async def get_dashboard_stats():
    """Get overall dashboard statistics.

    Read from the reports persisted on disk so a backend restart never wipes the
    dashboard; the in-memory sessions are only a fallback for a fresh install.
    """
    reports = _report_rows()
    if reports:
        scores = [s for s in (_row_score(r) for r in reports) if s is not None]
        level_dist: Dict[str, int] = {level.value: 0 for level in CompetenceLevel}
        product_counts: Dict[str, int] = {}
        for r in reports:
            level_value = r.get("level") or "junior"
            level_dist[level_value] = level_dist.get(level_value, 0) + 1
            product = _row_product(r)
            if product:
                product_counts[product] = product_counts.get(product, 0) + 1

        top_products = sorted(product_counts.items(), key=lambda x: x[1], reverse=True)[:10]
        return SessionStats(
            total_sessions=len(reports),
            average_score=round(sum(scores) / len(scores), 1) if scores else 0.0,
            level_distribution=level_dist,
            top_products=[{"name": p, "count": c} for p, c in top_products],
            recent_sessions=[
                {
                    "id": r.get("session_id"),
                    "mode": "training",
                    "level": r.get("level") or "junior",
                    "product": _row_product(r) or "—",
                    "score": _row_score(r) or 0,
                    "started_at": r.get("completed_at"),
                }
                for r in reports[:10]
            ],
        )

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
    """Get score distribution by level (persisted reports first)."""
    reports = _report_rows()
    if reports:
        distribution = {}
        for level in CompetenceLevel:
            level_rows = [r for r in reports if (r.get("level") or "").lower() == level.value]
            scores = [s for s in (_row_score(r) for r in level_rows) if s is not None]
            distribution[level.value] = {
                "count": len(level_rows),
                "avg_score": round(sum(scores) / len(scores), 1) if scores else 0,
                "min_score": min(scores) if scores else 0,
                "max_score": max(scores) if scores else 0,
            }
        return distribution

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
    """Get average scores per visit step (persisted reports first)."""
    reports = _report_rows()
    if reports:
        step_totals: Dict[str, List[float]] = {}
        for r in reports:
            for step, score in (r.get("step_scores") or {}).items():
                if isinstance(score, (int, float)):
                    step_totals.setdefault(step, []).append(float(score))
        return {
            step: {
                "avg_score": round(sum(scores) / len(scores), 1),
                "count": len(scores),
            }
            for step, scores in step_totals.items()
        }

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
