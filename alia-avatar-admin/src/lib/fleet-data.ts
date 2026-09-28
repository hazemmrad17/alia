// ──────────────────────────────────────────────
// ALIA Avatar — registre flotte & tournées
//
// The field force of VITAL SA: one entry per delegate unit — the delegate, the
// vehicle he drives, the circuit he is running today and the state he is in
// right now.
//
// Where the data comes from: nowhere yet. The backend has no fleet model — it
// stores training sessions, accounts and support reports, and nothing else — so
// this registry is a seed, kept in one file so a future `GET /api/v1/fleet/units`
// replaces the export at the bottom without touching the page.
//
// Two consequences worth remembering while reading the overview:
//  * Everything that is a figure *about a session* (visit rating, weekly score,
//    sessions played) is read from the API by the page itself — those are real.
//  * Everything about vehicles, circuits and states is the seed below.
// ──────────────────────────────────────────────

export type FleetState = 'en_route' | 'en_visite' | 'chargement' | 'attente' | 'immobilise'

export type VehicleCondition = 'excellent' | 'bon' | 'moyen' | 'a_reviser' | 'immobilise'

export type StopState = 'planifiee' | 'en_cours' | 'terminee'

export interface FleetStop {
  id: string

  /** Officine or cabinet the delegate is visiting. */
  name: string
  city: string

  /** Planned slot, "HH:MM". */
  at: string
  state: StopState
  productFocus: string
}

/**
 * One unit of the field force. `id` is its registration, used as its identity
 * everywhere on the platform: "VITAL-01".
 */
export interface FleetUnit {
  id: string
  delegate: string
  jobTitle: string
  sector: string
  car: string
  plate: string
  state: FleetState

  /** Minutes spent in the current state — what the fleet overview adds up. */
  minutesInState: number

  /**
   * Minutes behind the planned slot. Zero means on time, and an out-of-service
   * unit is never "late" — it is reported as immobilised instead.
   */
  delayMinutes: number

  /** Where the circuit started and where it ends. */
  routeFrom: string
  routeTo: string
  condition: VehicleCondition
  fuelPercent: number
  odometerKm: number

  /** Service due at this odometer reading. */
  serviceAtKm: number

  /** Cold-chain box temperature, °C. Null when the unit is not running. */
  coldChainC: number | null

  /** Operational alerts, already written for display. Empty means none. */
  warnings: string[]
  stops: FleetStop[]

  /** Visits closed on each of the last 12 working days (oldest first). */
  visitsByDay: number[]

  /** Kilometres driven on each of the last 12 working days (oldest first). */
  kmByDay: number[]
  visitsYesterday: number
  kmToday: number
}

/** Visits a unit is expected to close in a day, and the km that implies. */
export const VISITS_TARGET = 5
export const KM_TARGET = 60

/** Beyond either bound the cold-chain box is out of compliance. */
export const COLD_CHAIN_MIN_C = 2
export const COLD_CHAIN_MAX_C = 8

function stops(unit: string, rows: Array<[string, string, string, StopState, string]>): FleetStop[] {
  return rows.map(([name, city, at, state, productFocus], index) => ({
    id: `${unit}-S${index + 1}`,
    name,
    city,
    at,
    state,
    productFocus
  }))
}

const DAYS: number[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]

/** Last twelve working days as short French labels, oldest first. */
export const WORKING_DAYS = DAYS.map(day => `J-${12 - day}`)

