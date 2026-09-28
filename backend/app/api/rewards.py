"""
ALIA Avatar - Doctor loyalty/rewards API.

The doctor is Vital's client: he receives pitches from delegates and his
engagement earns Vital Points that he can spend on gifts. All state lives in
backend/data/doctor_rewards.json (git-ignored like the other data files).
"""
import json
import os
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from loguru import logger

from app.auth import store
from app.auth.deps import get_current_user, require_roles
from app.config import data_dir

router = APIRouter(tags=["rewards"])

POINTS_PER_PITCH = 50
POINTS_PER_FEEDBACK = 15
TIERS = [("Bronze", 0), ("Argent", 250), ("Or", 600)]


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _path() -> str:
    return os.path.join(data_dir(), "doctor_rewards.json")


def _default() -> Dict[str, List]:
    return {"gifts": [], "points_ledger": [], "claims": []}


def _load() -> Dict[str, List]:
    path = _path()
    if not os.path.exists(path):
        return _default()
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        if not isinstance(data, dict):
            return _default()
    except Exception as e:  # noqa: BLE001
        logger.error(f"Failed to read doctor_rewards.json: {e}")
        return _default()
    out = _default()
    for key in out:
        if isinstance(data.get(key), list):
            out[key] = data[key]
    return out


def _save(data: Dict[str, List]) -> None:
    path = _path()
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def _tenant_of(user: Dict[str, Any]) -> str:
    return store.tenant_of(str(user.get("id") or "")) or str(user.get("tenant_id") or "")


def _balance(data: Dict[str, List], doctor_id: str) -> int:
    return sum(int(e.get("delta") or 0) for e in data["points_ledger"] if e.get("doctor_id") == doctor_id)


def _lifetime(data: Dict[str, List], doctor_id: str) -> int:
    return sum(int(e.get("delta") or 0) for e in data["points_ledger"] if e.get("doctor_id") == doctor_id and int(e.get("delta") or 0) > 0)


def _tier_for(lifetime: int) -> Dict[str, Any]:
    name, threshold = TIERS[0]
    for candidate, min_points in TIERS:
        if lifetime >= min_points:
            name, threshold = candidate, min_points
    return {"name": name, "min_points": threshold}


def _record_points(data: Dict[str, List], doctor_id: str, tenant_id: str, delta: int, reason: str, ref_id: Optional[str]) -> Dict[str, Any]:
    entry = {
        "id": uuid.uuid4().hex,
        "tenant_id": tenant_id,
        "doctor_id": doctor_id,
        "delta": delta,
        "reason": reason,
        "ref_id": ref_id,
        "created_at": _now(),
    }
    data["points_ledger"].append(entry)
    return entry


# ── Points events ────────────────────────────────────────────────────────────

def grant_pitch_points(doctor_id: str, tenant_id: str, session_id: str) -> bool:
    """Award points once per completed pitch session. Returns True if new."""
    if not doctor_id:
        return False
    data = _load()
    if any(e.get("reason") == "pitch_received" and e.get("ref_id") == session_id for e in data["points_ledger"]):
        return False
    _record_points(data, doctor_id, tenant_id, POINTS_PER_PITCH, "pitch_received", session_id)
    _save(data)
    return True


def grant_feedback_points(doctor_id: str, tenant_id: str, session_id: str) -> bool:
    """Award points once per feedback submitted about a visit."""
    if not doctor_id:
        return False
    data = _load()
    if any(e.get("reason") == "feedback_given" and e.get("ref_id") == session_id for e in data["points_ledger"]):
        return False
    _record_points(data, doctor_id, tenant_id, POINTS_PER_FEEDBACK, "feedback_given", session_id)
    _save(data)
    return True


# ── Doctor endpoints ─────────────────────────────────────────────────────────

