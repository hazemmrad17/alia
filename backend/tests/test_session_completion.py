"""Completing a session: exactly one row per session, and the right kind of row.

The client posts this once at the end of a visit and the endpoint is written to
be idempotent, because a reload after the last message must not double-count a
visit. A presentation is not a graded exercise either: its row is kept, its
competence fields are not.
"""
from __future__ import annotations

from app.models.schemas import ConversationMode


def _complete(api, session_id, headers, **payload):
    return api.post(
        f"/api/v1/session/{session_id}/complete",
        headers=headers,
        json=payload or {"duration_seconds": 412.0},
    )


def test_a_presentation_is_kept_but_not_scored(api, seed, live_session, reports):
    session = live_session(seed.doctor["id"], mode=ConversationMode.COMMERCIAL)

    response = _complete(api, session.id, seed.headers["doctor"], duration_seconds=412.0)

    assert response.status_code == 200
    assert response.json() == {"saved": True, "session_id": session.id, "scored": False}

    row = next(r for r in reports.all() if r["session_id"] == session.id)
    assert row["mode"] == "commercial"
    assert row["tenant_id"] == "vital"
    assert row["user_id"] == seed.doctor["id"]
    assert row["unscored"] is True
    assert row["overall_score"] is None
    assert row["step_scores"] == {}
    assert row["strengths"] == []
    assert row["areas_for_improvement"] == []

    # A presentation never reaches the manager's competence log.
    team_log = api.get("/api/v1/team/sessions", headers=seed.headers["admin"]).json()
    assert session.id not in {entry["session_id"] for entry in team_log["sessions"]}


def test_completing_twice_keeps_one_row(api, seed, live_session, reports):
    session = live_session(seed.delegate["id"])

    assert _complete(api, session.id, seed.headers["delegate"]).status_code == 200
    assert _complete(api, session.id, seed.headers["delegate"]).status_code == 200

    matching = [r for r in reports.all() if r["session_id"] == session.id]
    assert len(matching) == 1


def test_a_training_session_keeps_its_evaluation(api, seed, live_session, reports):
    session = live_session(seed.delegate["id"], mode=ConversationMode.TRAINING)

    response = _complete(api, session.id, seed.headers["delegate"])

    assert response.status_code == 200
    assert response.json()["scored"] is True

    row = next(r for r in reports.all() if r["session_id"] == session.id)
    assert row["mode"] == "training"
    assert row["user_id"] == seed.delegate["id"]
    assert isinstance(row["overall_score"], (int, float))
    assert row["unscored"] is False

    # And the manager can read it, evaluation included.
    log = api.get("/api/v1/team/sessions", headers=seed.headers["admin"]).json()
    assert session.id in {entry["session_id"] for entry in log["sessions"]}


def test_a_session_lost_to_a_restart_still_reaches_the_dashboard(api, seed, reports):
    """The visit outlived the process, so the client's report is all there is."""
    response = _complete(
        api,
        "vanished-session",
        seed.headers["delegate"],
        level="junior",
        visit_format="standard",
        doctor_style="sceptique",
        mode="training",
    )

    assert response.status_code == 200

    row = next(r for r in reports.all() if r["session_id"] == "vanished-session")
    assert row["user_id"] == seed.delegate["id"]
    assert row["unscored"] is True
    assert row["overall_score"] is None


def test_an_unknown_session_with_nothing_to_report_is_a_404(api, seed):
    response = api.post(
        "/api/v1/session/never-existed/complete", headers=seed.headers["delegate"], json={}
    )

    assert response.status_code == 404


def test_completion_requires_authentication(api):
    response = api.post("/api/v1/session/anything/complete", json={"level": "junior"})

    assert response.status_code == 401


def test_the_mode_breakdown_separates_the_two_kinds(api, seed, live_session, reports):
    reports.add(
        session_id="legacy-anonymous",
        mode=None,
        overall_score=55.0,
        completed_at="2026-09-24T09:00:00",
    )

    presentation = live_session(seed.doctor["id"], mode=ConversationMode.COMMERCIAL)
    _complete(api, presentation.id, seed.headers["doctor"], duration_seconds=120.0)

    body = api.get(
        "/api/v1/dashboard/saved-sessions",
        headers=seed.headers["admin"],
        params={"include_scores": True, "limit": 200},
    ).json()

    # A row written before modes existed reads as training, not as unknown.
    assert body["modes"]["commercial"] == 1
    assert body["modes"]["training"] >= 1

    commercial_only = api.get(
        "/api/v1/dashboard/saved-sessions",
        headers=seed.headers["admin"],
        params={"mode": "commercial", "limit": 200},
    ).json()

    assert [row["session_id"] for row in commercial_only["sessions"]] == [presentation.id]
