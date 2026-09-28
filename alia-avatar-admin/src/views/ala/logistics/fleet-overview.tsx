'use client'

// ──────────────────────────────────────────────
// Flotte & tournées — vue d'ensemble (administrateur)
//
// Layout follows the logistics dashboard template: the fleet activity card
// beside the tracked unit card, then three cards on one row (field performance,
// vehicle condition, visit rating), then a full-width table of the units on the
// road with its own pagination.
//
// Two kinds of data feed this page and they are not the same:
//
//  * The fleet itself — units, circuits, states, vehicle condition — comes from
//    the seed registry in `@/lib/fleet-data`. The backend has no fleet model
//    yet, so none of it is persisted; swapping that module for an API call is
//    the whole migration.
//  * The rating card reads the real API. A doctor's rating and the weekly score
//    are session data, and they are the part of this page a responsable can act
//    on today.
// ──────────────────────────────────────────────

import { useCallback, useEffect, useMemo, useState } from 'react'

import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'
import {
  CalendarClock,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  Clock9,
  Download,
  Ellipsis,
  EllipsisVertical,
  Gauge,
  MapPinned,
  PackageOpen,
  Plus,
  RefreshCw,
  Route,
  ShieldCheck,
  Snowflake,
  Store,
  ThermometerSnowflake,
  TrendingUp,
  Truck,
  Wrench
} from 'lucide-react'
import { Line, LineChart, XAxis, YAxis } from 'recharts'

import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import { Checkbox } from '@/components/ui/checkbox'
import { CircularProgress } from '@/components/ui/circular-progress'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Progress } from '@/components/ui/progress'
import { Rating } from '@/components/ui/rating'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'

import { getSavedSessions, type SavedSessionsResponse } from '@/lib/alia-api'
import { ACCOUNT_ROLE_LABELS, getCurrentUser, initialsOf, workspaceFor } from '@/lib/auth'
import {
  CONDITION_LABELS,
  FLEET_UNITS,
  KM_TARGET,
  STATE_LABELS,
  STOP_STATE_LABELS,
  VISITS_TARGET,
  WORKING_DAYS,
  circuitProgress,
  conditionSplit,
  fleetTotals,
  formatColdChain,
  formatMinutes,
  isBlockingWarning,
  stateSplit,
  stopProgress,
  stopsInState,
  type ConditionSplit,
  type FleetState,
  type FleetUnit,
  type StateSplit,
  type StopState,
  type VehicleCondition
} from '@/lib/fleet-data'

// ── Labels and tones ──────────────────────────────────────────────────────────

/** The API stores English weekday keys; the team reads French. */
const DAY_LABELS: Record<string, string> = {
  Mon: 'Lun',
  Tue: 'Mar',
  Wed: 'Mer',
  Thu: 'Jeu',
  Fri: 'Ven',
  Sat: 'Sam',
  Sun: 'Dim'
}

/** ALIA's evaluation target, the same 7/10 the training overview holds itself to. */
const SCORE_TARGET = 7

const PAGE_SIZE = 5

/**
 * Icon and colour of each state, in the order the fleet strip draws them. The
 * progress class is written out in full rather than assembled from a colour name
 * — Tailwind only sees class names that appear literally in the source.
 */ const STATE_META: Record<FleetState, { icon: LucideIcon; segment: string; badge: string; progress: string }> = {
  en_route: {
    icon: Truck,
    segment: 'bg-primary/10 text-primary',
    badge: 'bg-primary/10 text-primary',
    progress: '**:data-[slot=progress-indicator]:bg-chart-1'
  },
  en_visite: {
    icon: Store,
    segment: 'bg-chart-1 text-primary-foreground',
    badge: 'bg-chart-1/10 text-chart-1',
    progress: '**:data-[slot=progress-indicator]:bg-chart-2'
  },
  chargement: {
    icon: PackageOpen,
    segment: 'bg-chart-2 text-primary-foreground',
    badge: 'bg-chart-2/10 text-chart-2',
    progress: '**:data-[slot=progress-indicator]:bg-chart-3'
  },
  attente: {
    icon: Clock9,
    segment: 'bg-chart-3 text-primary-foreground',
    badge: 'bg-chart-3/10 text-chart-3',
    progress: '**:data-[slot=progress-indicator]:bg-chart-5'
  },
  immobilise: {
    icon: Wrench,
    segment: 'bg-chart-5 text-primary-foreground',
    badge: 'bg-destructive/10 text-destructive',
    progress: '**:data-[slot=progress-indicator]:bg-chart-4'
  }
}