@router.get("/doctor/rewards/overview")
async def rewards_overview(user: Dict[str, Any] = Depends(get_current_user)):
    tenant_id = _tenant_of(user)
    doctor_id = str(user.get("id") or "")
    data = _load()
    balance = _balance(data, doctor_id)
    lifetime = _lifetime(data, doctor_id)
    gifts = [g for g in data["gifts"] if g.get("tenant_id") == tenant_id and g.get("active", True)]
    gifts.sort(key=lambda g: int(g.get("cost") or 0))
    next_gift = next((g for g in gifts if int(g.get("cost") or 0) > balance), None)
    pitches = sum(1 for e in data["points_ledger"] if e.get("doctor_id") == doctor_id and e.get("reason") == "pitch_received")
    feedbacks = sum(1 for e in data["points_ledger"] if e.get("doctor_id") == doctor_id and e.get("reason") == "feedback_given")
    gifts_obtained = sum(1 for c in data["claims"] if c.get("doctor_id") == doctor_id)
    progress = 1.0
    if next_gift:
        progress = min(1.0, balance / max(1, int(next_gift.get("cost") or 1)))
    recent = [e for e in data["points_ledger"] if e.get("doctor_id") == doctor_id]
    recent.sort(key=lambda e: e.get("created_at") or "", reverse=True)
    return {
        "balance": balance,
        "lifetime_points": lifetime,
        "tier": _tier_for(lifetime),
        "next_gift": next_gift,
        "progress_to_next": progress,
        "stats": {"pitches_received": pitches, "feedbacks_given": feedbacks, "gifts_obtained": gifts_obtained},
        "recent_ledger": recent[:10],
    }


@router.get("/doctor/rewards/gifts")
async def list_gifts(user: Dict[str, Any] = Depends(get_current_user)):
    tenant_id = _tenant_of(user)
    data = _load()
    gifts = [g for g in data["gifts"] if g.get("tenant_id") == tenant_id and g.get("active", True)]
    gifts.sort(key=lambda g: int(g.get("cost") or 0))
    balance = _balance(data, str(user.get("id") or ""))
    return {"balance": balance, "gifts": gifts}


@router.post("/doctor/rewards/gifts/{gift_id}/claim", dependencies=[Depends(require_roles("doctor", "admin"))])
async def claim_gift(gift_id: str, user: Dict[str, Any] = Depends(get_current_user)):
    tenant_id = _tenant_of(user)
    doctor_id = str(user.get("id") or "")
    data = _load()
    gift = next((g for g in data["gifts"] if g.get("id") == gift_id and g.get("tenant_id") == tenant_id), None)
    if not gift or not gift.get("active", True):
        raise HTTPException(status_code=404, detail="Cadeau introuvable")
    stock = gift.get("stock")
    if stock is not None and int(stock) <= 0:
        raise HTTPException(status_code=400, detail="Rupture de stock")
    balance = _balance(data, doctor_id)
    cost = int(gift.get("cost") or 0)
    if balance < cost:
        raise HTTPException(status_code=400, detail="Points insuffisants")
    _record_points(data, doctor_id, tenant_id, -cost, "gift_claim", gift_id)
    if stock is not None:
        gift["stock"] = int(stock) - 1
    claim = {
        "id": uuid.uuid4().hex,
        "tenant_id": tenant_id,
        "doctor_id": doctor_id,
        "gift_id": gift_id,
        "gift_title": gift.get("title"),
        "status": "requested",
        "requested_at": _now(),
        "delivered_at": None,
    }
    data["claims"].append(claim)
    _save(data)
    return {"claim": claim, "balance": _balance(data, doctor_id)}


@router.get("/doctor/rewards/claims")
async def my_claims(user: Dict[str, Any] = Depends(get_current_user)):
    data = _load()
    doctor_id = str(user.get("id") or "")
    claims = [c for c in data["claims"] if c.get("doctor_id") == doctor_id]
    claims.sort(key=lambda c: c.get("requested_at") or "", reverse=True)
    return {"claims": claims}


# ── Admin endpoints ──────────────────────────────────────────────────────────

@router.get("/admin/rewards/gifts", dependencies=[Depends(require_roles("admin"))])
async def admin_list_gifts(user: Dict[str, Any] = Depends(get_current_user)):
    tenant_id = _tenant_of(user)
    data = _load()
    gifts = [g for g in data["gifts"] if g.get("tenant_id") == tenant_id]
    gifts.sort(key=lambda g: g.get("created_at") or "", reverse=True)
    return {"gifts": gifts}


