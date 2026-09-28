# ──────────────────────────────────────────────
# L'équipe de l'administrateur
#
# The admin's relationships with the people on the other side of the platform:
# the delegates who train, and the doctors who receive a presentation. Both are
# persisted the same way the accounts are — a JSON file, written by the same
# write-then-replace discipline so a crash mid-write cannot leave it unreadable.
#
# An assignment is one line: the member's user id and the admin who manages them.
# A member has at most one manager — the field force reads better when "who is my
# manager" has one answer — so assigning an already-assigned member moves them
# rather than doubling them up.
#
# The two audiences share one implementation and differ only in their file and
# the name of the id field, so a fix to assignment semantics cannot land on one
# of them and miss the other.
# ──────────────────────────────────────────────
from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from app.auth import store
from app.config import get_settings

_DELEGATE_FILE = "team.json"
_DOCTOR_FILE = "doctor_team.json"


def _path(filename: str) -> str:
    return os.path.join(os.path.dirname(store.users_path()), filename)


def _read(filename: str) -> List[Dict[str, Any]]:
    path = _path(filename)

    if not os.path.exists(path):
        return []

    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
    except Exception:  # noqa: BLE001
        return []

    return data if isinstance(data, list) else []


def _write(filename: str, assignments: List[Dict[str, Any]]) -> None:
    path = _path(filename)

    os.makedirs(os.path.dirname(path), exist_ok=True)
    tmp = path + ".tmp"

    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(assignments, f, ensure_ascii=False, indent=2)

    os.replace(tmp, path)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _assignment_of(filename: str, id_key: str, member_id: str) -> Optional[Dict[str, Any]]:
    for record in _read(filename):
        if record.get(id_key) == member_id:
            return record

    return None


def _assign(
    filename: str,
    id_key: str,
    member_id: str,
    manager_id: str,
    *,
    assigned_by: Optional[str] = None,
    tenant_id: Optional[str] = None,
) -> Dict[str, Any]:
    """Put a member under a manager, moving them if already assigned.

    Who did it and when is recorded alongside the pair: an assignment is an
    administrative act, so it should be answerable after the fact. Moving a
    member keeps the *current* manager only — the history is not a log file, and
    pretending otherwise would mean maintaining two sources of truth.
    """
    previous = _assignment_of(filename, id_key, member_id) or {}
    records = [a for a in _read(filename) if a.get(id_key) != member_id]
    record = {
        id_key: member_id,
        "manager_id": manager_id,
        "assigned_at": _now(),
        "assigned_by": assigned_by or manager_id,
        "previous_manager_id": previous.get("manager_id"),
        "tenant_id": tenant_id or previous.get("tenant_id"),
    }
    records.append(record)
    _write(filename, records)

    return record


def _unassign(filename: str, id_key: str, member_id: str) -> bool:
    """Remove a member's assignment. True when something was removed."""
    before = _read(filename)
    after = [a for a in before if a.get(id_key) != member_id]

    if len(after) == len(before):
        return False

    _write(filename, after)

    return True


def _manager_of(filename: str, id_key: str, member_id: str) -> Optional[str]:
    for record in _read(filename):
        if record.get(id_key) == member_id:
            return record.get("manager_id")

    return None


def _members_of(filename: str, id_key: str, manager_id: str) -> List[str]:
    """Every member id under a manager, in assignment order."""
    return [a[id_key] for a in _read(filename) if a.get("manager_id") == manager_id and a.get(id_key)]


def _assigned_at(filename: str, id_key: str, member_id: str) -> Optional[str]:
    record = _assignment_of(filename, id_key, member_id)

    return (record or {}).get("assigned_at")


def _field(filename: str, id_key: str, member_id: str, field: str) -> Optional[str]:
    """One stored field of an assignment, or None."""
    record = _assignment_of(filename, id_key, member_id)
    value = (record or {}).get(field)

    return value if isinstance(value, str) and value else None


def _purge(filename: str, id_key: str, user_id: str) -> Dict[str, int]:
    """Forget an account in one assignment file.

    Two rows can name a user: their own assignment (they were a member) and the
    assignment of everyone who reported to them (they were a manager). Deleting
    the manager releases their members rather than leaving them attached to an
    id nobody holds any more.
    """
    before = _read(filename)
    released = sum(1 for a in before if a.get(id_key) == user_id)
    orphaned = sum(1 for a in before if a.get("manager_id") == user_id)
    after = [a for a in before if a.get(id_key) != user_id and a.get("manager_id") != user_id]

    if len(after) != len(before):
        _write(filename, after)

    return {"released": released, "orphaned": orphaned}


