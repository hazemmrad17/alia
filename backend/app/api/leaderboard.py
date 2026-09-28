"""
ALIA Avatar - Delegate leaderboard.

A friendly, tenant-scoped competition board: delegates of the same company see
each other's training activity ranked by total XP (1 XP per point of score,
10 XP for an unscored session). Everyone sees the same board; the caller's own
row is flagged so the UI can highlight it. Read-only, role-agnostic: any
member of a tenant can read it, admins included.
"""
import json
import os
from collections import defaultdict
from typing import Any, Dict, List

from fastapi import APIRouter, Depends
from loguru import logger

from app.auth import store
from app.auth.deps import get_current_user
from app.config import data_dir

router = APIRouter(tags=["leaderboard"])


def _tenant_of(user: Dict[str, Any]):
    return store.tenant_of(str(user.get("id") or "")) or user.get("tenant_id")


@router.get("/leaderboard")
async def get_leaderboard(user: Dict[str, Any] = Depends(get_current_user)):
    """Rank the tenant's delegates by training XP, with the caller highlighted."""
    tenant = _tenant_of(user)
    if not tenant:
        return {"entries": [], "me": None}

    # ── Members of the tenant (delegates + doctors flagged, admins excluded) ──
    members: List[Dict[str, Any]] = []
    try:
        for u in store.load_users():
            if str(u.get("tenant_id") or "") != str(tenant):
                continue
            if str(u.get("role") or "") == "admin":
                continue
            pub = store.public_user(u)
            members.append(
                {
                    "user_id": pub.get("id") or u.get("id"),
                    "full_name": pub.get("full_name") or "—",
                    "role": u.get("role"),
                    "current_level": u.get("current_level"),
                }
            )
    except Exception as e:  # noqa: BLE001
        logger.error(f"leaderboard: failed to list users: {e}")
        return {"entries": [], "me": None}

    # ── Session activity per user ──
    per_user: Dict[str, Dict[str, Any]] = defaultdict(
        lambda: {"sessions": 0, "xp": 0, "scored": 0, "score_sum": 0, "best": None}
    )
    path = os.path.join(data_dir(), "session_reports.json")
    if os.path.exists(path):
        try:
            with open(path, "r", encoding="utf-8") as f:
                raw = json.load(f)
            if isinstance(raw, list):
                for r in raw:
                    if not isinstance(r, dict):
                        continue
                    if str(r.get("tenant_id") or "") != str(tenant):
                        continue
                    uid = str(r.get("user_id") or "")
                    if not uid:
                        continue
                    entry = per_user[uid]
                    entry["sessions"] += 1
                    score = r.get("overall_score")
                    if isinstance(score, (int, float)):
                        entry["xp"] += int(score)
                        entry["scored"] += 1
                        entry["score_sum"] += score
                        entry["best"] = max(entry["best"] or 0, int(score))
                    else:
                        entry["xp"] += 10
        except Exception as e:  # noqa: BLE001
            logger.error(f"leaderboard: failed to read session_reports.json: {e}")

    now_iso = ""
    me_id = str(user.get("id") or "")
    entries: List[Dict[str, Any]] = []
    for m in members:
        uid = str(m["user_id"])
        act = per_user.get(uid, {"sessions": 0, "xp": 0, "scored": 0, "score_sum": 0, "best": None})
        avg = int(round(act["score_sum"] / act["scored"])) if act["scored"] else None
        entries.append(
            {
                **m,
                "sessions": act["sessions"],
                "xp": act["xp"],
                "avg_score": avg,
                "best_score": act["best"],
                "is_me": uid == me_id,
            }
        )

    entries.sort(key=lambda e: (-e["xp"], e["full_name"]))
    for i, e in enumerate(entries, 1):
        e["rank"] = i

    me = next((e for e in entries if e["is_me"]), None)
    return {"entries": entries, "me": me}
