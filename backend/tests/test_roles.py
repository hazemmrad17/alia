"""Role guards: who may read what.

The dashboard's saved-session endpoint is delegate-safe by default, and the
evaluation half of it is admin-only. Both rules were once enforced by
convention, which is another way of saying they were not enforced.
"""
from __future__ import annotations


def test_non_admin_cannot_ask_for_scores(api, seed, reports):
    reports.add(
        session_id="own-1",
        user_id=seed.delegate["id"],
        mode="training",
        level="junior",
        overall_score=72.0,
        completed_at="2026-09-24T10:00:00",
    )

    for role in ("delegate", "doctor"):
        response = api.get(
            "/api/v1/dashboard/saved-sessions",
            headers=seed.headers[role],
            params={"include_scores": True},
        )

        assert response.status_code == 403


def test_a_non_admin_only_ever_sees_their_own_rows(api, seed, reports):
    reports.add(
        session_id="admin-1",
        user_id=seed.admin["id"],
        mode="training",
        overall_score=80.0,
        completed_at="2026-09-24T10:00:00",
    )
    reports.add(
        session_id="delegate-1",
        user_id=seed.delegate["id"],
        mode="training",
        overall_score=61.0,
        completed_at="2026-09-24T11:00:00",
    )

    response = api.get("/api/v1/dashboard/saved-sessions", headers=seed.headers["delegate"])

    assert response.status_code == 200

    body = response.json()
    assert [row["session_id"] for row in body["sessions"]] == ["delegate-1"]

    # Delegate-safe means no evaluation anywhere in the payload.
    assert "overall_score" not in body["sessions"][0]


def test_the_admin_view_does_carry_scores(api, seed, reports):
    reports.add(
        session_id="admin-2",
        user_id=seed.delegate["id"],
        mode="training",
        overall_score=93.5,
        completed_at="2026-09-24T10:00:00",
    )

    response = api.get(
        "/api/v1/dashboard/saved-sessions",
        headers=seed.headers["admin"],
        params={"include_scores": True},
    )

    assert response.status_code == 200
    row = next(r for r in response.json()["sessions"] if r["session_id"] == "admin-2")
    assert row["overall_score"] == 93.5


def test_delegate_team_view_mirrors_their_manager(api, seed):
    response = api.get("/api/v1/team", headers=seed.headers["delegate"])

    assert response.status_code == 200

    body = response.json()
    assert body["manager"]["email"] == "admin@vital.tn"
    assert [entry["id"] for entry in body["delegates"]] == [seed.delegate["id"]]
    assert body["delegates"][0]["current_level"] == "debutant"


def test_doctor_team_view_mirrors_their_manager(api, seed):
    response = api.get("/api/v1/doctors", headers=seed.headers["doctor"])

    assert response.status_code == 200

    body = response.json()
    assert body["manager"]["email"] == "admin@vital.tn"
    assert [entry["id"] for entry in body["doctors"]] == [seed.doctor["id"]]


def test_delegates_cannot_read_a_doctor_roster(api, seed):
    assert api.get("/api/v1/doctors", headers=seed.headers["delegate"]).status_code == 403
    assert api.get("/api/v1/doctors/sessions", headers=seed.headers["delegate"]).status_code == 403


def test_doctors_cannot_read_a_delegate_roster(api, seed):
    assert api.get("/api/v1/team", headers=seed.headers["doctor"]).status_code == 403
    assert api.get("/api/v1/team/sessions", headers=seed.headers["doctor"]).status_code == 403


def test_doctors_cannot_read_the_account_directory(api, seed):
    assert api.get("/api/v1/auth/users", headers=seed.headers["doctor"]).status_code == 403
    assert api.get("/api/v1/auth/users", headers=seed.headers["delegate"]).status_code == 403


def test_doctor_presentation_feed_is_scoped_to_self(api, seed, reports):
    reports.add(
        session_id="presentation-1",
        user_id=seed.doctor["id"],
        mode="commercial",
        level="junior",
        overall_score=None,
        unscored=True,
        completed_at="2026-09-24T10:00:00",
    )

    body = api.get("/api/v1/doctors/sessions", headers=seed.headers["doctor"]).json()

    assert body["scope"] == "self"
    assert [row["session_id"] for row in body["sessions"]] == ["presentation-1"]

    # And the admin reads it through the other side of the same relationship.
    admin_view = api.get("/api/v1/doctors/sessions", headers=seed.headers["admin"]).json()
    assert admin_view["scope"] == "team"
    assert "presentation-1" in {row["session_id"] for row in admin_view["sessions"]}


def test_presentations_stay_out_of_the_training_log(api, seed, reports):
    reports.add(
        session_id="presentation-2",
        user_id=seed.delegate["id"],
        mode="commercial",
        level="junior",
        unscored=True,
        completed_at="2026-09-24T10:00:00",
    )

    body = api.get("/api/v1/team/sessions", headers=seed.headers["admin"]).json()

    assert "presentation-2" not in {row["session_id"] for row in body["sessions"]}
