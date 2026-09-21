'use client'

// ──────────────────────────────────────────────
// General Overview — the delegate's home dashboard.
// Card structure mirrors the admin reference layout:
//   1. Hero card : activity chart (2/3) + list (1/3)
//   2. Weekly overview (1/2) + Level mix (1/2)
//   3. Product lines (1/2) + Quick actions (1/2)
//   4. Full-width sessions table with 3 Select filters
//      + pagination
// All real data (`saved-sessions` + `products`).
// ──────────────────────────────────────────────

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  PlayCircle, Star, CalendarDays, Pill, ChevronRight, RefreshCw, Zap,
  MessageSquare, BookOpen, ShoppingCart, Timer, TrendingUp, TrendingDown,
  EllipsisVertical, Trophy, Target
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Progress } from '@/components/ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { Bar, BarChart, XAxis, YAxis, CartesianGrid, ComposedChart, Line, LabelList, Cell } from 'recharts'

import { getSavedSessions, listProducts } from '@/lib/alia-api'
import type { SavedSession, SavedSessionsResponse } from '@/lib/alia-api'
import type { Product } from '@/types/alia'
import { LEVEL_META } from '@/types/alia'

const LEVEL_ORDER = ['debutant', 'junior', 'confirme', 'expert'] as const
const LEVEL_META_Typed = LEVEL_META as Record<string, { label?: string }>

function fmtDuration(seconds?: number | null): string {
  if (!seconds) return '—'
  const m = Math.floor(seconds / 60)
  const s = Math.round(seconds % 60)
  return m > 0 ? `${m} min ${String(s).padStart(2, '0')}` : `${s} s`
}

function Stars({ value }: { value: number | null }) {
  if (!value) return <span className='text-xs text-muted-foreground'>—</span>
  return (
    <span className='inline-flex items-center gap-0.5' title={`${value} / 5`}>
      {[1, 2, 3, 4, 5].map(n => (
        <Star key={n} className={`size-3.5 ${n <= value ? 'text-amber-400 fill-amber-400' : 'text-muted-foreground/30'}`} />
      ))}
    </span>
  )
}

const TIMELINE_CONFIG = { sessions: { label: 'Sessions' } }
const WEEKLY_CONFIG = {
  sessions: { label: 'Sessions', color: 'color-mix(in oklab, var(--chart-2) 20%, var(--background))' },
  rating: { label: 'Note', color: 'var(--chart-2)' }
}

