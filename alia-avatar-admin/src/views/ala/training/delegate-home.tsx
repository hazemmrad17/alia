'use client'

// ──────────────────────────────────────────────
// Espace délégué — Vue d'ensemble + Formation
//
// The overview tab follows the reference dashboard grid exactly: a 6-column
// grid where
//   · row 1 — "Timeline des sessions" big card (col-span-full 2xl:col-span-4)
//     with a nested 2/3-1/3 split: horizontal Gantt-style bars (last 8 weeks)
//     on the left, "Liste des produits" on the right;
//   · row 2 — three cards each col-span-full lg:col-span-3 2xl:col-span-2:
//     "Vue hebdomadaire" (bars + line overlay + footer CTA), "Conversion" (big
//     number + mini area chart + funnel rows), "Progression & niveau" (plan
//     box + progression rows);
//   · row 3 — full-width sessions table with filter selects, actions and
//     pagination (col-span-full py-0 shadow-none).
// The Formation tab keeps the detailed KPIs (TrainingOverview).
// ──────────────────────────────────────────────

import { useEffect, useMemo, useState } from 'react'

import Link from 'next/link'
import { useRouter } from 'next/navigation'

import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  EllipsisVertical,
  Eye,
  GraduationCap,
  LayoutDashboard,
  Pill,
  PlayCircle,
  RefreshCw,
  Stethoscope,
  Target,
  Trophy,
  Timer,
  TrendingUp,
  Wallet
} from 'lucide-react'
import { Area, AreaChart, Bar, BarChart, Cell, Line, ComposedChart, XAxis } from 'recharts'

import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import TrainingOverview from '@/views/ala/training/training-overview'
import ProgressionPath from '@/views/ala/training/progression-path'

import { ApiError, getSavedSessions, getRewardsOverview } from '@/lib/alia-api'
import type { RewardsOverview, SavedSession } from '@/lib/alia-api'
import { cn } from '@/lib/utils'

const LEVEL_LABELS: Record<string, string> = {
  debutant: 'Débutant',
  junior: 'Junior',
  confirme: 'Confirmé',
  expert: 'Expert'
}

const DAYS_FR = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

const LEVEL_ORDER = ['debutant', 'junior', 'confirme', 'expert']

const LEVEL_ICONS: Record<string, React.ReactNode> = {
  debutant: <Stethoscope className='text-chart-3 size-4' />,
  junior: <Target className='size-4 text-green-600 dark:text-green-400' />,
  confirme: <TrendingUp className='text-chart-2 size-4' />,
  expert: <Wallet className='text-chart-5 size-4' />
}

function fmtDuration(seconds?: number | null): string {
  if (!seconds) return '—'
  const m = Math.floor(seconds / 60)
  const s = Math.round(seconds % 60)
  return m > 0 ? `${m} min ${String(s).padStart(2, '0')} s` : `${s} s`
}

