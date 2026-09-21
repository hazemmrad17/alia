# ALIA Avatar — Tailored Dashboard Plan

## Overview

We have two assets:
1. **`frontend/`** — Simple Next.js 14 SPA with basic Tailwind (the conversational avatar)
2. **`alia-avatar-admin/`** — Full shadcn admin template (Next.js 16, 42 UI components, recharts, sidebar nav, data tables)

**Goal:** Build a professional admin dashboard inside `alia-avatar-admin/` that serves both user stories with distinct views, then optionally link it from the main avatar app.

---

## Architecture Decision

### Option A: Extend `alia-avatar-admin/` (Recommended)

Build the dashboard as a standalone admin app using the cloned template. The avatar frontend (`frontend/`) stays as the conversational UI, and the admin dashboard becomes the analytics/reporting layer.

**Why:**
- 42 shadcn components already installed (Card, Table, Chart, Tabs, Sidebar, etc.)
- Recharts for data visualization
- TanStack Table for data grids
- Sidebar navigation with configurable groups
- Theme support (dark/light)
- Production-ready layout (header, sidebar, footer)

### Option B: Migrate `frontend/` to use shadcn

Replace the basic Tailwind in `frontend/` with shadcn components. This would mean merging two Next.js apps with different versions (14 vs 16) — risky and complex.

**Verdict:** Go with **Option A**. Keep the avatar app separate, build the dashboard in `alia-avatar-admin/`.

---

## Navigation Structure

### Sidebar Menu (navConfig.tsx)

```
┌─────────────────────────────────┐
│ ALIA Avatar                     │
│ VITAL SA                        │
├─────────────────────────────────┤
│ 🏠 Dashboard                    │
│   ├── Overview        (shared)  │
│   ├── Training        (VM)      │
│   └── Commercial      (Doctor)  │
├─────────────────────────────────┤
│ 📊 Analytics                    │
│   ├── Step Performance (VM)     │
│   ├── Doctor Styles    (VM)     │
│   ├── Product Impact   (Doc)    │
│   └── Score Trends     (shared) │
├─────────────────────────────────┤
│ 📋 Sessions                     │
│   ├── History          (shared) │
│   ├── Transcript View  (shared) │
│   └── CRM Reports      (Doc)    │
├─────────────────────────────────┤
│ 👥 People                       │
│   ├── Delegates        (VM)     │
│   └── Doctors          (Doc)    │
├─────────────────────────────────┤
│ 💊 Products                     │
│   ├── Catalog          (Doc)    │
│   └── Usage Stats      (Doc)    │
├─────────────────────────────────┤
│ ⚙️ Settings                     │
│   ├── General                    │
│   └── AI Config                  │
└─────────────────────────────────┘
```

---

## Dashboard Pages by User Story

### 🎓 Medical Delegate (Training Mode) Dashboard

#### 1. Training Overview (`/dashboard/training`)

**Components to use:**
- `StatisticsCard` (4x) — Total Sessions, Avg Score, Active Delegates, Completion Rate
- `widget-total-earning` → Adapt as **Level Progression Widget** — show delegates moving from Débutant → Expert
- `widget-product-insights` → Adapt as **Session Volume Chart** — bar chart of sessions over time
- `campaign-stat-cards` → Adapt as **Step Performance Summary** — cards for each of the 6 visit steps
- `sales-transaction-overview` → Adapt as **Recent Training Sessions** — table with delegate, doctor style, score, date

**Data sources:**
- `GET /api/v1/dashboard/stats` — overall metrics
- `GET /api/v1/dashboard/level-distribution` — level breakdown
- `GET /api/v1/dashboard/step-analysis` — per-step scores

#### 2. Step Performance (`/analytics/step-performance`)

**Components to use:**
- `chart-sales-metrics` → Adapt as **Score by Step** — line/bar chart showing avg scores per visit step
- `campaign-income-chart` → Adapt as **Score Trends Over Time** — line chart of weekly avg scores
- `Card` + `Progress` — **Step Difficulty Ranking** — which steps delegates struggle with most
- `Table` (TanStack) — **Detailed Step Breakdown** — sortable table of all step scores

**Visualizations:**
```
Step Score Distribution
┌─────────────────────────────────────────┐
│ Introduction   ████████░░  8.2/10      │
│ Sondage        ██████░░░░  6.8/10      │
│ Synthèse       ███████░░░  7.5/10      │
│ Objections     █████░░░░░  5.9/10  ⚠️  │
│ Argumentation  ███████░░░  7.1/10      │
│ Conclusion     ████████░░  8.0/10      │
└─────────────────────────────────────────┘
```