@router.post("/admin/rewards/gifts", dependencies=[Depends(require_roles("admin"))])
async def admin_create_gift(payload: Dict[str, Any], user: Dict[str, Any] = Depends(get_current_user)):
    tenant_id = _tenant_of(user)
    title = str(payload.get("title") or "").strip()
    if not title:
        raise HTTPException(status_code=422, detail="Titre requis")
    data = _load()
    gift = {
        "id": uuid.uuid4().hex,
        "tenant_id": tenant_id,
        "title": title,
        "description": str(payload.get("description") or "").strip() or None,
        "cost": max(0, int(payload.get("cost") or 0)),
        "stock": payload.get("stock") if payload.get("stock") is None else max(0, int(payload.get("stock"))),
        "active": bool(payload.get("active", True)),
        "created_at": _now(),
    }
    data["gifts"].append(gift)
    _save(data)
    return {"gift": gift}


@router.patch("/admin/rewards/gifts/{gift_id}", dependencies=[Depends(require_roles("admin"))])
async def admin_update_gift(gift_id: str, payload: Dict[str, Any], user: Dict[str, Any] = Depends(get_current_user)):
    tenant_id = _tenant_of(user)
    data = _load()
    gift = next((g for g in data["gifts"] if g.get("id") == gift_id and g.get("tenant_id") == tenant_id), None)
    if not gift:
        raise HTTPException(status_code=404, detail="Cadeau introuvable")
    for field in ("title", "description", "active"):
        if field in payload:
            gift[field] = payload[field]
    if "cost" in payload:
        gift["cost"] = max(0, int(payload["cost"] or 0))
    if "stock" in payload:
        gift["stock"] = None if payload["stock"] is None else max(0, int(payload["stock"] or 0))
    _save(data)
    return {"gift": gift}


@router.get("/admin/rewards/claims", dependencies=[Depends(require_roles("admin"))])
async def admin_list_claims(user: Dict[str, Any] = Depends(get_current_user)):
    tenant_id = _tenant_of(user)
    data = _load()
    claims = [c for c in data["claims"] if c.get("tenant_id") == tenant_id]
    claims.sort(key=lambda c: c.get("requested_at") or "", reverse=True)
    by_doctor = {u["id"]: store.public_user(u) for u in store.load_users()}
    for c in claims:
        doctor = by_doctor.get(str(c.get("doctor_id") or ""))
        c["doctor_name"] = doctor.get("full_name") if doctor else None
    return {"claims": claims}


@router.patch("/admin/rewards/claims/{claim_id}", dependencies=[Depends(require_roles("admin"))])
async def admin_update_claim(claim_id: str, payload: Dict[str, Any], user: Dict[str, Any] = Depends(get_current_user)):
    tenant_id = _tenant_of(user)
    data = _load()
    claim = next((c for c in data["claims"] if c.get("id") == claim_id and c.get("tenant_id") == tenant_id), None)
    if not claim:
        raise HTTPException(status_code=404, detail="Demande introuvable")
    status = str(payload.get("status") or "")
    if status not in ("requested", "delivered", "cancelled"):
        raise HTTPException(status_code=422, detail="Statut invalide")
    claim["status"] = status
    if status == "delivered" and not claim.get("delivered_at"):
        claim["delivered_at"] = _now()
    _save(data)
    return {"claim": claim}


@router.post("/admin/rewards/adjust", dependencies=[Depends(require_roles("admin"))])
async def admin_adjust_points(payload: Dict[str, Any], user: Dict[str, Any] = Depends(get_current_user)):
    tenant_id = _tenant_of(user)
    doctor_id = str(payload.get("doctor_id") or "")
    delta = int(payload.get("delta") or 0)
    if not doctor_id or not delta:
        raise HTTPException(status_code=422, detail="doctor_id et delta requis")
    target = store.get_user(doctor_id)
    if not target or not store.same_tenant(store.tenant_of(doctor_id), tenant_id):
        raise HTTPException(status_code=404, detail="Médecin introuvable")
    data = _load()
    entry = _record_points(data, doctor_id, tenant_id, delta, str(payload.get("reason") or "admin_adjust"), None)
    _save(data)
    return {"entry": entry, "balance": _balance(data, doctor_id)}
