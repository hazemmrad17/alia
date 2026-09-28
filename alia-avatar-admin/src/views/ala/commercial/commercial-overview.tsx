'use client'

// ──────────────────────────────────────────────
// Overview — workspace administrateur
//
// Layout follows the admin dashboard template: a row of five KPI cards, then an
// activity card (trend chart + report column) beside a visit-format card, then a
// full-width table of the finished sessions with its own toolbar and pagination.
//
// Everything numeric here comes from the API rather than from demo constants.
// Two things are worth knowing before reading the numbers:
//
//  * Scores (`overall_score`, step scores, CRM) are admin-only. The page asks for
//    them explicitly — a delegate could not read this data even by loading the
//    page, because the server strips those fields for that role.
//  * Sessions have no owner yet, so every figure is "the lab", not "a delegate".
//    Per-delegate reporting is the next increment; until then a responsable sees
//    aggregate training activity and can export the row set he is looking at.
// ──────────────────────────────────────────────

import { useCallback, useEffect, useMemo, useState } from 'react'

import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'
import {
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Clock,
  Copy,
  Download,
  EllipsisVertical,
  Eye,
  GraduationCap,
  Microscope,
  RefreshCw,
  Search,
  Star,
  TrendingUp,
  Users,
  Zap
} from 'lucide-react'
import { Bar, BarChart, Cell, ComposedChart, LabelList, Line, RadialBar, RadialBarChart, XAxis, YAxis } from 'recharts'

import { toast } from 'sonner'

import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { Checkbox } from '@/components/ui/checkbox'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'

import {
  getDashboardStats,
  getSavedSessions,
  listProducts,
  listSupportReports,
  type SavedSession,
  type SavedSessionsResponse
} from '@/lib/alia-api'
import { initialsOf } from '@/lib/auth'
import type { Product, SessionStats } from '@/types/alia'

// ── Labels ────────────────────────────────────────────────────────────────────

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

const LEVEL_LABELS: Record<string, string> = {
  debutant: 'Débutant',
  junior: 'Junior',
  confirme: 'Confirmé',
  expert: 'Expert'
}

type FormatKey = 'flash' | 'standard' | 'approfondie'

/**
 * Icon and tint per visit format. The classes are written out in full because
 * Tailwind only generates what it can see in the source — a computed
 * `bg-${tint}/10` produces nothing.
 */
const FORMAT_META: Record<FormatKey, { label: string; icon: LucideIcon; chip: string }> = {
  flash: { label: 'Flash', icon: Zap, chip: 'bg-chart-1/10 text-chart-1' },
  standard: { label: 'Standard', icon: GraduationCap, chip: 'bg-chart-2/10 text-chart-2' },
  approfondie: { label: 'Approfondie', icon: Microscope, chip: 'bg-chart-3/10 text-chart-3' }
}

const FORMAT_ORDER: FormatKey[] = ['flash', 'standard', 'approfondie']

/** Tint per product family, so the same gamme keeps the same colour. */
const GAMME_TINTS = [
  'bg-chart-1/10 text-chart-1',
  'bg-chart-2/10 text-chart-2',
  'bg-chart-3/10 text-chart-3',
  'bg-chart-4/10 text-chart-4',
  'bg-chart-5/10 text-chart-5'
]

/** Same idea for the two icon tiles above the activity card. */
const TILE_TINTS = {
  clock: 'bg-chart-1/10 text-chart-1',
  alert: 'bg-chart-5/10 text-chart-5',
  users: 'bg-chart-5/10 text-chart-5',
  score: 'bg-chart-2/10 text-chart-2'
} as const

/**
 * Stable colour for a product family: the same gamme keeps its tint between
 * renders and between reloads, without needing a lookup table on the server.
 */
function tintForGamme(gamme?: string): string {
  if (!gamme) return GAMME_TINTS[0]

  let hash = 0

  for (let index = 0; index < gamme.length; index += 1) {
    hash = (hash * 31 + gamme.charCodeAt(index)) % 997
  }

  return GAMME_TINTS[hash % GAMME_TINTS.length]
}

// ── Chart configs ─────────────────────────────────────────────────────────────

const SCORE_OFFSET_CONFIG = {
  up: { label: 'Au-dessus de la moyenne', color: 'var(--chart-2)' },
  down: { label: 'En dessous', color: 'var(--chart-4)' }
}

const SESSIONS_CONFIG = {
  sessions: { label: 'Sessions', color: 'var(--chart-1)' }
}

const COVERAGE_CONFIG = {
  advanced: { label: 'Confirmé et plus', color: 'var(--chart-5)' }
}

const ACTIVITY_CONFIG = {
  sessions: { label: 'Sessions', color: 'var(--chart-2)' },
  score: { label: 'Score moyen', color: 'var(--primary)' }
}

const FORMAT_CONFIG = {
  count: { label: 'Sessions', color: 'var(--chart-2)' }
}