export const FLEET_UNITS: FleetUnit[] = [
  {
    id: 'VITAL-01',
    delegate: 'Karim Benali',
    jobTitle: 'Délégué senior',
    sector: 'Tunis · Ariana',
    car: 'Renault Kangoo',
    plate: '214 TU 8934',
    state: 'en_route',
    minutesInState: 130,
    delayMinutes: 0,
    routeFrom: 'Dépôt VITAL — Tunis',
    routeTo: 'Ariana centre',
    condition: 'excellent',
    fuelPercent: 72,
    odometerKm: 48920,
    serviceAtKm: 50000,
    coldChainC: 4.5,
    warnings: [],
    stops: stops('VITAL-01', [
      ['Pharmacie El Amel', 'Ariana', '08:30', 'terminee', 'VITONIC'],
      ['Pharmacie Ibn Sina', 'Ariana', '09:15', 'terminee', 'Oligovit'],
      ['Pharmacie Centre Ville', 'Ariana', '10:00', 'terminee', 'LV Fersang'],
      ['Pharmacie Ennasr', 'Ariana', '10:45', 'en_cours', 'CALMOSS'],
      ['Pharmacie Borj Louzir', 'Ariana', '11:30', 'planifiee', 'PEDIAKIDS'],
      ['Pharmacie La Soukra', 'Ariana', '12:15', 'planifiee', 'VITONIC']
    ]),
    visitsByDay: [5, 6, 4, 5, 5, 6, 5, 4, 6, 5, 6, 5],
    kmByDay: [58, 64, 51, 60, 55, 68, 59, 47, 66, 61, 63, 52],
    visitsYesterday: 5,
    kmToday: 61
  },
  {
    id: 'VITAL-02',
    delegate: 'Amira Zouari',
    jobTitle: 'Déléguée',
    sector: 'Sfax Nord',
    car: 'Dacia Dokker',
    plate: '189 TU 2207',
    state: 'en_visite',
    minutesInState: 45,
    delayMinutes: 10,
    routeFrom: 'Dépôt Sfax',
    routeTo: 'Sfax centre',
    condition: 'bon',
    fuelPercent: 54,
    odometerKm: 61240,
    serviceAtKm: 63000,
    coldChainC: 5.1,
    warnings: [],
    stops: stops('VITAL-02', [
      ['Pharmacie Riadh', 'Sfax', '08:15', 'terminee', 'Magné B6'],
      ['Pharmacie Sidi Mansour', 'Sfax', '09:00', 'terminee', 'VITONIC'],
      ['Pharmacie El Jadida', 'Sfax', '09:45', 'terminee', 'PEDIAKIDS'],
      ['Pharmacie Bab Bhar', 'Sfax', '11:00', 'en_cours', 'Oligovit'],
      ['Pharmacie Route Gremda', 'Sfax', '11:45', 'planifiee', 'CALMOSS']
    ]),
    visitsByDay: [4, 5, 4, 4, 5, 3, 5, 4, 5, 4, 5, 4],
    kmByDay: [49, 55, 44, 58, 51, 39, 62, 47, 53, 45, 57, 41],
    visitsYesterday: 4,
    kmToday: 52
  },
  {
    id: 'VITAL-03',
    delegate: 'Yacine Hadj',
    jobTitle: 'Délégué',
    sector: 'Sousse · Monastir',
    car: 'VW Caddy',
    plate: '302 TU 4471',
    state: 'chargement',
    minutesInState: 25,
    delayMinutes: 0,
    routeFrom: 'Dépôt Sousse',
    routeTo: 'Port El Kantaoui',
    condition: 'bon',
    fuelPercent: 88,
    odometerKm: 38760,
    serviceAtKm: 45000,
    coldChainC: 6.2,
    warnings: [],
    stops: stops('VITAL-03', [
      ['Pharmacie Khezama', 'Sousse', '08:45', 'terminee', 'VITONIC'],
      ['Pharmacie Sahloul', 'Sousse', '09:30', 'terminee', 'LV Fersang'],
      ['Pharmacie Corniche', 'Sousse', '10:15', 'en_cours', 'Oligovit'],
      ['Pharmacie Kantaoui', 'Monastir', '11:15', 'planifiee', 'PEDIAKIDS'],
      ['Pharmacie Skanes', 'Monastir', '12:00', 'planifiee', 'CALMOSS']
    ]),
    visitsByDay: [5, 4, 7, 5, 4, 6, 5, 5, 4, 6, 5, 6],
    kmByDay: [54, 47, 72, 58, 49, 63, 55, 51, 44, 65, 57, 59],
    visitsYesterday: 5,
    kmToday: 58
  },
  {
    id: 'VITAL-04',
    delegate: 'Rania Boudali',
    jobTitle: 'Déléguée senior',
    sector: 'Bizerte',
    car: 'Renault Kangoo',
    plate: '176 TU 9183',
    state: 'en_route',
    minutesInState: 95,
    delayMinutes: 5,
    routeFrom: 'Dépôt Tunis',
    routeTo: 'Bizerte centre',
    condition: 'excellent',
    fuelPercent: 61,
    odometerKm: 55110,
    serviceAtKm: 58000,
    coldChainC: 4.2,
    warnings: [],
    stops: stops('VITAL-04', [
      ['Pharmacie Mateur', 'Mateur', '08:20', 'terminee', 'Oligovit'],
      ['Pharmacie Menzel Jemil', 'Bizerte', '09:40', 'terminee', 'VITONIC'],
      ['Pharmacie Ras Jebel', 'Bizerte', '10:30', 'terminee', 'Magné B6'],
      ['Pharmacie Zarzouna', 'Bizerte', '11:20', 'en_cours', 'CALMOSS'],
      ['Pharmacie Bizerte Nord', 'Bizerte', '12:10', 'planifiee', 'PEDIAKIDS']
    ]),
    visitsByDay: [6, 5, 6, 5, 7, 5, 6, 6, 5, 6, 5, 6],
    kmByDay: [64, 58, 71, 62, 76, 59, 68, 63, 55, 70, 61, 66],
    visitsYesterday: 6,
    kmToday: 66
  },
  {
    id: 'VITAL-05',
    delegate: 'Sami Djabri',
    jobTitle: 'Délégué',
    sector: 'Nabeul · Hammamet',
    car: 'Dacia Dokker',
    plate: '233 TU 6612',
    state: 'attente',
    minutesInState: 190,
    delayMinutes: 35,
    routeFrom: 'Dépôt Nabeul',
    routeTo: 'Hammamet Sud',
    condition: 'moyen',
    fuelPercent: 18,
    odometerKm: 74380,
    serviceAtKm: 76000,
    coldChainC: 7.4,
    warnings: ['Carburant bas', 'Chaîne du froid à surveiller'],
    stops: stops('VITAL-05', [
      ['Pharmacie Nabeul Centre', 'Nabeul', '08:30', 'terminee', 'VITONIC'],
      ['Pharmacie Dar Chaabane', 'Nabeul', '09:20', 'terminee', 'PEDIAKIDS'],
      ['Pharmacie Beni Khiar', 'Nabeul', '10:10', 'terminee', 'CALMOSS'],
      ['Pharmacie Hammamet Nord', 'Hammamet', '11:30', 'planifiee', 'Oligovit'],
      ['Pharmacie Yasmine', 'Hammamet', '12:20', 'planifiee', 'LV Fersang']
    ]),
    visitsByDay: [3, 3, 4, 2, 4, 3, 4, 3, 2, 4, 3, 3],
    kmByDay: [38, 42, 51, 36, 47, 40, 53, 44, 35, 49, 41, 46],
    visitsYesterday: 4,
    kmToday: 44
  },
  {
    id: 'VITAL-06',
    delegate: 'Leila Ferhat',
    jobTitle: 'Déléguée',
    sector: 'Gabès · Médenine',
    car: 'VW Caddy',
    plate: '415 TU 7723',
    state: 'en_visite',
    minutesInState: 70,
    delayMinutes: 20,
    routeFrom: 'Dépôt Gabès',
    routeTo: 'Médenine',
    condition: 'a_reviser',
    fuelPercent: 47,
    odometerKm: 82150,
    serviceAtKm: 80000,
    coldChainC: 8.4,
    warnings: ['Entretien en retard', 'Chaîne du froid hors plage'],
    stops: stops('VITAL-06', [
      ['Pharmacie Gabès Centre', 'Gabès', '08:10', 'terminee', 'VITONIC'],
      ['Pharmacie Chenini', 'Gabès', '09:00', 'terminee', 'Oligovit'],
      ['Pharmacie Mareth', 'Mareth', '10:20', 'en_cours', 'Magné B6'],
      ['Pharmacie Médenine', 'Médenine', '11:40', 'planifiee', 'CALMOSS'],
      ['Pharmacie Zarzis', 'Zarzis', '13:00', 'planifiee', 'PEDIAKIDS']
    ]),
    visitsByDay: [4, 3, 5, 4, 3, 4, 5, 3, 4, 5, 3, 4],
    kmByDay: [92, 88, 105, 96, 83, 99, 110, 91, 87, 102, 94, 98],
    visitsYesterday: 3,
    kmToday: 96
  },
  {
    id: 'VITAL-07',
    delegate: 'Omar Khaled',
    jobTitle: 'Délégué junior',
    sector: 'Kairouan · Sousse Ouest',
    car: 'Renault Kangoo',
    plate: '268 TU 3390',
    state: 'en_route',
    minutesInState: 55,
    delayMinutes: 15,
    routeFrom: 'Dépôt Kairouan',
    routeTo: 'Kairouan centre',
    condition: 'bon',
    fuelPercent: 66,
    odometerKm: 29840,
    serviceAtKm: 35000,
    coldChainC: 4.8,
    warnings: [],
    stops: stops('VITAL-07', [
      ['Pharmacie Okba', 'Kairouan', '08:40', 'terminee', 'VITONIC'],
      ['Pharmacie Sidi Zitoun', 'Kairouan', '09:30', 'terminee', 'PEDIAKIDS'],
      ['Pharmacie Hafria', 'Kairouan', '10:30', 'en_cours', 'Oligovit'],
      ['Pharmacie Sbikha', 'Sbikha', '11:30', 'planifiee', 'CALMOSS'],
      ['Pharmacie Chbika', 'Kairouan', '12:30', 'planifiee', 'Magné B6']
    ]),
    visitsByDay: [2, 3, 3, 4, 3, 2, 4, 3, 3, 4, 3, 4],
    kmByDay: [60, 66, 72, 58, 69, 63, 75, 61, 67, 70, 64, 68],
    visitsYesterday: 3,
    kmToday: 62
  },
  {
    id: 'VITAL-08',
    delegate: 'Nadia Saidi',
    jobTitle: 'Déléguée junior',
    sector: 'Monastir · Mahdia',
    car: 'Renault Kangoo',
    plate: '121 TU 8845',
    state: 'immobilise',
    minutesInState: 1440,
    delayMinutes: 0,
    routeFrom: 'Dépôt Monastir',
    routeTo: 'Atelier — Monastir',
    condition: 'immobilise',
    fuelPercent: 12,
    odometerKm: 66420,
    serviceAtKm: 70000,
    coldChainC: null,
    warnings: ['Pneu crevé', 'Immobilisée à l’atelier'],
    stops: stops('VITAL-08', [
      ['Pharmacie Mahdia Centre', 'Mahdia', '09:00', 'planifiee', 'VITONIC'],
      ['Pharmacie Rejiche', 'Mahdia', '10:00', 'planifiee', 'PEDIAKIDS'],
      ['Pharmacie Ksar Hellal', 'Monastir', '11:00', 'planifiee', 'Oligovit'],
      ['Pharmacie Moknine', 'Monastir', '12:00', 'planifiee', 'CALMOSS']
    ]),
    visitsByDay: [3, 4, 2, 3, 4, 3, 2, 4, 3, 4, 3, 0],
    kmByDay: [52, 58, 44, 61, 55, 49, 46, 57, 51, 59, 48, 0],
    visitsYesterday: 3,
    kmToday: 0
  }
]

