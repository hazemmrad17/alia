"""Shared fixtures for the API suite.

The application keeps its state in JSON files under a single directory whose
location comes from ``DATA_DIR``. Pointing that at a per-test temporary folder
is what makes this suite safe to run against a real checkout: no test here can
reach the seeded demo data in ``backend/data``.

Each test gets its own client and its own empty store, so the three starter
accounts and the two seeded assignments are created fresh every time by the
application's own startup path — not by hand in the fixture.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path
from types import SimpleNamespace
from typing import Any, Callable, Dict, Iterator, List

import pytest

# The backend package is imported as ``app.*``, so ``backend/`` has to be
# importable no matter which directory pytest was launched from.
BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

SEED_PASSWORD = "Alia@2026"

ADMIN_EMAIL = "admin@vital.tn"
DOCTOR_EMAIL = "doctor@vital.tn"
DELEGATE_EMAIL = "delegate@vital.tn"

OTHER_TENANT = "clinique-b"
OTHER_TENANT_ADMIN = "admin@clinique-b.tn"


@pytest.fixture()
def api(tmp_path, monkeypatch) -> Iterator["TestClient"]:  # noqa: F821
    """A TestClient whose stores live in this test's temporary directory.

    The settings object is cached, so the cache is dropped on both sides of the
    test: entering, so the new ``DATA_DIR`` is read; leaving, so the next test
    starts from a clean cache rather than a stale path.
    """
    from app.config import get_settings

    monkeypatch.setenv("DATA_DIR", str(tmp_path))
    get_settings.cache_clear()

    from fastapi.testclient import TestClient
    from app.main import app

    # As a context manager, so the lifespan runs: that is what seeds the three
    # starter accounts and assigns the seeded delegate and doctor.
    with TestClient(app) as client:
        yield client

    get_settings.cache_clear()


@pytest.fixture()
def auth(api) -> Callable[..., Dict[str, str]]:
    """``auth(email)`` → an Authorization header for that account."""

    def _auth(email: str, password: str = SEED_PASSWORD) -> Dict[str, str]:
        response = api.post(
            "/api/v1/auth/login", json={"email": email, "password": password}
        )
        assert response.status_code == 200, response.text

        return {"Authorization": f"Bearer {response.json()['access_token']}"}

    return _auth


@pytest.fixture()
def seed(api, auth) -> SimpleNamespace:
    """The three starter accounts: their headers and their records."""
    headers = {
        "admin": auth(ADMIN_EMAIL),
        "doctor": auth(DOCTOR_EMAIL),
        "delegate": auth(DELEGATE_EMAIL),
    }

    listing = api.get("/api/v1/auth/users", headers=headers["admin"]).json()["users"]
    by_role = {entry["role"]: entry for entry in listing}

    return SimpleNamespace(
        headers=headers,
        admin=by_role["admin"],
        doctor=by_role["doctor"],
        delegate=by_role["delegate"],
    )


@pytest.fixture()
def other_tenant(api, auth) -> SimpleNamespace:
    """A second tenant, with one account per role, created through the store.

    There is no endpoint that could plant these — ``POST /users`` forces the
    caller's own tenant, which is the point — so the store is the only honest
    way to stand up the neighbour these tests need.
    """
    from app.auth import store, team
    from app.auth.schemas import UserRole

    accounts: Dict[str, Dict[str, Any]] = {}

    for role in ("admin", "delegate", "doctor"):
        accounts[role] = store.create_user(
            email=f"{role}@{OTHER_TENANT}.tn",
            password=SEED_PASSWORD,
            full_name=f"B {role}",
            role=UserRole(role),
            tenant_id=OTHER_TENANT,
        )

    team.assign(
        accounts["delegate"]["id"],
        accounts["admin"]["id"],
        assigned_by=accounts["admin"]["id"],
        tenant_id=OTHER_TENANT,
    )
    team.assign_doctor(
        accounts["doctor"]["id"],
        accounts["admin"]["id"],
        assigned_by=accounts["admin"]["id"],
        tenant_id=OTHER_TENANT,
    )

    headers = {
        "admin": auth(f"admin@{OTHER_TENANT}.tn"),
        "doctor": auth(f"doctor@{OTHER_TENANT}.tn"),
        "delegate": auth(f"delegate@{OTHER_TENANT}.tn"),
    }

    return SimpleNamespace(accounts=accounts, headers=headers, tenant_id=OTHER_TENANT)


@pytest.fixture()
def reports() -> SimpleNamespace:
    """Read and write the stored session reports, the way the API does."""
    from app.config import data_dir

    def path() -> Path:
        return Path(data_dir()) / "session_reports.json"

    def all() -> List[Dict[str, Any]]:
        if not path().exists():
            return []

        with path().open("r", encoding="utf-8") as handle:
            data = json.load(handle)

        return data if isinstance(data, list) else []

    def add(**row: Any) -> Dict[str, Any]:
        rows = all()
        rows.append(row)
        path().parent.mkdir(parents=True, exist_ok=True)

        with path().open("w", encoding="utf-8") as handle:
            json.dump(rows, handle, ensure_ascii=False, indent=2)

        return row

    return SimpleNamespace(path=path, all=all, add=add)


@pytest.fixture()
def live_session() -> Callable[..., Any]:
    """Put a conversation session in the orchestrator's memory.

    Built exactly the way ``start_session`` builds one — same constructor, same
    flow engine — but without the LLM greeting, so a guard can be tested without
    a provider key or a network call.
    """
    from app.conversation.visit_flow import VisitFlowEngine, create_session
    from app.conversation.orchestrator import orchestrator
    from app.models.schemas import (
        CompetenceLevel,
        ConversationMode,
        VisitFormat,
    )

    def _make(
        user_id: str,
        mode: ConversationMode = ConversationMode.TRAINING,
    ) -> Any:
        session = create_session(
            mode=mode,
            level=CompetenceLevel.JUNIOR,
            visit_format=VisitFormat.STANDARD,
            product_focus="Test",
            user_id=user_id,
        )
        orchestrator.sessions[session.id] = session
        orchestrator.flows[session.id] = VisitFlowEngine(session)

        return session

    return _make