#### 3. Doctor Styles Analysis (`/analytics/doctor-styles`)

**Components to use:**
- `Card` (4x) — One per doctor style (Analysant, Controlant, Facilitant, Promouvant)
- `ChartContainer` + `BarChart` — Score distribution per personality
- `Badge` — SONCAS tags per style
- `Table` — **Delegates vs Doctor Styles** matrix — who trained on what, scores

**Key insight:** This view answers "Which doctor personalities are hardest for delegates?"

#### 4. Delegate Leaderboard (`/people/delegates`)

**Components to use:**
- `Table` (TanStack) — Sortable, filterable list of all delegates
- `Avatar` + `AvatarFallback` — Delegate avatars
- `Badge` — Current level (Débutant/Junior/Confirme/Expert)
- `Progress` — Level progression bar
- `Card` — **Top Performers** sidebar widget

**Columns:**
| Name | Level | Sessions | Avg Score | Best Step | Weakest Step | Last Active |
|------|-------|----------|-----------|-----------|--------------|-------------|

---

### 💊 Doctor / Pharmacist (Commercial Mode) Dashboard

#### 1. Commercial Overview (`/dashboard/commercial`)

**Components to use:**
- `StatisticsCard` (4x) — Total Presentations, Products Covered, Avg Engagement, Follow-ups Scheduled
- `widget-product-insights` → **Product Reach** — which products got the most presentations
- `campaign-stat-cards` → **Visit Format Distribution** — Flash vs Standard vs Approfondie
- `sales-details-radial` → **Engagement Ring** — radial chart of engagement levels

**Data sources:**
- `GET /api/v1/dashboard/stats` — overall metrics
- `GET /api/v1/products` — product catalog
- Session transcripts with CRM reports

#### 2. Product Performance (`/products/usage`)

**Components to use:**
- `Card` + `BarChart` — **Product Presentation Count** — which products are presented most
- `Table` — **Product Detail Table** — name, gamme, presentations, avg doctor interest, follow-ups
- `Badge` — Product category (Gamme)
- `Progress` — Product coverage % (how many of 100+ products have been presented)

**Key insight:** This answers "Which VITAL SA products are getting traction with doctors?"

#### 3. CRM Reports (`/sessions/crm-reports`)

**Components to use:**
- `Table` (TanStack) — **All CRM Reports** — sortable by date, doctor, product, score
- `Dialog` / `Sheet` — **Report Detail View** — full transcript, objections, next steps
- `Badge` — Engagement level (high/medium/low)
- `Timeline` — **Visit Timeline** — visual representation of the 6-step visit

**CRM Report Card layout:**
```
┌─────────────────────────────────────────┐
│ 📋 CRM Report — Dr. Martin             │
│ Session: abc123  │  Score: 7.5/10       │
├─────────────────────────────────────────┤
│ 🏥 Specialty: Médecine Générale         │
│ 🎭 Style: Analysant                     │
│ 🎯 SONCAS: Sécurité                     │
│ 📝 Need: Patient efficacy and safety    │
│ 💬 Engagement: Moderate                 │
├─────────────────────────────────────────┤
│ 🛡️ Objections:                          │
│   • "Habits" → Acknowledged & redirected│
├─────────────────────────────────────────┤
│ 📦 Materials Left: Product brochure     │
│ 📅 Next Step: Follow-up at J+7         │
└─────────────────────────────────────────┘
```

#### 4. Doctor Directory (`/people/doctors`)

**Components to use:**
- `Table` — **Doctor List** — all doctors who received presentations
- `Avatar` — Doctor avatars
- `Badge` — Specialty, Style
- `Card` — **Doctor Profile** sidebar — session history, products presented, avg interest

---

### 📊 Shared Pages

#### 1. Session History (`/sessions/history`)

**Components to use:**
- `Table` (TanStack) — **All Sessions** — filterable by mode, level, product, date range
- `Badge` — Mode (Training/Commercial), Level
- `Dialog` — **Session Detail** — full transcript, scores, CRM report
- `Input` + `Combobox` — **Search & Filter** bar

**Columns:**
| Date | Mode | Delegate/Doctor | Product | Doctor Style | Score | Duration | Status |

#### 2. Score Trends (`/analytics/score-trends`)

**Components to use:**
- `ChartContainer` + `LineChart` — **Score Over Time** — weekly/monthly avg scores
- `ChartContainer` + `BarChart` — **Score Distribution** — histogram of all scores
- `Card` + `Tabs` — **Filter by Mode/Level/Style** — segmented controls
- `statistics-card-01` — **Trend Indicators** — % change vs previous period

