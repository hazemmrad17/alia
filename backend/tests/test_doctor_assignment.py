"""The admin–doctor relationship: who may be assigned, and who may move them."""
from __future__ import annotations


def test_the_seeded_doctor_is_already_followed(api, seed):
    body = api.get("/api/v1/doctors", headers=seed.headers["admin"]).json()

    assert [entry["id"] for entry in body["doctors"]] == [seed.doctor["id"]]
    assert body["doctors"][0]["assigned_at"] is not None


def test_only_a_doctor_can_be_followed(api, seed):
    """A delegate is a member of the team, not a doctor on the list."""
    response = api.post(
        "/api/v1/doctors",
        headers=seed.headers["admin"],
        json={"doctor_id": seed.delegate["id"]},
    )

    assert response.status_code == 400


def test_an_unknown_doctor_is_a_404(api, seed):
    response = api.post(
        "/api/v1/doctors", headers=seed.headers["admin"], json={"doctor_id": "does-not-exist"}
    )

    assert response.status_code == 404


def test_only_an_admin_can_assign_a_doctor(api, seed):
    response = api.post(
        "/api/v1/doctors",
        headers=seed.headers["delegate"],
        json={"doctor_id": seed.doctor["id"]},
    )

    assert response.status_code == 403


def test_release_then_follow_again(api, seed):
    doctor_id = seed.doctor["id"]

    assert api.delete(f"/api/v1/doctors/{doctor_id}", headers=seed.headers["admin"]).status_code == 200
    assert api.get("/api/v1/doctors", headers=seed.headers["admin"]).json()["doctors"] == []

    again = api.post("/api/v1/doctors", headers=seed.headers["admin"], json={"doctor_id": doctor_id})
    assert again.status_code == 200
    assert [entry["id"] for entry in api.get("/api/v1/doctors", headers=seed.headers["admin"]).json()["doctors"]] == [doctor_id]


def test_a_doctor_i_do_not_follow_cannot_be_released(api, seed, other_tenant):
    response = api.delete(
        f"/api/v1/doctors/{other_tenant.accounts['doctor']['id']}", headers=seed.headers["admin"]
    )

    assert response.status_code == 404


def test_a_handover_leaves_a_trace(api, seed):
    """Moving a doctor to another admin is recorded, not silent.

    An assignment is an administrative act, so the admin who takes someone back
    can see whose list they came from. Without this the transfer is invisible
    and the new manager has no way to ask who used to follow the doctor.
    """
    created = api.post(
        "/api/v1/auth/users",
        headers=seed.headers["admin"],
        json={
            "email": "second.admin@vital.tn",
            "password": "Alia@2026",
            "full_name": "Second Admin",
            "role": "admin",
        },
    )
    assert created.status_code == 201

    login = api.post(
        "/api/v1/auth/login",
        json={"email": "second.admin@vital.tn", "password": "Alia@2026"},
    )
    second = {"Authorization": f"Bearer {login.json()['access_token']}"}

    doctor_id = seed.doctor["id"]

    # The first admin already follows the doctor: no predecessor.
    first_view = api.get("/api/v1/doctors", headers=seed.headers["admin"]).json()["doctors"][0]
    assert first_view["previous_manager_name"] is None

    # The second admin takes over.
    assert api.post("/api/v1/doctors", headers=second, json={"doctor_id": doctor_id}).status_code == 200

    # The first admin follows them again, and can now see the handover.
    assert api.post("/api/v1/doctors", headers=seed.headers["admin"], json={"doctor_id": doctor_id}).status_code == 200

    moved = api.get("/api/v1/doctors", headers=seed.headers["admin"]).json()["doctors"][0]
    assert moved["previous_manager_name"] == "Second Admin"
    assert moved["assigned_by_name"] == "Administrateur ALIA"


def test_a_delegate_handover_leaves_a_trace(api, seed):
    created = api.post(
        "/api/v1/auth/users",
        headers=seed.headers["admin"],
        json={
            "email": "second.admin@vital.tn",
            "password": "Alia@2026",
            "full_name": "Second Admin",
            "role": "admin",
        },
    )
    assert created.status_code == 201

    login = api.post(
        "/api/v1/auth/login",
        json={"email": "second.admin@vital.tn", "password": "Alia@2026"},
    )
    second = {"Authorization": f"Bearer {login.json()['access_token']}"}

    delegate_id = seed.delegate["id"]

    assert api.post("/api/v1/team", headers=second, json={"delegate_id": delegate_id}).status_code in (200, 201)
    assert api.post("/api/v1/team", headers=seed.headers["admin"], json={"delegate_id": delegate_id}).status_code in (200, 201)

    moved = api.get("/api/v1/team", headers=seed.headers["admin"]).json()["delegates"][0]
    assert moved["previous_manager_name"] == "Second Admin"
