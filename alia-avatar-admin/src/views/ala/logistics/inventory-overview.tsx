'use client'

// ──────────────────────────────────────────────
// Vue d'ensemble du stock — what the dépôts hold, what is running out, what turns
//
// The fourth page of the Opérations group, beside the operations overview, the
// live map and Flotte & tournées. Where those three read the *field force*, this
// one reads the *stock that feeds it*: the same five dépôts the tournées load
// from, the références the delegates actually pitch (CALMOSS, PEDIAKIDS,
// OLIGOVIT, VITONIC…), what is below its reorder point, and how fast it moves.
//
// Two controls, two different questions — on purpose:
//  * the period selector governs the *reporting window*: the headline figures,
//    the value curve and its delta, the références added, the deltas compared to
//    the previous window of the same length;
//  * the rotation tabs govern the *window the rotation rate is averaged over*.
//    A rate needs a window, and asking for the annualised rate while reading a
//    seven-day report is a legitimate question, so the two are independent.
//
// Where the data comes from: src/lib/inventory-data.ts, a seed. The backend has
// no stock model — it stores training sessions, accounts, support reports and the
// product catalogue — so every number here is the seed's, and the footnote says
// so. The référence names, gammes and dépôts are the real ones.
// ──────────────────────────────────────────────

import { useMemo, useState, type ReactNode } from 'react'

import Link from 'next/link'

import {
  ArrowLeftRight,
  Baby,
  Banknote,
  Bell,
  Box,
  Calendar,
  ChevronRight,
  CircleAlert,
  CircleQuestionMark,
  FlaskConical,
  Leaf,
  Package,
  PackageX,
  Pill,
  Scale,
  ShieldCheck,
  Sparkles,
  SprayCan,
  TrendingDown,
  TrendingUp,
  Truck,
  Warehouse,
  type LucideIcon
} from 'lucide-react'
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import { Progress } from '@/components/ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { ACCOUNT_ROLE_LABELS, getCurrentUser, workspaceFor } from '@/lib/auth'
import {
  DEFAULT_PERIOD_DAYS,
  DEPOTS,
  HEALTH_LABELS,
  HISTORY_DAYS,
  MOVEMENT_LABELS,
  PERIOD_OPTIONS,
  RECOMMENDED_COVER_DAYS,
  STOCK_STATUS_LABELS,
  TURNOVER_WINDOWS,
  categoryHealth,
  dayLabel,
  depotRows,
  formatDaysAgo,
  formatDt,
  formatUnits,
  inventorySummary,
  recentActivity,
  reorderAlerts,
  turnover,
  valueSeries,
  type HealthTone,
  type Movement,
  type MovementKind,
  type StockLine,
  type StockStatus
} from '@/lib/inventory-data'
import { cn } from '@/lib/utils'

/** Tones shared by the badges, chips and tiles of the page. */
const TONE_SOFT: Record<'success' | 'info' | 'warning' | 'destructive' | 'primary', string> = {
  success: 'bg-success-soft text-success',
  info: 'bg-info-soft text-info',
  warning: 'bg-warning-soft text-warning',
  destructive: 'bg-destructive/10 text-destructive',
  primary: 'bg-primary/10 text-primary'
}

const HEALTH_TONES: Record<HealthTone, string> = {
  success: TONE_SOFT.success,
  warning: TONE_SOFT.warning,
  destructive: TONE_SOFT.destructive
}

/** How each stock status is written in the alerts table. */
const STATUS_TONES: Record<StockStatus, string> = {
  rupture: TONE_SOFT.destructive,
  critique: TONE_SOFT.warning,
  bas: TONE_SOFT.primary,
  ok: TONE_SOFT.success
}

/** The gamme's own symbol, so a row is recognisable before it is read. */
const GAMME_ICONS: Record<string, LucideIcon> = {
  'Laboratoire Vital': FlaskConical,
  PediaKids: Baby,
  Oligovit: Pill,
  Calmoss: Leaf,
  Vitonic: Sparkles,
  Cosmopharma: SprayCan
}