// ── Labels ────────────────────────────────────────────────────────────────────

export const STATE_LABELS: Record<FleetState, string> = {
  en_route: 'En tournée',
  en_visite: 'En visite',
  chargement: 'Au dépôt',
  attente: 'En attente',
  immobilise: 'Immobilisée'
}

/**
 * Order the fleet strip and its rows are drawn in: the four states of a working
 * unit. An immobilised unit is deliberately absent — it would own most of the
 * strip and answer nothing — so the split describes the *running* fleet, and the
 * action card reports the immobilised ones separately.
 */
export const STATE_ORDER: FleetState[] = ['en_route', 'en_visite', 'chargement', 'attente']

export const CONDITION_LABELS: Record<VehicleCondition, string> = {
  excellent: 'Excellent',
  bon: 'Bon',
  moyen: 'Moyen',
  a_reviser: 'À réviser',
  immobilise: 'Immobilisé'
}

export const CONDITION_ORDER: VehicleCondition[] = ['excellent', 'bon', 'moyen', 'a_reviser', 'immobilise']

export const STOP_STATE_LABELS: Record<StopState, string> = {
  planifiee: 'Planifiée',
  en_cours: 'En cours',
  terminee: 'Terminée'
}

// ── Derived figures ───────────────────────────────────────────────────────────

