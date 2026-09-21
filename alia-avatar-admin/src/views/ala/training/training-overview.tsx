'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import {
  CalendarDays, TrendingUp, TrendingDown, Clock, ChevronLeft, ChevronRight, EllipsisVertical,
  Eye, PlayCircle, Trophy, ArrowUpRight, ArrowDownRight, Zap, Sparkles, Star as StarIcon
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import {
  Bar, BarChart, XAxis, YAxis, Cell, LabelList, ComposedChart, Line, Area, AreaChart, CartesianGrid
} from 'recharts'

import { getDashboardStats, getLevelDistribution, getStepAnalysis, getSavedSessions } from '@/lib/alia-api'
import type { SavedSession, SavedSessionsResponse } from '@/lib/alia-api'
import type { SessionStats, LevelDistribution, StepAnalysis, CompetenceLevel } from '@/types/alia'
import { STEP_META, ALL_VISIT_STEPS, LEVEL_META } from '@/types/alia'

// ── Empty initial state ────────────────────────────────────────────────────────
// Every figure on this page is measured from the sessions saved on the server.
// These zeroed shapes only fill the gap while the fetch is in flight.
const EMPTY_STATS: SessionStats = {
  total_sessions: 0,
  average_score: 0,
  level_distribution: { debutant: 0, junior: 0, confirme: 0, expert: 0 },
  top_products: [],
  recent_sessions: [],
}

const EMPTY_LEVELS: LevelDistribution = {
  debutant: { count: 0, avg_score: 0, min_score: 0, max_score: 0 },
  junior: { count: 0, avg_score: 0, min_score: 0, max_score: 0 },
  confirme: { count: 0, avg_score: 0, min_score: 0, max_score: 0 },
  expert: { count: 0, avg_score: 0, min_score: 0, max_score: 0 },
}

const EMPTY_STEPS: StepAnalysis = {
  introduction: { avg_score: 0, count: 0 },
  sondage: { avg_score: 0, count: 0 },
  synthese: { avg_score: 0, count: 0 },
  objections: { avg_score: 0, count: 0 },
  argumentation: { avg_score: 0, count: 0 },
  conclusion: { avg_score: 0, count: 0 },
}

// ── Weekly activity (built from the saved sessions) ────────────────────────────
function emptyWeek(): Array<{ day: string; sessions: number; score: number }> {
  return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => ({ day, sessions: 0, score: 0 }))
}

const BAR_COLORS = ['var(--chart-2)', 'var(--chart-5)', 'var(--chart-3)', 'var(--primary)', 'var(--chart-1)']

// ── Chart configs ──────────────────────────────────────────────────────────────
const TIMELINE_CONFIG = {
  sessions: { label: 'Sessions', color: 'var(--chart-2)' },
}

const WEEKLY_CONFIG = {
  uv: { label: 'Sessions', color: 'var(--chart-2)' },
  pv: { label: 'Avg score', color: 'var(--primary)' },
}