const MOVEMENT_META: Record<MovementKind, { icon: LucideIcon; tone: string }> = {
  reception: { icon: Truck, tone: TONE_SOFT.success },
  transfert: { icon: ArrowLeftRight, tone: TONE_SOFT.info },
  ajustement: { icon: Scale, tone: TONE_SOFT.warning },
  alerte: { icon: Bell, tone: TONE_SOFT.destructive }
}

const VALUE_CONFIG = {
  value: { label: 'Valeur du stock', color: 'var(--chart-1)' }
} satisfies ChartConfig

const TURNOVER_CONFIG = {
  rotation: { label: 'Rotation annualisée', color: 'var(--chart-1)' }
} satisfies ChartConfig

/** "9,7x" — the shape a rotation rate is written in. */
function formatTurns(value: number): string {
  return `${value.toFixed(1).replace('.', ',')}x`
}

/** Signed rotation move, e.g. "+0,3x". */
function formatTurnDelta(value: number): string {
  const sign = value > 0 ? '+' : ''

  return `${sign}${value.toFixed(1).replace('.', ',')}x`
}

/** Signed share, e.g. "+8,1 %". */
function formatDelta(value: number): string {
  const sign = value > 0 ? '+' : ''

  return `${sign}${value.toFixed(1).replace('.', ',')} %`
}

/** "DC" for DERMACNÉ CRÈME — the two initials the row's avatar shows. */
function initials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map(word => word[0])
    .join('')
    .toUpperCase()
}

function InfoHint({ label, children }: { label: string; children: string }) {
  return (
    <Tooltip>
      <TooltipTrigger render={<span className='text-muted-foreground hover:text-foreground cursor-help' />}>
        <CircleQuestionMark className='size-4' aria-label={label} />
      </TooltipTrigger>
      <TooltipContent className='max-w-72 text-pretty'>{children}</TooltipContent>
    </Tooltip>
  )
}

// ── Headline figures ──────────────────────────────────────────────────────────

interface Kpi {
  key: string
  label: string
  icon: LucideIcon
  value: string
  valueClass?: string
  badge?: { text: string; tone: string }
}

function KpiCard({ kpi, footer }: { kpi: Kpi; footer: ReactNode }) {
  const Icon = kpi.icon

  return (
    <Card className='justify-between gap-4'>
      <CardContent className='flex items-center gap-4'>
        <span className='bg-muted text-foreground grid size-12 shrink-0 place-items-center rounded-full [&>svg]:size-5'>
          <Icon />
        </span>

        <div className='min-w-0 flex-1'>
          <p className='text-muted-foreground text-sm font-medium'>{kpi.label}</p>

          <div className='mt-0.5 flex flex-wrap items-center gap-2'>
            <span className={cn('text-2xl font-semibold tabular-nums', kpi.valueClass)}>{kpi.value}</span>

            {kpi.badge && <Badge className={cn('rounded-sm', kpi.badge.tone)}>{kpi.badge.text}</Badge>}
          </div>
        </div>
      </CardContent>

      {footer}
    </Card>
  )
}

// ── Rotation ──────────────────────────────────────────────────────────────────

