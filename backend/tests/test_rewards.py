"""Doctor loyalty/rewards: points, tiers, gifts, claims, tenant isolation."""
import json
import os

import pytest


@pytest.fixture()
def rewards_path(api):
    """Path of the rewards store inside the test DATA_DIR."""
    from app.config import data_dir

    return os.path.join(data_dir(), "doctor_rewards.json")


def _doctor_headers(auth):
    return auth("doctor@vital.tn")


def _gift(api, admin_headers, **over):
    payload = {
        "title": over.get("title", "Echantillons HYDRA"),
        "cost": over.get("cost", 100),
        "stock": over.get("stock", 5),
    }
    r = api.post("/api/v1/admin/rewards/gifts", json=payload, headers=admin_headers)
    assert r.status_code == 200, r.text
    return r.json()["gift"]


def _adjust(api, admin_headers, doctor_id, delta):
    r = api.post(
        "/api/v1/admin/rewards/adjust",
        json={"doctor_id": doctor_id, "delta": delta, "reason": "test"},
        headers=admin_headers,
    )
    assert r.status_code == 200, r.text
    return r.json()


def test_overview_starts_empty(api, auth, rewards_path):
    r = api.get("/api/v1/doctor/rewards/overview", headers=_doctor_headers(auth))
    assert r.status_code == 200
    body = r.json()
    assert body["balance"] == 0
    assert body["tier"]["name"] == "Bronze"
    assert body["next_gift"] is None
    assert body["stats"]["pitches_received"] == 0


def test_adjust_and_tiers(api, seed, rewards_path):
    doctor_id = seed.doctor["id"]
    _adjust(api, seed.headers["admin"], doctor_id, 100)
    _adjust(api, seed.headers["admin"], doctor_id, 200)
    body = api.get("/api/v1/doctor/rewards/overview", headers=seed.headers["doctor"]).json()
    assert body["balance"] == 300
    assert body["tier"]["name"] == "Argent"
    assert body["lifetime_points"] == 300
    # Lifetime keeps the tier after spending.
    gift = _gift(api, seed.headers["admin"], cost=300)
    r = api.post(f"/api/v1/doctor/rewards/gifts/{gift['id']}/claim", headers=seed.headers["doctor"])
    assert r.status_code == 200
    assert r.json()["balance"] == 0
    body = api.get("/api/v1/doctor/rewards/overview", headers=seed.headers["doctor"]).json()
    assert body["tier"]["name"] == "Argent"
    assert body["stats"]["gifts_obtained"] == 1


def test_claim_insufficient_and_stock(api, seed, rewards_path):
    doctor_id = seed.doctor["id"]
    gift = _gift(api, seed.headers["admin"], cost=500)
    r = api.post(f"/api/v1/doctor/rewards/gifts/{gift['id']}/claim", headers=seed.headers["doctor"])
    assert r.status_code == 400
    # Zero stock is refused even when affordable.
    gift2 = _gift(api, seed.headers["admin"], title="Rien", cost=0, stock=0)
    r = api.post(f"/api/v1/doctor/rewards/gifts/{gift2['id']}/claim", headers=seed.headers["doctor"])
    assert r.status_code == 400


def test_cross_tenant_doctor_cannot_see_or_claim(api, seed, other_tenant, rewards_path):
    vital_gift = _gift(api, seed.headers["admin"])
    other_doctor_headers = other_tenant.headers["doctor"]
    # Other tenant's gift list is empty — vital's gifts are invisible.
    r = api.get("/api/v1/doctor/rewards/gifts", headers=other_doctor_headers)
    assert r.status_code == 200
    assert r.json()["gifts"] == []
    r = api.post(f"/api/v1/doctor/rewards/gifts/{vital_gift['id']}/claim", headers=other_doctor_headers)
    assert r.status_code == 404


def test_pitch_points_idempotent(api, seed, rewards_path):
    from app.api import rewards

    doctor_id = seed.doctor["id"]
    assert rewards.grant_pitch_points(doctor_id, "vital", "sess-1") is True
    assert rewards.grant_pitch_points(doctor_id, "vital", "sess-1") is False
    assert rewards.grant_feedback_points(doctor_id, "vital", "sess-1") is True
    assert rewards.grant_feedback_points(doctor_id, "vital", "sess-1") is False
    data = json.load(open(rewards_path, encoding="utf-8"))
    pitches = [e for e in data["points_ledger"] if e.get("ref_id") == "sess-1" and e.get("reason") == "pitch_received"]
    feedbacks = [e for e in data["points_ledger"] if e.get("ref_id") == "sess-1" and e.get("reason") == "feedback_given"]
    assert len(pitches) == 1
    assert len(feedbacks) == 1
    body = api.get("/api/v1/doctor/rewards/overview", headers=seed.headers["doctor"]).json()
    assert body["balance"] == 65  # 50 + 15
    assert body["stats"]["pitches_received"] == 1
    assert body["stats"]["feedbacks_given"] == 1


def test_admin_claims_and_delivery(api, seed, rewards_path):
    _adjust(api, seed.headers["admin"], seed.doctor["id"], 100)
    gift = _gift(api, seed.headers["admin"], cost=100)
    r = api.post(f"/api/v1/doctor/rewards/gifts/{gift['id']}/claim", headers=seed.headers["doctor"])
    claim = r.json()["claim"]
    listing = api.get("/api/v1/admin/rewards/claims", headers=seed.headers["admin"]).json()
    assert any(c["id"] == claim["id"] for c in listing["claims"])
    r = api.patch(
        f"/api/v1/admin/rewards/claims/{claim['id']}",
        json={"status": "delivered"},
        headers=seed.headers["admin"],
    )
    assert r.status_code == 200
    assert r.json()["claim"]["delivered_at"]
    mine = api.get("/api/v1/doctor/rewards/claims", headers=seed.headers["doctor"]).json()
    assert any(c["status"] == "delivered" for c in mine["claims"])


def test_doctor_cannot_use_admin_endpoints(api, seed, rewards_path):
    h = seed.headers["doctor"]
    assert api.get("/api/v1/admin/rewards/gifts", headers=h).status_code == 403
    assert api.post("/api/v1/admin/rewards/gifts", json={"title": "x"}, headers=h).status_code == 403
    assert api.post("/api/v1/admin/rewards/adjust", json={"doctor_id": "x", "delta": 1}, headers=h).status_code == 403


def test_next_gift_progress(api, seed, rewards_path):
    cheap = _gift(api, seed.headers["admin"], title="Petit", cost=50)
    dear = _gift(api, seed.headers["admin"], title="Cher", cost=200)
    _adjust(api, seed.headers["admin"], seed.doctor["id"], 100)
    body = api.get("/api/v1/doctor/rewards/overview", headers=seed.headers["doctor"]).json()
    assert body["next_gift"]["id"] == dear["id"]
    assert body["progress_to_next"] == 0.5
    assert body["stats"]["pitches_received"] == 0
