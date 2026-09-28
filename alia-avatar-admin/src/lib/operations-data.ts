// ──────────────────────────────────────────────
// ALIA Avatar — agrégats de la vue d'ensemble des opérations
//
// What the Operations overview adds up: how the fleet is distributed, how far
// today's visits have got, what the units need before their day can be trusted,
// the visits themselves, and the last twelve working days.
//
// Everything here derives from the fleet registry (src/lib/fleet-data.ts) — this
// module adds no seed of its own. It exists separately because the registry
// describes the *fleet* (one entry per unit) while this describes the
// *operation* (the fleet as a whole, and the visits as a stream), and the page
// reads one of each. When `GET /api/v1/fleet/units` lands, the registry is
// replaced and every figure below follows for free.
// ──────────────────────────────────────────────

import {
  COLD_CHAIN_MAX_C,
  COLD_CHAIN_MIN_C,
  DELAY_THRESHOLD_MIN,
  FLEET_UNITS,
  KM_TARGET,
  STATE_ORDER,
  VISITS_TARGET,
  WORKING_DAYS,
  circuitProgress,
  isBlockingWarning,
  stopEta,
  stopProgress,
  type FleetState,
  type FleetStop,
  type FleetUnit,
  type StopState
} from '@/lib/fleet-data'

/** Under this share of a full tank, the unit is worth flagging for a refill. */
export const FUEL_WARNING_PERCENT = 25

/** Service is flagged this many kilometres before its scheduled reading. */
export const SERVICE_WINDOW_KM = 2000

/** Days the visit trend covers. */
export const TREND_DAYS = 7

// ── Fleet occupancy ───────────────────────────────────────────────────────────

/**
 * Every state a unit can be drawn in, including the immobilised one. Unlike the
 * fleet overview's strip — which measures *time* and therefore leaves out a unit
 * that spent the day at the workshop — this one counts units, and a unit in the
 * workshop is a real twelfth of the roster that would otherwise disappear.
 */
export const OCCUPANCY_ORDER: FleetState[] = [...STATE_ORDER, 'immobilise']

export interface OccupancyRow {
  state: FleetState
  units: number
  percent: number

  /** Visits those units still have to close today. */
  stopsRemaining: number
}

/** How the fleet is distributed right now, by units rather than by minutes. */
export function fleetOccupancy(units: FleetUnit[] = FLEET_UNITS): OccupancyRow[] {
  const total = units.length || 1

  return OCCUPANCY_ORDER.map(state => {
    const inState = units.filter(unit => unit.state === state)

    return {
      state,
      units: inState.length,
      percent: (inState.length / total) * 100,
      stopsRemaining: inState.reduce(
        (sum, unit) => sum + unit.stops.filter(stop => stop.state !== 'terminee').length,
        0
      )
    }
  }).filter(row => row.units > 0)
}

// ── Visit pipeline ────────────────────────────────────────────────────────────

export interface PipelineProduct {
  product: string
  stops: number
  percent: number
}

export interface PipelineStage {
  state: StopState
  stops: number

  /** Product families carrying those stops, the busiest first. */
  products: PipelineProduct[]
}

export interface VisitPipeline {
  total: number

  /** Closed, in progress, still planned — the order the tabs read them in. */
  stages: PipelineStage[]
}

const PIPELINE_ORDER: StopState[] = ['terminee', 'en_cours', 'planifiee']

/**
 * Today's visits as a pipeline: how many of the day's stops are closed, moving
 * or still ahead, and which product family is carrying each stage. This is the
 * one cut of the data that nothing else in the app makes — the product focus of
 * a stop is written by the planner and read nowhere else.
 */
export function visitPipeline(units: FleetUnit[] = FLEET_UNITS): VisitPipeline {
  const all = units.flatMap(unit => unit.stops)

  const stages = PIPELINE_ORDER.map(state => {
    const stops = all.filter(stop => stop.state === state)
    const byProduct = new Map<string, number>()

    stops.forEach(stop => byProduct.set(stop.productFocus, (byProduct.get(stop.productFocus) ?? 0) + 1))

    return {
      state,
      stops: stops.length,
      products: [...byProduct.entries()]
        .map(([product, count]) => ({
          product,
          stops: count,
          percent: stops.length > 0 ? (count / stops.length) * 100 : 0
        }))
        .sort((a, b) => b.stops - a.stops || a.product.localeCompare(b.product, 'fr'))
    }
  })

  return { total: all.length, stages }
}