function TurnoverCard({ className }: { className?: string }) {
  const [window, setWindow] = useState(DEFAULT_PERIOD_DAYS)
  const data = useMemo(() => turnover(window), [window])

  // The chart plots the same rate the panel headlines, keyed to match the config
  // above — which is what gives the area its colour.
  const chartData = useMemo(() => data.series.map(point => ({ label: point.label, rotation: point.turns })), [data])

  const rising = data.deltaTurns > 0.05
  const falling = data.deltaTurns < -0.05

  return (
    <Card className={cn('h-full', className)}>
      <CardHeader className='flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between'>
        <div>
          <div className='flex items-center gap-1.5'>
            <CardTitle>Rotation des stocks</CardTitle>

            <InfoHint label='Comment la rotation est calculée'>
              {`Rotation annualisée = valeur des sorties de la fenêtre × 365 ÷ valeur moyenne du stock détenu. Une rotation de 6x signifie que le stock couvre deux mois de demande.`}
            </InfoHint>
          </div>

          <p className='text-muted-foreground mt-1 text-sm'>
            Rotation annualisée sur la fenêtre choisie, comparée à la fenêtre précédente de même durée
          </p>
        </div>

        <Tabs value={String(window)} onValueChange={value => setWindow(Number(value))}>
          <TabsList>
            {TURNOVER_WINDOWS.map(option => (
              <TabsTrigger key={option.value} value={String(option.value)} className='px-1.5'>
                {option.label}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value={String(window)} />
        </Tabs>
      </CardHeader>

      <CardContent className='grid flex-1 grid-cols-1 gap-6'>
        <div className='bg-muted h-fit rounded-xl p-4'>
          <p className='text-muted-foreground text-xs font-medium tracking-wide uppercase'>Rotation moyenne</p>

          <div className='mt-3 flex items-end gap-2'>
            <span className='text-4xl font-semibold tracking-tight'>{formatTurns(data.turns)}</span>

            <Badge
              className={cn(
                'mb-1 rounded-sm',
                rising ? TONE_SOFT.success : falling ? TONE_SOFT.destructive : 'bg-primary/10 text-primary'
              )}
            >
              {rising ? <TrendingUp /> : falling ? <TrendingDown /> : null}
              {formatTurnDelta(data.deltaTurns)}
            </Badge>
          </div>

          <p className='text-muted-foreground mt-2 text-xs leading-5'>
            {rising
              ? 'Le stock tourne plus vite que sur la fenêtre précédente.'
              : falling
                ? 'Le stock tourne plus lentement que sur la fenêtre précédente.'
                : 'Le stock tourne au même rythme que sur la fenêtre précédente.'}
          </p>

          <Separator className='my-4' />

          <p className='text-muted-foreground text-xs'>Gamme la plus rapide</p>

          <div className='mt-1 flex items-center justify-between gap-2'>
            <span className='truncate text-sm font-semibold'>{data.best?.gamme ?? '—'}</span>
            <span className='text-sm font-semibold tabular-nums'>{formatTurns(data.best?.turns ?? 0)}</span>
          </div>

          <Separator className='my-4' />

          <p className='text-muted-foreground text-xs'>Gamme la plus lente</p>

          <div className='mt-1 flex items-center justify-between gap-2'>
            <span className='truncate text-sm font-semibold'>{data.worst?.gamme ?? '—'}</span>
            <span className='text-sm font-semibold tabular-nums'>{formatTurns(data.worst?.turns ?? 0)}</span>
          </div>
        </div>

        <ChartContainer config={TURNOVER_CONFIG} className='h-full min-h-70 w-full'>
          <AreaChart accessibilityLayer data={chartData} margin={{ left: 4, right: 8, top: 8 }}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey='label' tickLine={false} axisLine={false} tickMargin={8} />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              width={36}
              domain={[0, 'auto']}
              tickFormatter={value => `${value}x`}
            />
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent indicator='line' formatter={value => `${Number(value).toFixed(2)}x`} />}
            />

            <Area
              dataKey='rotation'
              type='monotone'
              stroke='var(--color-rotation)'
              fill='var(--color-rotation)'
              fillOpacity={0.2}
              strokeWidth={2.5}
              dot={false}
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}

// ── Alertes de réapprovisionnement ────────────────────────────────────────────

function ReorderAlertsCard({ rows, className }: { rows: StockLine[]; className?: string }) {
  return (
    <Card className={cn('gap-0 py-0', className)}>
      <CardHeader className='border-b'>
        <div className='flex items-center gap-2'>
          <CardTitle>Alertes de réapprovisionnement</CardTitle>
          <Badge variant='secondary' className='rounded-sm'>
            {rows.length}
          </Badge>
        </div>

        <CardAction>
          <Button
            variant='outline'
            size='sm'
            className='gap-1'
            nativeButton={false}
            render={<Link href='/products/catalog' />}
          >
            Catalogue <ChevronRight className='size-4' />
          </Button>
        </CardAction>
      </CardHeader>

      <div className='relative w-full overflow-x-auto'>
        <Table>
          <TableHeader>
            <TableRow className='hover:bg-transparent'>
              {/* `max-w-0 w-full` is what lets the name ellipsize instead of
                  widening the table past its card. */}
              <TableHead className='text-foreground w-full max-w-0 px-5'>Référence</TableHead>
              <TableHead className='text-foreground w-32 px-2'>Dépôt</TableHead>
              <TableHead className='text-foreground w-20 px-2'>Statut</TableHead>
              <TableHead className='text-foreground w-32 px-2 pr-5 text-right'>Seuil de réappro.</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {rows.map(line => (
              <TableRow key={line.id} className='[&>td]:py-2.5'>
                <TableCell className='w-full max-w-0 px-5'>
                  <div className='flex items-center gap-2.5'>
                    <span className='bg-muted flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold'>
                      {initials(line.item.name)}
                    </span>

                    <div className='min-w-0'>
                      <p className='truncate text-sm font-medium' title={line.item.name}>
                        {line.item.name}
                      </p>
                      <p className='text-muted-foreground mt-0.5 text-xs'>
                        {line.item.code} · {Math.round(line.coverageDays)} j de couverture
                      </p>
                    </div>
                  </div>
                </TableCell>

                <TableCell className='text-muted-foreground truncate px-2' title={line.depot.name}>
                  {line.depot.name}
                </TableCell>

                <TableCell className='px-2'>
                  <Badge variant='outline' className={cn('border-0', STATUS_TONES[line.status])}>
                    {line.quantity === 0 ? 'Rupture' : STOCK_STATUS_LABELS[line.status]}
                  </Badge>
                </TableCell>

                <TableCell className='pr-5 text-right tabular-nums'>{formatUnits(line.reorderPoint)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </Card>
  )
}

// ── Santé par gamme ───────────────────────────────────────────────────────────

function CategoryHealthCard({ className }: { className?: string }) {
  const rows = useMemo(() => categoryHealth(), [])

  return (
    <Card className={cn('gap-0 py-0', className)}>
      <CardHeader className='border-b'>
        <div className='flex items-center gap-1.5'>
          <CardTitle>Santé du stock par gamme</CardTitle>

          <InfoHint label='Comment la santé par gamme est calculée'>
            {`Stock disponible de la gamme rapporté à son niveau recommandé, ${RECOMMENDED_COVER_DAYS} jours de demande par référence. Sous 40 % la gamme est critique, sous 70 % en vigilance.`}
          </InfoHint>
        </div>

        <p className='text-muted-foreground text-sm'>
          Disponible rapporté au niveau recommandé, la gamme la plus juste en tête
        </p>
      </CardHeader>

      <CardContent className='divide-border divide-y p-0'>
        {rows.map(row => {
          const Icon = GAMME_ICONS[row.gamme] ?? Package

          return (
            <div key={row.gamme} className='flex items-center gap-4 px-5 py-3.5'>
              <span className='bg-muted flex size-9 shrink-0 items-center justify-center rounded-lg'>
                <Icon className='size-4' />
              </span>

              <div className='min-w-0 flex-1'>
                <p className='truncate text-sm font-medium'>{row.gamme}</p>
                <p className='text-muted-foreground mt-0.5 text-xs'>
                  {row.skus} référence{row.skus > 1 ? 's' : ''} · {formatDt(row.value)} de valeur
                </p>
              </div>

              <Progress
                value={Math.min(100, row.coverPercent)}
                className='hidden w-24 shrink-0 **:data-[slot=progress-track]:h-2 sm:flex lg:w-32'
                aria-label={`${row.gamme} — ${Math.round(row.coverPercent)} % du niveau recommandé`}
              />

              <span className='w-10 shrink-0 text-right text-sm font-semibold tabular-nums'>
                {Math.round(row.coverPercent)} %
              </span>

              <Badge variant='outline' className={cn('w-18 shrink-0 justify-center border-0', HEALTH_TONES[row.tone])}>
                {HEALTH_LABELS[row.tone]}
              </Badge>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}

// ── Stock par dépôt ───────────────────────────────────────────────────────────

function WarehouseCard({ className }: { className?: string }) {
  const rows = useMemo(() => depotRows(), [])
  const units = rows.reduce((sum, row) => sum + row.units, 0)
  const capacity = rows.reduce((sum, row) => sum + row.depot.capacityUnits, 0)
  const usedPercent = capacity > 0 ? (units / capacity) * 100 : 0

  return (
    <Card className={cn('gap-0 py-0', className)}>
      <CardHeader className='border-b'>
        <div className='flex items-center gap-1.5'>
          <CardTitle>Stock par dépôt</CardTitle>

          <InfoHint label='Comment la capacité est calculée'>
            Capacité utilisée = unités en stock rapportées à la capacité du dépôt. Les seuils et ruptures sont comptés
            par référence et par dépôt.
          </InfoHint>
        </div>

        <p className='text-muted-foreground text-sm'>Capacité, occupation et risques par site</p>

        <CardAction>
          <Badge className='bg-primary/10 text-primary rounded-sm'>{Math.round(usedPercent)} % de capacité</Badge>
        </CardAction>
      </CardHeader>

      <CardContent className='divide-border divide-y p-0'>
        {rows.map(row => (
          <div key={row.depot.id} className='flex flex-wrap items-center gap-x-4 gap-y-3 p-4'>
            <div className='flex min-w-40 flex-1 items-center gap-3'>
              <span className='bg-muted flex size-9 shrink-0 items-center justify-center rounded-lg'>
                <Warehouse className='size-4' />
              </span>

              <div className='min-w-0'>
                <p className='truncate text-sm font-medium' title={row.depot.name}>
                  {row.depot.name}
                </p>
                <p className='text-muted-foreground mt-0.5 truncate text-xs'>
                  {row.depot.city} · {row.skus} référence{row.skus > 1 ? 's' : ''}
                </p>
              </div>
            </div>

            <div className='flex shrink-0 gap-4'>
              <div>
                <p className='text-muted-foreground text-xs'>Capacité</p>
                <p className='mt-1 text-sm font-semibold tabular-nums'>{Math.round(row.usedPercent)} %</p>
              </div>
              <div>
                <p className='text-muted-foreground text-xs'>Stock bas</p>
                <p className='text-warning mt-1 text-sm font-semibold tabular-nums'>{row.lowCount}</p>
              </div>
              <div>
                <p className='text-muted-foreground text-xs'>Ruptures</p>
                <p className='text-destructive mt-1 text-sm font-semibold tabular-nums'>{row.outCount}</p>
              </div>
            </div>

            <div className='flex w-full items-center gap-3'>
              <Progress
                value={row.usedPercent}
                className='flex-1 **:data-[slot=progress-track]:h-2'
                aria-label={`${row.depot.name} — ${Math.round(row.usedPercent)} % de capacité utilisée`}
              />
              <span className='text-muted-foreground shrink-0 text-xs tabular-nums'>
                {formatUnits(row.units)} / {formatUnits(row.depot.capacityUnits)} unités
              </span>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

// ── Activité du stock ─────────────────────────────────────────────────────────

function ActivityCard({ movements, className }: { movements: Movement[]; className?: string }) {
  return (
    <Card className={cn('gap-0 py-0', className)}>
      <CardHeader className='flex items-center justify-between gap-2 border-b pt-5'>
        <CardTitle>Activité récente du stock</CardTitle>
        <CardAction>
          <span className='text-muted-foreground text-sm'>
            Dernier mouvement de chaque type · {DEPOTS.length} dépôts
          </span>
        </CardAction>
      </CardHeader>

      <CardContent className='grid grid-cols-1 p-0 md:grid-cols-2 lg:grid-cols-4'>
        {movements.map(movement => {
          const meta = MOVEMENT_META[movement.kind]
          const Icon = meta.icon

          return (
            <div
              key={movement.id}
              className='flex flex-col gap-4 border-b p-4 last:border-b-0 lg:border-r lg:border-b-0 lg:last:border-r-0'
            >
              <div className='flex items-start gap-3'>
                <span className={cn('grid size-11 shrink-0 place-items-center rounded-full [&>svg]:size-5', meta.tone)}>
                  <Icon />
                </span>

                <div className='min-w-0 flex-1'>
                  <Badge variant='outline' className='rounded-sm'>
                    {MOVEMENT_LABELS[movement.kind]}
                  </Badge>

                  <p className='mt-1.5 truncate text-sm font-medium'>{movement.title}</p>
                  <p className='text-muted-foreground mt-0.5 line-clamp-2 text-xs'>{movement.description}</p>
                </div>
              </div>

              <div className='flex items-center justify-between gap-2 text-xs'>
                <span className='text-muted-foreground truncate'>{movement.depotName}</span>
                <span className='text-muted-foreground shrink-0'>
                  {movement.daysAgo === undefined ? 'à traiter' : formatDaysAgo(movement.daysAgo)}
                </span>
              </div>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function InventoryOverview() {
  // Read once: the account only changes when someone signs out.
  const me = useMemo(() => getCurrentUser(), [])
  const [period, setPeriod] = useState(DEFAULT_PERIOD_DAYS)

  const summary = useMemo(() => inventorySummary(period), [period])
  const curve = useMemo(() => valueSeries(period), [period])
  const alerts = useMemo(() => reorderAlerts(), [])
  const activity = useMemo(() => recentActivity(), [])

  // The dépôts are the platform's stock: the nav item is absent from the other
  // two navbars, and this covers typing the URL — the same answer the operations
  // overview and /admin/accounts give.
  if (me && workspaceFor(me.role) !== 'admin') {
    return (
      <div className='col-span-full'>
        <Card>
          <CardContent className='flex flex-col gap-2 py-6'>
            <span className='flex items-center gap-2 text-lg font-semibold'>
              <ShieldCheck className='text-muted-foreground size-5' /> Accès restreint
            </span>
            <p className='text-muted-foreground text-sm'>
              La vue d’ensemble du stock est réservée aux administrateurs. Votre rôle ({ACCOUNT_ROLE_LABELS[me.role]})
              n’y a pas accès.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const valueRising = summary.valueDeltaPercent >= 0

  const kpis: Kpi[] = [
    {
      key: 'skus',
      label: 'Références en stock',
      icon: Box,
      value: formatUnits(summary.skus)
    },
    {
      key: 'value',
      label: 'Valeur du stock',
      icon: Banknote,
      value: formatDt(summary.value),
      badge: {
        text: formatDelta(summary.valueDeltaPercent),
        tone: valueRising ? TONE_SOFT.primary : TONE_SOFT.destructive
      }
    },
    {
      key: 'low',
      label: 'Stock bas',
      icon: CircleAlert,
      value: formatUnits(summary.lowCount),
      valueClass: 'text-warning'
    },
    {
      key: 'out',
      label: 'Ruptures',
      icon: PackageX,
      value: formatUnits(summary.outCount),
      valueClass: 'text-destructive'
    }
  ]

  return (
    <>
      <div className='col-span-full flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between'>
        <div>
          <div className='flex flex-wrap items-center gap-3'>
            <h1 className='text-2xl font-semibold tracking-tight'>Vue d’ensemble du stock</h1>

            <Badge variant='outline' className='text-success gap-1.5 rounded-full'>
              <span className='bg-success size-1.5 rounded-full' />
              Stock en direct
            </Badge>
          </div>

          <p className='text-muted-foreground mt-1.5 text-sm'>
            Suivez la santé du stock, les risques de rupture et la rotation des dépôts VITAL.
          </p>
        </div>

        <div className='flex flex-col gap-2 sm:flex-row sm:items-center'>
          <Select value={String(period)} onValueChange={value => setPeriod(Number(value ?? DEFAULT_PERIOD_DAYS))}>
            <SelectTrigger id='inventory-period' className='w-full sm:w-52' aria-label='Période d’analyse'>
              <Calendar className='text-muted-foreground size-4 shrink-0' />
              <SelectValue>
                {(value: string) => PERIOD_OPTIONS.find(option => option.value === Number(value))?.label ?? 'Période'}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {PERIOD_OPTIONS.map(option => (
                <SelectItem key={option.value} value={String(option.value)}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className='col-span-full grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4'>
        <KpiCard
          kpi={kpis[0]}
          footer={
            <CardContent>
              <Separator className='mb-4' />
              <p className='text-muted-foreground text-xs'>
                +{summary.addedInPeriod} référence{summary.addedInPeriod > 1 ? 's' : ''} ajoutée
                {summary.addedInPeriod > 1 ? 's' : ''} · {summary.depots} dépôts
              </p>
            </CardContent>
          }
        />

        <KpiCard
          kpi={kpis[1]}
          footer={
            <CardContent>
              <div className='flex items-center gap-3'>
                <span className='text-muted-foreground shrink-0 text-xs'>vs période précédente</span>

                <ChartContainer config={VALUE_CONFIG} className='h-9 min-w-0 flex-1' aria-hidden>
                  <AreaChart data={curve} margin={{ left: 0, right: 0, top: 2, bottom: 0 }}>
                    {/* Shape only: the badge beside it carries the magnitude. */}
                    <YAxis hide domain={['dataMin', 'dataMax']} />

                    <Area
                      dataKey='value'
                      type='monotone'
                      stroke='var(--color-value)'
                      fill='var(--color-value)'
                      fillOpacity={0.2}
                      strokeWidth={2}
                      dot={false}
                      isAnimationActive={false}
                    />
                  </AreaChart>
                </ChartContainer>
              </div>
            </CardContent>
          }
        />

        <KpiCard
          kpi={kpis[2]}
          footer={
            <CardContent>
              <div className='flex items-center justify-between gap-2 text-xs'>
                <span className='text-muted-foreground'>{summary.urgentCount} à traiter en priorité</span>
                <span className='text-muted-foreground shrink-0 tabular-nums'>
                  {Math.round(summary.lowPercent)} % des lignes
                </span>
              </div>

              <Progress
                value={summary.lowPercent}
                className='mt-3 **:data-[slot=progress-track]:h-2'
                aria-label={`${Math.round(summary.lowPercent)} % des lignes de stock sont au niveau de leur seuil ou en dessous`}
              />
            </CardContent>
          }
        />

        <KpiCard
          kpi={kpis[3]}
          footer={
            <CardContent>
              <div className='flex items-center justify-between gap-2 text-xs'>
                <span className='text-muted-foreground'>Manque à gagner mensuel</span>
                <span className='text-destructive font-semibold tabular-nums'>{formatDt(summary.valueAtRisk)}</span>
              </div>
            </CardContent>
          }
        />
      </div>

      <TurnoverCard className='col-span-full lg:col-span-3' />
      <ReorderAlertsCard rows={alerts} className='col-span-full lg:col-span-3' />

      <CategoryHealthCard className='col-span-full self-start lg:col-span-3' />
      <WarehouseCard className='col-span-full self-start lg:col-span-3' />

      <ActivityCard movements={activity} className='col-span-full' />

      <p className='text-muted-foreground col-span-full text-xs'>
        Références, gammes et dépôts sont ceux du catalogue VITAL et des tournées ; les quantités, seuils et prix
        proviennent du jeu de départ interne ({summary.lines} lignes de stock, {formatUnits(summary.unitsOnHand)}{' '}
        unités). Le niveau recommandé est de {RECOMMENDED_COVER_DAYS} jours de demande par référence, et la courbe de
        valeur est reconstruite à partir de la consommation de chaque ligne jusqu’au {dayLabel(HISTORY_DAYS - 1)} — le
        suivi de stock temps réel n’est pas encore branché.
      </p>
    </>
  )
}
