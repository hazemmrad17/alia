// ──────────────────────────────────────────────
// ALIA Avatar — stock & dépôts (Opérations)
//
// What VITAL SA holds and where: the finished-goods stock of every dépôt, the
// reorder risk in it, and how fast it turns over.
//
// Where the data comes from: nowhere yet — like the fleet registry
// (src/lib/fleet-data.ts) this is a seed. The backend stores training sessions,
// accounts, support reports and the product catalogue, and no stock model at
// all, so a future `GET /api/v1/inventory/stock` replaces the export at the
// bottom of this file without touching the page.
//
// Two things ARE real, and the page says so:
//  * the références themselves — names, gammes and packagings are read from the
//    product catalogue the backend serves (`data/processed/products_llm.json`,
//    191 références across 21 gammes), so the SKUs on this page exist;
//  * the dépôts — the same five warehouses the fleet registry routes its
//    tournées from, so a unit leaving "Dépôt Sfax" is leaving a place this page
//    holds stock in.
//
// Everything else — quantities, seuils, prices, history — is the seed below.
//
// Why the history is *reconstructed* rather than written out: a 400-day daily
// series per référence would be seed nobody can check. Instead every line
// carries its own monthly demand, and the stock level of each day is walked
// backwards from today's quantity along that demand (one receipt per 30-day
// cycle, one month's demand issued over that cycle). The value curve, the
// rotation rate and the "sous le seuil depuis N jours" of every alert are then
// all read off that single walk, so they cannot disagree with each other or with
// the quantities printed in the table.
// ──────────────────────────────────────────────

// ── Policies ──────────────────────────────────────────────────────────────────

/**
 * Le seuil de réapprovisionnement, exprimé en jours de consommation. A line at or
 * below its threshold has less than three weeks of demand left.
 */
export const COVER_TARGET_DAYS = 21

/**
 * Le niveau recommandé the "santé par gamme" card compares available stock to:
 * two months of demand. A gamme holding that much reads as sain, one holding a
 * month sits at vigilance, and one whose ruptures have eaten half its holding
 * reads as critique.
 */
export const RECOMMENDED_COVER_DAYS = 60

/** Days in the demand month every rate on this page is expressed in. */
export const DAYS_PER_MONTH = 30

/**
 * One delivery per line every ten days, carrying the demand it covers. Short
 * enough that the dépôts are not refilled a whole month at a time — which would
 * swing the stock value of the whole network by tens of percent every cycle.
 */
export const RECEIPT_CYCLE_DAYS = 10

/** How far back the value curve is walked. Covers the widest period plus the window before it. */
export const HISTORY_DAYS = 800

export interface PeriodOption {
  value: number
  label: string
}

/** The reporting periods the header selector offers. */
export const PERIOD_OPTIONS: PeriodOption[] = [
  { value: 7, label: '7 derniers jours' },
  { value: 30, label: '30 derniers jours' },
  { value: 90, label: '90 derniers jours' },
  { value: 365, label: '12 derniers mois' }
]

export const DEFAULT_PERIOD_DAYS = 30

export interface TurnoverWindow {
  value: number
  label: string
}

/** The windows the rotation rate may be averaged over, as the card's tabs. */
export const TURNOVER_WINDOWS: TurnoverWindow[] = [
  { value: 30, label: '30 J' },
  { value: 90, label: '90 J' },
  { value: 365, label: '12 M' }
]

// ── Dépôts ────────────────────────────────────────────────────────────────────

export type DepotId = 'tunis' | 'sfax' | 'sousse' | 'nabeul' | 'gabes'

export interface Depot {
  id: DepotId
  name: string

  /** Governorate and delivery head, in the words the fleet registry uses. */
  city: string

  /** Boxes the site can hold — what "capacité utilisée" is a share of. */
  capacityUnits: number
}

export const DEPOTS: Depot[] = [
  { id: 'tunis', name: 'Dépôt central Tunis', city: 'Tunis · Ben Arous', capacityUnits: 8200 },
  { id: 'sfax', name: 'Dépôt Sfax', city: 'Sfax · Sfax Sud', capacityUnits: 3100 },
  { id: 'sousse', name: 'Dépôt Sousse', city: 'Sousse · Kalaa Kebira', capacityUnits: 1350 },
  { id: 'nabeul', name: 'Dépôt Nabeul', city: 'Nabeul · Hammamet', capacityUnits: 820 },
  { id: 'gabes', name: 'Dépôt Gabès', city: 'Gabès · Médenine', capacityUnits: 1000 }
]

const DEPOT_BY_ID = new Map(DEPOTS.map(depot => [depot.id, depot]))

// ── Références ────────────────────────────────────────────────────────────────

export type StockStatus = 'rupture' | 'critique' | 'bas' | 'ok'