export interface StateSplit {
  state: FleetState
  minutes: number
  percent: number
}

/**
 * Where the field force is right now, as time spent in each state. A unit that
 * has just left the depot counts for its minutes on the road, not for a whole
 * shift — the split is meant to answer "what is the fleet doing", not "how many
 * units exist". Immobilised units are excluded; see STATE_ORDER.
 */
export function stateSplit(units: FleetUnit[] = FLEET_UNITS): StateSplit[] {
  const total = units
    .filter(unit => STATE_ORDER.includes(unit.state))
    .reduce((sum, unit) => sum + unit.minutesInState, 0)

  return STATE_ORDER.map(state => {
    const minutes = units.filter(unit => unit.state === state).reduce((sum, unit) => sum + unit.minutesInState, 0)

    return { state, minutes, percent: total > 0 ? (minutes / total) * 100 : 0 }
  }).filter(split => split.minutes > 0)
}

export interface ConditionSplit {
  condition: VehicleCondition
  count: number
  percent: number
}

export function conditionSplit(units: FleetUnit[] = FLEET_UNITS): ConditionSplit[] {
  const total = units.length || 1

  return CONDITION_ORDER.map(condition => {
    const count = units.filter(unit => unit.condition === condition).length

    return { condition, count, percent: (count / total) * 100 }
  }).filter(split => split.count > 0)
}

