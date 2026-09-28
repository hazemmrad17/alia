"""Auth endpoints: sign in, read the current user, manage accounts."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from loguru import logger

from app.auth import store
from app.auth.deps import get_current_user, require_roles
from app.auth.schemas import (
    ChangePasswordRequest,
    CreateUserRequest,
    LoginRequest,
    ResetPasswordRequest,
    TokenResponse,
    UpdateUserRequest,
    UserListResponse,
    UserPublic,
    UserRole,
)
from app.auth.security import create_access_token, verify_password
from app.config import get_settings

router = APIRouter(tags=["auth"])


@router.post("/login", response_model=TokenResponse)
async def login(request: LoginRequest):
    """Exchange e-mail + password for a bearer token."""
    settings = get_settings()
    user = store.find_by_email(request.email)

    # One message for both "no such account" and "wrong password", so the
    # endpoint cannot be used to enumerate who has an account.
    if not user or not verify_password(request.password, user.get("password_hash", "")):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="E-mail ou mot de passe incorrect.",
        )

    if not user.get("is_active", True):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Ce compte est désactivé.",
        )

    store.touch_last_login(user["id"])

    token = create_access_token(
        subject=user["id"],
        role=user.get("role", UserRole.DELEGATE.value),
        tenant_id=user.get("tenant_id") or settings.DEFAULT_TENANT_ID,
    )

    logger.info(f"🔐 {user.get('email')} signed in as {user.get('role')}")

    return TokenResponse(
        access_token=token,
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user=UserPublic(**store.public_user(user)),
    )


@router.get("/me", response_model=UserPublic)
async def read_me(user: dict = Depends(get_current_user)):
    """The signed-in user — also how the frontend validates a stored token."""
    return UserPublic(**store.public_user(user))


@router.get("/users", response_model=UserListResponse)
async def list_users(current: dict = Depends(require_roles(UserRole.ADMIN))):
    """The caller's tenant's accounts. Admin only, and tenant-scoped.

    A doctor must not read the staff directory; an admin must not read another
    tenant's. Both rules live here, so the roster is exactly the set of accounts
    the caller is allowed to act on.
    """
    users = [
        UserPublic(**store.public_user(user))
        for user in store.load_users()
        if store.same_tenant(user.get("tenant_id"), current.get("tenant_id"))
    ]
    users.sort(key=lambda item: (item.role.value, item.full_name))

    return UserListResponse(total=len(users), users=users)


@router.post("/users", response_model=UserPublic, status_code=status.HTTP_201_CREATED)
async def create_user(
    request: CreateUserRequest,
    current: dict = Depends(require_roles(UserRole.ADMIN)),
):
    """Create an account, in the caller's own tenant. Admin only.

    `tenant_id` from the request body is deliberately ignored: an admin creates
    accounts for their own tenant and nobody else's, otherwise isolation could
    be bypassed by simply planting an account next door.
    """
    try:
        user = store.create_user(
            email=request.email,
            password=request.password,
            full_name=request.full_name,
            role=request.role,
            tenant_id=store.normalize_tenant(current.get("tenant_id")),
            specialty=request.specialty,
            city=request.city,
        )
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error))

    logger.info(f"👤 {request.role.value} account created: {user['email']}")

    return UserPublic(**store.public_user(user))


@router.patch("/users/{user_id}", response_model=UserPublic)
async def update_account(
    user_id: str,
    request: UpdateUserRequest,
    current: dict = Depends(require_roles(UserRole.ADMIN)),
):
    """Rename, re-role or (de)activate an account. Admin only, own tenant only."""
    target = store.get_user(user_id)
    if not target:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Compte introuvable.")

    # Same rule as the roster: an account in another tenant is not editable, and
    # 404 keeps it from being used to probe who exists elsewhere.
    if not store.same_tenant(target.get("tenant_id"), current.get("tenant_id")):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Compte introuvable.")

    is_self = target["id"] == current["id"]

    # Two edits would lock the platform out of its own admin back door, so they
    # are refused rather than merely warned about.
    if is_self and request.is_active is False:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Vous ne pouvez pas désactiver votre propre compte.",
        )

    if is_self and request.role is not None and request.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Vous ne pouvez pas retirer votre propre rôle d'administrateur.",
        )

    losing_admin = (request.role is not None and request.role != UserRole.ADMIN) or (
        request.is_active is False
    )
    if target.get("role") == UserRole.ADMIN.value and losing_admin:
        if store.count_active_admins(exclude_id=target["id"], tenant_id=current.get("tenant_id")) == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Impossible : c'est le dernier administrateur actif.",
            )

    updated = store.update_user(
        user_id,
        full_name=request.full_name,
        role=request.role,
        is_active=request.is_active,
        specialty=request.specialty,
        city=request.city,
    )

    logger.info(f"👤 account updated: {updated['email']} ({updated['role']}, active={updated['is_active']})")

    return UserPublic(**store.public_user(updated))


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_account(
    user_id: str,
    current: dict = Depends(require_roles(UserRole.ADMIN)),
):
    """Remove an account. Admin only.

    For a real typo in a freshly created account. For someone who has left,
    deactivating is the better move: it keeps their sessions attributable.
    """
    target = store.get_user(user_id)
    if not target:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Compte introuvable.")

    if not store.same_tenant(target.get("tenant_id"), current.get("tenant_id")):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Compte introuvable.")

    if target["id"] == current["id"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Vous ne pouvez pas supprimer votre propre compte.",
        )

    if target.get("role") == UserRole.ADMIN.value and store.count_active_admins(
        exclude_id=user_id, tenant_id=current.get("tenant_id")
    ) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Impossible : c'est le dernier administrateur.",
        )

    from app.auth import team

    store.delete_user(user_id)

    # The account is gone, so its assignment must go too: otherwise team.json
    # keeps naming an id that no longer resolves to anyone.
    team.purge_user(user_id)
    logger.info(f"👤 account deleted: {target['email']}")


@router.post("/users/{user_id}/password", status_code=status.HTTP_204_NO_CONTENT)
async def reset_account_password(
    user_id: str,
    request: ResetPasswordRequest,
    current: dict = Depends(require_roles(UserRole.ADMIN)),
):
    """Set a new password for another account. Admin only, own tenant only."""
    target = store.get_user(user_id)
    if not target:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Compte introuvable.")

    if not store.same_tenant(target.get("tenant_id"), current.get("tenant_id")):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Compte introuvable.")

    store.set_password(user_id, request.new_password)
    logger.info(f"🔑 password reset for user {user_id}")


@router.post("/me/password", status_code=status.HTTP_204_NO_CONTENT)
async def change_own_password(
    request: ChangePasswordRequest,
    current: dict = Depends(get_current_user),
):
    """Change your own password. The current one is required, so a stolen token
    alone cannot lock the real owner out of their account."""
    if not verify_password(request.current_password, current.get("password_hash", "")):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Mot de passe actuel incorrect.",
        )

    store.set_password(current["id"], request.new_password)
    logger.info(f"🔑 {current.get('email')} changed their own password")
