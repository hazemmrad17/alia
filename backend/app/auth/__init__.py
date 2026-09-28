"""Authentication for the ALIA backend.

Password verification and token signing are implemented with the standard
library only (see ``security``), users live in a small JSON store (see
``store``) and FastAPI dependencies live in ``deps``.
"""
from app.auth.deps import get_current_user, require_roles  # noqa: F401