/** "2h 10min" — the shape the fleet strip reports a state duration in. */
export function formatMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const rest = Math.round(minutes % 60)

  if (hours === 0) return `${rest}min`

  return `${hours}h ${String(rest).padStart(2, '0')}min`
}

export interface FleetTotals {
  units: number
  moving: number
  visitsToday: number
  visitsYesterday: number
  visitsTarget: number
  kmToday: number
  kmTarget: number
  coldChainOk: number
  coldChainChecked: number
  alerts: number
  serviceDue: number
}

/** Fleet-wide roll-up for the performance card. Zeroed when the roster is empty. */
export function fleetTotals(units: FleetUnit[] = FLEET_UNITS): FleetTotals {
  const running = units.filter(unit => unit.state !== 'immobilise')
  const checked = units.filter(unit => unit.coldChainC !== null)

  return {
    units: units.length,
    moving: running.length,
    visitsToday: units.reduce((sum, unit) => sum + unit.stops.filter(stop => stop.state === 'terminee').length, 0),
    visitsYesterday: units.reduce((sum, unit) => sum + unit.visitsYesterday, 0),
    visitsTarget: running.length * VISITS_TARGET,
    kmToday: units.reduce((sum, unit) => sum + unit.kmToday, 0),
    kmTarget: running.length * KM_TARGET,
    coldChainOk: checked.filter(
      unit => (unit.coldChainC ?? 0) >= COLD_CHAIN_MIN_C && (unit.coldChainC ?? 0) <= COLD_CHAIN_MAX_C
    ).length,
    coldChainChecked: checked.length,
    alerts: units.reduce((sum, unit) => sum + unit.warnings.length, 0),
    serviceDue: units.filter(unit => unit.odometerKm >= unit.serviceAtKm - 2000).length
  }
}