// ── Formatting ────────────────────────────────────────────────────────────────

function formatDate(value?: string | null): string {
  if (!value) return '—'

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) return '—'

  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}

function formatDuration(seconds?: number | null): string {
  if (!seconds || seconds <= 0) return '—'

  const minutes = Math.floor(seconds / 60)
  const rest = Math.round(seconds % 60)

  return minutes > 0 ? `${minutes} min ${String(rest).padStart(2, '0')}` : `${rest} s`
}

function formatScore(score?: number | null): string {
  return typeof score === 'number' ? score.toFixed(1) : '—'
}

/** The score a delegate is expected to reach. The chart reads as distance to it. */
const SCORE_TARGET = 7

/** Green when the gap is up, red when it is down, muted when there is nothing to compare. */
function gapClass(gap?: number | null): string {
  if (typeof gap !== 'number') return 'text-muted-foreground'

  return gap >= 0 ? 'text-green-600 dark:text-green-400' : 'text-destructive'
}

function gapText(gap?: number | null): string {
  if (typeof gap !== 'number') return 'aucune session'

  return `${gap > 0 ? '+' : ''}${gap.toFixed(1)} pt`
}

function scoreBadgeClass(score?: number | null): string {
  if (typeof score !== 'number') return 'bg-muted text-muted-foreground'
  if (score >= 8) return 'bg-green-600/10 text-green-600 dark:bg-green-400/10 dark:text-green-400'
  if (score >= 6) return 'bg-amber-600/10 text-amber-600 dark:bg-amber-400/10 dark:text-amber-400'

  return 'bg-destructive/10 text-destructive'
}