export const STOCK_STATUS_LABELS: Record<StockStatus, string> = {
  rupture: 'Rupture',
  critique: 'Critique',
  bas: 'Bas',
  ok: 'Disponible'
}

/** Days in the year the holding growth is quoted over. */
export const DAYS_PER_YEAR = 365

/**
 * One référence the dépôts hold, as the catalogue describes it. Its `code` is a
 * placeholder: the backend catalogue serves names, gammes and packagings, and no
 * codes yet.
 */
export interface StockItem {
  code: string
  name: string
  gamme: string
  packaging: string

  /** Prix de cession unitaire, in dinars (millimes included). */
  unitPriceDt: number

  /** Days since the référence entered the catalogue. Absent = older than the curve. */
  addedDaysAgo?: number

  /**
   * Year-over-year growth of the holdings: 0.18 reads as +18 % sur douze mois.
   * It is the only thing that gives the value curve its trend — without it the
   * walk would return to the same level every delivery cycle.
   */
  annualGrowth: number
}

/**
 * One stock line: a référence in one dépôt. Everything a page needs about it —
 * seuil, coverage, value, status — is derived from the quantity and the demand
 * rather than seeded, so the table and the alerts cannot disagree.
 */
export interface StockLine {
  id: string
  item: StockItem
  depot: Depot

  /** Boxes on hand. */
  quantity: number

  /** Boxes shipped from this dépôt per month, on average. */
  monthlyOut: number

  /** Boxes below which the dépôt reorders, rounded to 5 for a readable policy. */
  reorderPoint: number

  /** Days of demand the quantity covers at the current rate. */
  coverageDays: number
  lineValue: number
  status: StockStatus

  /**
   * Recommended holding for the line: the level "santé par gamme" compares the
   * quantity to. Never zero, so the share always divides.
   */
  recommendedUnits: number
}

/**
 * A seed entry: the référence, plus where it is held and how fast it moves. Each
 * tuple is [dépôt, quantité en stock, unités écoulées par mois].
 */
interface ItemSeed extends StockItem {
  stock: Array<[DepotId, number, number]>
}

/**
 * The seed. Names, gammes and packagings come from the catalogue the backend
 * serves; the quantities, demands and growth rates are the invented part.
 *
 * The quantities are not arbitrary: they are what makes the page's story true —
 * four références out of stock, five below their seuil, three added inside the
 * last month, everything else between six and eight weeks of cover.
 */