// ── Working-day series ────────────────────────────────────────────────────────

export interface DayPoint {
  day: string
  visits: number
  km: number

  /**
   * Units that actually drove that day. A unit at the workshop is not a target,
   * so it is left out of the day's objective rather than counted as a failure.
   */
  activeUnits: number
  visitsTarget: number
  kmTarget: number
  visitsPercent: number
  kmPercent: number
}

/** The registry's twelve-day window, oldest first, as fleet-wide figures. */
export function workingDaySeries(units: FleetUnit[] = FLEET_UNITS): DayPoint[] {
  return WORKING_DAYS.map((day, index) => {
    const active = units.filter(unit => (unit.kmByDay[index] ?? 0) > 0)
    const visits = units.reduce((sum, unit) => sum + (unit.visitsByDay[index] ?? 0), 0)
    const km = units.reduce((sum, unit) => sum + (unit.kmByDay[index] ?? 0), 0)
    const visitsTarget = active.length * VISITS_TARGET
    const kmTarget = active.length * KM_TARGET

    return {
      day,
      visits,
      km,
      activeUnits: active.length,
      visitsTarget,
      kmTarget,
      visitsPercent: visitsTarget > 0 ? (visits / visitsTarget) * 100 : 0,
      kmPercent: kmTarget > 0 ? (km / kmTarget) * 100 : 0
    }
  })
}

// ── Readiness ─────────────────────────────────────────────────────────────────

export type ReadinessTone = 'success' | 'warning' | 'destructive' | 'primary'

export interface ReadinessRow {
  key: string
  label: string
  hint: string

  /**
   * What the ring shows. For the compliance row it is the rate itself; for the
   * rows that count a problem it is the share of the fleet affected, and the
   * hint is what names the count.
   */
  percent: number

  /** Units concerned — printed in the badge beside the row. */
  value: number
  tone: ReadinessTone
}

/**
 * What the fleet needs before its day can be trusted. Two different lenses on
 * purpose: the cold chain is a *compliance rate* (it is a condition to meet),
 * the four below it are *incidents* (they are units to chase), so a full ring is
 * good in the first row and bad in the others.
 */
export function fleetReadiness(units: FleetUnit[] = FLEET_UNITS): ReadinessRow[] {
  const total = units.length || 1

  const checked = units.filter(unit => unit.coldChainC !== null)

  const compliant = checked.filter(
    unit => (unit.coldChainC as number) >= COLD_CHAIN_MIN_C && (unit.coldChainC as number) <= COLD_CHAIN_MAX_C
  )

  const compliance = checked.length > 0 ? (compliant.length / checked.length) * 100 : 100

  const lowFuel = units.filter(unit => unit.fuelPercent < FUEL_WARNING_PERCENT)
  const serviceDue = units.filter(unit => unit.odometerKm >= unit.serviceAtKm - SERVICE_WINDOW_KM)
  const immobilised = units.filter(unit => unit.state === 'immobilise')

  const allWarnings = units.reduce((sum, unit) => sum + unit.warnings.length, 0)
  const blocking = units.reduce((sum, unit) => sum + unit.warnings.filter(isBlockingWarning).length, 0)

  const share = (count: number) => (count / total) * 100

  return [
    {
      key: 'cold-chain',
      label: 'Chaîne du froid conforme',
      hint: `${compliant.length} sur ${checked.length} unités contrôlées`,
      percent: compliance,
      value: compliant.length,
      tone: compliance >= 100 ? 'success' : compliance >= 80 ? 'warning' : 'destructive'
    },
    {
      key: 'fuel',
      label: `Carburant sous ${FUEL_WARNING_PERCENT} %`,
      hint: `${lowFuel.length} unité${lowFuel.length > 1 ? 's' : ''} à ravitailler`,
      percent: share(lowFuel.length),
      value: lowFuel.length,
      tone: lowFuel.length === 0 ? 'success' : lowFuel.length > total / 4 ? 'destructive' : 'warning'
    },
    {
      key: 'service',
      label: 'Entretien à prévoir',
      hint: `${serviceDue.length} unité${serviceDue.length > 1 ? 's' : ''} à échéance`,
      percent: share(serviceDue.length),
      value: serviceDue.length,
      tone: serviceDue.length === 0 ? 'success' : serviceDue.length > total / 2 ? 'destructive' : 'warning'
    },
    {
      key: 'immobilised',
      label: 'Immobilisées',
      hint: `${immobilised.length} unité${immobilised.length > 1 ? 's' : ''} hors service`,
      percent: share(immobilised.length),
      value: immobilised.length,
      tone: immobilised.length === 0 ? 'success' : 'destructive'
    },
    {
      key: 'alerts',
      label: 'Alertes bloquantes',
      hint: `${blocking} sur ${allWarnings} alerte${allWarnings > 1 ? 's' : ''} à traiter`,
      percent: allWarnings > 0 ? (blocking / allWarnings) * 100 : 0,
      value: blocking,
      tone: blocking === 0 ? 'success' : blocking > 1 ? 'destructive' : 'warning'
    }
  ]
}

