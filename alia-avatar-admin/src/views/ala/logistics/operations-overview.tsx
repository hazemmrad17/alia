'use client'

// ──────────────────────────────────────────────
// Vue d'ensemble des opérations — the whole field operation on one screen
//
// The landing view of the Opérations group: where the fleet is, how far today's
// visits have got, what the units need before their day can be trusted, and the
// visits themselves. From here the other two pages of the group are one click
// away — the live map for where a unit is, Flotte & tournées for the unit itself.
//
// Why the cards are what they are: this page sits beside /dashboard/logistics,
// which already owns the fleet's *time* split, the vehicle-condition rings, the
// twelve-day strips of the tracked unit and the per-unit tournée table. Repeating
// those here would be two pages answering one question, so each card below takes
// a different cut of the same registry — units rather than minutes, the visits
// rather than the vehicles, readiness rather than condition — and the aggregates
// all live in src/lib/operations-data.ts.
//
// Where the data comes from: the fleet registry (src/lib/fleet-data.ts), which is
// still a seed — the backend has no fleet model. The training and visit figures
// that DO come from the API live on the training and commercial pages; nothing
// here is invented per page.
// ──────────────────────────────────────────────

import { useMemo, useState } from 'react'

import Link from 'next/link'
import { useRouter } from 'next/navigation'

import {
  ArrowRight,
  CalendarClock,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  Clock,
  Clock9,
  Gauge,
  PackageOpen,
  Route,
  ShieldCheck,
  Store,
  TrendingUp,
  Truck,
  Wrench,
  type LucideIcon
} from 'lucide-react'
import { CartesianGrid, Line, LineChart, XAxis } from 'recharts'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import { CircularProgress } from '@/components/ui/circular-progress'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ACCOUNT_ROLE_LABELS, getCurrentUser, workspaceFor } from '@/lib/auth'
import {
  DELAY_THRESHOLD_MIN,
  STATE_LABELS,
  STOP_STATE_LABELS,
  delayedUnits,
  formatMinutes,
  type FleetState,
  type StopState
} from '@/lib/fleet-data'
import {
  TREND_DAYS,
  completionByUnit,
  completionRate,
  fleetOccupancy,
  fleetReadiness,
  punctualityByUnit,
  punctualityRate,
  todayVisits,
  totalDelayMinutes,
  visitPipeline,
  workingDaySeries,
  type DayPoint,
  type OccupancyRow,
  type PipelineStage,
  type ReadinessRow,
  type ReadinessTone,
  type UnitCheck,
  type VisitRow
} from '@/lib/operations-data'
import { cn } from '@/lib/utils'

/** Visits listed per page of the day's table. */
const PAGE_SIZE = 5

/**
 * Icon and segment colours per fleet state, in the order the split bar draws
 * them. The semantic tokens are the theme's: a unit stuck in "en attente" is the
 * same amber here as it is on the live map.
 */
const OCCUPANCY_META: Record<FleetState, { icon: LucideIcon; segment: string; bar: string }> = {
  en_route: {
    icon: Truck,
    segment: 'bg-primary text-primary-foreground',
    bar: '**:data-[slot=progress-indicator]:bg-primary'
  },
  en_visite: { icon: Store, segment: 'bg-success text-white', bar: '**:data-[slot=progress-indicator]:bg-success' },
  chargement: {
    icon: PackageOpen,
    segment: 'bg-muted text-muted-foreground',
    bar: '**:data-[slot=progress-indicator]:bg-muted-foreground'
  },
  attente: { icon: Clock9, segment: 'bg-warning text-white', bar: '**:data-[slot=progress-indicator]:bg-warning' },
  immobilise: {
    icon: Wrench,
    segment: 'bg-destructive text-white',
    bar: '**:data-[slot=progress-indicator]:bg-destructive'
  }
}

/** The three states a visit can be in, as the pipeline tabs read them. */
const STAGE_TABS: Array<{ value: StopState; label: string; icon: LucideIcon; bar: string }> = [
  { value: 'terminee', label: 'Terminées', icon: CheckCheck, bar: '**:data-[slot=progress-indicator]:bg-success' },
  { value: 'en_cours', label: 'En cours', icon: Route, bar: '**:data-[slot=progress-indicator]:bg-warning' },
  { value: 'planifiee', label: 'Planifiées', icon: CalendarClock, bar: '**:data-[slot=progress-indicator]:bg-primary' }
]