const ITEMS: ItemSeed[] = [
  // ── Laboratoire Vital — hématologie & vitamines ──
  {
    code: 'VTL-101',
    name: 'FERBIOTIC 60 gélules',
    gamme: 'Laboratoire Vital',
    packaging: 'Boîte de 60 gélules',
    unitPriceDt: 24.5,
    annualGrowth: 0.18,
    stock: [
      ['tunis', 370, 248],
      ['sfax', 205, 136],
      ['sousse', 150, 99]
    ]
  },
  {
    code: 'VTL-118',
    name: 'FERBIOTIC LIPO 30 gélules',
    gamme: 'Laboratoire Vital',
    packaging: 'Boîte de 30 gélules',
    unitPriceDt: 19.8,
    addedDaysAgo: 9,
    annualGrowth: 0.24,
    stock: [
      ['tunis', 210, 164],
      ['sfax', 110, 90]
    ]
  },
  {
    code: 'VTL-102',
    name: 'FERSANG 30 comprimés',
    gamme: 'Laboratoire Vital',
    packaging: 'Boîte de 30 comprimés',
    unitPriceDt: 21.3,
    annualGrowth: 0.15,
    stock: [
      ['tunis', 325, 216],
      ['sfax', 180, 119],
      ['sousse', 25, 86],
      ['nabeul', 95, 65]
    ]
  },
  {
    code: 'VTL-127',
    name: 'TETRA B 30 comprimés',
    gamme: 'Laboratoire Vital',
    packaging: 'Boîte de 30 comprimés',
    unitPriceDt: 18.9,
    annualGrowth: 0.11,
    stock: [
      ['tunis', 215, 144],
      ['sfax', 55, 79],
      ['gabes', 55, 36]
    ]
  },
  {
    code: 'VTL-140',
    name: 'MAGNÉ B6 60 comprimés',
    gamme: 'Laboratoire Vital',
    packaging: 'Boîte de 60 comprimés',
    unitPriceDt: 15.4,
    annualGrowth: 0.13,
    stock: [
      ['tunis', 290, 192],
      ['sousse', 115, 77],
      ['gabes', 70, 48]
    ]
  },

  // ── PediaKids ──
  {
    code: 'PDK-104',
    name: 'APITOU N°1 200 ml',
    gamme: 'PediaKids',
    packaging: 'Flacon de 200 ml',
    unitPriceDt: 12.7,
    annualGrowth: 0.17,
    stock: [
      ['tunis', 450, 280],
      ['sfax', 245, 154],
      ['sousse', 70, 112],
      ['nabeul', 135, 84]
    ]
  },
  {
    code: 'PDK-111',
    name: 'APITOU N°2 200 ml',
    gamme: 'PediaKids',
    packaging: 'Flacon de 200 ml',
    unitPriceDt: 12.9,
    annualGrowth: 0.14,
    stock: [
      ['tunis', 410, 256],
      ['sfax', 225, 141],
      ['gabes', 100, 64]
    ]
  },
  {
    code: 'PDK-118',
    name: 'APIMIX 250 ml',
    gamme: 'PediaKids',
    packaging: 'Flacon de 250 ml',
    unitPriceDt: 14.2,
    annualGrowth: 0.19,
    stock: [
      ['tunis', 245, 152],
      ['nabeul', 0, 46],
      ['gabes', 60, 38]
    ]
  },
  {
    code: 'PDK-126',
    name: 'IMMUNOVIT 20 comprimés',
    gamme: 'PediaKids',
    packaging: 'Boîte de 20 comprimés',
    unitPriceDt: 9.8,
    annualGrowth: 0.12,
    stock: [
      ['tunis', 330, 208],
      ['sousse', 135, 83],
      ['nabeul', 100, 62]
    ]
  },
  {
    code: 'PDK-133',
    name: 'PEDIAKIDS MULTIVITAMINES 125 ml',
    gamme: 'PediaKids',
    packaging: 'Flacon de 125 ml',
    unitPriceDt: 16.5,
    annualGrowth: 0.11,
    stock: [
      ['tunis', 190, 120],
      ['sfax', 105, 66]
    ]
  },

  // ── Oligovit ──
  {
    code: 'OLG-204',
    name: 'OLIGOVIT VIT.C 20 comprimés effervescents',
    gamme: 'Oligovit',
    packaging: 'Tube de 20 comprimés effervescents',
    unitPriceDt: 8.9,
    annualGrowth: 0.21,
    stock: [
      ['tunis', 395, 360],
      ['sfax', 220, 198],
      ['gabes', 0, 90]
    ]
  },
  {
    code: 'OLG-217',
    name: 'OLIGOVIT MAGNÉSIUM 30 gélules',
    gamme: 'Oligovit',
    packaging: 'Boîte de 30 gélules',
    unitPriceDt: 13.6,
    annualGrowth: 0.15,
    stock: [
      ['tunis', 245, 224],
      ['sfax', 135, 123],
      ['sousse', 100, 90]
    ]
  },
  {
    code: 'OLG-231',
    name: 'OLIGOVIT ZINC 20 comprimés',
    gamme: 'Oligovit',
    packaging: 'Boîte de 20 comprimés',
    unitPriceDt: 10.4,
    annualGrowth: 0.14,
    stock: [
      ['tunis', 190, 172],
      ['nabeul', 30, 52],
      ['gabes', 50, 43]
    ]
  },
  {
    code: 'OLG-246',
    name: 'OLIGOVIT TRIO 30 comprimés',
    gamme: 'Oligovit',
    packaging: 'Boîte de 30 comprimés',
    unitPriceDt: 17.2,
    addedDaysAgo: 21,
    annualGrowth: 0.31,
    stock: [
      ['tunis', 115, 104],
      ['sousse', 45, 42]
    ]
  },

  // ── Calmoss ──
  {
    code: 'CMO-310',
    name: 'CALMOSS 20 comprimés',
    gamme: 'Calmoss',
    packaging: 'Boîte de 20 comprimés',
    unitPriceDt: 11.5,
    annualGrowth: 0.17,
    stock: [
      ['tunis', 370, 192],
      ['sfax', 205, 106],
      ['gabes', 15, 48]
    ]
  },
  {
    code: 'CMO-322',
    name: 'CALMOSS RHUME & GRIPPE 125 ml',
    gamme: 'Calmoss',
    packaging: 'Flacon de 125 ml',
    unitPriceDt: 13.9,
    annualGrowth: 0.1,
    stock: [
      ['tunis', 260, 136],
      ['sousse', 105, 54],
      ['nabeul', 80, 41]
    ]
  },
  {
    code: 'CMO-334',
    name: 'CALMOSS TRANSIT 30 comprimés',
    gamme: 'Calmoss',
    packaging: 'Boîte de 30 comprimés',
    unitPriceDt: 12.3,
    annualGrowth: 0.09,
    stock: [
      ['tunis', 230, 120],
      ['sfax', 130, 66]
    ]
  },
  {
    code: 'CMO-347',
    name: 'CALMOSS NUIT 30 gélules',
    gamme: 'Calmoss',
    packaging: 'Boîte de 30 gélules',
    unitPriceDt: 14.7,
    annualGrowth: 0.04,
    stock: [
      ['tunis', 45, 72],
      ['gabes', 35, 18]
    ]
  },

  // ── Vitonic ──
  {
    code: 'VTC-101',
    name: 'VITONIC sirop 200 ml',
    gamme: 'Vitonic',
    packaging: 'Flacon de 200 ml',
    unitPriceDt: 12.4,
    annualGrowth: 0.18,
    stock: [
      ['tunis', 330, 248],
      ['sfax', 180, 136],
      ['nabeul', 100, 74]
    ]
  },
  {
    code: 'VTC-118',
    name: 'VITONIC EXAMENS 30 comprimés',
    gamme: 'Vitonic',
    packaging: 'Boîte de 30 comprimés',
    unitPriceDt: 15.8,
    annualGrowth: 0.19,
    stock: [
      ['tunis', 250, 188],
      ['sfax', 0, 103]
    ]
  },
  {
    code: 'VTC-127',
    name: 'VITONIC BOOSTER 20 ampoules',
    gamme: 'Vitonic',
    packaging: 'Boîte de 20 ampoules',
    unitPriceDt: 18.2,
    annualGrowth: 0.24,
    stock: [
      ['tunis', 185, 140],
      ['sousse', 75, 56]
    ]
  },
  {
    code: 'VTC-134',
    name: 'VITONIC ALLAITEMENT 30 gélules',
    gamme: 'Vitonic',
    packaging: 'Boîte de 30 gélules',
    unitPriceDt: 16.9,
    annualGrowth: 0.11,
    stock: [
      ['tunis', 130, 96],
      ['sfax', 70, 53]
    ]
  },
  {
    code: 'VTC-140',
    name: 'VITONIC IMMUNO 30 comprimés',
    gamme: 'Vitonic',
    packaging: 'Boîte de 30 comprimés',
    unitPriceDt: 17.4,
    addedDaysAgo: 7,
    annualGrowth: 0.33,
    stock: [
      ['tunis', 20, 84],
      ['sfax', 60, 46]
    ]
  },

  // ── Cosmopharma — dermo-cosmétique ──
  {
    code: 'COS-045',
    name: 'DERMACNÉ CRÈME 45 gr',
    gamme: 'Cosmopharma',
    packaging: 'Tube de 45 gr',
    unitPriceDt: 22.6,
    annualGrowth: 0.14,
    stock: [
      ['tunis', 110, 132],
      ['sfax', 60, 73],
      ['nabeul', 0, 40]
    ]
  },
  {
    code: 'COS-058',
    name: 'DERMACNÉ GÉLULE 30 gélules',
    gamme: 'Cosmopharma',
    packaging: 'Boîte de 30 gélules',
    unitPriceDt: 26.4,
    annualGrowth: 0.19,
    stock: [
      ['tunis', 95, 112],
      ['sfax', 50, 62]
    ]
  },
  {
    code: 'COS-061',
    name: 'DERMASOUFRE SAVON 90 gr',
    gamme: 'Cosmopharma',
    packaging: 'Savon de 90 gr',
    unitPriceDt: 9.2,
    annualGrowth: 0.06,
    stock: [
      ['tunis', 60, 224],
      ['sousse', 75, 90],
      ['gabes', 45, 56]
    ]
  },
  {
    code: 'COS-077',
    name: 'HYDRA CRÈME 90 gr',
    gamme: 'Cosmopharma',
    packaging: 'Pot de 90 gr',
    unitPriceDt: 19.4,
    annualGrowth: 0.15,
    stock: [
      ['tunis', 130, 156],
      ['sfax', 70, 86],
      ['nabeul', 40, 47]
    ]
  },
  {
    code: 'COS-089',
    name: 'FONGIDERM CRÈME 45 gr',
    gamme: 'Cosmopharma',
    packaging: 'Tube de 45 gr',
    unitPriceDt: 14.9,
    annualGrowth: 0.12,
    stock: [
      ['tunis', 95, 116],
      ['sfax', 40, 64],
      ['gabes', 25, 29]
    ]
  }
]