/** Ring colour per vehicle condition, from best to worst. */
const CONDITION_RINGS: Record<VehicleCondition, string> = {
  excellent: 'stroke-chart-1',
  bon: 'stroke-chart-2',
  moyen: 'stroke-chart-3',
  a_reviser: 'stroke-chart-5',
  immobilise: 'stroke-destructive'
}

/** The three states a stop of a circuit can be in, in tab order. */
const STOP_TABS: Array<{ value: StopState; label: string; icon: LucideIcon }> = [
  { value: 'terminee', label: 'Terminées', icon: CheckCheck },
  { value: 'en_cours', label: 'En cours', icon: Route },
  { value: 'planifiee', label: 'Planifiées', icon: CalendarClock }
]

const RATING_CONFIG = {
  score: { label: 'Score moyen', color: 'var(--chart-2)' },
  objectif: { label: 'Objectif', color: 'var(--muted-foreground)' }
} satisfies ChartConfig

/** Green at target, amber close to it, red below — same scale for the badges. */
function attainmentTone(percent: number, neutral = false): string {
  if (neutral) return 'bg-primary/10 text-primary'
  if (percent >= 100) return 'bg-green-600/10 text-green-600 dark:bg-green-400/10 dark:text-green-400'
  if (percent >= 70) return 'bg-amber-600/10 text-amber-600 dark:bg-amber-400/10 dark:text-amber-400'

  return 'bg-destructive/10 text-destructive'
}

function attainmentLabel(percent: number): string {
  if (percent >= 100) return 'Objectif tenu'
  if (percent >= 70) return 'Proche de l’objectif'

  return 'Sous l’objectif'
}

/** Signed delta, e.g. "+9,2 %" — the shape the fleet badges report a variation in. */
function formatDelta(value: number, digits = 0): string {
  const sign = value > 0 ? '+' : ''

  return `${sign}${value.toFixed(digits).replace('.', ',')} %`
}

