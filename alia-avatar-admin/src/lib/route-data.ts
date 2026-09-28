// The route planner's data: the tournées the field force runs, the orders still
// waiting for one, and the geometry that turns a list of stops into a distance, a
// duration and an arrival time.
//
// Nothing here types in a distance, a duration or a slot. All three come out of
// the same rule — travel + loading + one visit per stop — so the table, the map
// and the summary can never disagree: add a stop and every figure moves with it.

import { FLEET_UNITS, coordForCity, formatMinutes, type LatLng, type StopState } from './fleet-data'
import { DEPOTS, type DepotId } from './inventory-data'

// ── Statuts ───────────────────────────────────────────────────────────────────

export type RouteStatus = 'brouillon' | 'prete' | 'en_tournee' | 'terminee'

export const ROUTE_STATUS_LABELS: Record<RouteStatus, string> = {
  brouillon: 'Brouillon',
  prete: 'Prête à expédier',
  en_tournee: 'En tournée',
  terminee: 'Terminée'
}

/** The one place a status is coloured: chip, badge and legend all read it. */
export const ROUTE_STATUS_TONES: Record<RouteStatus, string> = {
  brouillon: 'bg-muted text-muted-foreground',
  prete: 'bg-primary text-primary-foreground',
  en_tournee: 'bg-warning-soft text-warning',
  terminee: 'bg-success-soft text-success'
}

export const ROUTE_STATUS_ORDER: RouteStatus[] = ['en_tournee', 'prete', 'brouillon', 'terminee']

// ── Véhicules ─────────────────────────────────────────────────────────────────
// The eight units of the registry are the vehicles a tournée can be dispatched
// to, and the delegate listed against a unit drives it — which is why the planner
// never asks for a driver separately: assigning the vehicle assigns him. The id is
// the unit's registration, its identity everywhere on the platform.

export interface PlannerVehicle {
  id: string
  car: string
  plate: string

  /** The delegate who drives it. */
  driver: string
  depotId: DepotId
  payloadKg: number
  packageSlots: number

  /** Non-blocking warnings off the registry, surfaced when the unit is picked. */
  warnings: string[]
}

/** Average weight of a colis of medication, in kg. */
const KG_PER_PACKAGE = 12

/** Payload by model — what decides whether a load fits. */
const CAR_PAYLOAD_KG: Record<string, number> = {
  'Renault Kangoo': 650,
  'Dacia Dokker': 800,
  'VW Caddy': 700
}

/**
 * Where each unit is based for planning purposes. The registry sends two units out
 * of Kairouan and Monastir, which are not stocking sites — the five dépôts the
 * inventory tracks are — so those two plan out of Sousse, the nearest site that
 * actually holds stock.
 */
const UNIT_DEPOTS: Record<string, DepotId> = {
  'VITAL-01': 'tunis',
  'VITAL-02': 'sfax',
  'VITAL-03': 'sousse',
  'VITAL-04': 'tunis',
  'VITAL-05': 'nabeul',
  'VITAL-06': 'gabes',
  'VITAL-07': 'sousse',
  'VITAL-08': 'sousse'
}

export const PLANNER_VEHICLES: PlannerVehicle[] = FLEET_UNITS.map(unit => {
  const payloadKg = CAR_PAYLOAD_KG[unit.car] ?? 600

  return {
    id: unit.id,
    car: unit.car,
    plate: unit.plate,
    driver: unit.delegate,
    depotId: UNIT_DEPOTS[unit.id] ?? 'tunis',
    payloadKg,
    packageSlots: Math.floor(payloadKg / KG_PER_PACKAGE),
    warnings: unit.warnings
  }
})

const VEHICLE_BY_ID = new Map(PLANNER_VEHICLES.map(vehicle => [vehicle.id, vehicle]))
const DEPOT_BY_ID = new Map(DEPOTS.map(depot => [depot.id, depot]))

export function vehicleOf(id: string | null): PlannerVehicle | null {
  return id ? (VEHICLE_BY_ID.get(id) ?? null) : null
}

export type { DepotId }

export function depotOf(id: DepotId) {
  return DEPOT_BY_ID.get(id) ?? DEPOTS[0]
}

// ── Géométrie ─────────────────────────────────────────────────────────────────
// A road is not a straight line and a delegate is not on a motorway, so both
// factors are declared rather than hidden in the numbers.

/** Straight line → road distance. */
const ROAD_FACTOR = 1.28

/** Average door-to-door speed, dépôt to officine, km/h. */
const AVG_SPEED_KMH = 34

/** Loading at the dépôt before the first stop. */
export const LOAD_MINUTES = 25