function reorderPointFor(monthlyOut: number): number {
  const raw = (monthlyOut * COVER_TARGET_DAYS) / DAYS_PER_MONTH

  return Math.max(5, Math.round(raw / 5) * 5)
}

function statusFor(quantity: number, reorderPoint: number): StockStatus {
  if (quantity <= 0) return 'rupture'
  if (quantity <= reorderPoint / 2) return 'critique'
  if (quantity <= reorderPoint) return 'bas'

  return 'ok'
}

let linesCache: StockLine[] | null = null

/** Every référence/dépôt pair, with its policy, coverage and status derived. */
export function stockLines(): StockLine[] {
  if (linesCache) return linesCache

  linesCache = ITEMS.flatMap<StockLine>(seed =>
    seed.stock.map(([depotId, quantity, monthlyOut]) => {
      const depot = DEPOT_BY_ID.get(depotId)

      if (!depot) throw new Error(`unknown dépôt: ${depotId}`)

      const reorderPoint = reorderPointFor(monthlyOut)
      const dailyOut = monthlyOut / DAYS_PER_MONTH
      const item: StockItem = seed

      return {
        id: `${seed.code}@${depotId}`,
        item,
        depot,
        quantity,
        monthlyOut,
        reorderPoint,
        coverageDays: dailyOut > 0 ? quantity / dailyOut : 0,
        lineValue: quantity * item.unitPriceDt,
        status: statusFor(quantity, reorderPoint),
        recommendedUnits: monthlyOut * (RECOMMENDED_COVER_DAYS / DAYS_PER_MONTH)
      }
    })
  )

  return linesCache
}

