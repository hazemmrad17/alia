"""User accounts persisted as JSON.

The rest of the pilot backend stores its records the same way (sessions,
feedback, support reports), so this stays consistent and needs no database to
run. The API is deliberately narrow — ``find_by_email``, ``create_user`` and
friends — so the PostgreSQL + ``tenant_id`` move in the next phase only has to
reimplement this file, not every caller.
"""
from __future__ import annotations

import json
import os
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from loguru import logger

from app.auth.schemas import UserRole
from app.auth.security import hash_password
from app.config import data_dir, get_settings


def users_path() -> str:
    return os.path.join(data_dir(), "users.json")


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _normalise_email(email: str) -> str:
    return (email or "").strip().lower()


def load_users() -> List[Dict[str, Any]]:
    """Read every account. A missing or corrupt file reads as empty."""
    path = users_path()
    if not os.path.exists(path):
        return []

    try:
        with open(path, "r", encoding="utf-8") as handle:
            records = json.load(handle)
    except Exception as error:  # noqa: BLE001 - a corrupt file must not 500 login
        logger.error(f"Could not read {path}: {error}")
        return []

    return records if isinstance(records, list) else []


def save_users(users: List[Dict[str, Any]]) -> None:
    path = users_path()
    os.makedirs(os.path.dirname(path), exist_ok=True)

    # Write then replace, so a crash mid-write cannot leave accounts unreadable.
    temporary = f"{path}.tmp"
    with open(temporary, "w", encoding="utf-8") as handle:
        json.dump(users, handle, ensure_ascii=False, indent=2)
    os.replace(temporary, path)


def public_user(user: Dict[str, Any]) -> Dict[str, Any]:
    """Strip the password hash before a record leaves the process."""
    return {key: value for key, value in user.items() if key != "password_hash"}


def normalize_tenant(tenant_id: Optional[str]) -> str:
    """A tenant is never empty: an unset one means the install's own."""
    return (tenant_id or "").strip() or get_settings().DEFAULT_TENANT_ID


def tenant_of(user_id: str) -> Optional[str]:
    """The tenant an account belongs to, or None when the account is unknown."""
    user = get_user(user_id)

    return (user or {}).get("tenant_id")


def tenants_by_user() -> Dict[str, Optional[str]]:
    """id → tenant for every account, for one scoped read of the reports."""
    return {user.get("id"): user.get("tenant_id") for user in load_users()}


def same_tenant(left: Optional[str], right: Optional[str]) -> bool:
    """Whether two records share a tenant, treating an unset one as default.

    Every isolation check goes through here so a missing field can never be read
    as "matches everything": None normalises to the install's default tenant,
    which is what an account created before tenancy was tracked belongs to.
    """
    return normalize_tenant(left) == normalize_tenant(right)


def find_by_email(email: str) -> Optional[Dict[str, Any]]:
    wanted = _normalise_email(email)
    for user in load_users():
        if _normalise_email(user.get("email", "")) == wanted:
            return user
    return None


def get_user(user_id: str) -> Optional[Dict[str, Any]]:
    for user in load_users():
        if user.get("id") == user_id:
            return user
    return None


def create_user(
    *,
    email: str,
    password: str,
    full_name: str,
    role: UserRole = UserRole.DELEGATE,
    tenant_id: Optional[str] = None,
    specialty: Optional[str] = None,
    city: Optional[str] = None,
) -> Dict[str, Any]:
    """Add an account. Raises ``ValueError`` when the email is already taken."""
    normalised = _normalise_email(email)
    if find_by_email(normalised):
        raise ValueError("Un compte existe déjà avec cet e-mail.")

    settings = get_settings()
    user = {
        "id": uuid.uuid4().hex,
        "email": normalised,
        "full_name": full_name.strip(),
        "role": role.value if isinstance(role, UserRole) else str(role),
        "tenant_id": normalize_tenant(tenant_id),
        "password_hash": hash_password(password),
        "is_active": True,
        "created_at": _now(),
        "last_login_at": None,
    }

    # A delegate is the only account that progresses through the competence
    # levels, so only a delegate carries a current one. Everyone starts at the
    # bottom: a level is earned, never assumed.
    if user["role"] == UserRole.DELEGATE.value:
        user["current_level"] = "debutant"

    # A doctor is described by where he practises and what he practises; both
    # drive which presentation ALIA opens with, and both are his, not the
    # account's decoration.
    if specialty is not None:
        user["specialty"] = specialty.strip() or None
    if city is not None:
        user["city"] = city.strip() or None

    users = load_users()
    users.append(user)
    save_users(users)

    return user