/** Stops of one unit in a given state, in the order they are planned. */
export function stopsInState(unit: FleetUnit, state: StopState): FleetStop[] {
  return unit.stops.filter(stop => stop.state === state)
}

/**
 * How far along a stop is, as a percentage. Planned stops are a visible empty
 * track rather than a hidden row — a circuit is mostly "not yet done".
 */
export function stopProgress(state: StopState): number {
  if (state === 'terminee') return 100
  if (state === 'en_cours') return 60

  return 0
}

/** Share of a unit's planned circuit that is closed. */
export function circuitProgress(unit: FleetUnit): number {
  if (unit.stops.length === 0) return 0

  const done = unit.stops.filter(stop => stop.state === 'terminee').length

  return Math.round((done / unit.stops.length) * 100)
}

/** Temperature reading with its unit, or a dash when the box is not running. */
export function formatColdChain(value: number | null): string {
  return value === null ? '—' : `${value.toFixed(1)} °C`
}

/** True when a warning is about something that should stop the unit. */
export function isBlockingWarning(warning: string): boolean {
  return /immobilis|crevé|hors plage|panne/i.test(warning)
}

// ── Geography ─────────────────────────────────────────────────────────────────
// Where the circuits actually run. The live map plots each unit at its current
// stop and draws the road it drives between stops, so the registry needs to know
// where its cities are: the city centres of the places its stops name.

export interface LatLng {
  lat: number
  lng: number
}

const CITY_COORDS: Record<string, LatLng> = {
  Tunis: { lat: 36.8065, lng: 10.1815 },
  Ariana: { lat: 36.8625, lng: 10.1956 },
  Bizerte: { lat: 37.2744, lng: 9.8739 },
  Mateur: { lat: 37.0406, lng: 9.6653 },
  'Port El Kantaoui': { lat: 35.8936, lng: 10.5944 },
  Nabeul: { lat: 36.4513, lng: 10.7357 },
  Hammamet: { lat: 36.4, lng: 10.6167 },
  Sousse: { lat: 35.8256, lng: 10.6084 },
  Monastir: { lat: 35.777, lng: 10.8262 },
  Kairouan: { lat: 35.6781, lng: 10.0963 },
  Sbikha: { lat: 35.9333, lng: 10.0333 },
  Mahdia: { lat: 35.5047, lng: 11.0622 },
  Sfax: { lat: 34.7406, lng: 10.7603 },
  Gabès: { lat: 33.8815, lng: 10.0982 },
  Mareth: { lat: 33.6333, lng: 10.2833 },
  Médenine: { lat: 33.3549, lng: 10.5055 },
  Zarzis: { lat: 33.5039, lng: 11.1122 }
}

/**
 * Coordinates of any place the registry names — a stop city ("Médenine"), a
 * depot ("Dépôt Sfax") or a landmark ("Port El Kantaoui"). Route endpoints are
 * written the way a person writes them ("Hammamet Sud", "Atelier — Monastir"),
 * so an exact miss falls back to the longest known city contained in the label.
 * Returns null rather than guessing, and the map then leaves that unit out.
 */