/** Excel-ready CSV: BOM for the accents, semicolons for French Excel. */
function downloadCsv(rows: SavedSession[]) {
  const header = ['Session', 'Niveau', 'Format', 'Produit', 'Score', 'Durée', 'Terminée le', 'Note']

  const body = rows.map(row => [
    row.session_id,
    LEVEL_LABELS[row.level] ?? row.level,
    FORMAT_META[row.visit_format as FormatKey]?.label ?? row.visit_format,
    row.product_focus ?? '',
    formatScore(row.overall_score),
    formatDuration(row.duration_seconds),
    row.completed_at ?? '',
    row.rating ? `${row.rating}/5` : ''
  ])

  const csv = [header, ...body]
    .map(line => line.map(value => `"${String(value).replace(/"/g, '""')}"`).join(';'))
    .join('\r\n')

  const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')

  link.href = url
  link.download = `sessions-alia-${new Date().toISOString().slice(0, 10)}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

const PAGE_SIZES = [5, 10, 25]

// ── Small pieces ──────────────────────────────────────────────────────────────

/** The small round status chip the template uses in the status column. */
function FormatChip({ visitFormat }: { visitFormat?: string | null }) {
  const meta = FORMAT_META[visitFormat as FormatKey] ?? FORMAT_META.standard
  const Icon = meta.icon

  return (
    <Avatar className='rounded-full after:border-0'>
      <AvatarFallback className={cn('rounded-full', meta.chip)} aria-label={meta.label}>
        <Icon className='size-4' />
      </AvatarFallback>
    </Avatar>
  )
}

/** A tiny modal-free stat block: icon chip, label, number. */
function MiniStat({
  icon: Icon,
  chip,
  label,
  value
}: {
  icon: LucideIcon
  chip: string
  label: string
  value: string
}) {
  return (
    <div className='flex flex-col items-center gap-4 p-2'>
      <Avatar className='size-12 rounded-sm after:border-0'>
        <AvatarFallback className={cn('rounded-sm', chip)}>
          <Icon className='size-6' />
        </AvatarFallback>
      </Avatar>
      <div className='flex flex-col items-center gap-1'>
        <span className='text-muted-foreground'>{label}</span>
        <span className='text-2xl font-medium'>{value}</span>
      </div>
    </div>
  )
}

function ChartSkeleton({ className }: { className: string }) {
  return <Skeleton className={cn('w-full rounded-md', className)} />
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function CommercialOverview() {
  const [stats, setStats] = useState<SessionStats | null>(null)
  const [saved, setSaved] = useState<SavedSessionsResponse | null>(null)
  const [gammeOf, setGammeOf] = useState<Record<string, string>>({})
  const [support, setSupport] = useState<{ total: number; open: number } | null>(null)
  const [loading, setLoading] = useState(true)
  const [warning, setWarning] = useState<string | null>(null)

  const [query, setQuery] = useState('')
  const [formatFilter, setFormatFilter] = useState<'all' | FormatKey>('all')
  const [pageSize, setPageSize] = useState(10)
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<string[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    setWarning(null)

    const [statsRes, savedRes, productsRes, supportRes] = await Promise.allSettled([
      getDashboardStats(),

      // `include_scores` is the admin view: the server strips scores for a
      // delegate, so asking for them here costs nothing and never leaks.
      getSavedSessions(true, { limit: 500 }),
      listProducts(),
      listSupportReports(1)
    ])

    if (statsRes.status === 'fulfilled') setStats(statsRes.value)
    if (savedRes.status === 'fulfilled') setSaved(savedRes.value)
    if (supportRes.status === 'fulfilled') setSupport({ total: supportRes.value.total, open: supportRes.value.open })

    if (productsRes.status === 'fulfilled') {
      // Only the family of each product is needed — it is the second line of the
      // product column in the table, not a figure of its own.
      const gammes: Record<string, string> = {}

      for (const product of (productsRes.value.products ?? []) as Product[]) {
        if (product.name && product.gamme) gammes[product.name] = product.gamme
      }

      setGammeOf(gammes)
    }

    if (statsRes.status === 'rejected' && savedRes.status === 'rejected') {
      setWarning("L'API ALIA ne répond pas — les compteurs restent à zéro jusqu'au prochain essai.")
    }

    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const sessions = useMemo(() => saved?.sessions ?? [], [saved])
  const weekly = useMemo(() => saved?.weekly ?? [], [saved])

  const weekAverage = saved?.week_score ?? saved?.average_score ?? 0
  const sessionsThisWeek = saved?.this_week ?? 0
  const totalSessions = saved?.total ?? stats?.total_sessions ?? 0
  const averageScore = saved?.average_score ?? stats?.average_score ?? null

  /** Bar-per-day activity, with the score as a line that skips empty days. */
  const activity = useMemo(
    () =>
      weekly.map(point => ({
        day: DAY_LABELS[point.day] ?? point.day,
        sessions: point.sessions,
        score: point.score > 0 ? point.score : null
      })),
    [weekly]
  )

  /**
   * Days with no session at all, drawn as the muted "track" the template shows
   * behind a bar. Recharts only renders a Bar's own background for entries that
   * have a value, so the track is a second series overlapped on top of the first
   * (barGap = -barSize) rather than the `background` prop — otherwise the empty
   * days of a quiet week would be invisible instead of visibly empty.
   */
  const trackData = useMemo(() => {
    const busiest = Math.max(1, ...activity.map(point => point.sessions))

    // A constant full-height track behind every bar: the bar covers its lower part
    // and the muted remainder stays visible above it, exactly like the template.
    return activity.map(point => ({ ...point, track: busiest }))
  }, [activity])

  /** Best day of the week — the one bar the template draws in full colour. */
  const bestDayIndex = useMemo(() => {
    let index = -1

    weekly.forEach((point, i) => {
      if (point.sessions > 0 && (index === -1 || point.sessions > weekly[index].sessions)) index = i
    })

    return index
  }, [weekly])

  /**
   * Distance from the objective, split into an up and a down series so the bars
   * grow from a shared baseline: above the target = solid, below = tinted.
   *
   * Anchoring on the target rather than on the week's own average is deliberate:
   * with every session played on a single day, the average *is* that day's score
   * and every bar would be zero-height — an empty chart on a quiet week.
   */
  const scoreOffset = useMemo(
    () =>
      weekly.map(point => {
        const gap = point.score > 0 ? Number((point.score - SCORE_TARGET).toFixed(1)) : 0

        return {
          day: DAY_LABELS[point.day] ?? point.day,
          up: Math.max(0, gap),
          down: Math.min(0, gap)
        }
      }),
    [weekly]
  )

  /** How far the current week sits from the objective, in points of score. */
  const scoreGap = useMemo(() => {
    const score = saved?.week_score ?? saved?.average_score ?? null

    return typeof score === 'number' ? Number((score - SCORE_TARGET).toFixed(1)) : null
  }, [saved])

  const formatRows = useMemo(() => {
    const counted = FORMAT_ORDER.map(key => ({
      key,
      label: FORMAT_META[key].label,
      icon: FORMAT_META[key].icon,
      count: sessions.filter(session => (session.visit_format ?? '').toLowerCase() === key).length
    }))

    const total = counted.reduce((sum, row) => sum + row.count, 0)

    return counted.map(row => ({ ...row, pct: total ? Math.round((row.count / total) * 100) : 0 }))
  }, [sessions])

  const formatTotal = useMemo(() => formatRows.reduce((sum, row) => sum + row.count, 0), [formatRows])

  /** The format bar the template draws in full colour: the busiest one. */
  const busiestFormatIndex = useMemo(() => {
    let index = -1

    formatRows.forEach((row, i) => {
      if (row.count > 0 && (index === -1 || row.count > formatRows[index].count)) index = i
    })

    return index === -1 ? 0 : index
  }, [formatRows])

  /**
   * How much of the volume is played at Confirmé or Expert. It answers the
   * question a responsable actually asks — are people training past Junior? —
   * and it is the only one of these figures that moves for the right reason.
   */
  const levelShare = useMemo(() => {
    const counts = sessions.reduce<Record<string, number>>((accumulator, session) => {
      const key = (session.level ?? '').toLowerCase()

      accumulator[key] = (accumulator[key] ?? 0) + 1

      return accumulator
    }, {})

    const advanced = (counts.confirme ?? 0) + (counts.expert ?? 0)
    const total = sessions.length
    const topLevel = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0]

    return {
      advanced,
      pct: total ? Math.round((advanced / total) * 100) : 0,
      topLevel: topLevel ? (LEVEL_LABELS[topLevel] ?? topLevel) : '—'
    }
  }, [sessions])

  const openReports = support?.open ?? 0
  const avgDuration = saved?.average_duration_seconds ?? null
  const averageRating = saved?.average_rating ?? null
  const ratedCount = saved?.rated ?? 0

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()

    return sessions.filter(session => {
      if (formatFilter !== 'all' && (session.visit_format ?? '').toLowerCase() !== formatFilter) return false
      if (!needle) return true

      return [
        session.session_id,
        session.product_focus,
        session.level,
        LEVEL_LABELS[session.level],
        session.doctor_style
      ].some(value =>
        String(value ?? '')
          .toLowerCase()
          .includes(needle)
      )
    })
  }, [sessions, query, formatFilter])

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const pageItems = filtered.slice((safePage - 1) * pageSize, safePage * pageSize)
  const visibleIds = pageItems.map(item => item.session_id)
  const allOnPageSelected = visibleIds.length > 0 && visibleIds.every(id => selected.includes(id))
  const selectedRows = sessions.filter(session => selected.includes(session.session_id))

  return (
    <>
      {warning && (
        <div className='col-span-full'>
          <div className='text-muted-foreground bg-muted/40 flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm'>
            <span className='flex items-center gap-2'>
              <CircleAlert className='size-4 shrink-0' />
              {warning}
            </span>
            <Button variant='outline' size='sm' className='gap-1.5' onClick={() => void load()} disabled={loading}>
              <RefreshCw className={cn('size-4', loading && 'animate-spin')} />
              Réessayer
            </Button>
          </div>
        </div>
      )}

      {/* ── KPI row ── */}
      <div className='col-span-full grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5'>
        {/* Score du moment, jour par jour au-dessus ou en dessous de la moyenne */}
        <Card className='justify-between'>
          <CardHeader>
            <div className='flex items-center gap-2'>
              <CardTitle className='text-lg font-semibold'>{formatScore(saved?.week_score ?? averageScore)}</CardTitle>
              <span className={cn('text-base', gapClass(scoreGap))}>{gapText(scoreGap)}</span>
            </div>
            <CardDescription className='text-base'>Score de la semaine · objectif {SCORE_TARGET}/10</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <ChartSkeleton className='h-31' />
            ) : (
              <ChartContainer config={SCORE_OFFSET_CONFIG} className='h-31 w-full'>
                <BarChart data={scoreOffset} barCategoryGap={10}>
                  <XAxis dataKey='day' tick={false} axisLine={false} />
                  <YAxis hide domain={['dataMin - 1', 'dataMax + 1']} />
                  <ChartTooltip content={<ChartTooltipContent />} cursor={false} />
                  <Bar dataKey='up' stackId='score' fill='var(--color-up)' radius={[6, 6, 0, 0]} barSize={12} />
                  <Bar dataKey='down' stackId='score' fill='var(--color-down)' radius={[0, 0, 6, 6]} barSize={12} />
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
          <CardContent className='flex items-center justify-between'>
            <span className='text-xl font-semibold'>{ratedCount} évaluations</span>
            <span className='text-primary text-base'>
              {averageRating !== null ? `${averageRating}/5 avis` : 'aucun avis'}
            </span>
          </CardContent>
        </Card>

        {/* Sessions des 7 derniers jours */}
        <Card>
          <CardHeader>
            <CardTitle className='text-lg font-semibold'>Sessions</CardTitle>
            <CardDescription className='text-base'>7 derniers jours</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <ChartSkeleton className='h-21' />
            ) : (
              <ChartContainer config={SESSIONS_CONFIG} className='h-21 w-full'>
                <BarChart data={trackData} barCategoryGap={12} barGap={-12} barSize={12}>
                  <XAxis dataKey='day' hide />
                  <YAxis hide domain={[0, 'dataMax']} />
                  <Bar dataKey='track' fill='color-mix(in oklab, var(--primary) 10%, transparent)' radius={12} />
                  <Bar dataKey='sessions' fill='var(--color-sessions)' radius={12} />
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
          <CardContent className='flex items-center justify-between'>
            <span className='text-xl font-semibold'>{totalSessions} au total</span>
            <span className='text-primary text-base'>+{sessionsThisWeek} cette semaine</span>
          </CardContent>
        </Card>

        {/* Niveau de jeu : la part des sessions au-delà de Junior */}
        <Card className='justify-between'>
          <CardHeader>
            <CardTitle className='text-lg font-semibold'>Niveau des sessions</CardTitle>
            <CardDescription className='text-base'>Confirmé et Expert</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <ChartSkeleton className='h-21' />
            ) : (
              <div className='relative h-21 w-full'>
                <ChartContainer config={COVERAGE_CONFIG} className='h-21 w-full'>
                  <RadialBarChart
                    data={[{ name: 'advanced', value: levelShare.pct, fill: 'var(--color-advanced)' }]}
                    innerRadius='70%'
                    outerRadius='100%'
                    startAngle={90}
                    endAngle={-270}
                  >
                    <RadialBar
                      dataKey='value'
                      cornerRadius={12}
                      background={{ fill: 'color-mix(in oklab, var(--primary) 10%, transparent)' }}
                    />
                  </RadialBarChart>
                </ChartContainer>
                <div className='pointer-events-none absolute inset-0 flex flex-col items-center justify-center'>
                  <span className='text-base font-semibold'>{levelShare.advanced}</span>
                  <span className='text-muted-foreground text-xs'>sessions</span>
                </div>
              </div>
            )}
          </CardContent>
          <CardContent className='flex items-center justify-between'>
            <span className='text-xl font-semibold'>{levelShare.topLevel}</span>
            <span className='text-primary text-base'>{levelShare.pct}% confirmé+</span>
          </CardContent>
        </Card>

        {/* Durée moyenne d'une session */}
        <Card className='justify-between'>
          <CardHeader>
            <Avatar className='rounded-sm after:border-0'>
              <AvatarFallback className={cn('rounded-sm [&>svg]:size-5', TILE_TINTS.clock)}>
                <Clock />
              </AvatarFallback>
            </Avatar>
          </CardHeader>
          <CardContent className='flex flex-1 flex-col justify-around gap-4'>
            <p className='flex flex-col gap-1'>
              <span className='text-base font-semibold'>Durée moyenne</span>
              <span className='text-muted-foreground text-sm'>Par session de formation</span>
              <span className='text-base font-medium'>{formatDuration(avgDuration)}</span>
            </p>
            <Badge className='bg-primary/10 text-primary rounded-sm'>
              {avgDuration && avgDuration >= 600 ? 'objectif 10 min atteint' : 'objectif 10 min'}
            </Badge>
          </CardContent>
        </Card>

        {/* Signalements support — destructive tint when something is waiting */}
        <Card className='justify-between'>
          <CardHeader>
            <Avatar className='rounded-sm after:border-0'>
              <AvatarFallback className={cn('rounded-sm [&>svg]:size-5', TILE_TINTS.alert)}>
                <CircleAlert />
              </AvatarFallback>
            </Avatar>
          </CardHeader>
          <CardContent className='flex flex-1 flex-col justify-around gap-4'>
            <p className='flex flex-col gap-1'>
              <span className='text-base font-semibold'>Signalements ALIA</span>
              <span className='text-muted-foreground text-sm'>Bugs et retours utilisateurs</span>
              <span className='text-base font-medium'>{openReports} à traiter</span>
            </p>
            <Badge
              className={cn(
                'rounded-sm',
                openReports > 0
                  ? 'bg-destructive/10 text-destructive'
                  : 'bg-green-600/10 text-green-600 dark:bg-green-400/10 dark:text-green-400'
              )}
            >
              {openReports > 0 ? `${support?.total ?? 0} reçus au total` : 'Aucun en attente'}
            </Badge>
          </CardContent>
        </Card>
      </div>

      {/* ── Activité + rapport ── */}
      <Card className='col-span-full lg:col-span-4'>
        <div className='grid grid-cols-1 gap-4 md:grid-cols-5'>
          <div className='max-md:border-b md:col-span-3 md:border-r md:pr-4'>
            <CardHeader className='flex justify-between'>
              <div className='flex flex-col gap-1'>
                <CardTitle className='text-lg font-semibold'>Sessions &amp; progression</CardTitle>
                <CardDescription>
                  {sessionsThisWeek} sessions cette semaine · score /10 en surimpression
                </CardDescription>
              </div>
              <Button
                variant='ghost'
                size='icon'
                className='text-muted-foreground size-6 rounded-full'
                aria-label='Menu'
              >
                <EllipsisVertical className='size-4' />
              </Button>
            </CardHeader>
            <CardContent className='max-md:pb-6'>
              {loading ? (
                <ChartSkeleton className='h-83' />
              ) : (
                <ChartContainer config={ACTIVITY_CONFIG} className='h-83 w-full'>
                  <ComposedChart data={activity} barGap={0}>
                    <XAxis
                      dataKey='day'
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontSize: 14, fill: 'hsl(var(--muted-foreground))' }}
                    />
                    <YAxis hide />
                    <ChartTooltip content={<ChartTooltipContent />} cursor={false} />
                    <Bar dataKey='sessions' radius={10} barSize={35}>
                      <LabelList
                        dataKey='sessions'
                        position='top'
                        fontSize={14}
                        className='fill-card-foreground font-semibold'
                      />
                      {activity.map((point, index) => (
                        <Cell
                          key={point.day}
                          fill={
                            index === bestDayIndex
                              ? 'var(--chart-2)'
                              : 'color-mix(in oklab, var(--chart-2) 20%, transparent)'
                          }
                        />
                      ))}
                    </Bar>
                    <Line
                      type='monotone'
                      dataKey='score'
                      stroke='var(--color-score)'
                      strokeWidth={3}
                      connectNulls
                      dot={{ r: 3.5, strokeWidth: 3, fill: 'var(--color-score)' }}
                    />
                  </ComposedChart>
                </ChartContainer>
              )}
            </CardContent>
          </div>

          <div className='flex flex-col gap-8 md:col-span-2'>
            <CardHeader className='flex justify-between'>
              <div className='flex flex-col gap-1'>
                <CardTitle className='text-lg font-semibold'>Rapport</CardTitle>
                <CardDescription>{totalSessions} sessions évaluées à ce jour</CardDescription>
              </div>
              <Button
                variant='ghost'
                size='icon'
                className='text-muted-foreground size-6 rounded-full'
                aria-label='Menu'
              >
                <EllipsisVertical className='size-4' />
              </Button>
            </CardHeader>

            <CardContent className='flex flex-1 items-center text-base'>
              <div className='flex flex-1 justify-around gap-1'>
                <MiniStat icon={Users} chip={TILE_TINTS.users} label='Sessions' value={String(sessionsThisWeek)} />
                <Separator orientation='vertical' className='h-[inherit]!' />
                <MiniStat
                  icon={TrendingUp}
                  chip={TILE_TINTS.score}
                  label='Score moyen'
                  value={formatScore(weekAverage)}
                />
              </div>
            </CardContent>

            <div className='px-6'>
              <Separator />
            </div>

            <div className='flex items-center justify-between gap-2 px-6'>
              <div className='flex flex-col gap-2'>
                <span className='text-muted-foreground text-base'>Score global</span>
                <span className='text-xl font-medium'>{formatScore(averageScore)}/10</span>
              </div>
              <Link href='/dashboard/training/simulator'>
                <Button>Voir le rapport</Button>
              </Link>
            </div>
          </div>
        </div>
      </Card>

      {/* ── Formats de visite ── */}
      <Card className='col-span-full justify-between gap-4 sm:col-span-3 lg:col-span-2'>
        <CardHeader className='flex flex-col'>
          <div className='flex w-full items-center justify-between gap-2'>
            <div className='flex items-center gap-2 text-base'>
              <Avatar className='rounded-sm after:border-0'>
                <AvatarFallback className='bg-chart-2/10 text-chart-2 rounded-sm'>
                  <TrendingUp className='size-4' />
                </AvatarFallback>
              </Avatar>
              <span>Formats de visite</span>
            </div>
            <Link href='/dashboard/training/simulator'>
              <Button variant='outline' size='sm' className='rounded-[min(var(--radius-md),8px)] px-2 text-xs'>
                Détails
              </Button>
            </Link>
          </div>
          <div className='flex items-center gap-2'>
            <span className='text-2xl font-semibold'>{formatTotal}</span>
            <Badge className='bg-primary/10 text-primary rounded-sm'>+{sessionsThisWeek} cette semaine</Badge>
          </div>
        </CardHeader>

        <CardContent className='space-y-4'>
          <Separator />

          <div className='space-y-1'>
            {formatRows.map(row => {
              const Icon = row.icon

              return (
                <div key={row.key} className='flex items-center justify-between gap-2 py-2'>
                  <div className='text-muted-foreground flex items-center gap-2'>
                    <Icon className='size-4' />
                    <span className='text-sm'>{row.label}</span>
                  </div>
                  <div className='flex items-center gap-2 text-sm'>
                    <span className='text-muted-foreground'>{row.count}</span>
                    <span>{row.pct}%</span>
                  </div>
                </div>
              )
            })}
          </div>

          <Separator />

          {loading ? (
            <ChartSkeleton className='h-40' />
          ) : (
            <ChartContainer config={FORMAT_CONFIG} className='h-40 w-full'>
              <BarChart data={formatRows} barCategoryGap={24}>
                <XAxis
                  dataKey='label'
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                />
                <YAxis hide />
                <ChartTooltip content={<ChartTooltipContent />} cursor={false} />
                <Bar dataKey='count' radius={8} barSize={36}>
                  {formatRows.map((row, index) => (
                    <Cell
                      key={row.key}
                      fill={
                        index === busiestFormatIndex
                          ? 'var(--color-count)'
                          : 'color-mix(in oklab, var(--chart-2) 20%, transparent)'
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>

      {/* ── Sessions récentes ── */}
      <Card className='col-span-full py-0'>
        <div className='w-full'>
          <div className='border-b'>
            {/* Barre d'outils */}
            <div className='flex gap-6 p-6 max-lg:flex-col lg:items-center lg:justify-between'>
              <div className='flex flex-wrap items-center gap-4'>
                <div className='flex items-center gap-2'>
                  <Label htmlFor='rows-per-page' className='text-muted-foreground text-base font-normal max-sm:sr-only'>
                    Afficher
                  </Label>
                  <Select
                    value={String(pageSize)}
                    onValueChange={value => {
                      // A new page size means the old page number is meaningless.
                      setPageSize(Number(value ?? 10))
                      setPage(1)
                    }}
                  >
                    <SelectTrigger id='rows-per-page' className='w-fit whitespace-nowrap'>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PAGE_SIZES.map(size => (
                        <SelectItem key={size} value={String(size)}>
                          {size}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Button
                  className='gap-1.5'
                  disabled={loading || filtered.length === 0}
                  onClick={() => downloadCsv(selectedRows.length > 0 ? selectedRows : filtered)}
                >
                  <Download className='size-4' />
                  {selectedRows.length > 0 ? `Exporter (${selectedRows.length})` : 'Exporter le rapport'}
                </Button>

                <Button variant='outline' className='gap-1.5' onClick={() => void load()} disabled={loading}>
                  <RefreshCw className={cn('size-4', loading && 'animate-spin')} />
                  Actualiser
                </Button>
              </div>

              <div className='flex flex-1 flex-wrap items-center gap-4 lg:justify-end'>
                <div className='w-full max-w-2xs'>
                  <Label htmlFor='search-session' className='sr-only'>
                    Rechercher une session
                  </Label>
                  <InputGroup>
                    <InputGroupAddon align='inline-start'>
                      <Search />
                    </InputGroupAddon>
                    <InputGroupInput
                      id='search-session'
                      value={query}
                      onChange={event => {
                        setQuery(event.target.value)
                        setPage(1)
                      }}
                      placeholder='Rechercher un produit, un niveau, une session'
                    />
                  </InputGroup>
                </div>

                <div className='w-full max-w-2xs'>
                  <Label htmlFor='filter-format' className='sr-only'>
                    Format de visite
                  </Label>
                  <Select
                    value={formatFilter}
                    onValueChange={value => {
                      setFormatFilter((value ?? 'all') as 'all' | FormatKey)
                      setPage(1)
                    }}
                  >
                    <SelectTrigger id='filter-format' className='w-full'>
                      <SelectValue>
                        {(value: string) =>
                          value === 'all' ? 'Tous les formats' : (FORMAT_META[value as FormatKey]?.label ?? value)
                        }
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value='all'>Tous les formats</SelectItem>
                      {FORMAT_ORDER.map(key => (
                        <SelectItem key={key} value={key}>
                          {FORMAT_META[key].label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Sélection */}
            {selected.length > 0 && (
              <div className='bg-muted/40 flex flex-wrap items-center justify-between gap-3 border-b px-6 py-3'>
                <p className='text-sm font-medium'>{selected.length} session(s) sélectionnée(s)</p>
                <div className='flex items-center gap-2'>
                  <Button variant='outline' size='sm' className='gap-1.5' onClick={() => downloadCsv(selectedRows)}>
                    <Download className='size-3.5' />
                    Exporter la sélection
                  </Button>
                  <Button variant='ghost' size='sm' onClick={() => setSelected([])}>
                    Annuler
                  </Button>
                </div>
              </div>
            )}

            {/* Table */}
            {loading ? (
              <div className='space-y-2 p-6'>
                {[0, 1, 2, 3].map(row => (
                  <Skeleton key={row} className='h-12 w-full' />
                ))}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className='border-t'>
                    <TableHead className='first:pl-4 last:w-12'>
                      <Checkbox
                        aria-label='Tout sélectionner'
                        checked={allOnPageSelected}
                        indeterminate={
                          pageItems.length > 0 && !allOnPageSelected && visibleIds.some(id => selected.includes(id))
                        }
                        onCheckedChange={checked =>
                          setSelected(previous =>
                            checked
                              ? Array.from(new Set([...previous, ...visibleIds]))
                              : previous.filter(id => !visibleIds.includes(id))
                          )
                        }
                      />
                    </TableHead>
                    <TableHead className='w-28'>Session</TableHead>
                    <TableHead className='w-32'>Format</TableHead>
                    <TableHead className='w-80'>Produit</TableHead>
                    <TableHead className='w-24'>Score</TableHead>
                    <TableHead className='w-36'>Terminée le</TableHead>
                    <TableHead className='w-24'>Note</TableHead>
                    <TableHead className='last:px-4 last:text-center'>Actions</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {pageItems.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className='text-muted-foreground py-10 text-center text-sm'>
                        {totalSessions === 0
                          ? 'Aucune session terminée pour le moment — lancez une simulation pour alimenter ce tableau.'
                          : 'Aucune session ne correspond à ces filtres.'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    pageItems.map(session => {
                      const formatMeta = FORMAT_META[session.visit_format as FormatKey]
                      const gamme = session.product_focus ? gammeOf[session.product_focus] : undefined
                      const tint = tintForGamme(gamme)

                      return (
                        <TableRow
                          key={session.session_id}
                          data-state={selected.includes(session.session_id) ? 'selected' : false}
                          className='h-14'
                        >
                          <TableCell className='first:pl-4'>
                            <Checkbox
                              aria-label={`Sélectionner la session ${session.session_id}`}
                              checked={selected.includes(session.session_id)}
                              onCheckedChange={checked =>
                                setSelected(previous =>
                                  checked
                                    ? [...previous, session.session_id]
                                    : previous.filter(id => id !== session.session_id)
                                )
                              }
                            />
                          </TableCell>

                          <TableCell className='text-muted-foreground font-mono text-xs'>
                            #{session.session_id.slice(0, 8)}
                          </TableCell>

                          <TableCell>
                            <FormatChip visitFormat={session.visit_format} />
                          </TableCell>

                          <TableCell>
                            <div className='flex items-center gap-2'>
                              <Avatar className='size-9'>
                                <AvatarFallback className={cn('rounded-full text-xs', tint)}>
                                  {initialsOf(session.product_focus || 'ALIA')}
                                </AvatarFallback>
                              </Avatar>
                              <div className='flex flex-col'>
                                <span className='font-medium'>{session.product_focus || 'Produit non précisé'}</span>
                                <span className='text-muted-foreground text-xs'>
                                  {gamme ?? LEVEL_LABELS[session.level] ?? '—'}
                                </span>
                              </div>
                            </div>
                          </TableCell>

                          <TableCell>
                            <Badge className={cn('rounded-sm', scoreBadgeClass(session.overall_score))}>
                              {formatScore(session.overall_score)}
                            </Badge>
                          </TableCell>

                          <TableCell className='text-muted-foreground text-sm'>
                            <div className='flex flex-col'>
                              <span>{formatDate(session.completed_at)}</span>
                              <span className='text-xs'>{formatDuration(session.duration_seconds)}</span>
                            </div>
                          </TableCell>

                          <TableCell className='text-muted-foreground text-sm'>
                            {session.rating ? (
                              <span className='flex items-center gap-1'>
                                <Star className='size-3.5 fill-amber-400 text-amber-400' />
                                {session.rating}/5
                              </span>
                            ) : (
                              '—'
                            )}
                          </TableCell>

                          <TableCell className='last:px-4'>
                            <div className='flex items-center justify-center gap-1'>
                              <Link
                                href={`/dashboard/training/sessions/${session.session_id}`}
                                aria-label='Voir le détail de la session'
                                title='Votre note, les étapes, la transcription et la fiche de visite'
                              >
                                <Button variant='ghost' size='icon'>
                                  <Eye className='size-4' />
                                </Button>
                              </Link>
                              {/* A real action rather than a third icon: the session id
                                  is what a responsable pastes into a ticket or a mail. */}
                              <Button
                                variant='ghost'
                                size='icon'
                                aria-label='Copier l’identifiant'
                                title={
                                  formatMeta
                                    ? `Copier l’identifiant · visite ${formatMeta.label}, ${session.messages} échanges`
                                    : `Copier l’identifiant · ${session.messages} échanges`
                                }
                                className='text-muted-foreground'
                                onClick={() => {
                                  void navigator.clipboard
                                    ?.writeText(session.session_id)
                                    .then(() => toast.success('Identifiant de session copié'))
                                    .catch(() => toast.error('Copie impossible dans ce navigateur'))
                                }}
                              >
                                <Copy className='size-4' />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })
                  )}
                </TableBody>
              </Table>
            )}
          </div>

          {/* Pied de table */}
          <div className='flex items-center justify-between gap-3 px-6 py-4 max-sm:flex-col md:max-lg:flex-col'>
            <p className='text-muted-foreground text-sm whitespace-nowrap' aria-live='polite'>
              {filtered.length === 0 ? (
                <>Aucune entrée</>
              ) : (
                <>
                  Affichage <span>{String((safePage - 1) * pageSize + 1)}</span> à{' '}
                  <span>{String(Math.min(safePage * pageSize, filtered.length))}</span> sur{' '}
                  <span>{filtered.length}</span> entrées
                </>
              )}
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

                  {Array.from({ length: totalPages }, (_, index) => index + 1)
                    .slice(Math.max(0, safePage - 2), Math.max(0, safePage - 2) + 3)
                    .map(number => (
                      <li key={number}>
                        <Button
                          variant={number === safePage ? 'default' : 'ghost'}
                          size='icon'
                          aria-current={number === safePage ? 'page' : undefined}
                          className={cn(
                            'size-9',
                            number !== safePage && 'bg-primary/10 text-primary hover:bg-primary/20'
                          )}
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
    </>
  )
}