function fmtDate(value: string | null): string {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

export function DelegateHome() {
  const [sessions, setSessions] = useState<SavedSession[]>([])
  const [meta, setMeta] = useState<{ this_week: number; week_delta_percent: number | null } | null>(null)
  const [rewards, setRewards] = useState<RewardsOverview | null>(null)
  const [level, setLevel] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // One session is reviewed on its own page (/dashboard/training/sessions/[id]).
  const router = useRouter()
  const openSession = (id: string) => router.push(`/dashboard/training/sessions/${id}`)

  // Full-width table filters (template's Select Role / Plan / Status).
  const [filterLevel, setFilterLevel] = useState('all')
  const [filterProduct, setFilterProduct] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 5

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const data = await getSavedSessions(false)
        if (cancelled) return
        setSessions(data.sessions)
        setMeta({ this_week: data.this_week, week_delta_percent: data.week_delta_percent ?? null })
        try {
          const me = localStorage.getItem('alia-user')
          setLevel(me ? (JSON.parse(me).current_level ?? null) : null)
        } catch {
          setLevel(null)
        }
        try {
          setRewards(await getRewardsOverview())
        } catch {
          setRewards(null) // la fidélité est optionnelle pour ce rôle
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof ApiError ? e.message : 'Impossible de charger votre tableau de bord.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  // ── Derived figures ──
  const kpis = useMemo(() => {
    const scored = sessions.filter((s) => typeof s.overall_score === 'number')
    const avg = scored.length
      ? Math.round(scored.reduce((sum, s) => sum + (s.overall_score ?? 0), 0) / scored.length)
      : null
    const best = scored.length ? Math.max(...scored.map((s) => s.overall_score ?? 0)) : null
    const totalMinutes = Math.round(sessions.reduce((sum, s) => sum + (s.duration_seconds ?? 0), 0) / 60)
    return { avg, best, totalMinutes, scored: scored.length }
  }, [sessions])

  // Gantt-style chart: last 8 weeks, one bar per week (crescendo of sessions).
  const weekTimeline = useMemo(() => {
    const now = new Date()
    const mondayOf = (d: Date) => {
      const m = new Date(d)
      m.setDate(d.getDate() - ((d.getDay() + 6) % 7))
      m.setHours(0, 0, 0, 0)
      return m
    }
    const thisMonday = mondayOf(now)
    const buckets: { label: string; count: number; start: number }[] = []
    const weekFmt = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' })
    for (let i = 7; i >= 0; i--) {
      const start = new Date(thisMonday)
      start.setDate(thisMonday.getDate() - i * 7)
      buckets.push({ label: weekFmt.format(start), count: 0, start: start.getTime() })
    }
    for (const s of sessions) {
      if (!s.completed_at) continue
      const dMonday = mondayOf(new Date(s.completed_at)).getTime()
      const bucket = buckets.find((b) => b.start === dMonday)
      if (bucket) bucket.count += 1
    }
    return buckets.map(({ label, count }) => ({ label, count }))
  }, [sessions])

  // Product list (template's Project List card) — count + avg score.
  const productRows = useMemo(() => {
    const byProduct = new Map<string, { count: number; scores: number[] }>()
    for (const s of sessions) {
      const name = s.product_focus?.trim() || 'Session libre'
      const entry = byProduct.get(name) ?? { count: 0, scores: [] }
      entry.count += 1
      if (typeof s.overall_score === 'number') entry.scores.push(s.overall_score)
      byProduct.set(name, entry)
    }
    return Array.from(byProduct.entries())
      .map(([name, v], idx) => ({
        name,
        count: v.count,
        avgScore: v.scores.length ? Math.round(v.scores.reduce((a, b) => a + b, 0) / v.scores.length) : null,
        fill: `var(--chart-${(idx % 5) + 1})`
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 4)
  }, [sessions])

  // Weekly bars + avg-score line overlay (template's Weekly overview).
  const weeklyOverview = useMemo(() => {
    const counts = new Array(7).fill(0)
    const scores: number[][] = [[], [], [], [], [], [], []]
    const now = new Date()
    const monday = new Date(now)
    monday.setDate(now.getDate() - ((now.getDay() + 6) % 7))
    monday.setHours(0, 0, 0, 0)
    for (const s of sessions) {
      if (!s.completed_at) continue
      const d = new Date(s.completed_at)
      if (d < monday) continue
      const idx = (d.getDay() + 6) % 7
      counts[idx] += 1
      if (typeof s.overall_score === 'number') scores[idx].push(s.overall_score)
    }
    return counts.map((count, idx) => ({
      day: DAYS_FR[idx],
      count,
      avgScore: scores[idx].length
        ? Math.round(scores[idx].reduce((a, b) => a + b, 0) / scores[idx].length)
        : null
    }))
  }, [sessions])

  // Conversion-funnel style rows (template's Conversion rate card).
  const funnel = useMemo(() => {
    const scored = sessions.filter((s) => typeof s.overall_score === 'number')
    const passed = scored.filter((s) => (s.overall_score ?? 0) >= 75).length
    const rated = sessions.filter((s) => typeof s.rating === 'number').length
    const pct = (n: number) => (sessions.length ? Math.round((n / sessions.length) * 100) : 0)
    return [
      { label: 'Sessions réalisées', detail: `${sessions.length} au total`, value: `${pct(sessions.length)}%`, up: true },
      { label: 'Sessions évaluées', detail: `${scored.length} avec score`, value: `${pct(scored.length)}%`, up: true },
      { label: 'Score ≥ 75', detail: `${passed} sessions validées`, value: scored.length ? `${Math.round((passed / scored.length) * 100)}%` : '—', up: passed > 0 },
      { label: 'Feedback laissé', detail: `${rated} avis`, value: `${pct(rated)}%`, up: rated > 0 }
    ]
  }, [sessions])

  const nextLevel = useMemo(() => {
    if (!level) return null
    const idx = LEVEL_ORDER.indexOf(level)
    if (idx < 0 || idx >= LEVEL_ORDER.length - 1) return null
    return LEVEL_ORDER[idx + 1]
  }, [level])

  const levelProgress = useMemo(() => {
    if (!nextLevel || kpis.avg === null) return null
    const target = nextLevel === 'expert' ? 85 : 75
    return { target, percent: Math.min(100, Math.round((kpis.avg / target) * 100)) }
  }, [nextLevel, kpis.avg])

  // ── Full-width table (filters + pagination) ──
  const products = useMemo(
    () => Array.from(new Set(sessions.map((s) => s.product_focus?.trim() || 'Session libre'))),
    [sessions]
  )

  const filteredSessions = useMemo(() => {
    return sessions.filter((s) => {
      const prod = s.product_focus?.trim() || 'Session libre'
      if (filterLevel !== 'all' && (s.level ?? 'inconnu') !== filterLevel) return false
      if (filterProduct !== 'all' && prod !== filterProduct) return false
      if (filterStatus === 'scored' && typeof s.overall_score !== 'number') return false
      if (filterStatus === 'unscored' && typeof s.overall_score === 'number') return false
      return true
    })
  }, [sessions, filterLevel, filterProduct, filterStatus])

  const pageCount = Math.max(1, Math.ceil(filteredSessions.length / PAGE_SIZE))
  const safePage = Math.min(page, pageCount)
  const pageRows = filteredSessions.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  if (loading) {
    return (
      <div className='mx-auto max-w-360 space-y-6 p-4 sm:p-6'>
        <Skeleton className='h-10 w-72' />
        <div className='grid grid-cols-6 gap-6'>
          <Skeleton className='h-96 col-span-full rounded-xl' />
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className='h-80 col-span-full rounded-xl lg:col-span-3 2xl:col-span-2' />
          ))}
        </div>
        <Skeleton className='h-80 rounded-xl' />
      </div>
    )
  }

  if (error) {
    return (
      <div className='mx-auto max-w-360 p-6'>
        <Card className='border-destructive/40'>
          <CardHeader>
            <CardTitle className='text-destructive'>Oups</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant='outline' onClick={() => window.location.reload()}>
              <RefreshCw /> Réessayer
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const todayIdx = (new Date().getDay() + 6) % 7

  return (
    <main className='mx-auto size-full max-w-360 flex-1 px-4 py-6 sm:px-6'>
      <Tabs defaultValue='overview'>
        <div className='mb-6 flex flex-wrap items-center justify-between gap-3'>
          <div>
            <h1 className='text-2xl font-semibold tracking-tight'>Mon espace</h1>
            <p className='text-muted-foreground text-sm'>Votre vue d'ensemble et le détail de votre formation.</p>
          </div>
          <TabsList>
            <TabsTrigger value='overview'>
              <LayoutDashboard className='size-4' /> Vue d'ensemble
            </TabsTrigger>
            <TabsTrigger value='training'>
              <GraduationCap className='size-4' /> Formation
            </TabsTrigger>
            <TabsTrigger value='progression'>
              <Trophy className='size-4' /> Progression
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value='overview'>
          <div className='grid grid-cols-6 gap-6'>
            {/* ── Row 1 — Timeline des sessions (big card, nested 2/3 + 1/3) ── */}
            <Card className='col-span-full grid gap-0 py-0 lg:grid-cols-3 2xl:col-span-4'>
              <div className='flex flex-col gap-4 rounded-none border-none py-6 shadow-none ring-0 max-lg:border-b lg:col-span-2 lg:border-r'>
                <CardHeader>
                  <CardTitle className='text-lg'>Timeline des sessions</CardTitle>
                  <CardDescription>
                    {sessions.length} session{sessions.length > 1 ? 's' : ''} sur les 8 dernières semaines
                  </CardDescription>
                </CardHeader>
                <CardContent className='flex flex-1'>
                  <ChartContainer
                    config={{
                      count: { label: 'Sessions', color: 'var(--chart-2)' },
                      avg: { label: 'Score moyen', color: 'var(--primary)' }
                    }}
                    className='max-h-80 max-400px:h-60 max-400px:max-w-71 aspect-video w-full flex-1 justify-center text-xs'
                  >
                    <BarChart data={weekTimeline} layout='vertical' margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
                      <XAxis type='number' hide />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey='count' radius={12} barSize={22}>
                        {weekTimeline.map((entry, idx) => (
                          <Cell
                            key={entry.label}
                            fill={
                              idx === 7
                                ? 'var(--color-avg)'
                                : `color-mix(in oklab, var(--color-count) ${30 + idx * 8}%, transparent)`
                            }
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ChartContainer>
                </CardContent>
              </div>

              {/* Right column — Liste des produits (Project-List style) */}
              <div className='flex flex-col gap-8 rounded-none border-none py-6 shadow-none ring-0'>
                <CardHeader className='flex justify-between'>
                  <div className='flex flex-col gap-1'>
                    <CardTitle className='text-lg'>Liste des produits</CardTitle>
                    <CardDescription>{products.length} produit{products.length > 1 ? 's' : ''} travaillé{products.length > 1 ? 's' : ''}</CardDescription>
                  </div>
                  <Button variant='ghost' size='icon' className='text-muted-foreground size-6 rounded-full' aria-label='Menu'>
                    <EllipsisVertical />
                  </Button>
                </CardHeader>
                <CardContent className='grow'>
                  <div className='flex h-full flex-col justify-between gap-6'>
                    {productRows.length === 0 ? (
                      <p className='text-muted-foreground text-sm'>Aucun produit encore travaillé.</p>
                    ) : (
                      productRows.map((p) => (
                        <div key={p.name} className='flex items-center gap-3'>
                          <Avatar className='rounded-sm after:border-0'>
                            <AvatarFallback className='shrink-0' style={{ background: `color-mix(in oklab, ${p.fill} 10%, transparent)`, color: p.fill }}>
                              <Pill className='size-4' />
                            </AvatarFallback>
                          </Avatar>
                          <div className='flex flex-col gap-1'>
                            <span className='line-clamp-1 text-sm'>{p.name}</span>
                            <span className='text-muted-foreground text-xs'>
                              {p.count} session{p.count > 1 ? 's' : ''}
                              {p.avgScore !== null ? ` · score moyen ${p.avgScore}/100` : ''}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </div>
            </Card>

            {/* ── Row 2, card 1 — Vue hebdomadaire (bars + line overlay) ── */}
            <Card className='col-span-full gap-8 lg:col-span-3 2xl:col-span-2'>
              <CardHeader className='flex justify-between'>
                <span className='text-lg font-semibold'>Vue hebdomadaire</span>
                <Button variant='ghost' size='icon' className='text-muted-foreground size-6 rounded-full' aria-label='Menu'>
                  <EllipsisVertical />
                </Button>
              </CardHeader>
              <CardContent className='space-y-8'>
                <ChartContainer
                  config={{
                    count: { label: 'Sessions', color: 'var(--chart-2)' },
                    avgScore: { label: 'Score moyen', color: 'var(--chart-2)' }
                  }}
                  className='min-h-35 aspect-video w-full flex-1'
                >
                  <ComposedChart data={weeklyOverview} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
                    <XAxis dataKey='day' tickLine={false} axisLine={false} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey='count' radius={12} barSize={20}>
                      {weeklyOverview.map((entry, idx) => (
                        <Cell
                          key={entry.day}
                          fill={
                            idx === todayIdx
                              ? 'var(--color-count)'
                              : 'color-mix(in oklab, var(--color-count) 20%, transparent)'
                          }
                        />
                      ))}
                    </Bar>
                    <Line
                      dataKey='avgScore'
                      type='monotone'
                      stroke='var(--color-avgScore)'
                      strokeWidth={3}
                      dot={{ r: 3, strokeWidth: 3, fill: '#fff' }}
                      connectNulls
                    />
                  </ComposedChart>
                </ChartContainer>
                <div className='flex flex-col items-stretch gap-4'>
                  <div className='flex items-center gap-3'>
                    <span className='text-2xl font-medium'>{meta?.this_week ?? 0}</span>
                    <span className='text-muted-foreground text-sm'>
                      session{meta?.this_week === 1 ? '' : 's'} cette semaine
                      {meta?.week_delta_percent != null
                        ? ` — ${meta.week_delta_percent >= 0 ? '+' : ''}${meta.week_delta_percent}% vs la semaine passée`
                        : ''}
                    </span>
                  </div>
                  <Button
                    className='gap-1.5 px-2.5'
                    onClick={() => {
                      const el = document.querySelector<HTMLAnchorElement>('[data-nav-training]')
                      if (el) el.click()
                      else window.location.href = '/dashboard/training/simulator'
                    }}
                  >
                    Détails
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* ── Row 2, card 2 — Conversion (big number + mini area + funnel rows) ── */}
            <Card className='col-span-full gap-4 text-base lg:col-span-3 2xl:col-span-2'>
              <CardHeader className='flex justify-between'>
                <div className='flex flex-col gap-1'>
                  <span className='text-lg font-semibold'>Résultats</span>
                  <span className='text-muted-foreground text-sm'>Comparé aux sessions passées</span>
                </div>
                <Button variant='ghost' size='icon' className='text-muted-foreground size-6 rounded-full' aria-label='Menu'>
                  <EllipsisVertical />
                </Button>
              </CardHeader>
              <CardContent className='flex flex-1 flex-col justify-between gap-4'>
                <div className='flex items-center gap-4'>
                  <div className='flex items-center gap-3'>
                    <span className='text-3xl font-semibold'>{kpis.avg !== null ? `${kpis.avg}/100` : '—'}</span>
                    {meta?.week_delta_percent != null ? (
                      <div className='flex items-center gap-1'>
                        {meta.week_delta_percent >= 0 ? <ArrowUp className='size-4' /> : <ArrowDown className='size-4' />}
                        <span className='text-sm'>{Math.abs(meta.week_delta_percent)}%</span>
                      </div>
                    ) : null}
                  </div>
                  <ChartContainer
                    config={{ score: { label: 'Score', color: 'var(--chart-2)' } }}
                    className='h-20 w-full text-xs'
                  >
                    <AreaChart
                      data={weeklyOverview.map((w) => ({ day: w.day, score: w.avgScore }))}
                      margin={{ top: 4, right: 0, bottom: 0, left: 0 }}
                    >
                      <defs>
                        <linearGradient id='fillScore' x1='0' y1='0' x2='0' y2='1'>
                          <stop offset='10%' stopColor='var(--color-score)' stopOpacity={0.3} />
                          <stop offset='90%' stopColor='var(--color-score)' stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <Area
                        dataKey='score'
                        type='monotone'
                        stroke='var(--color-score)'
                        strokeWidth={2}
                        fill='url(#fillScore)'
                        fillOpacity={0.6}
                        connectNulls
                      />
                    </AreaChart>
                  </ChartContainer>
                </div>
                <div className='grid grid-cols-5 gap-2'>
                  {funnel.map((row) => (
                    <FragmentRow key={row.label} label={row.label} detail={row.detail} value={row.value} up={row.up} />
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* ── Row 2, card 3 — Résumé de progression / fidélité (Upgrade-your-plan style) ── */}
            <Card className='col-span-full justify-between gap-4 lg:col-span-3 2xl:col-span-2'>
              <CardHeader>
                <div className='flex items-center justify-between gap-2'>
                  <span className='text-lg font-semibold'>Résumé de progression</span>
                  <Button variant='ghost' size='icon' className='text-muted-foreground size-6 rounded-full' aria-label='Menu'>
                    <EllipsisVertical />
                  </Button>
                </div>
                <p className='text-muted-foreground text-sm'>
                  Vos points de fidélité et votre progression vers le niveau suivant.
                </p>
              </CardHeader>
              <CardContent>
                <div className='bg-primary/10 flex items-center justify-between gap-2 rounded-md px-2 py-1.5'>
                  <div className='flex items-center gap-2'>
                    <Avatar className='size-9 rounded-sm after:rounded-[inherit]'>
                      <AvatarFallback className='bg-background text-primary shrink-0'>
                        <Wallet className='size-6' />
                      </AvatarFallback>
                    </Avatar>
                    <div className='flex flex-col'>
                      <span className='text-base font-medium'>
                        {rewards ? rewards.tier.name : level ? (LEVEL_LABELS[level] ?? level) : 'Non classé'}
                      </span>
                      <span className='text-muted-foreground text-sm'>
                        {rewards ? `${rewards.balance} points disponibles` : 'Niveau actuel'}
                      </span>
                    </div>
                  </div>
                  <div className='flex items-baseline'>
                    <span className='text-xl font-medium'>
                      {rewards ? rewards.lifetime_points : kpis.best !== null ? kpis.best : '—'}
                    </span>
                    <span className='text-base'> {rewards ? 'pts cumulés' : '/100 record'}</span>
                  </div>
                </div>
              </CardContent>
              <CardContent>
                <div className='flex flex-col gap-4'>
                  <span className='text-base font-semibold'>
                    {rewards ? 'Prochaine récompense' : 'Objectifs'}
                  </span>
                  {rewards ? (
                    <div className='flex flex-col gap-3'>
                      <div className='flex items-center justify-between gap-2'>
                        <div className='flex flex-col gap-0.5'>
                          <span className='text-sm font-medium line-clamp-1'>
                            {rewards.next_gift ? rewards.next_gift.title : 'Tout est débloqué'}
                          </span>
                          <div className='bg-muted mt-1 h-1.5 w-full max-w-48 overflow-hidden rounded-full'>
                            <div
                              className='bg-primary h-full transition-all'
                              style={{ width: `${Math.min(100, rewards.progress_to_next)}%` }}
                            />
                          </div>
                        </div>
                        <span className='text-muted-foreground shrink-0 text-xs'>
                          {rewards.next_gift
                            ? `${Math.max(0, rewards.next_gift.cost - rewards.balance)} pts restants`
                            : '—'}
                        </span>
                      </div>
                      <div className='flex items-center justify-between gap-2'>
                        <div className='flex items-center gap-2'>
                          <div className='bg-muted rounded-sm p-2'>
                            <Target className='text-primary size-5' />
                          </div>
                          <div className='flex flex-col gap-0.5'>
                            <span className='text-sm font-medium'>Sessions évaluées</span>
                            <span className='text-muted-foreground text-xs'>{kpis.scored} avec score</span>
                          </div>
                        </div>
                        <span className='text-muted-foreground text-sm'>{kpis.avg !== null ? `${kpis.avg}/100` : '—'}</span>
                      </div>
                      <div className='flex items-center justify-between gap-2'>
                        <div className='flex items-center gap-2'>
                          <div className='bg-muted rounded-sm px-2 py-3'>
                            <Timer className='text-primary size-5' />
                          </div>
                          <div className='flex flex-col gap-0.5'>
                            <span className='text-sm font-medium'>Temps total</span>
                            <span className='text-muted-foreground text-xs'>Entraînement cumulé</span>
                          </div>
                        </div>
                        <span className='text-muted-foreground text-sm'>
                          {kpis.totalMinutes > 0 ? `${kpis.totalMinutes} min` : '—'}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className='flex flex-col gap-3'>
                      <div className='flex items-center justify-between gap-2'>
                        <div className='flex flex-col gap-0.5'>
                          <span className='text-sm font-medium'>
                            Score moyen {levelProgress ? `${levelProgress.percent}%` : '—'}
                          </span>
                          <div className='bg-muted mt-1 h-1.5 w-full max-w-48 overflow-hidden rounded-full'>
                            <div
                              className='bg-primary h-full transition-all'
                              style={{ width: `${levelProgress?.percent ?? 0}%` }}
                            />
                          </div>
                        </div>
                        <span className='text-muted-foreground text-xs'>
                          {nextLevel
                            ? `Niveau ${LEVEL_LABELS[nextLevel] ?? nextLevel} à ${levelProgress?.target}/100`
                            : 'Niveau maximum'}
                        </span>
                      </div>
                      <div className='flex items-center justify-between gap-2'>
                        <div className='flex items-center gap-2'>
                          <div className='bg-muted rounded-sm p-2'>
                            <Target className='text-primary size-5' />
                          </div>
                          <div className='flex flex-col gap-0.5'>
                            <span className='text-sm font-medium'>Sessions évaluées</span>
                            <span className='text-muted-foreground text-xs'>{kpis.scored} avec score</span>
                          </div>
                        </div>
                        <span className='text-muted-foreground text-sm'>{kpis.avg !== null ? `${kpis.avg}/100` : '—'}</span>
                      </div>
                      <div className='flex items-center justify-between gap-2'>
                        <div className='flex items-center gap-2'>
                          <div className='bg-muted rounded-sm px-2 py-3'>
                            <Timer className='text-primary size-5' />
                          </div>
                          <div className='flex flex-col gap-0.5'>
                            <span className='text-sm font-medium'>Temps total</span>
                            <span className='text-muted-foreground text-xs'>Entraînement cumulé</span>
                          </div>
                        </div>
                        <span className='text-muted-foreground text-sm'>
                          {kpis.totalMinutes > 0 ? `${kpis.totalMinutes} min` : '—'}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* ── Row 2, card 4 — Dernières sessions (Performance card w/ tabs) ── */}
            <Card className='col-span-full gap-4 lg:col-span-3 2xl:col-span-2'>
              <CardHeader className='flex justify-between'>
                <div className='flex items-center gap-2'>
                  <PlayCircle className='size-6' />
                  <span className='text-lg font-semibold'>Dernières sessions</span>
                </div>
                <Button variant='ghost' size='icon' className='text-muted-foreground size-6 rounded-full' aria-label='Menu'>
                  <EllipsisVertical />
                </Button>
              </CardHeader>
              <CardContent className='flex flex-1 flex-col justify-between gap-4 text-base'>
                {sessions.length === 0 ? (
                  <p className='text-muted-foreground py-10 text-center text-sm'>
                    Aucune session — lancez votre premier entraînement !
                  </p>
                ) : (
                  <>
                    <div className='flex flex-col justify-between gap-4'>
                      {sessions.slice(0, 3).map((s) => (
                        <div
                          key={s.session_id}
                          className='flex cursor-pointer items-center justify-between gap-2 rounded-xl border px-4 py-2'
                          onClick={() => openSession(s.session_id)}
                        >
                          <div className='flex min-w-0 items-center gap-3'>
                            <Avatar className='size-10.5 rounded-sm after:border-0'>
                              <AvatarFallback className='bg-primary/10 text-primary'>
                                <PlayCircle className='size-5' />
                              </AvatarFallback>
                            </Avatar>
                            <div className='flex min-w-0 flex-col'>
                              <span className='text-muted-foreground truncate text-xs'>
                                {s.level ? (LEVEL_LABELS[s.level] ?? s.level) : '—'} · {fmtDate(s.completed_at)}
                              </span>
                              <span className='truncate text-lg font-medium'>{s.product_focus || 'Session libre'}</span>
                            </div>
                          </div>
                          <div className='flex shrink-0 flex-col items-end'>
                            {typeof s.overall_score === 'number' ? (
                              <Badge className='h-6 rounded-4xl border-none bg-primary/10 px-3 text-primary'>
                                {s.overall_score}/100
                              </Badge>
                            ) : (
                              <span className='text-muted-foreground text-sm'>{fmtDuration(s.duration_seconds)}</span>
                            )}
                            {typeof s.rating === 'number' ? (
                              <span className='text-muted-foreground text-xs'>{s.rating}/5 ★</span>
                            ) : null}
                          </div>
                        </div>
                      ))}
                    </div>
                    <p className='text-center'>
                      <span className='font-medium'>{kpis.avg !== null ? `Score moyen ${kpis.avg}/100` : 'Prêt à démarrer'}</span>{' '}
                      <span className='text-muted-foreground text-sm'>
                        Cliquez sur une session pour voir la transcription et le détail.
                      </span>
                    </p>
                  </>
                )}
              </CardContent>
            </Card>

            {/* ── Row 3 — Full-width sessions table (filters + actions + pagination) ── */}
            <Card className='col-span-full py-0 shadow-none'>
              <div className='w-full'>
                <div className='border-b'>
                  <div className='flex flex-col gap-4 p-6'>
                    <div className='grid grid-cols-1 gap-6 max-md:*:last:col-span-full sm:grid-cols-2 md:grid-cols-3'>
                      <div className='flex w-full flex-col gap-2'>
                        <Label htmlFor='filter-level'>Niveau</Label>
                        <Select
                          value={filterLevel}
                          onValueChange={(v) => {
                            setFilterLevel(v ?? 'all')
                            setPage(1)
                          }}
                        >
                          <SelectTrigger id='filter-level' className='w-full capitalize'>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value='all' className='capitalize'>Tous</SelectItem>
                            {LEVEL_ORDER.map((lvl) => (
                              <SelectItem key={lvl} value={lvl} className='capitalize'>
                                {LEVEL_LABELS[lvl] ?? lvl}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className='flex w-full flex-col gap-2'>
                        <Label htmlFor='filter-product'>Produit</Label>
                        <Select
                          value={filterProduct}
                          onValueChange={(v) => {
                            setFilterProduct(v ?? 'all')
                            setPage(1)
                          }}
                        >
                          <SelectTrigger id='filter-product' className='w-full'>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value='all'>Tous</SelectItem>
                            {products.map((p) => (
                              <SelectItem key={p} value={p}>
                                {p}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className='flex w-full flex-col gap-2'>
                        <Label htmlFor='filter-status'>Statut</Label>
                        <Select
                          value={filterStatus}
                          onValueChange={(v) => {
                            setFilterStatus(v ?? 'all')
                            setPage(1)
                          }}
                        >
                          <SelectTrigger id='filter-status' className='w-full'>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value='all'>Tous</SelectItem>
                            <SelectItem value='scored'>Évaluée</SelectItem>
                            <SelectItem value='unscored'>Non évaluée</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                  <div className='relative w-full overflow-x-auto'>
                    <Table>
                      <TableHeader>
                        <TableRow className='h-14 border-t'>
                          <TableHead className='first:pl-4'>Produit</TableHead>
                          <TableHead>Niveau</TableHead>
                          <TableHead>Durée</TableHead>
                          <TableHead>Progression (score)</TableHead>
                          <TableHead className='last:px-4 last:text-end'>Évaluation</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pageRows.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={5} className='text-muted-foreground py-10 text-center'>
                              Aucune session pour ces filtres.
                            </TableCell>
                          </TableRow>
                        ) : (
                          pageRows.map((s) => {
                            const score = typeof s.overall_score === 'number' ? s.overall_score : null
                            return (
                              <TableRow key={s.session_id} className='h-14'>
                                <TableCell className='p-2 align-middle first:pl-4'>
                                  <div className='flex items-center gap-2'>
                                    <Avatar className='size-9 rounded-full after:border-0'>
                                      <AvatarFallback className='bg-primary/10 text-primary'>
                                        <PlayCircle className='size-6' />
                                      </AvatarFallback>
                                    </Avatar>
                                    <div className='flex flex-col'>
                                      <span className='font-medium'>{s.product_focus || 'Session libre'}</span>
                                      <span className='text-muted-foreground text-xs'>{fmtDate(s.completed_at)}</span>
                                    </div>
                                  </div>
                                </TableCell>
                                <TableCell className='p-2 align-middle'>
                                  <div className='flex items-center gap-2'>
                                    {LEVEL_ICONS[s.level] ?? <Target className='size-4' />}
                                    <span className='capitalize'>{LEVEL_LABELS[s.level] ?? s.level ?? '—'}</span>
                                  </div>
                                </TableCell>
                                <TableCell className='text-muted-foreground p-2 align-middle'>
                                  {fmtDuration(s.duration_seconds)}
                                </TableCell>
                                <TableCell className='p-2 align-middle'>
                                  {score !== null ? (
                                    <Badge
                                      className={cn(
                                        'h-6 rounded-sm border-none',
                                        score >= 75
                                          ? 'bg-green-600/10 text-green-600 dark:bg-green-400/10 dark:text-green-400'
                                          : score >= 50
                                            ? 'bg-amber-600/10 text-amber-600 dark:bg-amber-400/10 dark:text-amber-400'
                                            : 'bg-destructive/10 text-destructive'
                                      )}
                                    >
                                      {score}/100
                                    </Badge>
                                  ) : (
                                    <span className='text-muted-foreground'>—</span>
                                  )}
                                </TableCell>
                                <TableCell className='p-2 align-middle last:px-4'>
                                  <div className='flex items-center justify-end gap-1'>
                                    {/* Full review: scores, steps, transcript, visit report. */}
                                    <Button
                                      variant='outline'
                                      size='sm'
                                      className='gap-1.5'
                                      nativeButton={false}
                                      render={<Link href={`/dashboard/training/sessions/${s.session_id}`} />}
                                    >
                                      <Eye className='size-3.5' /> Détail
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            )
                          })
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>
                <div className='flex items-center justify-between gap-3 px-6 py-4 max-sm:flex-col md:max-lg:flex-col'>
                  <p className='text-muted-foreground text-sm whitespace-nowrap' aria-live='polite'>
                    Affichage <span>{filteredSessions.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1}</span> à{' '}
                    <span>{Math.min(safePage * PAGE_SIZE, filteredSessions.length)}</span> sur{' '}
                    <span>{filteredSessions.length}</span>
                  </p>
                  <nav role='navigation' aria-label='pagination' className='mx-auto flex w-full justify-center'>
                    <ul className='flex items-center gap-1'>
                      <li>
                        <Button
                          variant='ghost'
                          disabled={safePage <= 1}
                          onClick={() => setPage((p) => Math.max(1, p - 1))}
                        >
                          <ChevronLeft /> Précédent
                        </Button>
                      </li>
                      {pageCount <= 5 ? (
                        Array.from({ length: pageCount }, (_, i) => i + 1).map((p) => (
                          <li key={p}>
                            <Button
                              variant={p === safePage ? 'default' : 'secondary'}
                              size='icon-sm'
                              onClick={() => setPage(p)}
                            >
                              {p}
                            </Button>
                          </li>
                        ))
                      ) : (
                        <>
                          {[1, 2].map((p) => (
                            <li key={p}>
                              <Button
                                variant={p === safePage ? 'default' : 'secondary'}
                                size='icon-sm'
                                onClick={() => setPage(p)}
                              >
                                {p}
                              </Button>
                            </li>
                          ))}
                          <li>
                            <span className='text-muted-foreground flex size-9 items-center justify-center'>
                              <EllipsisVertical className='size-4 rotate-90' />
                              <span className='sr-only'>Plus de pages</span>
                            </span>
                          </li>
                          <li>
                            <Button
                              variant={pageCount === safePage ? 'default' : 'secondary'}
                              size='icon-sm'
                              onClick={() => setPage(pageCount)}
                            >
                              {pageCount}
                            </Button>
                          </li>
                        </>
                      )}
                      <li>
                        <Button
                          variant='ghost'
                          disabled={safePage >= pageCount}
                          onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                        >
                          Suivant <ChevronRight />
                        </Button>
                      </li>
                    </ul>
                  </nav>
                </div>
              </div>
            </Card>
          </div>
        </TabsContent>

        {/* ── Tab 2 : detailed training KPIs ── */}
        <TabsContent value='training'>
          <TrainingOverview />
        </TabsContent>

        {/* ── Tab 3 : Duolingo-style progression path ── */}
        <TabsContent value='progression'>
          <ProgressionPath sessions={sessions} level={level} loading={loading} />
        </TabsContent>
      </Tabs>

    </main>
  )
}

// One funnel row of the "Résultats" card (template's Conversion-rate rows).
function FragmentRow({ label, detail, value, up }: { label: string; detail: string; value: string; up: boolean }) {
  return (
    <>
      <div className='col-span-4 flex flex-col gap-0.5'>
        <span className='font-medium'>{label}</span>
        <span className='text-muted-foreground text-sm'>{detail}</span>
      </div>
      <div className='flex items-center justify-between gap-2'>
        {up ? <ArrowUp className='size-4' /> : <ArrowDown className='size-4' />}
        <span className='text-sm'>{value}</span>
      </div>
    </>
  )
}