/** A visit: unload, check the shelf, talk to the pharmacist. */
export const SERVICE_MINUTES = 18

const EARTH_RADIUS_KM = 6371
const KM_PER_DEGREE_LAT = 111

const rad = (degrees: number) => (degrees * Math.PI) / 180

function straightLineKm(a: LatLng, b: LatLng): number {
  const dLat = rad(b.lat - a.lat)
  const dLng = rad(b.lng - a.lng)

  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h))
}

/**
 * Where an officine sits. The registry names a stop's city, not its street
 * corner, and a tournée in Ariana calls on six officines — pinning all six to the
 * city centre would make an intra-city circuit measure zero and stack six markers
 * on one pixel. Each officine is therefore offset from its city centre by 0.6 to
 * 3 km on a bearing taken from its own name: deterministic, so the same officine
 * sits in the same spot on the map every time, and the distance the planner
 * reports is the distance between the pins the planner draws.
 */
export function stopPosition(officine: string, city: string): LatLng | null {
  const centre = coordForCity(city)

  if (!centre) return null

  let hash = 0

  for (let index = 0; index < officine.length; index++) {
    hash = (hash * 31 + officine.charCodeAt(index)) % 1_000_003
  }

  const bearing = rad(hash % 360)
  const radiusKm = 0.6 + ((hash >> 4) % 25) / 10

  return {
    lat: centre.lat + (Math.cos(bearing) * radiusKm) / KM_PER_DEGREE_LAT,
    lng: centre.lng + (Math.sin(bearing) * radiusKm) / (KM_PER_DEGREE_LAT * Math.cos(rad(centre.lat)))
  }
}

/** The dépôt's own position, on the centre of its governorate. */
function depotPosition(depotId: DepotId): LatLng | null {
  const depot = depotOf(depotId)

  return coordForCity(depot.city.split(' · ')[0]) ?? coordForCity(depot.name)
}

// ── Arrêts et tournées ────────────────────────────────────────────────────────

export interface RouteStop {
  id: string

  /** The order this stop delivers, so a stop can be traced back to its commande. */
  orderId: string
  officine: string
  city: string
  address: string

  /** Arrival the delegate is working to, "HH:MM" — derived, never typed in. */
  slot: string
  packages: number
  weightKg: number
  state: StopState
}

export interface Route {
  id: string
  status: RouteStatus

  /** ISO day the tournée runs on. */
  date: string
  depotId: DepotId

  /** Unit dispatched, or null while the plan is still a brouillon. */
  vehicleId: string | null

  /** Departure from the dépôt, "HH:MM". */
  startAt: string
  returnToStart: boolean
  stops: RouteStop[]
  notes: string
}

/** `[orderId, officine, city, address, packages, weightKg, state]`. */
type StopSeed = [string, string, string, string, number, number, StopState]