#### 3. Settings (`/settings`)

**Components to use:**
- `Card` — **General Settings** — app name, default level, visit format
- `Card` — **AI Configuration** — model params, SONCAS weights, step thresholds
- `Card` — **Product Catalog Management** — import/edit VITAL SA products

---

## Component Mapping

### Reusable Widgets from Template

| Template Component | ALIA Adaptation | Used In |
|---|---|---|
| `statistics-card-01` | Stat cards (sessions, scores, etc.) | All dashboards |
| `widget-total-earning` | Level progression widget | Training overview |
| `widget-product-insights` | Product reach / session volume | Both overviews |
| `campaign-stat-cards` | Step performance summary | Training overview |
| `sales-details-radial` | Engagement ring chart | Commercial overview |
| `sales-transaction-overview` | Recent sessions table | Both overviews |
| `campaign-income-chart` | Score trends line chart | Analytics |
| `chart-sales-metrics` | Step score bar chart | Step performance |
| `campaign-performance-table` | Delegates/Doctors table | People pages |
| `sales-invoice-datatable` | CRM report data table | CRM reports |

### New Components to Build

| Component | Description | Priority |
|---|---|---|
| `StepScoreBar` | Horizontal bar showing score per visit step | P0 |
| `DoctorStyleCard` | Card showing personality + SONCAS + avg score | P0 |
| `LevelBadge` | Badge with color per competence level | P0 |
| `SessionTimeline` | Visual 6-step timeline of a session | P1 |
| `ScoreGauge` | Circular gauge showing overall score | P1 |
| `SONCASTag` | Colored tag for each SONCAS element | P1 |
| `ProductUsageChart` | Bar chart of product presentation counts | P1 |
| `DelegateLeaderboard` | Ranked list with avatar + level + score | P2 |
| `DoctorProfileCard` | Compact card with specialty + sessions | P2 |

---

## File Structure (inside `alia-avatar-admin/`)

```
src/
├── app/(pages)/
│   ├── dashboard/
│   │   ├── overview/page.tsx          # Shared overview
│   │   ├── training/page.tsx          # Training overview
│   │   └── commercial/page.tsx        # Commercial overview
│   ├── analytics/
│   │   ├── step-performance/page.tsx  # Step analysis
│   │   ├── doctor-styles/page.tsx     # Personality analysis
│   │   ├── product-impact/page.tsx    # Product effectiveness
│   │   └── score-trends/page.tsx      # Trends over time
│   ├── sessions/
│   │   ├── history/page.tsx           # All sessions
│   │   ├── [id]/page.tsx              # Session detail
│   │   └── crm-reports/page.tsx       # CRM reports
│   ├── people/
│   │   ├── delegates/page.tsx         # Medical delegates
│   │   └── doctors/page.tsx           # Doctors
│   └── products/
│       ├── catalog/page.tsx           # Product catalog
│       └── usage/page.tsx             # Usage stats
│
├── views/ala/                          # ALIA-specific views
│   ├── training/
│   │   ├── training-overview.tsx
│   │   ├── step-performance.tsx
│   │   ├── doctor-styles-analysis.tsx
│   │   └── delegate-leaderboard.tsx
│   ├── commercial/
│   │   ├── commercial-overview.tsx
│   │   ├── product-performance.tsx
│   │   ├── crm-reports-table.tsx
│   │   └── doctor-directory.tsx
│   ├── shared/
│   │   ├── session-history-table.tsx
│   │   ├── score-trends-chart.tsx
│   │   └── overview-stats.tsx
│   └── widgets/
│       ├── step-score-bar.tsx
│       ├── doctor-style-card.tsx
│       ├── level-badge.tsx
│       ├── session-timeline.tsx
│       ├── score-gauge.tsx
│       └── sonca-tag.tsx
│
├── configs/
│   └── navConfig.tsx                   # Updated with ALIA nav
│
└── lib/
    └── api.ts                          # Backend API client (same as frontend/)
```

---

## Backend API Endpoints Used

| Endpoint | Dashboard Page | Data Used |
|---|---|---|
| `GET /api/v1/dashboard/stats` | All overviews | total_sessions, avg_score, level_distribution, top_products, recent_sessions |
| `GET /api/v1/dashboard/level-distribution` | Training overview, Delegate leaderboard | Per-level count, avg/min/max scores |
| `GET /api/v1/dashboard/step-analysis` | Step performance | Per-step avg_score, count |
| `GET /api/v1/products` | Product catalog, Commercial overview | Full product list with gamme, indications |
| `GET /api/v1/levels` | Level badges, Training setup | Level definitions and thresholds |
| `GET /api/v1/formats` | Visit format display | Format definitions |
| `GET /sessions/{id}` | Session detail, CRM reports | Full session with transcript and scores |
| `GET /health` | Connection status | Backend availability |

