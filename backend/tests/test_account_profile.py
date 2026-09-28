"""Editing an account's profile: the practice fields and the name.

The roster is read by people, so a name that is only whitespace is not a name,
and "no city recorded" has exactly one spelling — null, never an empty string.
"""
from __future__ import annotations


def test_an_admin_can_fill_in_a_doctors_practice(api, seed):
    response = api.patch(
        f"/api/v1/auth/users/{seed.doctor['id']}",
        headers=seed.headers["admin"],
        json={"full_name": "Dr Sami Trabelsi", "specialty": "Cardiologie", "city": "Sfax"},
    )

    assert response.status_code == 200

    body = response.json()
    assert body["full_name"] == "Dr Sami Trabelsi"
    assert body["specialty"] == "Cardiologie"
    assert body["city"] == "Sfax"

    # And it is really stored, not only echoed back.
    roster = api.get("/api/v1/doctors", headers=seed.headers["admin"]).json()["doctors"][0]
    assert roster["specialty"] == "Cardiologie"
    assert roster["city"] == "Sfax"


def test_a_practice_field_can_be_cleared(api, seed):
    api.patch(
        f"/api/v1/auth/users/{seed.doctor['id']}",
        headers=seed.headers["admin"],
        json={"specialty": "Cardiologie", "city": "Sfax"},
    )

    response = api.patch(
        f"/api/v1/auth/users/{seed.doctor['id']}",
        headers=seed.headers["admin"],
        json={"specialty": "", "city": ""},
    )

    assert response.status_code == 200
    assert response.json()["specialty"] is None
    assert response.json()["city"] is None

    from app.auth import store

    record = store.get_user(seed.doctor["id"])
    assert record["specialty"] is None
    assert record["city"] is None


def test_an_untouched_field_is_left_alone(api, seed):
    api.patch(
        f"/api/v1/auth/users/{seed.doctor['id']}",
        headers=seed.headers["admin"],
        json={"specialty": "Cardiologie", "city": "Sfax"},
    )

    response = api.patch(
        f"/api/v1/auth/users/{seed.doctor['id']}",
        headers=seed.headers["admin"],
        json={"city": "Tunis"},
    )

    assert response.json()["specialty"] == "Cardiologie"
    assert response.json()["city"] == "Tunis"


def test_a_blank_name_is_refused(api, seed):
    for blank in ("  ", " ", " x"):
        response = api.patch(
            f"/api/v1/auth/users/{seed.delegate['id']}",
            headers=seed.headers["admin"],
            json={"full_name": blank},
        )

        assert response.status_code == 422, blank


def test_a_name_is_trimmed(api, seed):
    response = api.patch(
        f"/api/v1/auth/users/{seed.delegate['id']}",
        headers=seed.headers["admin"],
        json={"full_name": "  Délégué Principal  "},
    )

    assert response.status_code == 200
    assert response.json()["full_name"] == "Délégué Principal"


def test_a_blank_name_is_refused_at_creation(api, seed):
    response = api.post(
        "/api/v1/auth/users",
        headers=seed.headers["admin"],
        json={
            "email": "blank@vital.tn",
            "password": "Alia@2026",
            "full_name": "   ",
            "role": "delegate",
        },
    )

    assert response.status_code == 422


def test_a_created_doctor_carries_their_practice(api, seed):
    response = api.post(
        "/api/v1/auth/users",
        headers=seed.headers["admin"],
        json={
            "email": "new.doctor@vital.tn",
            "password": "Alia@2026",
            "full_name": "Dr Ines Ben Ali",
            "role": "doctor",
            "specialty": "Pédiatrie",
            "city": "Sousse",
        },
    )

    assert response.status_code == 201

    from app.auth import store

    record = store.find_by_email("new.doctor@vital.tn")
    assert record["specialty"] == "Pédiatrie"
    assert record["city"] == "Sousse"


def test_a_blank_practice_is_stored_as_null(api, seed):
    response = api.post(
        "/api/v1/auth/users",
        headers=seed.headers["admin"],
        json={
            "email": "vague.doctor@vital.tn",
            "password": "Alia@2026",
            "full_name": "Dr Sans Ville",
            "role": "doctor",
            "specialty": "  ",
            "city": "",
        },
    )

    assert response.status_code == 201

    from app.auth import store

    record = store.find_by_email("vague.doctor@vital.tn")
    assert record["specialty"] is None
    assert record["city"] is None
