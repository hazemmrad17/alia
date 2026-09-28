# Plan — Doctor "Client Portal": Rewards & Pitch Tracking (Docs 14)

## Repositioning

The doctor is **not a responsible actor** in Vital's organization — he is
**Vital's client**. He does not manage anyone; he *receives* delegate visits
(pitches), and his engagement is rewarded. His space should feel like a
loyalty/progress portal, not a back-office dashboard.

Mental model: **"Mon espace fidélité Vital"** — like an airline or pharmacy
loyalty program:

- Delegates visit / present products to him (via ALIA or in person) → each
  received pitch is a milestone.
- Completing pitches, giving feedback, and attending visits earn **Vital
  Points**.
- Points unlock **gifts** (product samples, goodies, congress invites…) that
  the admin defines per tenant.
- A **progress bar per pitch** shows how far each received pitch/visit is
  along its lifecycle, and an overall progress bar shows how close he is to
  the next gift.

## Data model (backend)

New file `backend/data/doctor_rewards.json` (git-ignored, like the rest):

```json
{
  "gifts": [
    { "id": "…", "tenant_id": "vital", "title": "Échantillonnage HYDRA",
      "description": "…", "cost": 100, "stock": 20, "active": true,
      "image": "…" }
  ],
  "points_ledger": [
    { "id": "…", "tenant_id": "vital", "doctor_id": "…",
      "delta": 50, "reason": "pitch_received", "ref_id": "…",
      "created_at": "…" }
  ],
  "claims": [
    { "id": "…", "tenant_id": "vital", "doctor_id": "…", "gift_id": "…",
      "status": "requested", "requested_at": "…", "delivered_at": null }
  ]
}
```

Points rules (first pass, constant in `app/api/rewards.py`):

| Event | Points |
|---|---|
| Pitch/visit report received (completed session where user is the doctor) | 50 |
| Feedback left on a visit (`session_feedback.json` already exists) | 15 |
| Level progression (existing doctor level field) | bonus per level |

Derived read model (computed on GET, nothing to migrate):

- `balance` = Σ deltas.
- `next_gift` = cheapest active gift with cost > balance; `progress_to_next`
  = balance / next_gift.cost.
- `tier` = Bronze / Argent / Or at 0 / 250 / 600 points (lifetime earned, not
  balance, so tiers don't drop when gifts are claimed).

## Pitch tracking

Reuse existing signals — no new session machinery:

- `session_reports.json` rows where the row's doctor is this user →
  **"Pitches reçus"** timeline (product, delegate name, date, CRM summary).
- Each pitch card gets a lifecycle progress bar derived from the row:
  `reçu → feedback donné → créditée (points granted)`.
- `session_feedback.json` rows link by `session_id` to fill step 2.

## API (`app/api/rewards.py`, mounted under `/api/v1`)

- `GET /doctor/rewards/overview` — balance, tier, next_gift + progress,
  recent ledger, stats (pitches reçus, feedbacks donnés).
- `GET /doctor/rewards/pitches` — received-pitch timeline w/ lifecycle state.
- `GET /doctor/rewards/gifts` — active gifts for the tenant + affordability.
- `POST /doctor/rewards/gifts/{id}/claim` — creates claim, deducts points
  (ledger entry negative), 400 if insufficient or out of stock.
- `GET /doctor/rewards/claims` — my claims + status.

Admin side (existing accounts/permissions guard):

- `GET/POST/PATCH /admin/rewards/gifts` — CRUD gifts for the tenant.
- `GET /admin/rewards/claims` — all claims; `PATCH …/{id}` sets
  `delivered` (+ delivered_at).
- `POST /admin/rewards/adjust` — manual points grant (reason recorded).

All endpoints tenant-scoped via the existing `tenant_id` guards
(same pattern as `team.py`/`routes.py` rosters).

## Frontend (`alia-avatar-admin`)

1. **New doctor home** `src/views/ala/doctor/loyalty-dashboard.tsx`
   (+ route `(pages)/dashboard/loyalty/page.tsx`):
   - Hero card: points balance, tier badge, progress bar to next gift
     ("Plus que 40 pts pour Échantillonnage HYDRA").
   - "Mes pitches reçus" list with per-pitch lifecycle progress bars.
   - Stats chips: pitches reçus, feedbacks donnés, cadeaux obtenus.
2. **Gifts catalog** `src/views/ala/doctor/gifts.tsx`
   (+ `(pages)/dashboard/gifts/page.tsx`): gift cards, claim button enabled
   when balance ≥ cost, "Mes demandes" section with status.
3. **user-role.ts**: add `/dashboard/loyalty` and `/dashboard/gifts` to
   `DOCTOR_PREFIXES` so the doctor role attaches there.
4. **navConfig**: for doctor role, make "Mon espace" point at the loyalty
   dashboard (no rosters, no team management links).
5. **Admin gifts manager** in `src/views/ala/admin/` (gift CRUD + claims
   inbox) linked from the admin nav.

## Implementation order

1. Backend `rewards.py` + data file + tests (`tests/test_rewards.py`:
   balance math, tier, claim success/insufficient/stock-out, tenant
   isolation, points granted once per pitch).
2. Doctor frontend (loyalty dashboard + gifts) with empty states.
3. Admin gifts/claims screens.
4. Wire points grant into the existing completion path in `routes.py`
   (idempotent per session_id — reuse the same guard pattern as
   double-complete in `test_session_completion`).

## Non-goals (for now)

- No payment/e-commerce; gifts are fulfilled manually by the tenant.
- No push notifications; statuses are visible in-portal.
- Multi-tenant gift catalogs are per-tenant rows, no sharing.