# ── Delegates: the admin's training team ─────────────────────────────────────


def assignment_of(delegate_id: str) -> Optional[Dict[str, Any]]:
    """The raw assignment record for a delegate, or None."""
    return _assignment_of(_DELEGATE_FILE, "delegate_id", delegate_id)


def assign(
    delegate_id: str,
    manager_id: str,
    *,
    assigned_by: Optional[str] = None,
    tenant_id: Optional[str] = None,
) -> Dict[str, Any]:
    """Put a delegate under a manager, moving them if already assigned."""
    return _assign(
        _DELEGATE_FILE,
        "delegate_id",
        delegate_id,
        manager_id,
        assigned_by=assigned_by,
        tenant_id=tenant_id,
    )


def unassign(delegate_id: str) -> bool:
    """Remove a delegate's assignment. True when something was removed."""
    return _unassign(_DELEGATE_FILE, "delegate_id", delegate_id)


def manager_of(delegate_id: str) -> Optional[str]:
    """The delegate's manager id, or None."""
    return _manager_of(_DELEGATE_FILE, "delegate_id", delegate_id)


def delegates_of(manager_id: str) -> List[str]:
    """Every delegate id under a manager, in assignment order."""
    return _members_of(_DELEGATE_FILE, "delegate_id", manager_id)


def assigned_at(delegate_id: str) -> Optional[str]:
    """When the delegate joined their manager's team, or None."""
    return _assigned_at(_DELEGATE_FILE, "delegate_id", delegate_id)


def previous_manager_of(delegate_id: str) -> Optional[str]:
    """The manager this delegate was with before the current one, if any.

    Moving a member used to be invisible: the row was rewritten and the admin
    who took someone back had no way to see whose list they came from. The id
    was recorded all along; this is what reads it.
    """
    return _field(_DELEGATE_FILE, "delegate_id", delegate_id, "previous_manager_id")


def assigned_by_of(delegate_id: str) -> Optional[str]:
    """Who granted the delegate's current assignment."""
    return _field(_DELEGATE_FILE, "delegate_id", delegate_id, "assigned_by")


# ── Doctors: the practitioners who receive a presentation ─────────────────────


def doctor_assignment_of(doctor_id: str) -> Optional[Dict[str, Any]]:
    """The raw assignment record for a doctor, or None."""
    return _assignment_of(_DOCTOR_FILE, "doctor_id", doctor_id)


def assign_doctor(
    doctor_id: str,
    manager_id: str,
    *,
    assigned_by: Optional[str] = None,
    tenant_id: Optional[str] = None,
) -> Dict[str, Any]:
    """Put a doctor under a manager, moving them if already assigned."""
    return _assign(
        _DOCTOR_FILE,
        "doctor_id",
        doctor_id,
        manager_id,
        assigned_by=assigned_by,
        tenant_id=tenant_id,
    )


def unassign_doctor(doctor_id: str) -> bool:
    """Remove a doctor's assignment. True when something was removed."""
    return _unassign(_DOCTOR_FILE, "doctor_id", doctor_id)


def manager_of_doctor(doctor_id: str) -> Optional[str]:
    """The doctor's manager id, or None."""
    return _manager_of(_DOCTOR_FILE, "doctor_id", doctor_id)


def doctors_of(manager_id: str) -> List[str]:
    """Every doctor id under a manager, in assignment order."""
    return _members_of(_DOCTOR_FILE, "doctor_id", manager_id)


def doctor_assigned_at(doctor_id: str) -> Optional[str]:
    """When the doctor joined their manager's list, or None."""
    return _assigned_at(_DOCTOR_FILE, "doctor_id", doctor_id)


def previous_manager_of_doctor(doctor_id: str) -> Optional[str]:
    """The admin who followed this doctor before the current one, if any."""
    return _field(_DOCTOR_FILE, "doctor_id", doctor_id, "previous_manager_id")


def doctor_assigned_by(doctor_id: str) -> Optional[str]:
    """Who granted the follow-up of this doctor."""
    return _field(_DOCTOR_FILE, "doctor_id", doctor_id, "assigned_by")


# ── Level progression ────────────────────────────────────────────────────────
#
# A delegate's certified level is what their manager granted them, not the level
# a training session happened to be played at. The account carries the current
# value, and every change is appended to an audit file, because a promotion is an
# administrative act: it must be answerable who did it, when, and from what.