/** The distinct références on the shelves, catalogue order. */
export function stockItems(): StockItem[] {
  const byCode = new Map<string, StockItem>()

  for (const line of stockLines()) if (!byCode.has(line.item.code)) byCode.set(line.item.code, line.item)

  return [...byCode.values()]
}

// ── Formatters shared by the page and the aggregates ──────────────────────────

/** "1 240" — a space every three digits, French style. */
export function formatUnits(value: number): string {
  return Math.round(value)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
}

/** Boxes one delivery brings: the demand the next cycle will consume. */
function perDelivery(line: StockLine): number {
  return line.monthlyOut * (RECEIPT_CYCLE_DAYS / DAYS_PER_MONTH)
}

/**
 * Demand — and with it the holding — of a day, relative to today's. Growth in
 * the seed is growth of the business, not of unsold stock: scaling both sides of
 * the walk by the same factor is what keeps "le stock a grandi" from being
 * silently reported as "la rotation s'est effondrée".
 */
function growthScale(line: StockLine, daysAgo: number): number {
  return Math.max(0.1, 1 - (line.item.annualGrowth * daysAgo) / DAYS_PER_YEAR)
}

/** Money in dinars: "3 986 DT" under ten thousand, "45,6 k DT" above it. */
export function formatDt(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace('.', ',')} M DT`
  if (value >= 10_000) return `${(value / 1000).toFixed(1).replace('.', ',')} k DT`

  return `${formatUnits(value)} DT`
}

// ── The value curve ───────────────────────────────────────────────────────────

const MONTHS_FR = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.']

const TODAY = new Date()

/** "22 juin" — the shape the value curve writes its x-axis in. */
export function dayLabel(daysAgo: number): string {
  if (daysAgo <= 0) return "aujourd'hui"

  const date = new Date(TODAY)

  date.setDate(date.getDate() - daysAgo)

  return `${date.getDate()} ${MONTHS_FR[date.getMonth()]}`
}

/**
 * One day of the reconstructed walk. `daysAgo` counts back from today, so the
 * first point of the series is today itself.
 */
export interface DailyStock {
  daysAgo: number
  label: string
  value: number

  /** Value of the demand issued that day, at cost. */
  issued: number
  byGamme: Map<string, { value: number; issued: number }>
}

let historyCache: DailyStock[] | null = null

/**
 * The stock value of each of the last HISTORY_DAYS days, walked backwards from
 * today's quantities along each line's own demand and monthly receipt. Index 0 is
 * today, so `history()[n]` is n days ago.
 */
function history(): DailyStock[] {
  if (historyCache) return historyCache

  const lines = stockLines()

  const state = lines.map((line, index) => ({
    line,
    qty: line.quantity,

    // Stagger the receipt cycles so the dépôts are not all resupplied the same day.
    offset: index % RECEIPT_CYCLE_DAYS
  }))

  const points: DailyStock[] = []

  for (let daysAgo = 0; daysAgo < HISTORY_DAYS; daysAgo++) {
    let value = 0
    let issued = 0
    const byGamme = new Map<string, { value: number; issued: number }>()

    for (const slot of state) {
      // A référence added 21 days ago did not sit on a shelf 60 days ago.
      if (daysAgo > (slot.line.item.addedDaysAgo ?? HISTORY_DAYS)) continue

      const lineValue = slot.qty * slot.line.item.unitPriceDt

      const issuedToday =
        (slot.line.monthlyOut / DAYS_PER_MONTH) * slot.line.item.unitPriceDt * growthScale(slot.line, daysAgo)

      value += lineValue
      issued += issuedToday

      const bucket = byGamme.get(slot.line.item.gamme) ?? { value: 0, issued: 0 }

      bucket.value += lineValue
      bucket.issued += issuedToday
      byGamme.set(slot.line.item.gamme, bucket)
    }

    points.push({ daysAgo, label: dayLabel(daysAgo), value, issued, byGamme })

    // Step one day further back: yesterday held what today holds, plus the demand
    // issued since, minus whatever the delivery brought in. The growth factor then
    // takes the référence's own pace off the older day, which is what gives the
    // curve its trend instead of a flat sawtooth.
    for (const slot of state) {
      const scale = growthScale(slot.line, daysAgo)
      const received = (daysAgo + slot.offset) % RECEIPT_CYCLE_DAYS === 0 ? perDelivery(slot.line) * scale : 0
      const drift = 1 - slot.line.item.annualGrowth / DAYS_PER_YEAR

      slot.qty = Math.max(0, (slot.qty + (slot.line.monthlyOut / DAYS_PER_MONTH) * scale - received) * drift)
    }
  }

  historyCache = points

  return points
}

/** Today's stock value, and how it moved over the period. */
export function valueTrend(periodDays: number): { value: number; deltaPercent: number } {
  const points = history()
  const now = points[0]?.value ?? 0
  const then = points[Math.min(periodDays, HISTORY_DAYS - 1)]?.value ?? now

  return { value: now, deltaPercent: then > 0 ? ((now - then) / then) * 100 : 0 }
}

export interface ValuePoint {
  label: string
  value: number
}

/** The value curve of the period, bucketed to ~24 points, oldest first. */
export function valueSeries(periodDays: number, buckets = 24): ValuePoint[] {
  const window = history().slice(0, periodDays).reverse()
  const size = Math.max(1, Math.floor(window.length / buckets))
  const points: ValuePoint[] = []

  for (let index = 0; index < window.length; index += size) {
    const slice = window.slice(index, index + size)
    const mean = slice.reduce((sum, point) => sum + point.value, 0) / slice.length

    points.push({ label: slice[slice.length - 1].label, value: mean })
  }

  return points
}

// ── Turnover ──────────────────────────────────────────────────────────────────

export interface TurnoverGamme {
  gamme: string
  turns: number
}

/**
 * Rotation over a window. `turns` is the annualised rate — demand issued ÷ stock
 * held × 365 — which is the figure a supply chain reads: 6x means the network
 * ships its whole stock twice a quarter.
 */
export interface Turnover {
  turns: number

  /** The same figure over the preceding window of equal length. */
  previousTurns: number
  deltaTurns: number
  best: TurnoverGamme | null
  worst: TurnoverGamme | null

  /** The rate per bucket, oldest first — the area under the headline figure. */
  series: Array<{ label: string; turns: number }>
  points: number
}

function turnsOver(window: DailyStock[], windowDays: number): number {
  if (window.length === 0) return 0

  const issued = window.reduce((sum, point) => sum + point.issued, 0)
  const averageValue = window.reduce((sum, point) => sum + point.value, 0) / window.length

  return averageValue > 0 ? (issued / averageValue) * (365 / windowDays) : 0
}

/**
 * Rotation over a window, and the same rotation split by gamme so the card can
 * name what moves and what does not — all from one walk of the same curve.
 */
export function turnover(windowDays: number, buckets = 7): Turnover {
  const points = history()
  const window = points.slice(0, windowDays)
  const previous = points.slice(windowDays, windowDays * 2)
  const turns = turnsOver(window, windowDays)
  const previousTurns = turnsOver(previous, windowDays)

  const gammes = new Map<string, { issued: number; value: number }>()

  for (const point of window) {
    for (const [gamme, bucket] of point.byGamme) {
      const entry = gammes.get(gamme) ?? { issued: 0, value: 0 }

      entry.issued += bucket.issued
      entry.value += bucket.value
      gammes.set(gamme, entry)
    }
  }

  const perGamme: TurnoverGamme[] = [...gammes.entries()]
    .map(([gamme, entry]) => ({
      gamme,
      turns: entry.value > 0 ? (entry.issued / (entry.value / window.length)) * (365 / windowDays) : 0
    }))
    .sort((a, b) => b.turns - a.turns)

  // Oldest first, so the area rises left to right like the reference layout.
  const ordered = [...window].reverse()
  const size = Math.max(1, Math.ceil(ordered.length / buckets))
  const series: Array<{ label: string; turns: number }> = []

  for (let index = 0; index < ordered.length; index += size) {
    const slice = ordered.slice(index, index + size)

    series.push({
      label: slice[0].label,
      turns: turnsOver(slice, slice.length)
    })
  }

  return {
    turns,
    previousTurns,
    deltaTurns: turns - previousTurns,
    best: perGamme[0] ?? null,
    worst: perGamme[perGamme.length - 1] ?? null,
    series,
    points: window.length
  }
}

// ── Headline figures ──────────────────────────────────────────────────────────

export interface InventorySummary {
  skus: number
  depots: number
  lines: number

  /** Références that entered the catalogue inside the period. */
  addedInPeriod: number
  value: number
  valueDeltaPercent: number

  /** Lines below their seuil but still shipping. */
  lowCount: number
  urgentCount: number
  lowPercent: number

  /** Lines with nothing left. */
  outCount: number

  /** Monthly demand the ruptures cannot serve — the manque à gagner. */
  valueAtRisk: number
  unitsOnHand: number
  capacityUnits: number
}

export function inventorySummary(periodDays: number): InventorySummary {
  const lines = stockLines()
  const trend = valueTrend(periodDays)
  const low = lines.filter(line => line.status === 'bas' || line.status === 'critique')
  const out = lines.filter(line => line.status === 'rupture')

  return {
    skus: stockItems().length,
    depots: DEPOTS.length,
    lines: lines.length,
    addedInPeriod: stockItems().filter(item => (item.addedDaysAgo ?? HISTORY_DAYS) <= periodDays).length,
    value: trend.value,
    valueDeltaPercent: trend.deltaPercent,
    lowCount: low.length,
    urgentCount: lines.filter(line => line.status === 'critique').length,
    lowPercent: lines.length > 0 ? ((low.length + out.length) / lines.length) * 100 : 0,
    outCount: out.length,
    valueAtRisk: out.reduce((sum, line) => sum + line.monthlyOut * line.item.unitPriceDt, 0),
    unitsOnHand: lines.reduce((sum, line) => sum + line.quantity, 0),
    capacityUnits: DEPOTS.reduce((sum, depot) => sum + depot.capacityUnits, 0)
  }
}

// ── Santé par gamme ───────────────────────────────────────────────────────────

export type HealthTone = 'success' | 'warning' | 'destructive'

export interface CategoryHealth {
  gamme: string
  skus: number
  lines: number
  value: number

  /** Available stock as a share of the recommended holding. */
  coverPercent: number
  tone: HealthTone
}

function healthTone(coverPercent: number): HealthTone {
  if (coverPercent >= 70) return 'success'
  if (coverPercent >= 40) return 'warning'

  return 'destructive'
}

export const HEALTH_LABELS: Record<HealthTone, string> = {
  success: 'Sain',
  warning: 'Vigilance',
  destructive: 'Critique'
}

/** Stock held against the recommended level, one row per gamme, worst first. */
export function categoryHealth(): CategoryHealth[] {
  const byGamme = new Map<
    string,
    { skus: Set<string>; lines: number; quantity: number; value: number; recommended: number }
  >()

  for (const line of stockLines()) {
    const entry = byGamme.get(line.item.gamme) ?? {
      skus: new Set<string>(),
      lines: 0,
      quantity: 0,
      value: 0,
      recommended: 0
    }

    entry.skus.add(line.item.code)
    entry.lines += 1
    entry.quantity += line.quantity
    entry.value += line.lineValue
    entry.recommended += line.recommendedUnits
    byGamme.set(line.item.gamme, entry)
  }

  return [...byGamme.entries()]
    .map(([gamme, entry]) => {
      const coverPercent = entry.recommended > 0 ? (entry.quantity / entry.recommended) * 100 : 0

      return {
        gamme,
        skus: entry.skus.size,
        lines: entry.lines,
        value: entry.value,
        coverPercent,
        tone: healthTone(coverPercent)
      }
    })
    .sort((a, b) => a.coverPercent - b.coverPercent)
}

// ── Stock par dépôt ───────────────────────────────────────────────────────────

export interface DepotRow {
  depot: Depot
  skus: number
  lines: number
  units: number
  usedPercent: number
  lowCount: number
  outCount: number
  value: number
}

export function depotRows(): DepotRow[] {
  return DEPOTS.map(depot => {
    const lines = stockLines().filter(line => line.depot.id === depot.id)
    const units = lines.reduce((sum, line) => sum + line.quantity, 0)

    return {
      depot,
      skus: new Set(lines.map(line => line.item.code)).size,
      lines: lines.length,
      units,
      usedPercent: depot.capacityUnits > 0 ? (units / depot.capacityUnits) * 100 : 0,
      lowCount: lines.filter(line => line.status === 'bas' || line.status === 'critique').length,
      outCount: lines.filter(line => line.status === 'rupture').length,
      value: lines.reduce((sum, line) => sum + line.lineValue, 0)
    }
  }).sort((a, b) => b.units - a.units)
}

// ── Alertes de réapprovisionnement ────────────────────────────────────────────

const SEVERITY: Record<StockStatus, number> = { rupture: 0, critique: 1, bas: 2, ok: 3 }

/**
 * Lines at or under their seuil, worst first — ruptures, then criticals, then the
 * lines that are merely low. Coverage is what orders the ties: six days of
 * demand left is more urgent than sixteen, whatever the dépôt.
 */
export function reorderAlerts(): StockLine[] {
  return stockLines()
    .filter(line => line.status !== 'ok')
    .sort(
      (a, b) =>
        SEVERITY[a.status] - SEVERITY[b.status] ||
        a.coverageDays - b.coverageDays ||
        a.item.name.localeCompare(b.item.name, 'fr')
    )
}

// ── Mouvements ────────────────────────────────────────────────────────────────

export type MovementKind = 'reception' | 'transfert' | 'ajustement' | 'alerte'

export const MOVEMENT_LABELS: Record<MovementKind, string> = {
  reception: 'Réception',
  transfert: 'Transfert',
  ajustement: 'Ajustement',
  alerte: 'Alerte seuil'
}

export interface Movement {
  id: string
  kind: MovementKind
  title: string
  description: string
  depotName: string

  /**
   * Age of the movement. Absent for an alert, which is a state rather than an
   * event: the walk below cannot date the crossing, because a line under its
   * seuil has been under it for as long as the curve reaches.
   */
  daysAgo?: number
}

/** Hand-written operational events: a transfer and a count are decisions, not demand. */
const MANUAL_MOVEMENTS: Movement[] = [
  {
    id: 'transfert-1',
    kind: 'transfert',
    title: 'Transfert inter-dépôts',
    description: '480 unités de MAGNÉ B6 (VTL-140) vers Dépôt Gabès',
    depotName: 'Dépôt central Tunis',
    daysAgo: 2
  },
  {
    id: 'transfert-2',
    kind: 'transfert',
    title: 'Transfert inter-dépôts',
    description: '210 unités d’OLIGOVIT ZINC (OLG-231) vers Dépôt Nabeul',
    depotName: 'Dépôt Sfax',
    daysAgo: 6
  },
  {
    id: 'ajustement-1',
    kind: 'ajustement',
    title: 'Écart d’inventaire',
    description: 'Comptage tournant : −12 unités relevées sur APITOU N°1 (PDK-104)',
    depotName: 'Dépôt Sousse',
    daysAgo: 3
  },
  {
    id: 'ajustement-2',
    kind: 'ajustement',
    title: 'Écart d’inventaire',
    description: 'Comptage tournant : +8 unités relevées sur HYDRA CRÈME (COS-077)',
    depotName: 'Dépôt Nabeul',
    daysAgo: 11
  }
]

/**
 * The latest movement of each kind, in the order the card reads them: what came
 * in, what moved between dépôts, what the count corrected, what needs ordering.
 * One per kind rather than the last four events, so the card says what the stock
 * did rather than showing four receipts in a row.
 */
export function recentActivity(): Movement[] {
  const lines = stockLines()
  const state = lines.map((line, index) => ({ line, offset: index % RECEIPT_CYCLE_DAYS }))

  // The most recent receipt anywhere: the first line to come round on its cycle.
  let receipt: Movement | null = null

  for (let daysAgo = 0; daysAgo < RECEIPT_CYCLE_DAYS && !receipt; daysAgo++) {
    // The largest receipt due today: a month's supply landing in one delivery.
    const due = state.filter(
      slot => (daysAgo + slot.offset) % RECEIPT_CYCLE_DAYS === 0 && slot.line.status !== 'rupture'
    )

    if (due.length === 0) continue

    const slack = due.reduce((best, slot) => (slot.line.monthlyOut > best.line.monthlyOut ? slot : best), due[0])

    receipt = {
      id: `reception-${slack.line.id}-${daysAgo}`,
      kind: 'reception',
      title: 'Réception dépôt',
      description: `${formatUnits(perDelivery(slack.line))} unités de ${slack.line.item.name} (${slack.line.item.code})`,
      depotName: slack.line.depot.name,
      daysAgo
    }
  }

  const worst = reorderAlerts()[0] ?? null

  const alert: Movement | null = worst
    ? {
        id: `alerte-${worst.id}`,
        kind: 'alerte',
        title: worst.status === 'rupture' ? 'Référence en rupture' : 'Seuil de réapprovisionnement franchi',
        description:
          worst.status === 'rupture'
            ? `${worst.item.name} (${worst.item.code}) — 0 j de couverture`
            : `${worst.item.name} (${worst.item.code}) — ${Math.round(worst.coverageDays)} j de couverture`,
        depotName: worst.depot.name
      }
    : null

  const best = (kind: MovementKind) => {
    if (kind === 'reception') return receipt
    if (kind === 'alerte') return alert

    return (
      [...MANUAL_MOVEMENTS]
        .filter(movement => movement.kind === kind)
        .sort((a, b) => (a.daysAgo ?? 0) - (b.daysAgo ?? 0))[0] ?? null
    )
  }

  return (['reception', 'transfert', 'ajustement', 'alerte'] as MovementKind[])
    .map(best)
    .filter((movement): movement is Movement => movement !== null)
}

/** "il y a 3 j", "hier", "aujourd'hui" — the shape a movement age is written in. */
export function formatDaysAgo(daysAgo: number): string {
  if (daysAgo <= 0) return "aujourd'hui"
  if (daysAgo === 1) return 'hier'

  return `il y a ${daysAgo} j`
}