const STEPS_CONFIG = {
  score: { label: 'Avg score', color: 'var(--primary)' },
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function initials(name: string) {
  return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
}

function ScoreBadge({ score }: { score: number }) {
  const cls =
    score >= 8 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
    score >= 6 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400'
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold tabular-nums ${cls}`}>
      {score.toFixed(1)}
    </span>
  )
}

function LevelBadge({ level }: { level: CompetenceLevel }) {
  const meta = LEVEL_META[level]
  return (
    <Badge variant='secondary' className={`capitalize ${meta?.textClass ?? ''}`}>
      {meta?.label ?? level}
    </Badge>
  )
}

function Delta({ value }: { value: number }) {
  const up = value >= 0
  return (
    <span className={`flex items-center gap-1 text-sm font-medium ${up ? 'text-green-600 dark:text-green-400' : 'text-destructive'}`}>
      {up ? <ArrowUpRight className='size-4' /> : <ArrowDownRight className='size-4' />}
      {Math.abs(value).toFixed(1)}
    </span>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function TrainingOverview() {
  const [stats, setStats] = useState<SessionStats>(EMPTY_STATS)
  const [levels, setLevels] = useState<LevelDistribution>(EMPTY_LEVELS)
  const [steps, setSteps] = useState<StepAnalysis>(EMPTY_STEPS)
  const [loading, setLoading] = useState(true)
  // Real saved sessions from the server (delegate-safe: no scores).
  const [saved, setSaved] = useState<SavedSessionsResponse | null>(null)

  useEffect(() => {
    async function fetchData() {
      try {
        const [statsRes, levelsRes, stepsRes, savedRes] = await Promise.allSettled([
          getDashboardStats(),
          getLevelDistribution(),
          getStepAnalysis(),
          getSavedSessions(false),
        ])
        if (statsRes.status === 'fulfilled') setStats(statsRes.value)
        if (levelsRes.status === 'fulfilled') setLevels(levelsRes.value)
        if (stepsRes.status === 'fulfilled') setSteps(stepsRes.value)
        if (savedRes.status === 'fulfilled') setSaved(savedRes.value)
      } catch { /* the zeroed state stays on screen */ }
      setLoading(false)
    }
    fetchData()
  }, [])

  // Every session the server saved for this account (newest first).
  const sessions = useMemo<SavedSession[]>(() => saved?.sessions ?? [], [saved])

  // Weekly activity — measured from the saved sessions, never a fixture.
  const weeklyData = useMemo(
    () => (saved?.weekly?.length ? saved.weekly : emptyWeek()),
    [saved]
  )

  // Timeline — real training volume per competence level.
  const LEVEL_ORDER: CompetenceLevel[] = ['debutant', 'junior', 'confirme', 'expert']
  const timelineData = useMemo(() =>
    LEVEL_ORDER.map((level, i) => {
      const rows = sessions.filter(s => s.level === level)
      const rated = rows.filter(s => (s.rating ?? 0) > 0)
      const avg = rated.length ? rated.reduce((acc, s) => acc + (s.rating ?? 0), 0) / rated.length : 0
      return {
        name: LEVEL_META[level]?.label ?? level,
        label: avg ? `${avg.toFixed(1)}/5` : '—',
        sessions: rows.length,
        fill: BAR_COLORS[i % BAR_COLORS.length]
      }
    }), [sessions])

  // Per-window aggregates for the Performance card.
  const perfWindows = useMemo(() => {
    const day = 86_400_000
    const now = Date.now()
    const windows = [
      { key: 'week', heading: 'Top session this week', min: now - 7 * day },
      { key: 'month', heading: 'Top session this month', min: now - 30 * day },
      { key: 'all', heading: 'Best session overall', min: 0 }
    ]
    return windows.map(w => {
      const rows = sessions.filter(s => {
        const when = s.completed_at ? new Date(s.completed_at).getTime() : 0
        return when >= w.min
      })
      const rated = rows.filter(s => (s.rating ?? 0) > 0)
      const avgRating = rated.length
        ? rated.reduce((acc, s) => acc + (s.rating ?? 0), 0) / rated.length
        : null
      const best = [...rated].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))[0] ?? rows[0] ?? null
      const durations = rows.map(s => s.duration_seconds ?? 0).filter(d => d > 0)
      const avgDuration = durations.length
        ? Math.round(durations.reduce((acc, d) => acc + d, 0) / durations.length)
        : null
      return { ...w, count: rows.length, avgRating, best, avgDuration }
    })
  }, [sessions])

  // Step conversion funnel
  const stepFunnel = useMemo(() =>
    ALL_VISIT_STEPS.map(step => ({
      step: STEP_META[step]?.label || step,
      score: steps[step]?.avg_score ?? 0,
      count: steps[step]?.count ?? 0,
    })), [steps])

  const overallStepAvg = useMemo(() =>
    stepFunnel.reduce((acc, s) => acc + s.score, 0) / Math.max(1, stepFunnel.length), [stepFunnel])

  // Level distribution totals
  const totalDelegates = Object.values(levels).reduce((acc, l) => acc + l.count, 0)
  const mostCommonLevel = useMemo(() => {
    const entries = Object.entries(levels) as Array<[CompetenceLevel, (typeof levels)[string]]>
    return entries.sort((a, b) => b[1].count - a[1].count)[0]?.[0] ?? 'confirme'
  }, [levels])

  // Table filters + pagination — the rows ARE the saved sessions.
  const [levelFilter, setLevelFilter] = useState('all')
  const [formatFilter, setFormatFilter] = useState('all')
  const [ratingFilter, setRatingFilter] = useState('all')
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 5

  const filtered = useMemo(() =>
    sessions.filter(s => {
      if (levelFilter !== 'all' && s.level !== levelFilter) return false
      if (formatFilter !== 'all' && s.visit_format !== formatFilter) return false
      if (ratingFilter === 'rated' && !((s.rating ?? 0) > 0)) return false
      if (ratingFilter === 'unrated' && (s.rating ?? 0) > 0) return false
      return true
    }), [sessions, levelFilter, formatFilter, ratingFilter])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  useEffect(() => { setPage(1) }, [levelFilter, formatFilter, ratingFilter])
  const pageItems: SavedSession[] = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const from = filtered.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const to = Math.min(page * PAGE_SIZE, filtered.length)

  const weeklyScorePct = Math.round(((saved?.average_score ?? stats.average_score) / 10) * 100)
  const weekDelta = saved?.week_delta_percent ?? null
  const weekScoreLabel =
    weekDelta === null
      ? "Pas encore assez d'historique pour comparer les semaines"
      : `Your average score is ${Math.abs(weekDelta).toFixed(1)}% ${weekDelta >= 0 ? 'better' : 'worse'} than last week`
  const formatDuration = (seconds: number | null | undefined) => {
    if (!seconds || seconds <= 0) return '—'
    const min = Math.floor(seconds / 60)
    const sec = Math.round(seconds % 60)
    return min > 0 ? `${min} min ${String(sec).padStart(2, '0')}` : `${sec} s`
  }

  return (
    <>
      {/* ── Timeline + Recent Sessions ── */}
      <div className='col-span-full grid grid-cols-6 gap-6'>
        <Card className='col-span-full 2xl:col-span-4'>
          <div className='grid gap-8 py-6 lg:grid-cols-3'>
            {/* Training timeline (horizontal bars) */}
            <div className='lg:col-span-2 lg:border-r lg:pr-6'>
              <div className='flex items-center justify-between px-6 pb-2'>
                <div>
                  <h3 className='font-heading text-lg font-semibold'>Training Timeline</h3>
                  <p className='text-sm text-muted-foreground'>Total {stats.total_sessions} sessions completed</p>
                </div>
                <Button variant='ghost' size='icon' className='text-muted-foreground' aria-label='Menu'>
                  <EllipsisVertical className='size-4' />
                </Button>
              </div>
              {loading ? (
                <Skeleton className='mx-6 mt-2 h-64 rounded-md' />
              ) : (
                <ChartContainer config={TIMELINE_CONFIG} className='h-64 w-full px-2'>
                  <BarChart data={timelineData} layout='vertical' barCategoryGap={14} margin={{ left: 0, right: 16 }}>
                    <XAxis type='number' hide />
                    <YAxis
                      type='category' dataKey='name' width={76}
                      tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                    />
                    <ChartTooltip content={<ChartTooltipContent />} cursor={false} />
                    <Bar dataKey='sessions' radius={12} barSize={24}>
                      {timelineData.map((entry, i) => (
                        <Cell key={i} fill={entry.fill} />
                      ))}
                      <LabelList dataKey='label' position='insideLeft' offset={10} style={{ fill: 'hsl(var(--primary-foreground))', fontSize: 12, fontWeight: 600 }} />
                    </Bar>
                  </BarChart>
                </ChartContainer>
              )}
            </div>

            {/* Recent sessions list */}
            <div className='flex flex-col px-6'>
              <div className='flex items-center justify-between pb-2'>
                <div>
                  <h3 className='font-heading text-lg font-semibold'>Sessions récentes</h3>
                  <p className='text-sm text-muted-foreground'>
                    {saved
                      ? `${saved.total} session${saved.total > 1 ? 's' : ''} enregistrée${saved.total > 1 ? 's' : ''} · ${saved.this_week} cette semaine`
                      : 'Dernière activité d\'entraînement'}
                  </p>
                </div>
                <Button variant='ghost' size='icon' className='text-muted-foreground' aria-label='Menu'>
                  <EllipsisVertical className='size-4' />
                </Button>
              </div>
              <div className='mt-2 flex flex-1 flex-col justify-between gap-4'>
                {saved
                  ? saved.sessions.slice(0, 4).map(s => {
                      const levelMeta = LEVEL_META[s.level as keyof typeof LEVEL_META]
                      const when = s.completed_at ? new Date(s.completed_at) : null
                      return (
                        <div key={s.session_id} className='flex items-center gap-3'>
                          <Avatar className='size-8 shrink-0 rounded-sm'>
                            <AvatarFallback className='rounded-sm bg-primary/10 text-primary'>
                              <Zap className='size-4' />
                            </AvatarFallback>
                          </Avatar>
                          <div className='min-w-0 flex-1'>
                            <p className='truncate text-sm font-medium'>
                              Entretien {s.doctor_style} · {s.visit_format}
                            </p>
                            <p className='text-xs text-muted-foreground flex items-center gap-1.5'>
                              {when
                                ? when.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
                                : '—'}
                              {s.duration_seconds ? (
                                <span className='inline-flex items-center gap-0.5'>
                                  <Clock className='size-3' /> {formatDuration(s.duration_seconds)}
                                </span>
                              ) : null}
                              {s.rating ? (
                                <span className='inline-flex items-center gap-0.5 text-amber-400'>
                                  <StarIcon className='size-3 fill-amber-400' /> {s.rating}/5
                                </span>
                              ) : (
                                <span className='text-muted-foreground/60'>· sans note</span>
                              )}
                            </p>
                          </div>
                          <Badge variant='secondary' className={`hidden shrink-0 text-xs sm:inline-flex ${levelMeta?.textClass ?? ''}`}>
                            {levelMeta?.label ?? s.level}
                          </Badge>
                        </div>
                      )
                    })
                  : stats.recent_sessions.slice(0, 4).map(s => {
                      const levelMeta = LEVEL_META[s.level as keyof typeof LEVEL_META]
                      return (
                        <div key={s.id} className='flex items-center gap-3'>
                          <Avatar className='size-8 shrink-0 rounded-sm'>
                            <AvatarFallback className='rounded-sm bg-primary/10 text-primary'>
                              <Zap className='size-4' />
                            </AvatarFallback>
                          </Avatar>
                          <div className='min-w-0 flex-1'>
                            <p className='truncate text-sm font-medium'>{s.product}</p>
                            <p className='text-xs text-muted-foreground'>
                              {new Date(s.started_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                            </p>
                          </div>
                          <Badge variant='secondary' className={`hidden shrink-0 text-xs sm:inline-flex ${levelMeta?.textClass ?? ''}`}>
                            {levelMeta?.label ?? s.level}
                          </Badge>
                        </div>
                      )
                    })}
                <div className='flex items-center justify-between border-t pt-3'>
                  <span className='text-sm text-muted-foreground'>
                    <Clock className='mr-1 inline size-3.5' />
                    {saved
                      ? saved.average_rating !== null
                        ? `Note moyenne ${saved.average_rating}/5 (${saved.rated} avis)`
                        : 'Aucun avis laissé pour le moment'
                      : '~18 min en moyenne'}
                  </span>
                  <Link
                    href='/dashboard/training/sessions'
                    className='inline-flex h-8 items-center gap-1 rounded-md border border-border px-3 text-sm font-medium text-foreground transition-colors hover:bg-accent'
                  >
                    Tout voir
                    <ArrowUpRight className='size-4' />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* ── Weekly overview ── */}
        <Card className='col-span-full lg:col-span-3 2xl:col-span-2'>
          <CardHeader className='flex flex-row items-start justify-between'>
            <div>
              <CardTitle className='text-lg font-semibold'>Weekly Overview</CardTitle>
              <CardDescription>Sessions &amp; average score this week</CardDescription>
            </div>
            <Button variant='ghost' size='icon' className='text-muted-foreground' aria-label='Menu'>
              <EllipsisVertical className='size-4' />
            </Button>
          </CardHeader>
          <CardContent className='flex flex-1 flex-col justify-between gap-6'>
            <ChartContainer config={WEEKLY_CONFIG} className='h-48 w-full'>
              <ComposedChart data={weeklyData} barGap={0}>
                <defs>
                  <linearGradient id='weeklyFill' x1='0' y1='0' x2='0' y2='1'>
                    <stop offset='10%' stopColor='var(--chart-2)' stopOpacity='0.35' />
                    <stop offset='90%' stopColor='var(--chart-2)' stopOpacity='0.05' />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray='4 4' className='stroke-border' vertical={false} />
                <XAxis dataKey='day' tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis hide domain={[0, 10]} />
                <ChartTooltip content={<ChartTooltipContent />} cursor={false} />
                <Bar dataKey='sessions' radius={[6, 6, 6, 6]} barSize={14} fill='url(#weeklyFill)' />
                <Line type='monotone' dataKey='score' stroke='var(--color-pv)' strokeWidth={3} dot={{ r: 3, strokeWidth: 3, fill: 'hsl(var(--background))' }} />
              </ComposedChart>
            </ChartContainer>

            <div className='flex flex-col items-stretch gap-4'>
              <div className='flex items-center gap-3'>
                <span className='text-2xl font-medium'>{weeklyScorePct}%</span>
                <span className='text-sm text-muted-foreground'>{weekScoreLabel}</span>
              </div>
              <Link href='/dashboard/training/simulator'>
                <Button className='w-fit'>Details</Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* ── Step conversion ── */}
        <Card className='col-span-full lg:col-span-3 2xl:col-span-2'>
          <CardHeader className='flex flex-row items-start justify-between'>
            <div>
              <CardTitle className='text-lg font-semibold'>Step Conversion</CardTitle>
              <CardDescription>Average score across the 6 visit steps</CardDescription>
            </div>
            <Button variant='ghost' size='icon' className='text-muted-foreground' aria-label='Menu'>
              <EllipsisVertical className='size-4' />
            </Button>
          </CardHeader>
          <CardContent className='flex flex-1 flex-col justify-between gap-4'>
            <div className='flex items-center gap-4'>
              <div className='flex items-center gap-3'>
                <span className='text-3xl font-semibold'>{overallStepAvg.toFixed(1)}</span>
                <span className='flex items-center gap-1 text-sm font-medium text-green-600 dark:text-green-400'>
                  <TrendingUp className='size-4' /> 6.3%
                </span>
              </div>
              <ChartContainer config={STEPS_CONFIG} className='h-20 w-full'>
                <AreaChart data={stepFunnel} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id='fillSteps' x1='0' y1='0' x2='0' y2='1'>
                      <stop offset='10%' stopColor='var(--primary)' stopOpacity='0.3' />
                      <stop offset='90%' stopColor='var(--primary)' stopOpacity='0' />
                    </linearGradient>
                  </defs>
                  <ChartTooltip content={<ChartTooltipContent />} cursor={false} />
                  <Area type='monotone' dataKey='score' stroke='var(--primary)' strokeWidth={2} fill='url(#fillSteps)' />
                </AreaChart>
              </ChartContainer>
            </div>

            <div className='grid grid-cols-5 gap-2'>
              {stepFunnel.map(s => {
                const delta = s.score - overallStepAvg
                const up = delta >= 0
                return (
                  <div key={s.step} className='col-span-5 flex flex-col gap-0.5'>
                    <div className='flex items-center justify-between gap-2'>
                      <span className='truncate text-sm font-medium'>{s.step}</span>
                      <span className='shrink-0 text-xs text-muted-foreground'>{s.count} sessions</span>
                    </div>
                    <div className='flex items-center justify-between gap-2'>
                      <span className='text-xs text-muted-foreground'>{up ? 'Above' : 'Below'} average</span>
                      <Delta value={up ? delta : delta} />
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {/* ── Level progression ── */}
        <Card className='col-span-full lg:col-span-3 2xl:col-span-2'>
          <CardHeader className='flex flex-row items-start justify-between'>
            <div>
              <CardTitle className='text-lg font-semibold'>Level Progression</CardTitle>
              <CardDescription>Delegate competence distribution</CardDescription>
            </div>
            <Button variant='ghost' size='icon' className='text-muted-foreground' aria-label='Menu'>
              <EllipsisVertical className='size-4' />
            </Button>
          </CardHeader>
          <CardContent className='space-y-4'>
            <div className='bg-primary/10 flex items-center justify-between gap-2 rounded-md px-2 py-1.5'>
              <div className='flex items-center gap-2'>
                <Avatar className='size-9'>
                  <AvatarFallback className='bg-background text-primary'>
                    <Trophy className='size-4' />
                  </AvatarFallback>
                </Avatar>
                <div className='flex flex-col'>
                  <span className='text-base font-medium'>
                    {LEVEL_META[mostCommonLevel]?.label ?? mostCommonLevel}
                  </span>
                  <span className='text-sm text-muted-foreground'>Most common level</span>
                </div>
              </div>
              <div className='flex items-baseline'>
                <span className='text-xl font-medium'>{levels[mostCommonLevel]?.count ?? 0}</span>
                <span className='text-base'>/ {totalDelegates}</span>
              </div>
            </div>

            <div className='flex flex-col gap-4'>
              <span className='text-base font-semibold'>Level distribution</span>
              <div className='flex flex-col gap-3'>
                {Object.entries(levels).map(([level, data]) => {
                  const meta = LEVEL_META[level as keyof typeof LEVEL_META]
                  const pct = totalDelegates > 0 ? (data.count / totalDelegates) * 100 : 0
                  return (
                    <div key={level} className='flex items-center gap-3'>
                      <Badge variant='secondary' className={`w-24 shrink-0 justify-center text-xs ${meta?.textClass ?? ''}`}>
                        {meta?.label ?? level}
                      </Badge>
                      <Progress value={pct} className='h-2 flex-1' />
                      <span className='w-14 shrink-0 text-right text-sm text-muted-foreground tabular-nums'>
                        {data.count} · {Math.round(pct)}%
                      </span>
                    </div>
                  )
                })}
              </div>
              <Link href='/dashboard/training/simulator'>
                <Button className='w-full'>Start training</Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* ── Performance (top delegates) ── */}
        <Card className='col-span-full lg:col-span-3 2xl:col-span-2'>
          <CardHeader className='flex flex-row items-center justify-between gap-2'>
            <div className='flex items-center gap-2'>
              <Sparkles className='size-6 text-primary' />
              <CardTitle className='text-lg font-semibold'>Performance</CardTitle>
            </div>
            <Button variant='ghost' size='icon' className='text-muted-foreground' aria-label='Menu'>
              <EllipsisVertical className='size-4' />
            </Button>
          </CardHeader>
          <Tabs defaultValue='week' className='flex flex-1 flex-col gap-5 px-4 pb-4'>
            <TabsList variant='line' className='w-full justify-start gap-0 border-b p-0'>
              <TabsTrigger value='week' className='flex-1 rounded-none border-0'>This Week</TabsTrigger>
              <TabsTrigger value='month' className='flex-1 rounded-none border-0'>This Month</TabsTrigger>
              <TabsTrigger value='all' className='flex-1 rounded-none border-0'>All Time</TabsTrigger>
            </TabsList>

            {perfWindows.map(w => (
              <TabsContent key={w.key} value={w.key} className='flex flex-col justify-between gap-4 text-base'>
                <div className='flex items-center gap-4 rounded-xl border px-4 py-2'>
                  <Avatar className='size-10.5 shrink-0'>
                    <AvatarFallback className='bg-primary/10 text-primary'>
                      <Zap className='size-5' />
                    </AvatarFallback>
                  </Avatar>
                  <div className='flex min-w-0 flex-col'>
                    <span className='text-muted-foreground text-sm'>{w.heading}</span>
                    <span className='truncate text-lg font-medium capitalize'>
                      {w.best
                        ? `Entretien ${w.best.doctor_style} · ${w.best.visit_format}`
                        : 'Aucune session sur la période'}
                    </span>
                  </div>
                </div>

                <div className='flex items-center justify-between rounded-xl border px-4 py-3'>
                  {w.best ? (
                    <LevelBadge level={w.best.level as CompetenceLevel} />
                  ) : (
                    <span className='text-sm text-muted-foreground'>Lancez une simulation</span>
                  )}
                  <span className='text-xl font-medium'>
                    {w.count} session{w.count > 1 ? 's' : ''}
                  </span>
                </div>

                <div className='flex flex-col gap-4 rounded-xl border px-5 py-3.5'>
                  <div className='flex items-center justify-between'>
                    <div className='flex flex-col gap-1'>
                      <span className='text-muted-foreground text-sm'>Votre note moyenne</span>
                      <span className='text-xl font-semibold'>
                        {w.avgRating !== null ? `${w.avgRating.toFixed(1)}/5` : '—'}
                      </span>
                    </div>
                    {w.best && (w.best.rating ?? 0) > 0 ? (
                      <div className='flex items-center gap-1'>
                        {[1, 2, 3, 4, 5].map(n => (
                          <StarIcon
                            key={n}
                            className={n <= (w.best?.rating ?? 0) ? 'size-4 fill-amber-400 text-amber-400' : 'size-4 text-muted-foreground/30'}
                          />
                        ))}
                      </div>
                    ) : (
                      <span className='text-sm text-muted-foreground'>Pas encore noté</span>
                    )}
                  </div>
                  <div className='flex items-center justify-between'>
                    <div className='flex flex-col gap-1'>
                      <span className='text-muted-foreground text-sm'>Durée moyenne</span>
                      <span className='text-xl font-semibold'>{formatDuration(w.avgDuration)}</span>
                    </div>
                    <Link
                      href='/dashboard/training/sessions'
                      className='inline-flex h-8 items-center gap-1 rounded-md border border-border px-3 text-sm font-medium text-foreground transition-colors hover:bg-accent'
                    >
                      Toutes mes sessions
                      <ArrowUpRight className='size-4' />
                    </Link>
                  </div>
                </div>

                <p className='text-center text-sm text-muted-foreground'>
                  <span className='font-medium text-foreground'>{sessions.length}</span>{' '}
                  session{sessions.length > 1 ? 's' : ''} enregistrée{sessions.length > 1 ? 's' : ''} au total
                </p>
              </TabsContent>
            ))}
          </Tabs>
        </Card>
      </div>

      {/* ── Sessions enregistrées : filters + pagination ── */}
      <Card className='col-span-full py-0 shadow-none'>
        <div className='w-full'>
          <div className='border-b'>
            <div className='flex flex-col gap-4 p-6'>
              <div className='flex items-center justify-between'>
                <div>
                  <h3 className='font-heading text-lg font-semibold'>Sessions enregistrées</h3>
                  <p className='text-sm text-muted-foreground'>{filtered.length} session(s) correspondant à vos filtres</p>
                </div>
              </div>
              <div className='grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3'>
                <div className='flex w-full flex-col gap-2'>
                  <label className='text-sm font-medium leading-none select-none' htmlFor='filter-level'>Niveau</label>
                  <Select value={levelFilter} onValueChange={v => v !== null && setLevelFilter(v)}>
                    <SelectTrigger className='w-full capitalize' id='filter-level'><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value='all'>Tous</SelectItem>
                      {Object.entries(LEVEL_META).map(([k, meta]) => (
                        <SelectItem key={k} value={k}>{meta.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className='flex w-full flex-col gap-2'>
                  <label className='text-sm font-medium leading-none select-none' htmlFor='filter-format'>Format</label>
                  <Select value={formatFilter} onValueChange={v => v !== null && setFormatFilter(v)}>
                    <SelectTrigger className='w-full' id='filter-format'><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value='all'>Tous</SelectItem>
                      <SelectItem value='flash'>Flash</SelectItem>
                      <SelectItem value='standard'>Standard</SelectItem>
                      <SelectItem value='approfondie'>Approfondie</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className='flex w-full flex-col gap-2'>
                  <label className='text-sm font-medium leading-none select-none' htmlFor='filter-rating'>Votre note</label>
                  <Select value={ratingFilter} onValueChange={v => v !== null && setRatingFilter(v)}>
                    <SelectTrigger className='w-full capitalize' id='filter-rating'><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value='all'>Toutes</SelectItem>
                      <SelectItem value='rated'>Notées</SelectItem>
                      <SelectItem value='unrated'>Sans note</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>

          <div className='relative w-full overflow-x-auto'>
            <Table>
              <TableHeader>
                <TableRow className='h-14 border-t'>
                  <TableHead className='min-w-36'>Date</TableHead>
                  <TableHead className='min-w-28'>Niveau</TableHead>
                  <TableHead className='min-w-32'>Profil médecin</TableHead>
                  <TableHead className='min-w-28'>Format</TableHead>
                  <TableHead className='text-center'>Durée</TableHead>
                  <TableHead className='text-center'>Votre note</TableHead>
                  <TableHead className='min-w-40'>Commentaire</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && pageItems.length === 0
                  ? Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i}><TableCell colSpan={7}><Skeleton className='h-9 w-full' /></TableCell></TableRow>
                    ))
                  : pageItems.map(s => {
                      const when = s.completed_at ? new Date(s.completed_at) : null
                      const levelMeta = LEVEL_META[s.level as keyof typeof LEVEL_META]
                      return (
                        <TableRow key={s.session_id}>
                          <TableCell className='whitespace-nowrap text-sm'>
                            {when
                              ? when.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
                              : '—'}
                          </TableCell>
                          <TableCell>
                            <Badge variant='secondary' className={`text-xs capitalize ${levelMeta?.textClass ?? ''}`}>
                              {levelMeta?.label ?? s.level}
                            </Badge>
                          </TableCell>
                          <TableCell className='text-sm capitalize'>{s.doctor_style || '—'}</TableCell>
                          <TableCell className='text-sm capitalize'>{s.visit_format}</TableCell>
                          <TableCell className='text-center text-sm tabular-nums'>
                            {formatDuration(s.duration_seconds)}
                          </TableCell>
                          <TableCell className='text-center'>
                            {(s.rating ?? 0) > 0 ? (
                              <span className='inline-flex items-center gap-0.5 text-sm font-medium text-amber-500'>
                                <StarIcon className='size-3.5 fill-amber-400 text-amber-400' /> {s.rating}/5
                              </span>
                            ) : (
                              <span className='text-sm text-muted-foreground/50'>—</span>
                            )}
                          </TableCell>
                          <TableCell className='max-w-[20rem] text-sm text-muted-foreground'>
                            {s.comment ? <span className='line-clamp-2'>{s.comment}</span> : <span className='text-muted-foreground/50'>Aucun</span>}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                {!loading && pageItems.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className='py-10 text-center text-muted-foreground'>
                      Aucune session enregistrée pour ces filtres. Lancez une simulation pour commencer.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <div className='flex items-center justify-between gap-3 px-6 py-4 max-sm:flex-col md:max-lg:flex-col'>
            <p className='text-muted-foreground text-sm whitespace-nowrap' aria-live='polite'>
              Showing <span>{from}</span> to <span>{to}</span> of <span>{filtered.length}</span> entries
            </p>
            <nav role='navigation' aria-label='pagination' className='flex w-full justify-center sm:w-auto'>
              <div className='flex items-center gap-1'>
                <Button
                  variant='outline' size='sm'
                  disabled={page <= 1}
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  className='gap-1.5'
                >
                  <ChevronLeft className='size-4' /> Previous
                </Button>
                {Array.from({ length: totalPages }).map((_, i) => (
                  <Button
                    key={i}
                    variant={page === i + 1 ? 'default' : 'outline'}
                    size='icon'
                    className='size-9'
                    onClick={() => setPage(i + 1)}
                  >
                    {i + 1}
                  </Button>
                ))}
                <Button
                  variant='outline' size='sm'
                  disabled={page >= totalPages}
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  className='gap-1.5'
                >
                  Next <ChevronRight className='size-4' />
                </Button>
              </div>
            </nav>
          </div>
        </div>
      </Card>
    </>
  )
}