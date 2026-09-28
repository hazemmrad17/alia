"""Tenant isolation: one client's data must be invisible to another's.

These are the rules that were retrofitted after the stores became multi-tenant,
so they are the ones most likely to regress. The answer is deliberately 404 and
not 403: a 403 would confirm that an account with that id exists next door.
"""
from __future__ import annotations


def test_admin_reads_only_their_own_tenant(api, seed, other_tenant):
    listing = api.get("/api/v1/auth/users", headers=seed.headers["admin"]).json()

    emails = {entry["email"] for entry in listing["users"]}

    assert emails == {"admin@vital.tn", "doctor@vital.tn", "delegate@vital.tn"}


def test_patch_across_tenants_is_a_404(api, seed, other_tenant):
    target = other_tenant.accounts["delegate"]

    response = api.patch(
        f"/api/v1/auth/users/{target['id']}",
        headers=seed.headers["admin"],
        json={"full_name": "Pris de vitesse"},
    )

    assert response.status_code == 404

    # And nothing was written.
    from app.auth import store

    assert store.get_user(target["id"])["full_name"] == "B delegate"


def test_delete_across_tenants_is_a_404(api, seed, other_tenant):
    target = other_tenant.accounts["doctor"]

    response = api.delete(
        f"/api/v1/auth/users/{target['id']}", headers=seed.headers["admin"]
    )

    assert response.status_code == 404

    from app.auth import store

    assert store.get_user(target["id"]) is not None


def test_reset_password_across_tenants_is_a_404(api, seed, other_tenant):
    target = other_tenant.accounts["delegate"]

    response = api.post(
        f"/api/v1/auth/users/{target['id']}/password",
        headers=seed.headers["admin"],
        json={"new_password": "Hijacked@2026"},
    )

    assert response.status_code == 404


def test_other_tenant_delegate_is_not_in_my_team_log(api, seed, other_tenant):
    response = api.get(
        "/api/v1/team/sessions",
        headers=seed.headers["admin"],
        params={"delegate": other_tenant.accounts["delegate"]["id"]},
    )

    assert response.status_code == 404


def test_other_tenant_doctor_cannot_be_claimed(api, seed, other_tenant):
    response = api.post(
        "/api/v1/doctors",
        headers=seed.headers["admin"],
        json={"doctor_id": other_tenant.accounts["doctor"]["id"]},
    )

    assert response.status_code == 404


def test_other_tenant_doctor_roster_row_is_a_404(api, seed, other_tenant):
    response = api.get(
        "/api/v1/doctors/sessions",
        headers=seed.headers["admin"],
        params={"doctor": other_tenant.accounts["doctor"]["id"]},
    )

    assert response.status_code == 404


def test_post_users_ignores_a_planted_tenant(api, seed):
    """The body's tenant is ignored: an admin cannot create an account next door."""
    response = api.post(
        "/api/v1/auth/users",
        headers=seed.headers["admin"],
        json={
            "email": "mole@clinique-b.tn",
            "password": "Alia@2026",
            "full_name": "Taupe",
            "role": "doctor",
            "tenant_id": "clinique-b",
        },
    )

    assert response.status_code == 201
    assert response.json()["tenant_id"] == "vital"


def test_another_tenants_report_is_invisible(api, seed, other_tenant, reports):
    reports.add(
        session_id="b-session-1",
        user_id=other_tenant.accounts["delegate"]["id"],
        tenant_id=other_tenant.tenant_id,
        mode="training",
        level="junior",
        completed_at="2026-09-24T10:00:00",
        overall_score=91.0,
    )

    response = api.get(
        "/api/v1/dashboard/saved-sessions",
        headers=seed.headers["admin"],
        params={"include_scores": True, "limit": 200},
    )

    assert response.status_code == 200
    assert "b-session-1" not in {row["session_id"] for row in response.json()["sessions"]}

    # The other tenant does see it — the rule is isolation, not censorship.
    neighbour = api.get(
        "/api/v1/dashboard/saved-sessions",
        headers=other_tenant.headers["admin"],
        params={"include_scores": True, "limit": 200},
    )

    assert "b-session-1" in {row["session_id"] for row in neighbour.json()["sessions"]}


def test_a_deleted_owner_belongs_to_no_tenant(api, seed, other_tenant, reports):
    """A report whose owner is gone is not silently re-homed into the default tenant."""
    reports.add(
        session_id="orphan-1",
        user_id=other_tenant.accounts["delegate"]["id"],
        tenant_id=other_tenant.tenant_id,
        mode="training",
        overall_score=88.0,
        completed_at="2026-09-24T10:00:00",
    )

    # The neighbour deletes their own delegate; the assignment goes with it.
    deleted = api.delete(
        f"/api/v1/auth/users/{other_tenant.accounts['delegate']['id']}",
        headers=other_tenant.headers["admin"],
    )
    assert deleted.status_code == 204

    for headers in (seed.headers["admin"], other_tenant.headers["admin"]):
        listing = api.get(
            "/api/v1/dashboard/saved-sessions",
            headers=headers,
            params={"include_scores": True, "limit": 200},
        )
        assert "orphan-1" not in {row["session_id"] for row in listing.json()["sessions"]}


def test_deleting_an_account_purges_both_assignments(api, seed):
    from app.auth import team

    doctor_id = seed.doctor["id"]
    delegate_id = seed.delegate["id"]

    assert team.manager_of_doctor(doctor_id) == seed.admin["id"]
    assert team.manager_of(delegate_id) == seed.admin["id"]

    assert (
        api.delete(f"/api/v1/auth/users/{doctor_id}", headers=seed.headers["admin"]).status_code == 204
    )
    assert (
        api.delete(f"/api/v1/auth/users/{delegate_id}", headers=seed.headers["admin"]).status_code
        == 204
    )

    assert team.manager_of_doctor(doctor_id) is None
    assert team.manager_of(delegate_id) is None
    assert api.get("/api/v1/doctors", headers=seed.headers["admin"]).json()["doctors"] == []
    assert api.get("/api/v1/team", headers=seed.headers["admin"]).json()["delegates"] == []