/** Visit state as the table reports it, and the tone it is written in. */
const STOP_BADGES: Record<StopState, string> = {
  terminee: 'bg-success-soft text-success',
  en_cours: 'bg-warning-soft text-warning',
  planifiee: 'bg-muted text-muted-foreground'
}

const READINESS_RINGS: Record<ReadinessTone, string> = {
  success: 'stroke-success',
  warning: 'stroke-warning',
  destructive: 'stroke-destructive',
  primary: 'stroke-primary'
}

const READINESS_BADGES: Record<ReadinessTone, string> = {
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning',
  destructive: 'bg-destructive/10 text-destructive',
  primary: 'bg-primary/10 text-primary'
}

const TREND_CONFIG = {
  visites: { label: 'Visites réalisées', color: 'var(--chart-1)' },
  objectif: { label: 'Objectif', color: 'var(--muted-foreground)' }
} satisfies ChartConfig

/** Green at target, amber close to it, red below — the same scale everywhere. */
function attainmentTone(percent: number): string {
  if (percent >= 100) return 'bg-success-soft text-success'
  if (percent >= 70) return 'bg-warning-soft text-warning'

  return 'bg-destructive/10 text-destructive'
}

function attainmentLabel(percent: number): string {
  if (percent >= 100) return 'Objectif tenu'
  if (percent >= 70) return 'Proche de l’objectif'

  return 'Sous l’objectif'
}

/** "12,5 %" — the shape the split bar writes a share in. */
function formatShare(percent: number): string {
  return `${percent.toFixed(1).replace('.', ',')} %`
}

/** Signed delta, e.g. "+2,4 %". */
function formatDelta(value: number, digits = 1): string {
  const sign = value > 0 ? '+' : ''

  return `${sign}${value.toFixed(digits).replace('.', ',')} %`
}

function ProgressValue({ percent, tone }: { percent: number; tone: string }) {
  return <Badge className={cn('h-6 rounded-sm px-3 py-1', tone)}>{attainmentLabel(percent)}</Badge>
}

// ── Fleet split ───────────────────────────────────────────────────────────────