---

## Implementation Phases

### Phase 1: Foundation (Days 1-2)
- [ ] Copy API client from `frontend/src/lib/api.ts` → `alia-avatar-admin/src/lib/api.ts`
- [ ] Copy types from `frontend/src/lib/types.ts` → `alia-avatar-admin/src/types/alia.ts`
- [ ] Update `navConfig.tsx` with ALIA navigation structure
- [ ] Create `GET /api/v1/dashboard/level-distribution` endpoint (if missing)
- [ ] Create `GET /api/v1/dashboard/step-analysis` endpoint (if missing)

### Phase 2: Training Dashboard (Days 3-4)
- [ ] Build `training-overview.tsx` — stat cards + level widget + session volume chart
- [ ] Build `step-performance.tsx` — bar chart + difficulty ranking
- [ ] Build `doctor-styles-analysis.tsx` — personality cards + score matrix
- [ ] Build `delegate-leaderboard.tsx` — sortable table with avatars

### Phase 3: Commercial Dashboard (Days 5-6)
- [ ] Build `commercial-overview.tsx` — stat cards + product reach + engagement
- [ ] Build `product-performance.tsx` — product usage chart + coverage %
- [ ] Build `crm-reports-table.tsx` — data table with detail dialog
- [ ] Build `doctor-directory.tsx` — doctor list + profile cards

### Phase 4: Shared Pages (Days 7-8)
- [ ] Build `session-history-table.tsx` — filterable, sortable table
- [ ] Build `score-trends-chart.tsx` — line chart with time filters
- [ ] Build session detail page with full transcript view
- [ ] Build settings page

### Phase 5: Polish (Day 9)
- [ ] Dark mode support
- [ ] Responsive layout
- [ ] Loading skeletons
- [ ] Error states
- [ ] Empty states

---

## Visual Design

### Color System
- **Training Mode:** Blue (`--primary`) — matches existing `vital-blue`
- **Commercial Mode:** Green — product presentations
- **Scores:** Green (≥8) → Amber (6-8) → Red (<6)
- **Levels:** Débutant (gray) → Junior (blue) → Confirmé (purple) → Expert (gold)

### Layout Pattern
```
┌──────────────────────────────────────────────────┐
│ Header: ALIA Avatar │ Search │ Notifications │ 👤 │
├──────┬───────────────────────────────────────────┤
│      │ Breadcrumb: Dashboard > Training          │
│ Side │ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐        │
│ bar  │ │Stat │ │Stat │ │Stat │ │Stat │        │
│      │ │Card │ │Card │ │Card │ │Card │        │
│ 🏠   │ └─────┘ └─────┘ └─────┘ └─────┘        │
│ 📊   │ ┌──────────────┐ ┌──────────────┐       │
│ 📋   │ │ Chart Widget │ │ Table Widget │       │
│ 👥   │ │              │ │              │       │
│ 💊   │ │              │ │              │       │
│ ⚙️   │ └──────────────┘ └──────────────┘       │
│      │ ┌──────────────────────────────────┐     │
│      │ │ Full-width Data Table            │     │
│      │ └──────────────────────────────────┘     │
├──────┴───────────────────────────────────────────┤
│ Footer                                           │
└──────────────────────────────────────────────────┘
```

---

## Key Differences from Current Frontend

| Aspect | Current `frontend/` | New Admin Dashboard |
|---|---|---|
| Framework | Next.js 14 + basic Tailwind | Next.js 16 + shadcn/ui + Tailwind 4 |
| UI Components | Hand-rolled divs | 42 shadcn components |
| Charts | None | Recharts (bar, line, radial) |
| Data Tables | Basic HTML tables | TanStack Table (sort, filter, paginate) |
| Navigation | Button-based SPA routing | Sidebar with configurable groups |
| Theme | Fixed light | Dark/Light toggle |
| Scope | Chat + basic dashboard | Full analytics platform |

---

## Next Steps

1. **Confirm approach:** Build in `alia-avatar-admin/` as a standalone admin app?
2. **Backend gaps:** Do we need new API endpoints for the analytics views?
3. **Auth:** Do we need login/role-based access (VM sees training, Doctor sees commercial)?
4. **Deployment:** Separate deployment from the avatar frontend, or monorepo?

---

*Plan created: 2026-09-02*
*Status: Ready for review*