// ── Per-unit checks ───────────────────────────────────────────────────────────

export type UnitCheckState = 'met' | 'missed' | 'idle'

export interface UnitCheck {
  id: string
  delegate: string

  /** 0-100, what the bar fills to. */
  value: number
  state: UnitCheckState
}

/**
 * Punctuality, one bar per unit: full when the unit is inside its planned
 * minutes, empty when it is past them, and greyed for a unit in the workshop —
 * which is out of service rather than late, and is left out of the rate.
 */
export function punctualityByUnit(units: FleetUnit[] = FLEET_UNITS): UnitCheck[] {
  return units.map(unit => {
    if (unit.state === 'immobilise') {
      return { id: unit.id, delegate: unit.delegate, value: 0, state: 'idle' as const }
    }

    const onTime = unit.delayMinutes < DELAY_THRESHOLD_MIN

    return { id: unit.id, delegate: unit.delegate, value: onTime ? 100 : 0, state: onTime ? 'met' : 'missed' }
  })
}

/** Share of the running fleet inside its planned minutes, as a percentage. */
export function punctualityRate(units: FleetUnit[] = FLEET_UNITS): number {
  const running = units.filter(unit => unit.state !== 'immobilise')

  if (running.length === 0) return 0

  const onTime = running.filter(unit => unit.delayMinutes < DELAY_THRESHOLD_MIN).length

  return (onTime / running.length) * 100
}

/**
 * Minutes of delay accumulated across the running fleet: what the day's
 * punctuality costs, in the unit a dispatcher actually chases.
 */
export function totalDelayMinutes(units: FleetUnit[] = FLEET_UNITS): number {
  return units.filter(unit => unit.state !== 'immobilise').reduce((sum, unit) => sum + unit.delayMinutes, 0)
}

/** Circuit completion, one bar per unit, filled to that unit's own progress. */
export function completionByUnit(units: FleetUnit[] = FLEET_UNITS): UnitCheck[] {
  return units.map(unit => ({
    id: unit.id,
    delegate: unit.delegate,
    value: circuitProgress(unit),
    state: unit.stops.every(stop => stop.state === 'terminee') ? ('met' as const) : ('missed' as const)
  }))
}

/** Share of every planned stop of the day that is closed. */
export function completionRate(units: FleetUnit[] = FLEET_UNITS): number {
  const all = units.flatMap(unit => unit.stops)

  if (all.length === 0) return 0

  return (all.filter(stop => stop.state === 'terminee').length / all.length) * 100
}

// ── Today's visits ────────────────────────────────────────────────────────────

export interface VisitRow {
  key: string
  unit: FleetUnit
  stop: FleetStop

  /**
   * When the visit is now expected: the planned slot pushed back by the unit's
   * delay. Only meaningful for a visit still ahead — see the page.
   */
  eta: string | null
  progress: number
}

/** Every visit of the day, in the order it is planned. */
export function todayVisits(units: FleetUnit[] = FLEET_UNITS): VisitRow[] {
  return units
    .flatMap(unit =>
      unit.stops.map(stop => ({
        key: stop.id,
        unit,
        stop,
        eta: stopEta(unit, stop),
        progress: stopProgress(stop.state)
      }))
    )
    .sort((a, b) => a.stop.at.localeCompare(b.stop.at) || a.unit.id.localeCompare(b.unit.id))
}