export default function GeneralOverview() {
  const [saved, setSaved] = useState<SavedSessionsResponse | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  // Table filters
  const [levelFilter, setLevelFilter] = useState('all')
  const [formatFilter, setFormatFilter] = useState('all')
  const [ratedFilter, setRatedFilter] = useState('all')
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 5

  const load = () => {
    setLoading(true)
    setError(false)
    Promise.allSettled([getSavedSessions(false), listProducts()])
      .then(([s, p]) => {
        if (s.status === 'fulfilled') setSaved(s.value)
        if (p.status === 'fulfilled') setProducts(p.value.products ?? [])
      })
      .finally(() => setLoading(false))
  }

  useEffect(load, [])
  useEffect(() => { setPage(1) }, [levelFilter, formatFilter, ratedFilter])

  const m = useMemo(() => {
    const sessions: SavedSession[] = saved?.sessions ?? []
    const total = sessions.length
    const rated = sessions.filter(s => (s.rating ?? 0) > 0)
    const avgRating = rated.length
      ? rated.reduce((a, s) => a + (s.rating ?? 0), 0) / rated.length
      : null
    const durations = sessions.map(s => s.duration_seconds).filter((d): d is number => !!d)
    const avgDuration = durations.length
      ? durations.reduce((a, b) => a + b, 0) / durations.length
      : null
    const thisWeek = saved?.this_week ?? 0
    const prevWeek = Math.max(total - thisWeek, 0)
    const weekDelta = prevWeek > 0 ? Math.round(((thisWeek - prevWeek) / prevWeek) * 100) : thisWeek > 0 ? 100 : 0

    const perLevel = Object.fromEntries(
      LEVEL_ORDER.map(l => [l, sessions.filter(s => s.level === l).length])
    ) as Record<string, number>
    const levelsTotal = Object.values(perLevel).reduce((a, b) => a + b, 0)
    const mostActive = LEVEL_ORDER.reduce((best, l) => (perLevel[l] > (perLevel[best] ?? 0) ? l : best), 'debutant' as string)

    // Hero timeline chart — one bar per competence level
    const BAR_COLORS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-5)']
    const timelineData = LEVEL_ORDER.map((level, i) => {
      const rows = sessions.filter(s => s.level === level)
      const r = rows.filter(s => (s.rating ?? 0) > 0)
      const avg = r.length ? r.reduce((acc, s) => acc + (s.rating ?? 0), 0) / r.length : 0
      return {
        name: LEVEL_META_Typed[level]?.label ?? level,
        label: avg ? `${avg.toFixed(1)}/5` : '—',
        sessions: rows.length,
        fill: BAR_COLORS[i % BAR_COLORS.length]
      }
    })

    // Weekly composed chart
    const weekly = (saved?.weekly ?? []).map(p => ({
      day: p.day,
      sessions: p.sessions,
      rating: p.score > 0 ? p.score : null
    }))

    // Gammes (product lines)
    const gammes = new Map<string, number>()
    for (const p of products) {
      const g = p.gamme || 'Autres'
      gammes.set(g, (gammes.get(g) ?? 0) + 1)
    }
    const topGammes = [...gammes.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4)

    // Highlights (best session / total time / active days)
    const ratedSessions = (saved?.sessions ?? []).filter(s => (s.rating ?? 0) > 0)
    const bestSession = ratedSessions.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))[0] ?? null
    const totalSeconds = (saved?.sessions ?? []).reduce((acc, s) => acc + (s.duration_seconds ?? 0), 0)
    const dayKeys = new Set<string>()
    for (const s of saved?.sessions ?? []) {
      if (s.completed_at) dayKeys.add(new Date(s.completed_at).toDateString())
    }
    const activeDays = dayKeys.size

    return { total, avgRating, avgDuration, thisWeek, weekDelta, perLevel, levelsTotal, mostActive, timelineData, weekly, topGammes, bestSession, totalSeconds, activeDays }
  }, [saved, products])

  // ── Table filtering + pagination ──
  const sessions = useMemo(() => saved?.sessions ?? [], [saved])
  const filtered = useMemo(() =>
    sessions.filter(s => {
      if (levelFilter !== 'all' && s.level !== levelFilter) return false
      if (formatFilter !== 'all' && s.visit_format !== formatFilter) return false
      if (ratedFilter === 'rated' && !((s.rating ?? 0) > 0)) return false
      if (ratedFilter === 'unrated' && (s.rating ?? 0) > 0) return false
      return true
    }), [sessions, levelFilter, formatFilter, ratedFilter])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const pageItems = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)
  const from = filtered.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1
  const to = Math.min(safePage * PAGE_SIZE, filtered.length)

  return (
    <div className='col-span-full grid grid-cols-6 gap-6'>
      {/* ── 1. Hero : activity chart (2/3) + recent list (1/3) ── */}
      <Card className='col-span-full grid gap-0 py-0 lg:grid-cols-3 2xl:col-span-4'>
        {/* Chart half */}
        <div className='flex flex-col gap-4 rounded-none border-b py-6 shadow-none ring-0 max-lg:border-b lg:col-span-2 lg:border-r'>
          <CardHeader className='px-6'>
            <CardTitle className='text-lg font-semibold'>Timeline d&apos;entraînement</CardTitle>
            <CardDescription>Total {m.total} session(s) terminée(s)</CardDescription>
          </CardHeader>
          <CardContent className='flex-1 px-6'>
            {loading ? (
              <Skeleton className='h-64 w-full rounded-md' />
            ) : (
              <ChartContainer config={TIMELINE_CONFIG} className='h-64 w-full px-2'>
                <BarChart data={m.timelineData} layout='vertical' barCategoryGap={14} margin={{ left: 0, right: 16 }}>
                  <CartesianGrid strokeDasharray='4' stroke='var(--border)' horizontal={false} />
                  <XAxis type='number' hide />
                  <YAxis
                    type='category' dataKey='name' width={76}
                    tickLine={false} axisLine={false}
                    tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }}
                  />
                  <ChartTooltip content={<ChartTooltipContent />} cursor={false} />
                  <Bar dataKey='sessions' radius={12} barSize={24}>
                    <LabelList
                      dataKey='label' position='insideLeft' offset={10}
                      style={{ fill: 'var(--primary-foreground)', fontSize: 12, fontWeight: 600 }}
                    />
                    {m.timelineData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </div>

        {/* List half — recent activity */}
        <div className='flex flex-col gap-4 py-6'>
          <CardHeader className='px-6'>
            <CardTitle className='text-lg font-semibold'>Sessions récentes</CardTitle>
            <CardDescription>
              {saved
                ? `${saved.total} session(s) · ${saved.this_week} cette semaine`
                : 'Dernière activité'}
            </CardDescription>
          </CardHeader>
          <CardContent className='grow px-6'>
            <div className='flex h-full flex-col justify-between gap-6'>
              {loading ? (
                [0, 1, 2].map(i => <Skeleton key={i} className='h-10 rounded-md' />)
              ) : (saved?.sessions ?? []).slice(0, 4).map(s => {
                const when = s.completed_at ? new Date(s.completed_at) : null
                return (
                  <div key={s.session_id} className='flex items-center gap-3'>
                    <Avatar className='size-8 shrink-0 rounded-sm'>
                      <AvatarFallback className='rounded-sm bg-chart-2/10 text-chart-2'>
                        <Zap className='size-4' />
                      </AvatarFallback>
                    </Avatar>
                    <div className='flex min-w-0 flex-col gap-1'>
                      <span className='truncate text-sm capitalize'>Entretien {s.doctor_style} · {s.visit_format}</span>
                      <span className='text-muted-foreground text-xs'>
                        {when ? when.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : '—'}
                        {s.duration_seconds ? ` · ${fmtDuration(s.duration_seconds)}` : ''}
                      </span>
                    </div>
                  </div>
                )
              })}
              <div className='flex items-center justify-between border-t pt-3'>
                <span className='text-sm text-muted-foreground'>
                  {saved?.average_rating != null ? `Note moyenne ${saved.average_rating}/5` : 'Aucun avis'}
                </span>
                <Link
                  href='/dashboard/training/sessions'
                  className='inline-flex h-8 items-center gap-1 rounded-md border border-border px-3 text-sm font-medium transition-colors hover:bg-accent'
                >
                  Tout voir <ChevronRight className='size-4' />
                </Link>
              </div>
            </div>
          </CardContent>
        </div>
      </Card>

      {/* ── 2a. Weekly overview ── */}
      <Card className='col-span-full lg:col-span-3 2xl:col-span-2'>
        <CardHeader className='flex flex-row items-start justify-between'>
          <div>
            <CardTitle className='text-lg font-semibold'>Weekly overview</CardTitle>
            <CardDescription>Sessions &amp; note moyenne par jour</CardDescription>
          </div>
          <Button variant='ghost' size='icon' className='text-muted-foreground' aria-label='Menu'>
            <EllipsisVertical className='size-4' />
          </Button>
        </CardHeader>
        <CardContent className='space-y-8'>
          {loading ? (
            <Skeleton className='h-48 w-full rounded-md' />
          ) : (
            <ChartContainer config={WEEKLY_CONFIG} className='h-48 w-full'>
              <ComposedChart data={m.weekly} barGap={0}>
                <CartesianGrid strokeDasharray='4 4' className='stroke-border' vertical={false} />
                <XAxis dataKey='day' tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} />
                <ChartTooltip content={<ChartTooltipContent />} cursor={false} />
                <Bar dataKey='sessions' radius={[6, 6, 6, 6]} barSize={14} fill='var(--color-sessions)' />
                {m.avgRating != null ? (
                  <Line type='monotone' dataKey='rating' stroke='var(--color-rating)' strokeWidth={3} dot={{ r: 3, strokeWidth: 3, fill: 'var(--background)' }} />
                ) : null}
              </ComposedChart>
            </ChartContainer>
          )}
          <div className='flex flex-col items-stretch gap-4'>
            <div className='flex items-center gap-3'>
              <span className='text-2xl font-medium'>+{m.thisWeek}</span>
              <span className='text-sm text-muted-foreground'>
                {m.weekDelta >= 0
                  ? `Votre activité est de ${Math.abs(m.weekDelta)}% supérieure à la semaine passée`
                  : `Votre activité est de ${Math.abs(m.weekDelta)}% inférieure à la semaine passée`}
              </span>
            </div>
            <Link href='/dashboard/training/simulator'>
              <Button className='w-fit'>Details</Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* ── 2b. Level mix (like "Conversion rate") ── */}
      <Card className='col-span-full gap-4 lg:col-span-3 2xl:col-span-2'>
        <CardHeader className='flex flex-row items-start justify-between'>
          <div className='flex flex-col gap-1'>
            <span className='text-lg font-semibold'>Répartition par niveau</span>
            <span className='text-muted-foreground text-sm'>Niveau le plus actif : {LEVEL_META_Typed[m.mostActive]?.label ?? m.mostActive}</span>
          </div>
          <Button variant='ghost' size='icon' className='text-muted-foreground' aria-label='Menu'>
            <EllipsisVertical className='size-4' />
          </Button>
        </CardHeader>
        <CardContent className='flex flex-1 flex-col justify-between gap-4'>
          <div className='bg-primary/10 flex items-center justify-between gap-2 rounded-md px-2 py-1.5'>
            <div className='flex items-center gap-2'>
              <Avatar className='size-9'>
                <AvatarFallback className='bg-background text-primary'>
                  <Trophy className='size-4' />
                </AvatarFallback>
              </Avatar>
              <div className='flex flex-col'>
                <span className='text-base font-medium'>{LEVEL_META_Typed[m.mostActive]?.label ?? m.mostActive}</span>
                <span className='text-muted-foreground text-sm'>Niveau le plus joué</span>
              </div>
            </div>
            <div className='flex items-baseline'>
              <span className='text-xl font-medium'>{m.perLevel[m.mostActive] ?? 0}</span>
              <span className='text-base'>/ {m.levelsTotal}</span>
            </div>
          </div>

          <div className='flex flex-col gap-3'>
            {LEVEL_ORDER.map(level => {
              const count = m.perLevel[level] ?? 0
              const pct = m.levelsTotal ? Math.round((count / m.levelsTotal) * 100) : 0
              return (
                <div key={level} className='flex items-center gap-3'>
                  <Badge variant='secondary' className='w-24 shrink-0 justify-center text-xs'>
                    {LEVEL_META_Typed[level]?.label ?? level}
                  </Badge>
                  <Progress value={pct} className='h-2 flex-1' />
                  <span className='w-16 shrink-0 text-right text-sm tabular-nums text-muted-foreground'>
                    {count} · {pct}%
                  </span>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* ── 3a. Insights & objectifs (remplace "Lignes de produits") ── */}
      <Card className='col-span-full gap-4 lg:col-span-3 2xl:col-span-2'>
        <CardHeader className='flex flex-row items-start justify-between'>
          <div className='flex flex-col gap-1'>
            <span className='text-lg font-semibold'>Objectifs &amp; insights</span>
            <span className='text-muted-foreground text-sm'>Votre rythme et votre régularité</span>
          </div>
          <Button variant='ghost' size='icon' className='text-muted-foreground' aria-label='Menu'>
            <EllipsisVertical className='size-4' />
          </Button>
        </CardHeader>
        <CardContent className='space-y-3'>
          {/* Weekly goal banner */}
          <div className='bg-primary/10 flex items-center justify-between gap-2 rounded-md px-2 py-1.5'>
            <div className='flex items-center gap-2'>
              <Avatar className='size-9'>
                <AvatarFallback className='bg-background text-primary'>
                  <Target className='size-5' />
                </AvatarFallback>
              </Avatar>
              <div className='flex flex-col'>
                <span className='text-base font-medium'>{m.thisWeek} / 5 sessions cette semaine</span>
                <span className='text-muted-foreground text-sm'>Objectif hebdomadaire</span>
              </div>
            </div>
            <span className='text-sm font-semibold tabular-nums text-primary'>
              {Math.min(100, Math.round((m.thisWeek / 5) * 100))}%
            </span>
          </div>

          <div className='flex flex-col gap-3 pt-1'>
            {loading ? (
              [0, 1, 2].map(i => <Skeleton key={i} className='h-10 rounded-md' />)
            ) : (
              <>
                <div className='flex items-center gap-3'>
                  <span className='size-2.5 shrink-0 rounded-full' style={{ background: 'var(--chart-1)' }} />
                  <div className='min-w-0 flex-1'>
                    <div className='flex items-center justify-between text-sm'>
                      <span className='truncate font-medium'>Progression vers l&apos;objectif</span>
                      <span className='shrink-0 tabular-nums text-muted-foreground'>{m.thisWeek} / 5</span>
                    </div>
                    <Progress value={Math.min(100, (m.thisWeek / 5) * 100)} className='mt-1 h-1.5' />
                  </div>
                </div>
                <div className='flex items-center gap-3'>
                  <span className='size-2.5 shrink-0 rounded-full' style={{ background: 'var(--chart-3)' }} />
                  <div className='min-w-0 flex-1'>
                    <div className='flex items-center justify-between text-sm'>
                      <span className='truncate font-medium'>Niveau le plus pratiqué</span>
                      <span className='shrink-0 tabular-nums text-muted-foreground'>
                        {m.mostActive ? `${LEVEL_META[m.mostActive as keyof typeof LEVEL_META]?.label ?? m.mostActive} · ${m.perLevel[m.mostActive] ?? 0}` : '—'}
                      </span>
                    </div>
                    <Progress
                      value={m.levelsTotal ? ((m.perLevel[m.mostActive ?? ''] ?? 0) / m.levelsTotal) * 100 : 0}
                      className='mt-1 h-1.5'
                    />
                  </div>
                </div>
                <div className='flex items-center gap-3'>
                  <span className='size-2.5 shrink-0 rounded-full' style={{ background: 'var(--chart-4)' }} />
                  <div className='min-w-0 flex-1'>
                    <div className='flex items-center justify-between text-sm'>
                      <span className='truncate font-medium'>Tendance hebdomadaire</span>
                      <span className='shrink-0 inline-flex items-center gap-1 tabular-nums text-muted-foreground'>
                        {m.weekDelta >= 0 ? <TrendingUp className='size-3.5 text-green-600' /> : <TrendingDown className='size-3.5 text-red-500' />}
                        {m.weekDelta >= 0 ? '+' : ''}{m.weekDelta}%
                      </span>
                    </div>
                    <Progress value={Math.min(100, Math.abs(m.weekDelta))} className='mt-1 h-1.5' />
                  </div>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── 3b. Faits marquants (remplace "Accès rapides") ── */}
      <Card className='col-span-full gap-4 lg:col-span-3 2xl:col-span-2'>
        <CardHeader className='flex flex-row items-center justify-between'>
          <div className='flex items-center gap-2'>
            <Star className='size-6 text-primary' />
            <span className='text-lg font-semibold'>Faits marquants</span>
          </div>
          <Button variant='ghost' size='icon' className='text-muted-foreground' aria-label='Menu'>
            <EllipsisVertical className='size-4' />
          </Button>
        </CardHeader>
        <CardContent className='flex flex-1 flex-col justify-between gap-4'>
          {loading ? (
            [0, 1, 2].map(i => <Skeleton key={i} className='h-14 rounded-xl' />)
          ) : (
            <>
              <div className='flex items-center justify-between gap-3 rounded-xl border px-4 py-3'>
                <div className='flex items-center gap-3'>
                  <Avatar className='size-9 shrink-0 rounded-sm'>
                    <AvatarFallback className='size-9 shrink-0 rounded-sm bg-chart-2/10 text-chart-2'>
                      <Trophy className='size-4' />
                    </AvatarFallback>
                  </Avatar>
                  <div className='flex flex-col'>
                    <span className='text-sm font-medium'>Meilleure session</span>
                    <span className='text-muted-foreground text-xs'>
                      {m.bestSession
                        ? `${fmtDuration(m.bestSession.duration_seconds ?? 0)} · ${m.bestSession.visit_format ?? '—'}`
                        : 'Aucune session notée'}
                    </span>
                  </div>
                </div>
                {m.bestSession?.rating != null && (
                  <span className='inline-flex items-center gap-1 text-sm font-semibold text-primary'>
                    <Star className='size-3.5 fill-primary' /> {m.bestSession.rating}/5
                  </span>
                )}
              </div>
              <div className='flex items-center justify-between gap-3 rounded-xl border px-4 py-3'>
                <div className='flex items-center gap-3'>
                  <Avatar className='size-9 shrink-0 rounded-sm'>
                    <AvatarFallback className='size-9 shrink-0 rounded-sm bg-chart-3/10 text-chart-3'>
                      <Timer className='size-4' />
                    </AvatarFallback>
                  </Avatar>
                  <div className='flex flex-col'>
                    <span className='text-sm font-medium'>Temps d&apos;entraînement cumulé</span>
                    <span className='text-muted-foreground text-xs'>Sur {m.total} session(s)</span>
                  </div>
                </div>
                <span className='text-sm font-semibold tabular-nums'>
                  {m.totalSeconds > 0 ? fmtDuration(m.totalSeconds) : '—'}
                </span>
              </div>
              <div className='flex items-center justify-between gap-3 rounded-xl border px-4 py-3'>
                <div className='flex items-center gap-3'>
                  <Avatar className='size-9 shrink-0 rounded-sm'>
                    <AvatarFallback className='size-9 shrink-0 rounded-sm bg-chart-5/10 text-chart-5'>
                      <CalendarDays className='size-4' />
                    </AvatarFallback>
                  </Avatar>
                  <div className='flex flex-col'>
                    <span className='text-sm font-medium'>Régularité</span>
                    <span className='text-muted-foreground text-xs'>Jours d&apos;entraînement (7 derniers)</span>
                  </div>
                </div>
                <span className='text-sm font-semibold tabular-nums'>
                  {m.activeDays} / 7
                </span>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* ── 4. Full-width sessions table with 3 filters + pagination ── */}
      <Card className='col-span-full py-0 shadow-none'>
        <div className='w-full'>
          <div className='border-b'>
            <div className='flex flex-col gap-4 p-6'>
              <div className='grid grid-cols-1 gap-6 max-md:*:last:col-span-full sm:grid-cols-2 md:grid-cols-3'>
                <div className='flex w-full flex-col gap-2'>
                  <label className='text-sm font-medium leading-none select-none' htmlFor='ov-level'>Niveau</label>
                  <Select value={levelFilter} onValueChange={v => setLevelFilter(v ?? 'all')}>
                    <SelectTrigger className='w-full capitalize' id='ov-level'><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value='all'>Tous</SelectItem>
                      {LEVEL_ORDER.map(k => (
                        <SelectItem key={k} value={k}>{LEVEL_META_Typed[k]?.label ?? k}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className='flex w-full flex-col gap-2'>
                  <label className='text-sm font-medium leading-none select-none' htmlFor='ov-format'>Format</label>
                  <Select value={formatFilter} onValueChange={v => setFormatFilter(v ?? 'all')}>
                    <SelectTrigger className='w-full' id='ov-format'><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value='all'>Tous</SelectItem>
                      <SelectItem value='flash'>Flash</SelectItem>
                      <SelectItem value='standard'>Standard</SelectItem>
                      <SelectItem value='approfondie'>Approfondie</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className='flex w-full flex-col gap-2'>
                  <label className='text-sm font-medium leading-none select-none' htmlFor='ov-rated'>Avis</label>
                  <Select value={ratedFilter} onValueChange={v => setRatedFilter(v ?? 'all')}>
                    <SelectTrigger className='w-full' id='ov-rated'><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value='all'>Tous</SelectItem>
                      <SelectItem value='rated'>Notées</SelectItem>
                      <SelectItem value='unrated'>Sans note</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div data-slot='table-container' className='relative w-full overflow-x-auto'>
              {loading ? (
                <div className='space-y-3 px-6 py-6'>
                  {[0, 1, 2].map(i => <Skeleton key={i} className='h-12 rounded-md' />)}
                </div>
              ) : pageItems.length === 0 ? (
                <div className='flex flex-col items-center gap-3 px-6 py-12'>
                  {error ? (
                    <>
                      <p className='text-sm text-muted-foreground'>Impossible de charger — serveur injoignable.</p>
                      <Button variant='outline' size='sm' onClick={load} className='gap-1.5'>
                        <RefreshCw className='size-3.5' /> Réessayer
                      </Button>
                    </>
                  ) : (
                    <p className='text-sm text-muted-foreground'>
                      Aucune session pour ces filtres — lancez une simulation pour commencer.
                    </p>
                  )}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className='h-14'>
                      <TableHead className='pl-6'>Date</TableHead>
                      <TableHead>Niveau</TableHead>
                      <TableHead>Profil médecin</TableHead>
                      <TableHead>Format</TableHead>
                      <TableHead>Durée</TableHead>
                      <TableHead className='pr-6 text-center'>Votre note</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pageItems.map(s => {
                      const when = s.completed_at ? new Date(s.completed_at) : null
                      return (
                        <TableRow key={s.session_id} className='h-14'>
                          <TableCell className='whitespace-nowrap pl-6 text-sm'>
                            {when ? when.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}
                          </TableCell>
                          <TableCell>
                            <Badge variant='secondary' className='capitalize'>{LEVEL_META_Typed[s.level]?.label ?? s.level}</Badge>
                          </TableCell>
                          <TableCell className='text-sm capitalize'>{s.doctor_style}</TableCell>
                          <TableCell className='text-sm capitalize'>{s.visit_format}</TableCell>
                          <TableCell className='whitespace-nowrap text-sm tabular-nums'>{fmtDuration(s.duration_seconds)}</TableCell>
                          <TableCell className='pr-6 text-center'><Stars value={s.rating} /></TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              )}
            </div>
          </div>

          <div className='flex items-center justify-between gap-3 px-6 py-4 max-sm:flex-col md:max-lg:flex-col'>
            <p className='text-sm whitespace-nowrap text-muted-foreground' aria-live='polite'>
              Affichage de <span>{from}</span> à <span>{to}</span> sur <span>{filtered.length}</span> sessions
            </p>
            <div className='flex items-center gap-1'>
              <Button variant='outline' size='sm' disabled={safePage <= 1} onClick={() => setPage(p => p - 1)}>
                Précédent
              </Button>
              <Button variant='outline' size='sm' disabled={safePage >= totalPages} onClick={() => setPage(p => p + 1)}>
                Suivant
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
}