def touch_last_login(user_id: str) -> None:
    users = load_users()
    for user in users:
        if user.get("id") == user_id:
            user["last_login_at"] = _now()
            break
    else:
        return
    save_users(users)


def set_current_level(user_id: str, level: str) -> Optional[Dict[str, Any]]:
    """Set a delegate's certified level. Returns the account, or None if absent."""
    users = load_users()

    for user in users:
        if user.get("id") != user_id:
            continue

        user["current_level"] = level
        save_users(users)

        return user

    return None


def set_password(user_id: str, password: str) -> bool:
    users = load_users()
    for user in users:
        if user.get("id") == user_id:
            user["password_hash"] = hash_password(password)
            save_users(users)
            return True
    return False


def update_user(
    user_id: str,
    *,
    full_name: Optional[str] = None,
    role: Optional[UserRole] = None,
    is_active: Optional[bool] = None,
    specialty: Optional[str] = None,
    city: Optional[str] = None,
) -> Optional[Dict[str, Any]]:
    """Apply the given fields to one account. Returns it, or ``None`` if absent."""
    users = load_users()

    for user in users:
        if user.get("id") != user_id:
            continue


        if full_name is not None:
            user["full_name"] = full_name.strip()
        if role is not None:
            user["role"] = role.value if isinstance(role, UserRole) else str(role)
        if is_active is not None:
            user["is_active"] = bool(is_active)
        # An empty string clears the field: a blank practice is stored as null,
        # never as "", so "no city recorded" has exactly one spelling.
        if specialty is not None:
            user["specialty"] = specialty.strip() or None
        if city is not None:
            user["city"] = city.strip() or None

        save_users(users)

        return user

    return None


def delete_user(user_id: str) -> bool:
    """Remove an account permanently. Returns whether one was removed."""
    users = load_users()
    remaining = [user for user in users if user.get("id") != user_id]

    if len(remaining) == len(users):
        return False

    save_users(remaining)

    return True


def count_active_admins(exclude_id: Optional[str] = None, tenant_id: Optional[str] = None) -> int:
    """How many usable admin accounts exist besides ``exclude_id``.

    Used to refuse the two edits that would lock everybody out of the platform:
    deactivating the last admin, and demoting the last admin. The count is per
    tenant when one is given, because "the last admin" means the last one who
    can still sign in *here* — counting another tenant's admins would let a
    tenant lock itself out.
    """
    return sum(
        1
        for user in load_users()
        if user.get("role") == UserRole.ADMIN.value
        and user.get("is_active", True)
        and user.get("id") != exclude_id
        and (tenant_id is None or same_tenant(user.get("tenant_id"), tenant_id))
    )


def seed_default_users() -> int:
    """Create the starter accounts on first boot.

    Only runs when ``users.json`` does not exist yet, so it can never overwrite
    accounts created in production. Returns the number of accounts created.
    """
    settings = get_settings()
    if not settings.AUTH_SEED_USERS or os.path.exists(users_path()):
        return 0

    seeds = [
        (settings.AUTH_SEED_ADMIN_EMAIL, settings.AUTH_SEED_ADMIN_PASSWORD,
         "Administrateur ALIA", UserRole.ADMIN),
        (settings.AUTH_SEED_DOCTOR_EMAIL, settings.AUTH_SEED_DOCTOR_PASSWORD,
         "Médecin / Pharmacien", UserRole.DOCTOR),
        (settings.AUTH_SEED_DELEGATE_EMAIL, settings.AUTH_SEED_DELEGATE_PASSWORD,
         "Délégué Médical", UserRole.DELEGATE),
    ]

    created = 0
    for email, password, full_name, role in seeds:
        if not email or not password:
            continue
        try:
            create_user(email=email, password=password, full_name=full_name, role=role)
            created += 1
        except ValueError:
            continue

    if created:
        logger.warning(
            "🔐 Seeded {} starter account(s) in {} — change these passwords before "
            "the pilot goes on a public URL.",
            created,
            users_path(),
        )

    return created