function downloadCsv(rows: FleetUnit[], filename: string) {
  const header = [
    'Unité',
    'Délégué',
    'Fonction',
    'Secteur',
    'Véhicule',
    'Immatriculation',
    'État',
    'Départ',
    'Destination',
    'Alertes',
    'Circuit',
    'Visites du jour',
    'Km du jour',
    'Chaîne du froid',
    'Km compteur',
    'Entretien à'
  ]

  const body = rows.map(unit => [
    unit.id,
    unit.delegate,
    unit.jobTitle,
    unit.sector,
    unit.car,
    unit.plate,
    STATE_LABELS[unit.state],
    unit.routeFrom,
    unit.routeTo,
    unit.warnings.length > 0 ? unit.warnings.join(' · ') : 'Aucune alerte',
    `${circuitProgress(unit)} %`,
    String(unit.stops.filter(stop => stop.state === 'terminee').length),
    String(unit.kmToday),
    formatColdChain(unit.coldChainC),
    String(unit.odometerKm),
    String(unit.serviceAtKm)
  ])

  const csv = [header, ...body]
    .map(line => line.map(value => `"${String(value).replace(/"/g, '""')}"`).join(';'))
    .join('\r\n')

  const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')

  link.href = url
  link.download = `${filename}-${new Date().toISOString().slice(0, 10)}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

// ── Fleet activity ────────────────────────────────────────────────────────────

function FleetActivityCard({
  splits,
  units,
  onRefresh
}: {
  splits: StateSplit[]
  units: FleetUnit[]
  onRefresh: () => void
}) {
  const loaded = units.filter(unit => unit.state !== 'immobilise').length

  return (
    <Card className='col-span-full justify-between xl:col-span-3'>
      <CardHeader className='flex justify-between border-b'>
        <CardTitle className='text-lg font-semibold'>Activité de la flotte</CardTitle>

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant='ghost'
                size='icon'
                aria-label='Actions'
                className='text-muted-foreground size-6 rounded-full'
              />
            }
          >
            <EllipsisVertical />
          </DropdownMenuTrigger>
          <DropdownMenuContent align='end' className='w-56'>
            <DropdownMenuItem render={<Link href='/dashboard/logistics/live-map' />}>
              <MapPinned />
              <span>Voir la carte live</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => downloadCsv(units, 'repartition-flotte')} disabled={units.length === 0}>
              <Download />
              <span>Exporter la flotte</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onRefresh}>
              <RefreshCw />
              <span>Actualiser</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardHeader>

      <CardContent className='text-muted-foreground flex text-sm'>
        {splits.map(split => (
          <div key={split.state} className='flex min-w-0 flex-col gap-1' style={{ width: `${split.percent}%` }}>
            {/* A narrow state keeps its tick mark but drops the label: a two-
                word name in a 4 % column wraps over its neighbour. The rows
                below name every state anyway, so nothing is lost. */}
            <span className={cn('truncate', split.percent < 8 && 'sr-only')}>{STATE_LABELS[split.state]}</span>
            <div className='bg-muted-foreground h-2.5 w-0.5 rounded-full' />
          </div>
        ))}
      </CardContent>

      <CardContent>
        <div className='flex overflow-hidden rounded-md'>
          {splits.map(split => (
            <div
              key={split.state}
              className={cn('overflow-hidden p-3 text-base whitespace-nowrap', STATE_META[split.state].segment)}
              style={{ width: `${split.percent}%` }}
            >
              <span className={cn(split.percent < 8 && 'sr-only')}>{split.percent.toFixed(1)}%</span>
            </div>
          ))}
        </div>
      </CardContent>

      <CardContent>
        {splits.map((split, index) => {
          const Icon = STATE_META[split.state].icon

          return (
            <div
              key={split.state}
              className={cn(
                'flex items-center justify-between gap-4 px-2 py-3 text-base',
                index < splits.length - 1 && 'border-b'
              )}
            >
              <div className='text-muted-foreground flex items-center gap-4 [&>svg]:size-4'>
                <Icon />
                <span>{STATE_LABELS[split.state]}</span>
              </div>

              <div className='flex items-center gap-4'>
                <span className='font-medium'>{formatMinutes(split.minutes)}</span>
                <span className='text-muted-foreground text-sm'>{split.percent.toFixed(1)}%</span>
              </div>
            </div>
          )
        })}

        <div className='flex items-center justify-between gap-4 px-2 py-3 text-base'>
          <div className='text-muted-foreground flex items-center gap-4 [&>svg]:size-4'>
            <Truck />
            <span>Unités actives</span>
          </div>

          <div className='flex items-center gap-4'>
            <span className='font-medium'>
              {loaded} / {units.length}
            </span>
            <span className='text-muted-foreground text-sm'>en service</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ── Tracked unit ──────────────────────────────────────────────────────────────

function TrackedUnitCard({
  unit,
  units,
  onSelect
}: {
  unit: FleetUnit
  units: FleetUnit[]
  onSelect: (unitId: string) => void
}) {
  const closed = unit.stops.filter(stop => stop.state === 'terminee').length

  return (
    <Card className='col-span-full md:col-span-3'>
      <CardHeader className='flex justify-between'>
        <div className='flex items-center gap-2'>
          <Avatar className='size-9.5 rounded-lg after:rounded-[inherit]'>
            <AvatarFallback className='bg-primary/10 text-primary rounded-lg text-sm font-medium'>
              {initialsOf(unit.delegate)}
            </AvatarFallback>
          </Avatar>

          <div className='flex flex-col gap-1'>
            <CardTitle className='text-xl font-medium'>{unit.delegate}</CardTitle>
            <CardDescription>
              {unit.jobTitle} · {unit.sector}
            </CardDescription>
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant='ghost'
                size='icon'
                aria-label='Choisir une unité'
                className='text-muted-foreground size-6 rounded-full'
              />
            }
          >
            <Ellipsis />
          </DropdownMenuTrigger>
          <DropdownMenuContent align='end' className='w-64'>
            {units.map(row => (
              <DropdownMenuItem key={row.id} onClick={() => onSelect(row.id)}>
                <Truck />
                <span className='truncate'>
                  {row.id} · {row.delegate}
                </span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </CardHeader>

      <CardContent>
        <Separator />
      </CardContent>

      <CardContent className='flex flex-1 flex-col gap-6'>
        <div className='flex flex-1 flex-col gap-2'>
          <div className='flex items-baseline gap-1'>
            <span className='text-2xl font-medium'>{unit.stops.length}</span>
            <span className='text-muted-foreground text-sm'>visites au circuit</span>
          </div>

          <Tabs defaultValue='terminee' className='flex-1 justify-between gap-6'>
            <TabsList className='w-full'>
              {STOP_TABS.map(tab => (
                <TabsTrigger key={tab.value} value={tab.value} className='px-1.5'>
                  <tab.icon />
                  <span className='max-sm:hidden'>{tab.label}</span>
                </TabsTrigger>
              ))}
            </TabsList>

            {STOP_TABS.map(tab => {
              const rows = stopsInState(unit, tab.value)

              return (
                <TabsContent key={tab.value} value={tab.value} className='flex flex-col justify-evenly gap-6'>
                  {rows.length === 0 ? (
                    <p className='text-muted-foreground text-sm'>
                      Aucune visite {STOP_STATE_LABELS[tab.value].toLowerCase()} sur ce circuit.
                    </p>
                  ) : (
                    rows.slice(0, 4).map(stop => (
                      <div key={stop.id} className='space-y-2'>
                        <div className='flex items-center justify-between gap-2'>
                          <span className='truncate text-base'>{stop.name}</span>
                          <span className='text-muted-foreground shrink-0 text-sm'>
                            {stop.city} · {stop.at}
                          </span>
                        </div>

                        <Progress
                          value={stopProgress(stop.state)}
                          className='**:data-[slot=progress-track]:h-2'
                          aria-label={`${stop.name} — ${STOP_STATE_LABELS[stop.state]}`}
                        />
                      </div>
                    ))
                  )}
                </TabsContent>
              )
            })}
          </Tabs>
        </div>

        <div className='text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 text-sm'>
          <span className='flex items-center gap-1.5'>
            <Gauge className='size-4' />
            {unit.odometerKm.toLocaleString('fr-FR')} km compteur
          </span>
          <span className='flex items-center gap-1.5'>
            <ThermometerSnowflake className='size-4' />
            {formatColdChain(unit.coldChainC)}
          </span>
          <span className='flex items-center gap-1.5'>
            <Route className='size-4' />
            {unit.routeFrom} → {unit.routeTo}
          </span>
          <span className='ml-auto'>
            Circuit {circuitProgress(unit)} % — {closed}/{unit.stops.length} visites
          </span>
        </div>
      </CardContent>
    </Card>
  )
}

// ── Field performance ─────────────────────────────────────────────────────────

/** Mean of a series, zero when the series is empty. */
function average(values: number[]): number {
  if (values.length === 0) return 0

  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function PerformanceCard({ totals, unit }: { totals: ReturnType<typeof fleetTotals>; unit: FleetUnit }) {
  const visitsPercent = totals.visitsTarget > 0 ? Math.round((totals.visitsToday / totals.visitsTarget) * 100) : 0

  // The two columns are the *tracked* unit's twelve-day trends, not fleet sums.
  // A fleet total divided by a per-unit target answers nothing, and every day of
  // a fleet sum clears that bar — the strips would all read 100 % and say
  // nothing about the delegate the card is next to.
  const visitsAverage = average(unit.visitsByDay)
  const kmAverage = average(unit.kmByDay)
  const visitsPercentOfTarget = Math.round((visitsAverage / VISITS_TARGET) * 100)
  const kmPercentOfTarget = Math.round((kmAverage / KM_TARGET) * 100)

  return (
    <Card className='col-span-full gap-4 md:col-span-3 xl:col-span-2'>
      <CardHeader className='flex flex-col gap-2'>
        <div className='flex w-full items-center justify-between gap-2'>
          <div className='flex items-center gap-2 text-base'>
            <Avatar className='size-8 rounded-sm after:border-0'>
              <AvatarFallback className='bg-primary/10 text-primary rounded-sm [&>svg]:size-4'>
                <TrendingUp />
              </AvatarFallback>
            </Avatar>
            <span>Performance terrain</span>
          </div>

          <Button
            variant='outline'
            size='sm'
            className='h-6 px-2 text-xs'
            nativeButton={false}
            render={<Link href='/dashboard/training/simulator' />}
          >
            Détails
          </Button>
        </div>

        <div className='flex flex-wrap items-center gap-2'>
          <span className='text-2xl font-semibold'>{totals.visitsToday}</span>
          <span className='text-muted-foreground text-sm'>visites du jour</span>
          <Badge className={cn('h-6 rounded-sm px-3 py-1', attainmentTone(visitsPercent, true))}>
            {visitsPercent}% de l’objectif
          </Badge>
        </div>
      </CardHeader>

      <CardContent className='flex flex-1 flex-col gap-4'>
        <Separator />

        <p className='text-muted-foreground text-sm'>
          Tendance du délégué suivi · {unit.id} — {unit.delegate}
        </p>

        <div className='grid flex-1 grid-cols-2'>
          <div className='flex flex-1 flex-col gap-2.5 p-2'>
            <div className='flex flex-col gap-1'>
              <span className='text-muted-foreground text-sm'>Visites / jour</span>
              <div className='flex items-center gap-2'>
                <span className='text-2xl font-medium'>{Math.round(visitsAverage * 10) / 10}</span>
                <Badge className={cn('h-6 rounded-sm px-3 py-1', attainmentTone(visitsPercentOfTarget))}>
                  {attainmentLabel(visitsPercentOfTarget)}
                </Badge>
              </div>
            </div>

            <div className='flex flex-1 flex-col justify-between gap-1.5'>
              {unit.visitsByDay.map((value, index) => (
                <Progress
                  key={WORKING_DAYS[index] ?? index}
                  value={Math.min(100, (value / VISITS_TARGET) * 100)}
                  className='**:data-[slot=progress-indicator]:bg-chart-1 *:data-[slot=progress-track]:h-2 *:data-[slot=progress-track]:rounded-xs'
                  aria-label={`Visites ${unit.id} ${WORKING_DAYS[index] ?? ''}`}
                />
              ))}
            </div>
          </div>

          <div className='flex flex-1 flex-col gap-2.5 p-2'>
            <div className='flex flex-col gap-1'>
              <span className='text-muted-foreground text-sm'>Kilométrage</span>
              <div className='flex items-center gap-2'>
                <span className='text-2xl font-medium'>{Math.round(kmAverage)}</span>
                <Badge className={cn('h-6 rounded-sm px-3 py-1', attainmentTone(kmPercentOfTarget))}>
                  {attainmentLabel(kmPercentOfTarget)}
                </Badge>
              </div>
            </div>

            <div className='flex flex-1 flex-col justify-between gap-1.5'>
              {unit.kmByDay.map((value, index) => (
                <Progress
                  key={WORKING_DAYS[index] ?? index}
                  value={Math.min(100, (value / KM_TARGET) * 100)}
                  className='**:data-[slot=progress-indicator]:bg-chart-2 *:data-[slot=progress-track]:h-2 *:data-[slot=progress-track]:rounded-xs'
                  aria-label={`Kilométrage ${unit.id} ${WORKING_DAYS[index] ?? ''}`}
                />
              ))}
            </div>
          </div>
        </div>

        <div className='text-muted-foreground flex flex-wrap items-center justify-between gap-2 text-sm'>
          <span className='flex items-center gap-1.5'>
            <Truck className='size-4' />
            {totals.moving} unités actives · {totals.kmToday} km cumulés
          </span>
          <span>{formatDelta(visitsPercent - 100)} vs objectif du jour</span>
        </div>
      </CardContent>
    </Card>
  )
}

// ── Fleet condition ───────────────────────────────────────────────────────────

function ConditionCard({
  splits,
  units,
  onRefresh
}: {
  splits: ConditionSplit[]
  units: FleetUnit[]
  onRefresh: () => void
}) {
  return (
    <Card className='col-span-full gap-(--card-spacing) md:col-span-3 xl:col-span-2'>
      <CardHeader className='flex items-center justify-between'>
        <CardTitle className='text-lg font-semibold'>État des véhicules</CardTitle>

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant='ghost'
                size='icon'
                aria-label='Actions'
                className='text-muted-foreground size-6 rounded-full'
              />
            }
          >
            <EllipsisVertical />
          </DropdownMenuTrigger>
          <DropdownMenuContent align='end' className='w-56'>
            <DropdownMenuItem onClick={() => downloadCsv(units, 'etat-vehicules')}>
              <Download />
              <span>Exporter l’état du parc</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onRefresh}>
              <RefreshCw />
              <span>Actualiser</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardHeader>

      <CardContent className='flex flex-1 flex-col justify-between gap-4'>
        {splits.map(split => {
          const alerts = units
            .filter(unit => unit.condition === split.condition)
            .reduce((sum, unit) => sum + unit.warnings.length, 0)

          const blocking = split.condition === 'a_reviser' || split.condition === 'immobilise'

          return (
            <div key={split.condition} className='flex items-center justify-between gap-2'>
              <div className='flex items-center justify-between gap-3'>
                <CircularProgress
                  value={split.percent}
                  size={52}
                  strokeWidth={5}
                  showLabel
                  labelClassName='font-medium text-xs'
                  progressClassName={CONDITION_RINGS[split.condition]}
                />

                <div className='flex flex-col gap-0.5'>
                  <span className='text-base font-medium'>{CONDITION_LABELS[split.condition]}</span>
                  <span className='text-muted-foreground text-sm'>
                    {split.count} unité{split.count > 1 ? 's' : ''} · {split.percent.toFixed(0)} %
                  </span>
                </div>
              </div>

              <Badge
                className={cn(
                  'h-6 rounded-sm px-3 py-1',
                  alerts === 0
                    ? 'bg-primary/10 text-primary'
                    : blocking
                      ? 'bg-destructive/10 text-destructive'
                      : 'bg-amber-600/10 text-amber-600 dark:bg-amber-400/10 dark:text-amber-400'
                )}
              >
                {alerts === 0 ? 'Aucune alerte' : `${alerts} alerte${alerts > 1 ? 's' : ''}`}
              </Badge>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}

// ── Visit rating ──────────────────────────────────────────────────────────────

function RatingCard({
  saved,
  loading,
  onRefresh
}: {
  saved: SavedSessionsResponse | null
  loading: boolean
  onRefresh: () => void
}) {
  const points = useMemo(
    () =>
      (saved?.weekly ?? []).map(point => ({
        day: DAY_LABELS[point.day] ?? point.day,
        score: point.sessions > 0 ? point.score : null,
        objectif: SCORE_TARGET
      })),
    [saved]
  )

  const rating = saved?.average_rating ?? null
  const rated = saved?.rated ?? 0
  const score = saved?.average_score ?? null

  return (
    <Card className='col-span-full gap-(--card-spacing) md:col-span-3 xl:col-span-2'>
      <CardHeader className='flex justify-between'>
        <CardTitle className='text-lg font-semibold'>Évaluation des visites</CardTitle>

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant='ghost'
                size='icon'
                aria-label='Actions'
                className='text-muted-foreground size-6 rounded-full'
              />
            }
          >
            <EllipsisVertical />
          </DropdownMenuTrigger>
          <DropdownMenuContent align='end' className='w-56'>
            <DropdownMenuItem onClick={onRefresh} disabled={loading}>
              <RefreshCw />
              <span>Actualiser</span>
            </DropdownMenuItem>
            <DropdownMenuItem render={<Link href='/dashboard/training/simulator' />}>
              <Route />
              <span>Voir les sessions</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardHeader>

      <CardContent className='flex flex-1 flex-col gap-6'>
        <div className='flex flex-col gap-2'>
          {loading ? (
            <Skeleton className='h-9 w-40 rounded-md' />
          ) : (
            <div className='flex items-center gap-6'>
              <span className='text-3xl font-semibold'>{rating === null ? '—' : rating.toFixed(1)}</span>
              <Rating value={rating ?? 0} readOnly precision={0.5} variant='yellow' size={20} />
            </div>
          )}

          <div className='flex flex-wrap items-center gap-6'>
            <Badge className='bg-primary/10 text-primary h-6 gap-1 rounded-sm px-3 py-1'>
              <Plus />
              {rated}
            </Badge>
            <span className='text-muted-foreground text-sm'>
              évaluations reçues · score moyen {score === null ? '—' : score.toFixed(1)}/10
            </span>
          </div>
        </div>

        {loading ? (
          <Skeleton className='min-h-47.5 w-full flex-1 rounded-md' />
        ) : points.length === 0 ? (
          <div className='text-muted-foreground flex min-h-47.5 flex-1 items-center justify-center text-sm'>
            Aucune session évaluée sur les sept derniers jours.
          </div>
        ) : (
          <ChartContainer config={RATING_CONFIG} className='min-h-47.5 w-full flex-1'>
            <LineChart data={points} margin={{ left: 12, right: 12 }}>
              <XAxis dataKey='day' tickLine={false} axisLine={false} tickMargin={8} />
              {/* Fixed 0-10 scale: with an automatic domain the 7/10 objective
                  lands on the top edge and every rating looks like a failure. */}
              <YAxis hide domain={[0, 10]} />
              <ChartTooltip cursor={false} content={<ChartTooltipContent indicator='line' />} />
              <Line
                type='monotone'
                dataKey='objectif'
                stroke='var(--color-objectif)'
                strokeWidth={3}
                strokeDasharray='6 6'
                dot={false}
              />
              <Line
                type='monotone'
                dataKey='score'
                stroke='var(--color-score)'
                strokeWidth={5}
                dot={{ r: 3 }}
                connectNulls
              />
            </LineChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}

// ── Units on the road ─────────────────────────────────────────────────────────

function UnitsTable({ units }: { units: FleetUnit[] }) {
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<string[]>([])

  const totalPages = Math.max(1, Math.ceil(units.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)

  const pageRows = useMemo(() => units.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE), [units, safePage])

  const selectedRows = useMemo(() => units.filter(unit => selected.includes(unit.id)), [units, selected])
  const allOnPageSelected = pageRows.length > 0 && pageRows.every(unit => selected.includes(unit.id))

  return (
    <Card className='col-span-full py-0'>
      <div className='w-full'>
        <div className='border-b'>
          <div className='flex min-h-17 flex-wrap items-center justify-between gap-3 px-6 py-3'>
            <span className='text-base font-medium'>Unités en tournée</span>

            <DropdownMenu>
              <DropdownMenuTrigger render={<Button variant='ghost' size='icon' aria-label='Actions' />}>
                <EllipsisVertical />
              </DropdownMenuTrigger>
              <DropdownMenuContent align='end' className='w-64'>
                <DropdownMenuItem
                  onClick={() => downloadCsv(selectedRows, 'flotte-selection')}
                  disabled={selectedRows.length === 0}
                >
                  <Download />
                  <span>Exporter la sélection ({selectedRows.length})</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => downloadCsv(units, 'flotte-complete')}>
                  <Download />
                  <span>Exporter les {units.length} unités</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className='relative w-full overflow-x-auto'>
            <Table>
              <TableHeader>
                <TableRow className='h-14 border-t'>
                  <TableHead className='w-12.5 first:pl-4 last:px-4'>
                    <Checkbox
                      aria-label='Tout sélectionner'
                      checked={allOnPageSelected}
                      indeterminate={selected.length > 0 && !allOnPageSelected}
                      onCheckedChange={checked =>
                        setSelected(prev =>
                          checked
                            ? Array.from(new Set([...prev, ...pageRows.map(unit => unit.id)]))
                            : prev.filter(id => !pageRows.some(unit => unit.id === id))
                        )
                      }
                    />
                  </TableHead>
                  <TableHead className='text-muted-foreground w-55 first:pl-4 last:px-4'>Unité</TableHead>
                  <TableHead className='text-muted-foreground w-37.5 first:pl-4 last:px-4'>Départ</TableHead>
                  <TableHead className='text-muted-foreground w-37.5 first:pl-4 last:px-4'>Destination</TableHead>
                  <TableHead className='text-muted-foreground w-37.5 first:pl-4 last:px-4'>Alertes</TableHead>
                  <TableHead className='text-muted-foreground w-37.5 first:pl-4 last:px-4'>Progression</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {pageRows.map(unit => (
                  <TableRow key={unit.id} data-state={selected.includes(unit.id) ? 'selected' : 'false'}>
                    <TableCell className='h-17 first:pl-4 last:px-4'>
                      <Checkbox
                        aria-label={`Sélectionner ${unit.id}`}
                        checked={selected.includes(unit.id)}
                        onCheckedChange={checked =>
                          setSelected(prev => (checked ? [...prev, unit.id] : prev.filter(id => id !== unit.id)))
                        }
                      />
                    </TableCell>

                    <TableCell className='h-17 first:pl-4 last:px-4'>
                      <div className='flex items-center gap-2'>
                        <Avatar className='size-8'>
                          <AvatarFallback className='bg-primary/10 text-primary'>
                            <Truck className='size-4' />
                          </AvatarFallback>
                        </Avatar>

                        <div className='flex flex-col gap-0.5'>
                          <div className='flex items-center gap-2'>
                            <span className='font-medium'>{unit.id}</span>
                            {/* Named here so the progress colour below is
                                decodable: the column it belongs to has no state
                                of its own in this template. */}
                            <Badge
                              className={cn(
                                'h-auto rounded-sm px-1.5 py-0.5 text-[11px]',
                                STATE_META[unit.state].badge
                              )}
                            >
                              {STATE_LABELS[unit.state]}
                            </Badge>
                          </div>

                          <span className='text-muted-foreground text-xs'>
                            {unit.delegate} · {unit.plate}
                          </span>
                        </div>
                      </div>
                    </TableCell>

                    <TableCell className='h-17 first:pl-4 last:px-4'>
                      <span className='text-muted-foreground'>{unit.routeFrom}</span>
                    </TableCell>

                    <TableCell className='h-17 first:pl-4 last:px-4'>
                      <span className='text-muted-foreground'>{unit.routeTo}</span>
                    </TableCell>

                    <TableCell className='h-17 first:pl-4 last:px-4'>
                      {unit.warnings.length === 0 ? (
                        <Badge className='bg-primary/10 text-primary h-auto rounded-sm px-1.5 py-0.5'>
                          Aucune alerte
                        </Badge>
                      ) : (
                        <div className='flex flex-wrap items-center gap-1'>
                          {unit.warnings.map(warning => (
                            <Badge
                              key={warning}
                              className={cn(
                                'h-auto rounded-sm px-1.5 py-0.5',
                                isBlockingWarning(warning)
                                  ? 'bg-destructive/10 text-destructive'
                                  : 'bg-amber-600/10 text-amber-600 dark:bg-amber-400/10 dark:text-amber-400'
                              )}
                            >
                              {warning}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </TableCell>

                    <TableCell className='h-17 first:pl-4 last:px-4'>
                      <div className='flex items-center gap-3'>
                        <Progress
                          value={circuitProgress(unit)}
                          className={cn('w-43 *:data-[slot=progress-track]:h-1.5', STATE_META[unit.state].progress)}
                          aria-label={`Progression ${unit.id}`}
                        />
                        <span>{circuitProgress(unit)}%</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>

        <div className='flex items-center justify-between gap-3 px-6 py-4 max-sm:flex-col max-sm:items-start'>
          <p className='text-muted-foreground text-sm whitespace-nowrap' aria-live='polite'>
            Affichage <span>{(safePage - 1) * PAGE_SIZE + 1}</span> à{' '}
            <span>{Math.min(safePage * PAGE_SIZE, units.length)}</span> sur <span>{units.length}</span> unités
          </p>

          <div>
            <nav aria-label='pagination' className='mx-auto flex w-full justify-center'>
              <ul className='flex items-center gap-1'>
                <li>
                  <Button
                    variant='ghost'
                    size='sm'
                    className='gap-1.5'
                    disabled={safePage <= 1}
                    onClick={() => setPage(safePage - 1)}
                  >
                    <ChevronLeft className='size-4' />
                    <span className='max-sm:hidden'>Précédent</span>
                  </Button>
                </li>

                {Array.from({ length: totalPages }, (_, index) => index + 1).map(number => (
                  <li key={number}>
                    <Button
                      variant={number === safePage ? 'default' : 'ghost'}
                      size='icon'
                      aria-current={number === safePage ? 'page' : undefined}
                      className={cn('size-9', number !== safePage && 'bg-primary/10 text-primary hover:bg-primary/20')}
                      onClick={() => setPage(number)}
                    >
                      {number}
                    </Button>
                  </li>
                ))}

                <li>
                  <Button
                    variant='ghost'
                    size='sm'
                    className='gap-1.5'
                    disabled={safePage >= totalPages}
                    onClick={() => setPage(safePage + 1)}
                  >
                    <span className='max-sm:hidden'>Suivant</span>
                    <ChevronRight className='size-4' />
                  </Button>
                </li>
              </ul>
            </nav>
          </div>
        </div>
      </div>
    </Card>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function FleetOverview() {
  // Read once: the account only changes when someone signs out.
  const me = useMemo(() => getCurrentUser(), [])

  const [saved, setSaved] = useState<SavedSessionsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [warning, setWarning] = useState<string | null>(null)
  const [trackedId, setTrackedId] = useState(FLEET_UNITS[0]?.id ?? '')

  const load = useCallback(async () => {
    setLoading(true)
    setWarning(null)

    try {
      // `include_scores` is the responsable view: the server strips scores for a
      // delegate, so asking for them here costs nothing and never leaks.
      setSaved(await getSavedSessions(true, { limit: 500 }))
    } catch {
      setWarning("L'API ALIA ne répond pas — l'évaluation des visites reste vide jusqu'au prochain essai.")
    }

    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const splits = useMemo(() => stateSplit(), [])
  const conditions = useMemo(() => conditionSplit(), [])
  const totals = useMemo(() => fleetTotals(), [])

  const tracked = useMemo(() => FLEET_UNITS.find(unit => unit.id === trackedId) ?? FLEET_UNITS[0], [trackedId])

  // The field force is the platform's view. The nav item is already absent from
  // the other two navbars; this covers typing the URL, and matches how
  // /admin/accounts answers the same situation. Nothing leaks either way — the
  // server strips scores for a delegate — but neither a delegate nor a doctor
  // has business seeing the whole fleet's circuits.
  if (me && workspaceFor(me.role) !== 'admin') {
    return (
      <div className='col-span-full'>
        <Card>
          <CardContent className='flex flex-col gap-2 py-6'>
            <span className='flex items-center gap-2 text-lg font-semibold'>
              <ShieldCheck className='text-muted-foreground size-5' /> Accès restreint
            </span>
            <p className='text-muted-foreground text-sm'>
              Le suivi de la flotte est réservé aux administrateurs. Votre rôle ({ACCOUNT_ROLE_LABELS[me.role]}) n’y a
              pas accès.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <>
      {warning && (
        <div className='col-span-full flex items-center gap-2 rounded-md bg-amber-600/10 px-3 py-2 text-sm text-amber-600 dark:bg-amber-400/10 dark:text-amber-400'>
          <Snowflake className='size-4' />
          {warning}
        </div>
      )}

      <FleetActivityCard splits={splits} units={FLEET_UNITS} onRefresh={() => void load()} />

      {tracked && <TrackedUnitCard unit={tracked} units={FLEET_UNITS} onSelect={setTrackedId} />}

      {tracked && <PerformanceCard totals={totals} unit={tracked} />}
      <ConditionCard splits={conditions} units={FLEET_UNITS} onRefresh={() => void load()} />
      <RatingCard saved={saved} loading={loading} onRefresh={() => void load()} />

      <UnitsTable units={FLEET_UNITS} />
    </>
  )
}