export function coordForCity(label: string): LatLng | null {
  if (!label) return null

  const exact = CITY_COORDS[label]

  if (exact) return exact

  const wanted = label.toLowerCase()

  const match = Object.keys(CITY_COORDS)
    .sort((a, b) => b.length - a.length)
    .find(city => wanted.includes(city.toLowerCase()))

  return match ? CITY_COORDS[match] : null
}

/**
 * What the delegate of a unit is doing right now: the stop in progress, else the
 * next planned one, else the last one closed.
 */
export function currentStop(unit: FleetUnit): FleetStop | null {
  return (
    unit.stops.find(stop => stop.state === 'en_cours') ??
    unit.stops.find(stop => stop.state === 'planifiee') ??
    [...unit.stops].reverse().find(stop => stop.state === 'terminee') ??
    null
  )
}

/** Where to draw a unit — null when none of its stops names a known city. */
export function unitPosition(unit: FleetUnit): LatLng | null {
  const stop = currentStop(unit)

  if (stop) {
    const position = coordForCity(stop.city)

    if (position) return position
  }

  return coordForCity(unit.routeTo) ?? coordForCity(unit.routeFrom)
}

/** The circuit a unit is running, as [lng, lat] pairs a map can draw. */
export function unitCircuitPath(unit: FleetUnit): Array<[number, number]> {
  return unit.stops
    .map(stop => coordForCity(stop.city))
    .filter((position): position is LatLng => position !== null)
    .map(position => [position.lng, position.lat])
}

/** Great-circle kilometres between two points. */
function haversineKm(from: LatLng, to: LatLng): number {
  const earthRadius = 6371
  const deltaLat = ((to.lat - from.lat) * Math.PI) / 180
  const deltaLng = ((to.lng - from.lng) * Math.PI) / 180

  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos((from.lat * Math.PI) / 180) * Math.cos((to.lat * Math.PI) / 180) * Math.sin(deltaLng / 2) ** 2

  return 2 * earthRadius * Math.asin(Math.sqrt(a))
}

/**
 * A road is longer than the arc between two cities, and this factor is the usual
 * stand-in for the difference. It makes the figure an estimate — the map has no
 * routing engine behind it — so treat it as "about this far", not a measurement.
 */
const ROAD_FACTOR = 1.35

/** Kilometres still to drive on the circuit: the legs not yet closed. */
export function remainingCircuitKm(unit: FleetUnit): number {
  const points = unit.stops
    .filter(stop => stop.state !== 'terminee')
    .map(stop => coordForCity(stop.city))
    .filter((position): position is LatLng => position !== null)

  let km = 0

  for (let index = 1; index < points.length; index += 1) km += haversineKm(points[index - 1], points[index])

  return Math.round(km * ROAD_FACTOR)
}

/** From this many minutes behind, the board calls a unit late. */
export const DELAY_THRESHOLD_MIN = 15

/** Late units, worst first. Immobilised units are excluded — see delayMinutes. */
export function delayedUnits(units: FleetUnit[] = FLEET_UNITS): FleetUnit[] {
  return units
    .filter(unit => unit.state !== 'immobilise' && unit.delayMinutes >= DELAY_THRESHOLD_MIN)
    .sort((a, b) => b.delayMinutes - a.delayMinutes)
}

/** "+25 min", or a plain "À l'heure" when the unit is on schedule. */
export function formatDelay(minutes: number): string {
  return minutes > 0 ? `+${minutes} min` : "À l'heure"
}

/** The planned slot of a stop pushed back by the unit's delay: "10:25". */
export function stopEta(unit: FleetUnit, stop: FleetStop | null): string | null {
  if (!stop) return null

  const [hours, minutes] = stop.at.split(':').map(Number)

  if (Number.isNaN(hours) || Number.isNaN(minutes)) return stop.at

  const total = (hours * 60 + minutes + unit.delayMinutes) % (24 * 60)

  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}