function clock(startAt: string, minutes: number): string {
  const [hours, mins] = startAt.split(':').map(Number)
  const total = hours * 60 + mins + Math.round(minutes)

  return `${String(Math.floor((total / 60) % 24)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

/** Kilometres the circuit covers, counted leg by leg, dépôt to dépôt. */
export function routeDistanceKm(stops: RouteStop[], depotId: DepotId, returnToStart = true): number {
  const depotPoint = depotPosition(depotId)
  const legs: Array<LatLng | null> = [depotPoint, ...stops.map(stop => stopPosition(stop.officine, stop.city))]

  if (returnToStart) legs.push(depotPoint)

  let total = 0

  for (let index = 1; index < legs.length; index++) {
    const from = legs[index - 1]
    const to = legs[index]

    if (from && to) total += straightLineKm(from, to)
  }

  return total * ROAD_FACTOR
}

/**
 * Driving, loading and visiting, in minutes — the single rule this page measures a
 * tournée by. Slots are derived from it, so the last stop's time plus a visit plus
 * the run home is exactly the "fin estimée" the summary reports.
 */
export function routeDurationMinutes(stops: RouteStop[], depotId: DepotId, returnToStart = true): number {
  if (stops.length === 0) return 0

  return (
    (routeDistanceKm(stops, depotId, returnToStart) / AVG_SPEED_KMH) * 60 +
    LOAD_MINUTES +
    stops.length * SERVICE_MINUTES
  )
}

/** [lng, lat] pairs for the map: dépôt, each stop, then the dépôt again. */
export function routePath(stops: RouteStop[], depotId: DepotId, returnToStart: boolean): Array<[number, number]> {
  const depotPoint = depotPosition(depotId)
  const points: Array<[number, number]> = []

  if (depotPoint) points.push([depotPoint.lng, depotPoint.lat])

  for (const stop of stops) {
    const point = stopPosition(stop.officine, stop.city)

    if (point) points.push([point.lng, point.lat])
  }

  if (returnToStart && depotPoint && points.length > 1) points.push([depotPoint.lng, depotPoint.lat])

  return points
}

/** Arrival slot for each stop, in the order given, plus the end of the circuit. */
export function scheduleStopTimes(
  stops: RouteStop[],
  depotId: DepotId,
  startAt: string,
  returnToStart: boolean
): { stops: RouteStop[]; endAt: string | null } {
  if (stops.length === 0) return { stops, endAt: null }

  const depotPoint = depotPosition(depotId)

  let cursor = LOAD_MINUTES
  let previous = depotPoint

  const scheduled = stops.map(stop => {
    const point = stopPosition(stop.officine, stop.city)

    if (previous && point) cursor += (straightLineKm(previous, point) * ROAD_FACTOR * 60) / AVG_SPEED_KMH

    const slot = clock(startAt, cursor)

    cursor += SERVICE_MINUTES
    previous = point ?? previous

    return { ...stop, slot }
  })

  let tail = 0

  if (returnToStart && previous && depotPoint) {
    tail = (straightLineKm(previous, depotPoint) * ROAD_FACTOR * 60) / AVG_SPEED_KMH
  }

  return { stops: scheduled, endAt: clock(startAt, cursor + tail) }
}

function route(
  id: string,
  status: RouteStatus,
  date: string,
  depotId: DepotId,
  vehicleId: string | null,
  startAt: string,
  rows: StopSeed[],
  notes = ''
): Route {
  const raw: RouteStop[] = rows.map(([orderId, officine, city, address, packages, weightKg, state], index) => ({
    id: `${id}-A${index + 1}`,
    orderId,
    officine,
    city,
    address,
    slot: '00:00',
    packages,
    weightKg,
    state
  }))

  return {
    id,
    status,
    date,
    depotId,
    vehicleId,
    startAt,
    returnToStart: true,
    stops: scheduleStopTimes(raw, depotId, startAt, true).stops,
    notes
  }
}

// ── Commandes non assignées ───────────────────────────────────────────────────

export interface PendingOrder {
  id: string
  officine: string
  city: string
  address: string

  /** The day it has to land on, ISO. */
  date: string

  /** The window the officine agreed to, "HH:MM" each. */
  windowFrom: string
  windowTo: string
  packages: number
  weightKg: number

  /** Site holding the goods — what decides which dépôt the tournée leaves from. */
  depotId: DepotId
}

/** `[officine, city, address, windowFrom, windowTo, packages, depotId]`. */
type OrderSeed = [string, string, string, string, string, number, DepotId]

let orderSerial = 2047

function orderRows(rows: OrderSeed[]): PendingOrder[] {
  return rows.map(([officine, city, address, windowFrom, windowTo, packages, depotId]) => ({
    id: `CMD-${orderSerial++}`,
    officine,
    city,
    address,
    date: new Date().toISOString().slice(0, 10),
    windowFrom,
    windowTo,
    packages,
    weightKg: packages * KG_PER_PACKAGE,
    depotId
  }))
}

/**
 * What is waiting for a tournée. Every order sits in the governorate of the dépôt
 * that holds it, because that is what makes one plannable: a dépôt in Tunis has no
 * business dispatching a van to Zarzis.
 */
export const PENDING_ORDERS: PendingOrder[] = [
  ...orderRows([
    ['Pharmacie El Manar', 'Tunis', '24 av. Habib Bourguiba, Tunis', '08:00', '12:00', 5, 'tunis'],
    ['Pharmacie Bab Souika', 'Tunis', '9 rue de la Kasbah, Tunis', '13:00', '17:00', 3, 'tunis'],
    ['Pharmacie Bardo', 'Tunis', '14 rue de l’Union, Tunis', '10:00', '16:00', 9, 'tunis'],
    ['Pharmacie La Marsa Plage', 'Ariana', '6 av. Taieb Mhiri, Ariana', '08:30', '14:00', 7, 'tunis'],
    ['Pharmacie El Menzah', 'Ariana', '31 rue Ibn Charaf, Ariana', '09:00', '15:00', 2, 'tunis'],
    ['Pharmacie Ariana Ville', 'Ariana', '48 av. de Carthage, Ariana', '08:00', '13:00', 4, 'tunis']
  ]),
  ...orderRows([
    ['Pharmacie Sfax Ouest', 'Sfax', '41 route de Tunis, Sfax', '08:15', '12:30', 8, 'sfax'],
    ['Pharmacie Sfax El Jadida', 'Sfax', '77 av. de l’Armée, Sfax', '09:00', '14:00', 3, 'sfax'],
    ['Pharmacie Sakiet Ezzit', 'Sfax', '12 rue Léo Lagrange, Sfax', '10:00', '16:30', 5, 'sfax'],
    ['Pharmacie Gremda Nord', 'Sfax', '29 av. Gremda, Sfax', '13:00', '17:00', 4, 'sfax']
  ]),
  ...orderRows([
    ['Pharmacie Sousse Corniche', 'Sousse', '8 bd de la Corniche, Sousse', '08:00', '12:00', 6, 'sousse'],
    ['Pharmacie Khezama Ouest', 'Sousse', '52 av. Khezama, Sousse', '08:45', '13:30', 3, 'sousse'],
    ['Pharmacie Sahline', 'Monastir', '7 rue de la Plage, Monastir', '09:15', '15:00', 5, 'sousse'],
    ['Pharmacie Moknine Centre', 'Monastir', '3 rue Moknine, Monastir', '10:00', '15:30', 4, 'sousse'],
    ['Pharmacie Ksar Hellal', 'Monastir', '21 av. de la République, Monastir', '11:00', '16:00', 6, 'sousse']
  ]),
  ...orderRows([
    ['Pharmacie Hammamet Yasmine', 'Hammamet', '34 av. Yasmine, Hammamet', '08:15', '12:00', 8, 'nabeul'],
    ['Pharmacie Dar Chaabane Sud', 'Nabeul', '5 rue Sidi Salem, Nabeul', '09:30', '14:30', 3, 'nabeul'],
    ['Pharmacie Beni Khiar Est', 'Nabeul', '21 av. de la Liberté, Nabeul', '11:00', '16:00', 5, 'nabeul']
  ]),
  ...orderRows([
    ['Pharmacie Gabès Oasis', 'Gabès', '13 av. Farhat Hached, Gabès', '08:00', '12:00', 6, 'gabes'],
    ['Pharmacie Chenini Nord', 'Gabès', '6 rue Chenini, Gabès', '09:30', '14:00', 3, 'gabes'],
    ['Pharmacie Mareth Nord', 'Mareth', '9 rue de la Gare, Mareth', '10:00', '14:00', 4, 'gabes']
  ])
]

// ── Les tournées ──────────────────────────────────────────────────────────────
// Fourteen circuits over the five stocking sites. The two that are en tournée are
// the two the fleet registry has on the road right now, so the map in Opérations
// and this page describe the same vehicles.

export const ROUTES: Route[] = [
  route(
    'TR-2026-0181',
    'en_tournee',
    '2026-09-23',
    'tunis',
    'VITAL-01',
    '08:00',
    [
      ['CMD-1997', 'Pharmacie El Amel', 'Ariana', '14 av. de Carthage, Ariana', 6, 72, 'terminee'],
      ['CMD-1998', 'Pharmacie Ibn Sina', 'Ariana', '3 rue Ibn Sina, Ariana', 4, 48, 'terminee'],
      ['CMD-1999', 'Pharmacie Centre Ville', 'Ariana', '28 av. Habib Bourguiba, Ariana', 7, 86, 'terminee'],
      ['CMD-2000', 'Pharmacie Ennasr', 'Ariana', '45 av. Hédi Nouira, Ariana', 5, 59, 'en_cours'],
      ['CMD-2001', 'Pharmacie Borj Louzir', 'Ariana', '11 rue Borj Louzir, Ariana', 3, 37, 'planifiee'],
      ['CMD-2002', 'Pharmacie La Soukra', 'Ariana', '60 av. de la Soukra, Ariana', 6, 70, 'planifiee']
    ],
    'Chaîne du froid à surveiller sur la dernière livraison.'
  ),
  route('TR-2026-0180', 'en_tournee', '2026-09-23', 'nabeul', 'VITAL-05', '08:00', [
    ['CMD-2003', 'Pharmacie Nabeul Centre', 'Nabeul', '19 av. Habib Thameur, Nabeul', 5, 61, 'terminee'],
    ['CMD-2004', 'Pharmacie Dar Chaabane', 'Nabeul', '8 rue de la Plage, Nabeul', 4, 45, 'terminee'],
    ['CMD-2005', 'Pharmacie Beni Khiar', 'Nabeul', '23 av. de la République, Nabeul', 6, 73, 'terminee'],
    ['CMD-2006', 'Pharmacie Hammamet Nord', 'Hammamet', '37 av. de la Paix, Hammamet', 3, 39, 'planifiee'],
    ['CMD-2007', 'Pharmacie Yasmine', 'Hammamet', '4 bd Yasmine, Hammamet', 7, 84, 'planifiee']
  ]),

  // Prêtes à expédier — vehicle and delegate assigned, waiting on the departure slot.
  route('TR-2026-0183', 'prete', '2026-09-24', 'sfax', 'VITAL-02', '08:15', [
    ['CMD-2010', 'Pharmacie Riadh', 'Sfax', '31 av. Riadh, Sfax', 4, 47, 'planifiee'],
    ['CMD-2011', 'Pharmacie Sidi Mansour', 'Sfax', '16 route de Gabès, Sfax', 6, 69, 'planifiee'],
    ['CMD-2012', 'Pharmacie El Jadida', 'Sfax', '9 rue El Jadida, Sfax', 5, 58, 'planifiee'],
    ['CMD-2013', 'Pharmacie Bab Bhar', 'Sfax', '22 av. Bab Bhar, Sfax', 3, 36, 'planifiee'],
    ['CMD-2014', 'Pharmacie Route Gremda', 'Sfax', '48 route de Gremda, Sfax', 7, 82, 'planifiee']
  ]),
  route('TR-2026-0179', 'prete', '2026-09-24', 'sousse', 'VITAL-03', '08:30', [
    ['CMD-2015', 'Pharmacie Khezama', 'Sousse', '12 av. Khezama, Sousse', 6, 71, 'planifiee'],
    ['CMD-2016', 'Pharmacie Sahloul', 'Sousse', '5 rue Sahloul, Sousse', 4, 50, 'planifiee'],
    ['CMD-2017', 'Pharmacie Corniche', 'Sousse', '2 bd de la Corniche, Sousse', 5, 62, 'planifiee'],
    ['CMD-2018', 'Pharmacie Kantaoui', 'Port El Kantaoui', '18 av. du Port, Port El Kantaoui', 3, 33, 'planifiee'],
    ['CMD-2019', 'Pharmacie Skanes', 'Monastir', '27 route de Skanes, Monastir', 6, 74, 'planifiee']
  ]),

  // Brouillons — stops picked, nothing assigned yet.
  route('TR-2026-0184', 'brouillon', '2026-09-25', 'tunis', null, '08:00', [
    ['CMD-2020', 'Pharmacie El Manar', 'Tunis', '24 av. Habib Bourguiba, Tunis', 5, 57, 'planifiee'],
    ['CMD-2021', 'Pharmacie Bab Souika', 'Tunis', '9 rue de la Kasbah, Tunis', 4, 46, 'planifiee'],
    ['CMD-2022', 'Pharmacie Bardo', 'Tunis', '14 rue de l’Union, Tunis', 6, 70, 'planifiee'],
    ['CMD-2023', 'Pharmacie El Menzah', 'Ariana', '31 rue Ibn Charaf, Ariana', 3, 34, 'planifiee'],
    ['CMD-2024', 'Pharmacie Ariana Ville', 'Ariana', '48 av. de Carthage, Ariana', 4, 49, 'planifiee']
  ]),
  route('TR-2026-0185', 'brouillon', '2026-09-25', 'sfax', null, '08:00', [
    ['CMD-2025', 'Pharmacie Sfax Ouest', 'Sfax', '41 route de Tunis, Sfax', 5, 60, 'planifiee'],
    ['CMD-2026', 'Pharmacie Sakiet Ezzit', 'Sfax', '12 rue Léo Lagrange, Sfax', 4, 44, 'planifiee'],
    ['CMD-2027', 'Pharmacie Gremda Nord', 'Sfax', '29 av. Gremda, Sfax', 6, 72, 'planifiee'],
    ['CMD-2028', 'Pharmacie Sfax El Jadida', 'Sfax', '77 av. de l’Armée, Sfax', 3, 38, 'planifiee']
  ]),
  route('TR-2026-0186', 'brouillon', '2026-09-25', 'sousse', null, '08:30', [
    ['CMD-2029', 'Pharmacie Khezama Ouest', 'Sousse', '52 av. Khezama, Sousse', 4, 48, 'planifiee'],
    ['CMD-2030', 'Pharmacie Sahloul Nord', 'Sousse', '5 rue Sahloul, Sousse', 5, 55, 'planifiee'],
    ['CMD-2031', 'Pharmacie Sahline', 'Monastir', '7 rue de la Plage, Monastir', 6, 68, 'planifiee'],
    ['CMD-2032', 'Pharmacie Moknine Centre', 'Monastir', '3 rue Moknine, Monastir', 3, 35, 'planifiee']
  ]),
  route('TR-2026-0187', 'brouillon', '2026-09-26', 'nabeul', null, '09:00', [
    ['CMD-2033', 'Pharmacie Hammamet Yasmine', 'Hammamet', '34 av. Yasmine, Hammamet', 5, 59, 'planifiee'],
    ['CMD-2034', 'Pharmacie Dar Chaabane Sud', 'Nabeul', '5 rue Sidi Salem, Nabeul', 4, 45, 'planifiee'],
    ['CMD-2035', 'Pharmacie Beni Khiar Est', 'Nabeul', '21 av. de la Liberté, Nabeul', 6, 71, 'planifiee']
  ]),
  route('TR-2026-0188', 'brouillon', '2026-09-26', 'gabes', null, '08:00', [
    ['CMD-2036', 'Pharmacie Gabès Oasis', 'Gabès', '13 av. Farhat Hached, Gabès', 6, 73, 'planifiee'],
    ['CMD-2037', 'Pharmacie Chenini Nord', 'Gabès', '6 rue Chenini, Gabès', 4, 49, 'planifiee'],
    ['CMD-2038', 'Pharmacie Mareth Nord', 'Mareth', '9 rue de la Gare, Mareth', 5, 57, 'planifiee']
  ]),

  // Terminées — closed circuits, kept for the record.
  route('TR-2026-0178', 'terminee', '2026-09-22', 'tunis', 'VITAL-04', '08:00', [
    ['CMD-1901', 'Pharmacie El Manar', 'Tunis', '24 av. Habib Bourguiba, Tunis', 5, 61, 'terminee'],
    ['CMD-1902', 'Pharmacie Bardo', 'Tunis', '14 rue de l’Union, Tunis', 4, 47, 'terminee'],
    ['CMD-1903', 'Pharmacie Bab Souika', 'Tunis', '9 rue de la Kasbah, Tunis', 6, 68, 'terminee'],
    ['CMD-1904', 'Pharmacie El Menzah', 'Ariana', '31 rue Ibn Charaf, Ariana', 3, 35, 'terminee'],
    ['CMD-1905', 'Pharmacie Ariana Ville', 'Ariana', '48 av. de Carthage, Ariana', 5, 58, 'terminee']
  ]),
  route('TR-2026-0177', 'terminee', '2026-09-22', 'gabes', 'VITAL-06', '07:45', [
    ['CMD-1906', 'Pharmacie Gabès Centre', 'Gabès', '20 av. Farhat Hached, Gabès', 6, 70, 'terminee'],
    ['CMD-1907', 'Pharmacie Chenini', 'Gabès', '6 rue Chenini, Gabès', 4, 46, 'terminee'],
    ['CMD-1908', 'Pharmacie Gabès Oasis', 'Gabès', '13 av. Farhat Hached, Gabès', 5, 57, 'terminee'],
    ['CMD-1909', 'Pharmacie Mareth', 'Mareth', '11 av. de la Gare, Mareth', 3, 38, 'terminee']
  ]),
  route('TR-2026-0176', 'terminee', '2026-09-21', 'sfax', 'VITAL-02', '08:00', [
    ['CMD-1911', 'Pharmacie Riadh', 'Sfax', '31 av. Riadh, Sfax', 5, 60, 'terminee'],
    ['CMD-1912', 'Pharmacie Sidi Mansour', 'Sfax', '16 route de Gabès, Sfax', 4, 48, 'terminee'],
    ['CMD-1913', 'Pharmacie Sakiet Ezzit', 'Sfax', '12 rue Léo Lagrange, Sfax', 6, 71, 'terminee'],
    ['CMD-1914', 'Pharmacie Bab Bhar', 'Sfax', '22 av. Bab Bhar, Sfax', 3, 36, 'terminee'],
    ['CMD-1915', 'Pharmacie Route Gremda', 'Sfax', '48 route de Gremda, Sfax', 5, 59, 'terminee']
  ]),
  route('TR-2026-0175', 'terminee', '2026-09-21', 'sousse', 'VITAL-07', '08:30', [
    ['CMD-1916', 'Pharmacie Khezama', 'Sousse', '12 av. Khezama, Sousse', 6, 69, 'terminee'],
    ['CMD-1917', 'Pharmacie Sahloul', 'Sousse', '5 rue Sahloul, Sousse', 4, 45, 'terminee'],
    ['CMD-1918', 'Pharmacie Corniche', 'Sousse', '2 bd de la Corniche, Sousse', 5, 58, 'terminee'],
    ['CMD-1919', 'Pharmacie Skanes', 'Monastir', '27 route de Skanes, Monastir', 4, 50, 'terminee']
  ]),
  route('TR-2026-0174', 'terminee', '2026-09-20', 'nabeul', 'VITAL-05', '08:45', [
    ['CMD-1921', 'Pharmacie Nabeul Centre', 'Nabeul', '19 av. Habib Thameur, Nabeul', 5, 62, 'terminee'],
    ['CMD-1922', 'Pharmacie Dar Chaabane', 'Nabeul', '8 rue de la Plage, Nabeul', 4, 44, 'terminee'],
    ['CMD-1923', 'Pharmacie Beni Khiar', 'Nabeul', '23 av. de la République, Nabeul', 6, 72, 'terminee'],
    ['CMD-1924', 'Pharmacie Hammamet Nord', 'Hammamet', '37 av. de la Paix, Hammamet', 3, 31, 'terminee']
  ])
]

// ── Ordonnancement ────────────────────────────────────────────────────────────
// "Optimiser" is nearest neighbour from the dépôt: not the optimal tour, but the
// one a planner can explain, and it is what produces the arrival slots.

/**
 * Nearest neighbour: repeatedly take the closest stop left. What the planner's
 * Optimiser button does, and what makes the sequence card's order mean something.
 */
export function optimiseOrder(stops: RouteStop[], depotId: DepotId): RouteStop[] {
  const remaining = stops.map(stop => ({ stop, point: stopPosition(stop.officine, stop.city) }))
  const ordered: RouteStop[] = []

  let cursor = depotPosition(depotId)

  while (remaining.length > 0) {
    let bestIndex = 0
    let bestDistance = Number.POSITIVE_INFINITY

    for (let index = 0; index < remaining.length; index++) {
      const point = remaining[index].point

      // A stop whose city is unknown keeps its relative position rather than
      // being dropped: without a point it simply cannot win the comparison.
      const distance = cursor && point ? straightLineKm(cursor, point) : bestDistance

      if (distance < bestDistance) {
        bestDistance = distance
        bestIndex = index
      }
    }

    const [taken] = remaining.splice(bestIndex, 1)

    ordered.push(taken.stop)
    cursor = taken.point ?? cursor
  }

  return ordered
}

/** Turns picked orders into stops, sequenced and slotted. */
export function stopsFromOrders(
  orders: PendingOrder[],
  depotId: DepotId,
  startAt: string,
  returnToStart: boolean
): RouteStop[] {
  const seed: RouteStop[] = orders.map((order, index) => ({
    id: `NEW-A${index + 1}`,
    orderId: order.id,
    officine: order.officine,
    city: order.city,
    address: order.address,
    slot: '00:00',
    packages: order.packages,
    weightKg: order.weightKg,
    state: 'planifiee'
  }))

  return scheduleStopTimes(optimiseOrder(seed, depotId), depotId, startAt, returnToStart).stops
}

// ── Chiffres d'une tournée ────────────────────────────────────────────────────

export interface RouteFigures {
  stops: number
  packages: number
  weightKg: number
  distanceKm: number
  durationMinutes: number
  endAt: string | null
  capacityPercent: number | null
  capacityLabel: string
}

export function routeFigures(
  stops: RouteStop[],
  depotId: DepotId,
  startAt: string,
  returnToStart: boolean,
  vehicleId: string | null
): RouteFigures {
  const packages = stops.reduce((sum, stop) => sum + stop.packages, 0)
  const weightKg = stops.reduce((sum, stop) => sum + stop.weightKg, 0)
  const distanceKm = routeDistanceKm(stops, depotId, returnToStart)
  const durationMinutes = routeDurationMinutes(stops, depotId, returnToStart)
  const vehicle = vehicleOf(vehicleId)

  // Whichever runs out first decides the load: the payload or the room for colis.
  const byWeight = vehicle ? (weightKg / vehicle.payloadKg) * 100 : 0
  const byRoom = vehicle ? (packages / vehicle.packageSlots) * 100 : 0
  const capacityPercent = vehicle ? Math.max(byWeight, byRoom) : null

  const capacityLabel = vehicle
    ? `${byWeight.toFixed(0)} % charge utile · ${byRoom.toFixed(0)} % volume`
    : 'Aucun véhicule'

  return {
    stops: stops.length,
    packages,
    weightKg,
    distanceKm,
    durationMinutes,
    endAt: stops.length > 0 ? scheduleStopTimes(stops, depotId, startAt, returnToStart).endAt : null,
    capacityPercent,
    capacityLabel
  }
}

/** The figures of a stored route. */
export function figuresOf(route: Route): RouteFigures {
  return routeFigures(route.stops, route.depotId, route.startAt, route.returnToStart, route.vehicleId)
}

// ── List page ─────────────────────────────────────────────────────────────────

export interface RouteKpis {
  total: number
  enTournee: number
  prete: number
  terminee: number
  brouillon: number
}

export function routeKpis(routes: Route[] = ROUTES): RouteKpis {
  const count = (status: RouteStatus) => routes.filter(route => route.status === status).length

  return {
    total: routes.length,
    enTournee: count('en_tournee'),
    prete: count('prete'),
    terminee: count('terminee'),
    brouillon: count('brouillon')
  }
}

export type RouteSortKey = 'route' | 'date' | 'stops' | 'driver' | 'vehicle' | 'distance' | 'duration' | 'status'

export const ROUTE_SORT_LABELS: Record<RouteSortKey, string> = {
  route: 'Tournée',
  date: 'Date',
  stops: 'Arrêts',
  driver: 'Chauffeur',
  vehicle: 'Véhicule',
  distance: 'Distance',
  duration: 'Durée',
  status: 'Statut'
}

function sortValue(route: Route, key: RouteSortKey): string | number {
  const vehicle = vehicleOf(route.vehicleId)

  switch (key) {
    case 'route':
      return route.id
    case 'date':
      return `${route.date} ${route.startAt}`
    case 'stops':
      return route.stops.length
    case 'driver':
      return vehicle?.driver ?? ''
    case 'vehicle':
      return vehicle?.plate ?? ''
    case 'distance':
      return figuresOf(route).distanceKm
    case 'duration':
      return figuresOf(route).durationMinutes
    case 'status':
      return ROUTE_STATUS_ORDER.indexOf(route.status)
  }
}

export function sortRoutes(routes: Route[], key: RouteSortKey, descending: boolean): Route[] {
  const sorted = [...routes].sort((a, b) => {
    const left = sortValue(a, key)
    const right = sortValue(b, key)

    if (typeof left === 'number' && typeof right === 'number') return left - right

    return String(left).localeCompare(String(right), 'fr')
  })

  return descending ? sorted.reverse() : sorted
}

export interface RouteFilters {
  search: string
  status: string
  driver: string
  vehicle: string
}

export const EMPTY_ROUTE_FILTERS: RouteFilters = { search: '', status: 'all', driver: 'all', vehicle: 'all' }

export function isFiltered(filters: RouteFilters): boolean {
  return (
    filters.search.trim() !== '' || filters.status !== 'all' || filters.driver !== 'all' || filters.vehicle !== 'all'
  )
}

export function filterRoutes(routes: Route[], filters: RouteFilters): Route[] {
  const wanted = filters.search.trim().toLowerCase()

  return routes.filter(route => {
    const vehicle = vehicleOf(route.vehicleId)

    if (filters.status !== 'all' && route.status !== filters.status) return false
    if (filters.driver !== 'all' && (vehicle?.driver ?? '') !== filters.driver) return false
    if (filters.vehicle !== 'all' && (vehicle?.plate ?? '') !== filters.vehicle) return false

    if (wanted === '') return true

    return [
      route.id,
      vehicle?.driver ?? '',
      vehicle?.plate ?? '',
      depotOf(route.depotId).name,
      ...route.stops.map(stop => `${stop.officine} ${stop.city}`)
    ]
      .join(' ')
      .toLowerCase()
      .includes(wanted)
  })
}

/** The drivers and plates the filter selects offer, taken from the fleet itself. */
export function driverOptions(): string[] {
  return PLANNER_VEHICLES.map(vehicle => vehicle.driver).sort((a, b) => a.localeCompare(b, 'fr'))
}

export function vehicleOptions(): Array<{ value: string; label: string }> {
  return PLANNER_VEHICLES.map(vehicle => ({ value: vehicle.plate, label: `${vehicle.plate} · ${vehicle.id}` }))
}

// ── Mise en forme ─────────────────────────────────────────────────────────────

const MONTHS_FR = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.']

/** "24 sept. 2026" — the shape the list's Date column uses. */
export function formatRouteDate(iso: string): string {
  const [year, month, day] = iso.split('-').map(Number)

  return `${day} ${MONTHS_FR[month - 1]} ${year}`
}

/** "24 sept." — the short form the order list's window uses. */
export function formatShortDate(iso: string): string {
  const [, month, day] = iso.split('-').map(Number)

  return `${day} ${MONTHS_FR[month - 1]}`
}

export { formatMinutes as formatDuration }

export function formatKm(km: number): string {
  return `${km.toFixed(1).replace('.', ',')} km`
}

export function formatWeight(kg: number): string {
  return `${Math.round(kg)} kg`
}

/** Initials for the driver chip: "Karim Benali" → "KB". */
export function initials(name: string): string {
  return name
    .split(/[\s-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase() ?? '')
    .join('')
}
