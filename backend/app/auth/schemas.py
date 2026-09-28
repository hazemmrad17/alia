"""Request/response models for the auth endpoints."""
from __future__ import annotations

from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, Field, field_validator


class UserRole(str, Enum):
    """Platform roles.

    Two of these are the personas the product specs describe — see
    docs/12-user-stories-summary.md: ``delegate`` is the VITAL sales rep who
    trains against a simulated doctor, ``doctor`` is the healthcare professional
    who receives ALIA's product presentation. ``admin`` runs the platform.
    """

    ADMIN = "admin"
    DOCTOR = "doctor"
    DELEGATE = "delegate"


class LoginRequest(BaseModel):
    email: str = Field(..., min_length=3, max_length=200)
    password: str = Field(..., min_length=1, max_length=200)


def _strip_name(value: Optional[str]) -> Optional[str]:
    """A name is trimmed, and cannot be only whitespace.

    ``min_length=2`` counts spaces, so "  " would otherwise be accepted as a
    name — and the roster is read by people, not by a validator.
    """
    if value is None:
        return None

    cleaned = value.strip()

    if len(cleaned) < 2:
        raise ValueError("Le nom complet est requis.")

    return cleaned


class UserPublic(BaseModel):
    """A user as sent to the client — never includes the password hash."""

    id: str
    email: str
    full_name: str
    role: UserRole
    tenant_id: str
    is_active: bool = True
    created_at: Optional[str] = None
    last_login_at: Optional[str] = None

    # Doctor / pharmacist profile. Empty for the other roles, which have no
    # practice to describe.
    specialty: Optional[str] = None
    city: Optional[str] = None


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: UserPublic


class CreateUserRequest(BaseModel):
    email: str = Field(..., min_length=3, max_length=200)
    password: str = Field(..., min_length=8, max_length=200)
    full_name: str = Field(..., min_length=2, max_length=120)
    role: UserRole = UserRole.DELEGATE
    tenant_id: Optional[str] = None
    specialty: Optional[str] = Field(default=None, max_length=120)
    city: Optional[str] = Field(default=None, max_length=120)

    _clean_name = field_validator("full_name")(_strip_name)


class UserListResponse(BaseModel):
    total: int
    users: List[UserPublic]


class UpdateUserRequest(BaseModel):
    """Partial edit of an account. Absent fields are left untouched.

    Clearing a practice field means sending ``""``: an absent field is "leave it
    alone", which is not the same request as "this doctor has no city".
    """

    full_name: Optional[str] = Field(default=None, min_length=2, max_length=120)
    role: Optional[UserRole] = None
    is_active: Optional[bool] = None
    specialty: Optional[str] = Field(default=None, max_length=120)
    city: Optional[str] = Field(default=None, max_length=120)

    _clean_name = field_validator("full_name")(_strip_name)


class ResetPasswordRequest(BaseModel):
    """Admin sets a new password for someone else — no old one required."""

    new_password: str = Field(..., min_length=8, max_length=200)


class ChangePasswordRequest(BaseModel):
    """The signed-in user changes their own password, so it asks for the old one."""

    current_password: str = Field(..., min_length=1, max_length=200)
    new_password: str = Field(..., min_length=8, max_length=200)