function FleetSplitCard({ rows }: { rows: OccupancyRow[] }) {
  return (
    <Card className='col-span-full xl:col-span-3'>
      <CardHeader className='border-b'>
        <CardTitle className='text-lg font-medium'>Répartition de la flotte</CardTitle>

        <CardAction>
          <Button
            variant='outline'
            size='sm'
            className='gap-1'
            nativeButton={false}
            render={<Link href='/dashboard/logistics/live-map' />}
          >
            Carte live <ArrowRight className='size-4' />
          </Button>
        </CardAction>
      </CardHeader>

      {/* Name row, weighted like the bar under it, with the tick the board uses. */}
      <CardContent className='text-muted-foreground flex text-sm'>
        {rows.map(row => (
          <div key={row.state} className='flex min-w-0 flex-col gap-1' style={{ flex: `${row.percent} 1 0%` }}>
            <span className='truncate'>{STATE_LABELS[row.state]}</span>
            <div className='bg-muted-foreground h-2.5 w-0.5 rounded-full' />
          </div>
        ))}
      </CardContent>

      <CardContent>
        <div className='flex overflow-hidden rounded-md'>
          {rows.map(row => (
            <div
              key={row.state}
              className={cn('min-w-0 truncate p-3 text-sm', OCCUPANCY_META[row.state].segment)}
              style={{ flex: `${row.percent} 1 0%` }}
            >
              {formatShare(row.percent)}
            </div>
          ))}
        </div>
      </CardContent>

      <CardContent>
        {rows.map((row, index) => {
          const Icon = OCCUPANCY_META[row.state].icon

          return (
            <div
              key={row.state}
              className={cn(
                'flex items-center justify-between gap-4 px-2 py-3 text-base',
                index < rows.length - 1 && 'border-b'
              )}
            >
              <div className='text-muted-foreground flex items-center gap-4'>
                <Icon className='size-4' />
                <span>{STATE_LABELS[row.state]}</span>
              </div>

              <div className='flex items-center gap-4'>
                <span className='font-medium'>
                  {row.stopsRemaining} arrêt{row.stopsRemaining > 1 ? 's' : ''} restant
                  {row.stopsRemaining > 1 ? 's' : ''}
                </span>
                <span className='text-muted-foreground text-sm'>
                  {row.units} unité{row.units > 1 ? 's' : ''}
                </span>
              </div>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}

// ── Visit pipeline ────────────────────────────────────────────────────────────

function PipelineCard({ total, stages }: { total: number; stages: PipelineStage[] }) {
  const byStage = useMemo(() => new Map(stages.map(stage => [stage.state, stage])), [stages])

  return (
    <Card className='col-span-full md:col-span-3'>
      <CardHeader>
        <CardTitle className='text-lg font-medium'>Pipeline des visites</CardTitle>

        <CardAction>
          <Button
            variant='outline'
            size='sm'
            className='gap-1'
            nativeButton={false}
            render={<Link href='/dashboard/commercial' />}
          >
            Visites <ArrowRight className='size-4' />
          </Button>
        </CardAction>
      </CardHeader>

      <CardContent>
        <Separator />
      </CardContent>

      <CardContent className='flex flex-1 flex-col gap-2'>
        <div className='flex items-baseline gap-1'>
          <span className='text-2xl font-medium'>{total}</span>
          <span className='text-muted-foreground text-sm'>visites au programme aujourd’hui</span>
        </div>

        <Tabs defaultValue='terminee' className='flex-1 justify-between gap-6'>
          <TabsList className='w-full'>
            {STAGE_TABS.map(tab => (
              <TabsTrigger key={tab.value} value={tab.value} className='px-1.5'>
                <tab.icon />
                <span>{tab.label}</span>
                <span className='text-muted-foreground'>{byStage.get(tab.value)?.stops ?? 0}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          {STAGE_TABS.map(tab => {
            const stage = byStage.get(tab.value)

            return (
              <TabsContent key={tab.value} value={tab.value} className='flex flex-col justify-evenly gap-6'>
                {!stage || stage.products.length === 0 ? (
                  <p className='text-muted-foreground text-sm'>
                    Aucune visite {STOP_STATE_LABELS[tab.value].toLowerCase()} pour l’instant.
                  </p>
                ) : (
                  stage.products.map(product => (
                    <div key={product.product} className='space-y-2'>
                      <div className='flex items-center justify-between'>
                        <span className='truncate text-base'>{product.product}</span>
                        <span className='text-muted-foreground text-sm'>
                          {product.stops} visite{product.stops > 1 ? 's' : ''}
                        </span>
                      </div>

                      <Progress
                        value={product.percent}
                        className={cn('**:data-[slot=progress-track]:h-2', tab.bar)}
                        aria-label={`${product.product} — ${product.stops} visites ${STOP_STATE_LABELS[tab.value].toLowerCase()}`}
                      />
                    </div>
                  ))
                )}
              </TabsContent>
            )
          })}
        </Tabs>
      </CardContent>
    </Card>
  )
}

// ── Tour performance ──────────────────────────────────────────────────────────

/**
 * One column of the card: a headline rate, its verdict, and a bar per unit so
 * the fleet's answer to that question is visible rather than implied. The bars
 * are per *unit* and not per day — the fleet overview already shows the twelve
 * working days, per tracked delegate.
 */
function CheckColumn({
  title,
  rate,
  caption,
  checks,
  bar,
  describe
}: {
  title: string
  rate: number
  caption: string
  checks: UnitCheck[]
  bar: string

  /** What one bar means, written per column: the same bar answers two questions. */
  describe: (check: UnitCheck) => string
}) {
  return (
    <div className='flex flex-1 flex-col gap-2.5 p-2'>
      <div className='flex flex-col gap-1'>
        <span className='text-muted-foreground text-sm'>{title}</span>

        <div className='flex flex-wrap items-center gap-2'>
          <span className='text-2xl font-medium'>{Math.round(rate)} %</span>
          <ProgressValue percent={rate} tone={attainmentTone(rate)} />
        </div>
      </div>

      <div className='flex flex-1 flex-col justify-between gap-1.5'>
        {checks.map(check => {
          // `value` is already this column's answer: full-or-empty for
          // punctuality, proportional for a circuit. `state` only names it, which
          // is why the bar does not have to reinterpret it.
          return (
            <Progress
              key={check.id}
              value={check.value}
              className={cn('**:data-[slot=progress-track]:h-2 **:data-[slot=progress-track]:rounded-xs', bar)}
              aria-label={`${check.id} — ${describe(check)}`}
            />
          )
        })}
      </div>

      <p className='text-muted-foreground text-xs'>{caption}</p>
    </div>
  )
}

function TourPerformanceCard({
  delayMinutes,
  lateUnits,
  punctuality,
  completion,
  punctualityChecks,
  completionChecks
}: {
  delayMinutes: number
  lateUnits: number
  punctuality: number
  completion: number
  punctualityChecks: UnitCheck[]
  completionChecks: UnitCheck[]
}) {
  return (
    <Card className='col-span-full md:col-span-3 xl:col-span-2'>
      <CardHeader>
        <CardTitle className='flex items-center gap-2 text-base font-medium'>
          <span className='bg-primary text-primary-foreground grid size-8 shrink-0 place-items-center rounded-sm'>
            <Gauge className='size-4' />
          </span>
          Performance des tournées
        </CardTitle>

        <CardAction>
          {/* A count of late units rather than a delta: today is still running,
              so a percentage against yesterday's finished day would always read
              like a collapse. */}
          <Badge
            className={cn(
              'rounded-sm',
              lateUnits === 0 ? 'bg-success-soft text-success' : 'bg-destructive/10 text-destructive'
            )}
          >
            <Clock />
            {lateUnits} unité{lateUnits > 1 ? 's' : ''} en retard
          </Badge>
        </CardAction>
      </CardHeader>

      <CardContent className='flex flex-wrap items-baseline gap-2'>
        <span className='text-2xl font-semibold'>{formatMinutes(delayMinutes)}</span>
        <span className='text-muted-foreground text-sm'>de retard cumulé aujourd’hui</span>
        <span className='text-muted-foreground text-xs'>seuil {DELAY_THRESHOLD_MIN} min par unité</span>
      </CardContent>

      <CardContent className='flex flex-1 flex-col gap-4'>
        <Separator />

        <div className='grid flex-1 grid-cols-2'>
          <CheckColumn
            title='Ponctualité'
            rate={punctuality}
            caption='Une barre par unité · pleine = à l’heure, vide = en retard ou hors service'
            checks={punctualityChecks}
            bar='**:data-[slot=progress-indicator]:bg-success'
            describe={check =>
              check.state === 'idle' ? 'hors service' : check.state === 'met' ? 'à l’heure' : 'en retard'
            }
          />

          <CheckColumn
            title='Avancement des tournées'
            rate={completion}
            caption='Une barre par unité · remplie selon l’avancement du circuit'
            checks={completionChecks}
            bar='**:data-[slot=progress-indicator]:bg-primary'
            describe={check => (check.state === 'idle' ? 'hors service' : `${Math.round(check.value)} % d’avancement`)}
          />
        </div>
      </CardContent>
    </Card>
  )
}

// ── Fleet readiness ───────────────────────────────────────────────────────────

function ReadinessCard({ rows }: { rows: ReadinessRow[] }) {
  return (
    <Card className='col-span-full md:col-span-3 xl:col-span-2'>
      <CardHeader>
        <CardTitle className='text-lg font-medium'>Préparation de la flotte</CardTitle>

        <CardAction>
          <Button
            variant='outline'
            size='sm'
            className='gap-1'
            nativeButton={false}
            render={<Link href='/dashboard/logistics' />}
          >
            Flotte <ArrowRight className='size-4' />
          </Button>
        </CardAction>
      </CardHeader>

      <CardContent className='flex flex-1 flex-col justify-between gap-4'>
        {rows.map(row => (
          <div key={row.key} className='flex items-center justify-between gap-2'>
            <div className='flex min-w-0 items-center gap-3'>
              <CircularProgress
                value={row.percent}
                size={52}
                strokeWidth={5}
                showLabel
                renderLabel={value => `${Math.round(value)} %`}
                labelClassName='text-xs font-medium'
                progressClassName={READINESS_RINGS[row.tone]}
              />

              <div className='flex min-w-0 flex-col gap-0.5'>
                <span className='text-base font-medium'>{row.label}</span>
                <span className='text-muted-foreground truncate text-sm'>{row.hint}</span>
              </div>
            </div>

            <Badge className={cn('h-6 shrink-0 rounded-sm px-3 py-1', READINESS_BADGES[row.tone])}>{row.value}</Badge>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

// ── Visit trend ───────────────────────────────────────────────────────────────

function TrendCard({ points, target }: { points: DayPoint[]; target: number }) {
  const data = useMemo(
    () => points.map(point => ({ day: point.day, visites: point.visits, objectif: point.visitsTarget })),
    [points]
  )

  const visits = points.reduce((sum, point) => sum + point.visits, 0)
  const attainment = target > 0 ? (visits / target) * 100 : 0

  return (
    <Card className='col-span-full md:col-span-3 xl:col-span-2'>
      <CardHeader>
        <CardTitle className='text-lg font-medium'>Tendance des visites</CardTitle>

        <CardAction>
          <Badge
            className={cn(
              'rounded-sm',
              attainment >= 100 ? 'bg-success-soft text-success' : 'bg-primary/10 text-primary'
            )}
          >
            <TrendingUp />
            {formatDelta(attainment - 100)}
          </Badge>
        </CardAction>
      </CardHeader>

      <CardContent className='flex flex-1 flex-col gap-6'>
        <div className='flex flex-col gap-1'>
          <span className='text-3xl font-semibold'>{visits}</span>{' '}
          <span className='text-muted-foreground text-sm'>
            visites réalisées sur les {TREND_DAYS} derniers jours ouvrés
          </span>
        </div>

        <ChartContainer config={TREND_CONFIG} className='min-h-47.5 w-full flex-1'>
          <LineChart accessibilityLayer data={data} margin={{ left: 4, right: 8, top: 8 }}>
            <CartesianGrid vertical={false} />
            {/* interval={0}: seven days of labels fit, and the first one is
                otherwise dropped by Recharts' collision rule. */}
            <XAxis dataKey='day' tickLine={false} axisLine={false} tickMargin={8} interval={0} />
            <ChartTooltip cursor={false} content={<ChartTooltipContent indicator='line' />} />

            <Line dataKey='visites' type='monotone' stroke='var(--color-visites)' strokeWidth={3} dot={false} />
            <Line
              dataKey='objectif'
              type='monotone'
              stroke='var(--color-objectif)'
              strokeWidth={2}
              strokeDasharray='6 6'
              dot={false}
            />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}

// ── The day's visits ──────────────────────────────────────────────────────────

function VisitsTable({ rows }: { rows: VisitRow[] }) {
  const router = useRouter()
  const [page, setPage] = useState(1)

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const pageRows = useMemo(() => rows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE), [rows, safePage])

  const first = rows.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1
  const last = Math.min(safePage * PAGE_SIZE, rows.length)
  const open = rows.filter(row => row.stop.state !== 'terminee').length

  /**
   * The unit is what the map can show, so opening a visit opens the live map on
   * that unit — the registry has no per-visit page, and inventing one would mean
   * inventing a visit record the backend does not store.
   */
  const openOnMap = (unitId: string) => router.push(`/dashboard/logistics/live-map?unit=${unitId}`)

  return (
    <Card className='col-span-full gap-0 py-0'>
      <div className='flex min-h-17 flex-wrap items-center justify-between gap-3 border-b px-4 py-3'>
        <div className='flex flex-col'>
          <span className='text-base font-medium'>Visites du jour</span>
          <span className='text-muted-foreground text-sm'>
            {rows.length} visites au programme, {open} non clôturées
          </span>
        </div>

        <Button
          variant='outline'
          size='sm'
          className='gap-1'
          nativeButton={false}
          render={<Link href='/dashboard/commercial' />}
        >
          Toutes les visites <ArrowRight className='size-4' />
        </Button>
      </div>

      <div className='relative w-full overflow-x-auto'>
        <Table>
          <TableHeader>
            <TableRow className='border-t hover:bg-transparent'>
              <TableHead className='text-muted-foreground'>Unité</TableHead>
              <TableHead className='text-muted-foreground'>Visite</TableHead>
              <TableHead className='text-muted-foreground'>Officine</TableHead>
              <TableHead className='text-muted-foreground'>Créneau</TableHead>
              <TableHead className='text-muted-foreground'>Statut</TableHead>
              <TableHead className='text-muted-foreground'>Progression</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {pageRows.map(row => {
              // A visit already closed keeps its planned slot: the delay shifted
              // what is still ahead, not what was done.
              const late = row.stop.state !== 'terminee' && row.eta !== null && row.eta !== row.stop.at

              return (
                <TableRow
                  key={row.key}
                  role='link'
                  tabIndex={0}
                  aria-label={`Ouvrir ${row.stop.name} sur la carte live (${row.unit.id})`}
                  className='focus-visible:ring-ring/50 cursor-pointer focus-visible:ring-2 focus-visible:outline-none'
                  onClick={() => openOnMap(row.unit.id)}
                  onKeyDown={event => {
                    if (event.key === 'Enter') openOnMap(row.unit.id)
                  }}
                >
                  <TableCell className='first:pl-4 last:px-4'>
                    <div className='flex items-center gap-2'>
                      <span className='bg-primary text-primary-foreground grid size-8 shrink-0 place-items-center rounded-lg'>
                        <Truck className='size-4' />
                      </span>

                      <div className='flex min-w-0 flex-col'>
                        <span className='truncate font-medium'>{row.unit.id}</span>
                        <span className='text-muted-foreground truncate text-xs'>{row.unit.plate}</span>
                      </div>
                    </div>
                  </TableCell>

                  <TableCell className='first:pl-4 last:px-4'>
                    <div className='flex flex-col gap-0.5'>
                      <span className='font-medium'>{row.stop.id}</span>
                      <Badge className='bg-primary/10 text-primary h-auto w-fit rounded-sm px-1.5 py-0.5 text-[11px]'>
                        {row.stop.productFocus}
                      </Badge>
                    </div>
                  </TableCell>

                  <TableCell className='first:pl-4 last:px-4'>
                    <div className='text-muted-foreground flex min-w-0 items-center gap-1.5'>
                      <span className='truncate'>{row.stop.name}</span>
                      <ArrowRight className='size-3.5 shrink-0' />
                      <span className='truncate'>{row.stop.city}</span>
                    </div>
                  </TableCell>

                  <TableCell className='first:pl-4 last:px-4'>
                    <span className='text-muted-foreground flex items-center gap-1.5 whitespace-nowrap'>
                      <Clock className='size-3.5 shrink-0' />
                      {row.stop.at}
                      {late && <span className='text-warning font-medium'>· {row.eta}</span>}
                    </span>
                  </TableCell>

                  <TableCell className='first:pl-4 last:px-4'>
                    <Badge className={cn('rounded-sm border-none', STOP_BADGES[row.stop.state])}>
                      {STOP_STATE_LABELS[row.stop.state]}
                    </Badge>
                  </TableCell>

                  <TableCell className='first:pl-4 last:px-4'>
                    <div className='flex items-center gap-3'>
                      <Progress
                        value={row.progress}
                        className='w-32 **:data-[slot=progress-track]:h-1.5'
                        aria-label={`${row.stop.id} — ${row.progress} %`}
                      />
                      <span className='text-sm tabular-nums'>{row.progress} %</span>
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      <div className='flex items-center justify-between gap-3 border-t px-4 py-3 max-sm:flex-col'>
        <p className='text-muted-foreground text-sm'>
          Affichage {first} à {last} sur {rows.length} visites
        </p>

        <nav aria-label='pagination' className='flex items-center gap-1'>
          <Button
            variant='outline'
            size='icon'
            className='size-8'
            aria-label='Page précédente'
            disabled={safePage <= 1}
            onClick={() => setPage(safePage - 1)}
          >
            <ChevronLeft className='size-4' />
          </Button>

          {Array.from({ length: totalPages }, (_, index) => index + 1).map(number => (
            <Button
              key={number}
              variant={number === safePage ? 'default' : 'ghost'}
              size='icon'
              aria-current={number === safePage ? 'page' : undefined}
              className={cn('size-8', number !== safePage && 'bg-primary/10 text-primary hover:bg-primary/20')}
              onClick={() => setPage(number)}
            >
              {number}
            </Button>
          ))}

          <Button
            variant='outline'
            size='icon'
            className='size-8'
            aria-label='Page suivante'
            disabled={safePage >= totalPages}
            onClick={() => setPage(safePage + 1)}
          >
            <ChevronRight className='size-4' />
          </Button>
        </nav>
      </div>
    </Card>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function OperationsOverview() {
  // Read once: the account only changes when someone signs out.
  const me = useMemo(() => getCurrentUser(), [])

  const occupancy = useMemo(() => fleetOccupancy(), [])
  const pipeline = useMemo(() => visitPipeline(), [])
  const series = useMemo(() => workingDaySeries(), [])
  const readiness = useMemo(() => fleetReadiness(), [])
  const visits = useMemo(() => todayVisits(), [])
  const delayMinutes = useMemo(() => totalDelayMinutes(), [])
  const lateUnits = useMemo(() => delayedUnits().length, [])

  const punctuality = useMemo(() => punctualityRate(), [])
  const completion = useMemo(() => completionRate(), [])
  const punctualityChecks = useMemo(() => punctualityByUnit(), [])
  const completionChecks = useMemo(() => completionByUnit(), [])

  // The seven *complete* working days: today is still running, so counting it
  // into a seven-day total would make every figure under it read low.
  const trend = useMemo(() => series.slice(-(TREND_DAYS + 1), -1), [series])
  const trendTarget = useMemo(() => trend.reduce((sum, point) => sum + point.visitsTarget, 0), [trend])

  // The field force is the platform's view: the nav item is absent from the
  // other two navbars, and this covers typing the URL — the same answer
  // /admin/accounts and the live map give.
  if (me && workspaceFor(me.role) !== 'admin') {
    return (
      <div className='col-span-full'>
        <Card>
          <CardContent className='flex flex-col gap-2 py-6'>
            <span className='flex items-center gap-2 text-lg font-semibold'>
              <ShieldCheck className='text-muted-foreground size-5' /> Accès restreint
            </span>
            <p className='text-muted-foreground text-sm'>
              La vue d’ensemble des opérations est réservée aux administrateurs. Votre rôle (
              {ACCOUNT_ROLE_LABELS[me.role]}) n’y a pas accès.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <>
      <div className='col-span-full flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between'>
        <div>
          <div className='flex flex-wrap items-center gap-3'>
            <h1 className='text-2xl font-semibold tracking-tight'>Vue d’ensemble des opérations</h1>

            <Badge variant='outline' className='text-success gap-1.5 rounded-full'>
              <span className='bg-success size-1.5 rounded-full' />
              Opérations en direct
            </Badge>
          </div>

          <p className='text-muted-foreground mt-1.5 text-sm'>
            Suivez la répartition de la flotte, l’avancement des visites et ce que les unités demandent avant de partir
            en tournée.
          </p>
        </div>
      </div>

      <FleetSplitCard rows={occupancy} />
      <PipelineCard total={pipeline.total} stages={pipeline.stages} />

      <TourPerformanceCard
        delayMinutes={delayMinutes}
        lateUnits={lateUnits}
        punctuality={punctuality}
        completion={completion}
        punctualityChecks={punctualityChecks}
        completionChecks={completionChecks}
      />

      <ReadinessCard rows={readiness} />
      <TrendCard points={trend} target={trendTarget} />

      <VisitsTable rows={visits} />

      <p className='text-muted-foreground col-span-full text-xs'>
        Chiffres issus du registre flotte interne (seed) : le suivi GPS et les remontées de tournée ne sont pas encore
        branchés. Le retard d’une unité décale l’horaire prévu des visites à venir ({DELAY_THRESHOLD_MIN} min au-delà de
        l’horaire, l’unité est comptée en retard).
      </p>
    </>
  )
}