LEVEL_ORDER = ["debutant", "junior", "confirme", "expert"]


def _levels_path() -> str:
    return _path("level_history.json")


def _read_levels() -> List[Dict[str, Any]]:
    path = _levels_path()

    if not os.path.exists(path):
        return []

    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
    except Exception:  # noqa: BLE001
        return []

    return data if isinstance(data, list) else []


def _write_levels(entries: List[Dict[str, Any]]) -> None:
    path = _levels_path()

    os.makedirs(os.path.dirname(path), exist_ok=True)
    tmp = path + ".tmp"

    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(entries, f, ensure_ascii=False, indent=2)

    os.replace(tmp, path)


def current_level_of(delegate_id: str) -> Optional[str]:
    """The delegate's certified level, or None when the account is unknown.

    An account that exists but was never promoted is at the bottom of the
    ladder, so an absent field reads as "debutant" rather than "unknown" — the
    difference matters to every caller, which only ever wants a real level for a
    real account.
    """
    user = store.get_user(delegate_id)

    if not user:
        return None

    level = user.get("current_level")

    return level if isinstance(level, str) and level else "debutant"


def level_history_of(delegate_id: str) -> List[Dict[str, Any]]:
    """Every recorded level change for a delegate, newest first."""
    entries = [e for e in _read_levels() if e.get("delegate_id") == delegate_id]
    entries.sort(key=lambda e: e.get("changed_at") or "", reverse=True)

    return entries


def record_level_change(delegate_id: str, to_level: str, *, changed_by: Optional[str] = None) -> Dict[str, Any]:
    """Set a delegate's level and append the change to the audit trail.

    A change back to the level the delegate already holds writes nothing: the
    trail answers "what was this person's level, and on whose authority", and an
    entry that moves nothing only makes that harder to read. The caller learns
    the difference from the returned ``changed`` flag.
    """
    previous = current_level_of(delegate_id)

    if previous == to_level:
        return {
            "delegate_id": delegate_id,
            "from_level": previous,
            "to_level": to_level,
            "changed_at": _now(),
            "changed_by": changed_by,
            "changed": False,
        }

    entry = {
        "delegate_id": delegate_id,
        "from_level": previous,
        "to_level": to_level,
        "changed_at": _now(),
        "changed_by": changed_by,
    }
    entry["changed"] = True
    entries = _read_levels()
    entries.append(entry)
    _write_levels(entries)
    store.set_current_level(delegate_id, to_level)

    return entry


# ── Lifecycle ────────────────────────────────────────────────────────────────


def purge_user(user_id: str) -> Dict[str, int]:
    """Forget a deleted account in both assignment files.

    Removing an account without this left rows pointing at an id nobody holds any
    more, so "mon équipe" could list a member whose manager no longer exists.
    """
    delegate = _purge(_DELEGATE_FILE, "delegate_id", user_id)
    doctor = _purge(_DOCTOR_FILE, "doctor_id", user_id)

    return {
        "released": delegate["released"] + doctor["released"],
        "orphaned": delegate["orphaned"] + doctor["orphaned"],
    }


def seed_default_assignment() -> None:
    """Give the seeded accounts to the seeded admin on first boot.

    Each file is guarded on its own existence, mirroring the guard on the
    account seeding: it can never overwrite assignments made in production.
    """
    settings = get_settings()
    admin_email = settings.AUTH_SEED_ADMIN_EMAIL

    if not admin_email:
        return

    admin = store.find_by_email(admin_email)

    if not admin:
        return

    if not os.path.exists(_path(_DELEGATE_FILE)) and settings.AUTH_SEED_DELEGATE_EMAIL:
        delegate = store.find_by_email(settings.AUTH_SEED_DELEGATE_EMAIL)

        if delegate:
            assign(
                delegate["id"],
                admin["id"],
                assigned_by=admin["id"],
                tenant_id=admin.get("tenant_id"),
            )

    if not os.path.exists(_path(_DOCTOR_FILE)) and settings.AUTH_SEED_DOCTOR_EMAIL:
        doctor = store.find_by_email(settings.AUTH_SEED_DOCTOR_EMAIL)

        if doctor:
            assign_doctor(
                doctor["id"],
                admin["id"],
                assigned_by=admin["id"],
                tenant_id=admin.get("tenant_id"),
            )
