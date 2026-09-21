'use client'

// ──────────────────────────────────────────────
// Training Dashboard — the training-specific hub.
// Card structure mirrors the admin reference layout:
//   Header : 4 KPI stat cards (2-col grid, xl:4) + "Customers"-style highlight card
//   Row 2  : hero card — Total Income area chart (2/3) + Report list (1/3)
//   Row 3  : Monthly campaign state + Total earning + Launch plan + Vehicles-style
//            level breakdown with circular progress rings
//   Row 4  : Full-width sessions table with 3 Select filters + pagination
// All real data (`/api/v1/dashboard/saved-sessions`).
// No admin scores — those stay private to the manager.
// ──────────────────────────────────────────────

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  PlayCircle, Star, ChevronRight, RefreshCw, Zap, Timer, ChevronUp, ChevronDown,
  EllipsisVertical, Trophy, Sparkles, TicketCheck, BookMarked, TrendingUp,
  Users, Wallet, CreditCard, CircleDollarSign, Mail, MailOpen, MousePointerClick,
  TriangleAlert, CircleOff, Check, Stethoscope
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import {
  Bar, BarChart, XAxis, YAxis, CartesianGrid, Area, AreaChart, LabelList, Cell
} from 'recharts'

import { getSavedSessions } from '@/lib/alia-api'
import type { SavedSession, SavedSessionsResponse } from '@/lib/alia-api'
import { LEVEL_META } from '@/types/alia'
import type { CompetenceLevel } from '@/types/alia'

const LEVEL_ORDER: CompetenceLevel[] = ['debutant', 'junior', 'confirme', 'expert']
const LEVEL_META_Typed = LEVEL_META as Record<string, { label?: string }>
const FORMAT_LABELS: Record<string, string> = {
  flash: 'Flash', standard: 'Standard', approfondie: 'Approfondie'
}

const AREA_CONFIG = { sessions: { label: 'Sessions', color: 'var(--chart-2)' } }
const TIMELINE_CONFIG = { sessions: { label: 'Sessions' } }

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

// Circular progress ring (like the "Vehicles Condition" card)
function Ring({ pct, color }: { pct: number; color: string }) {
  const r = 23.5
  const c = 2 * Math.PI * r
  return (
    <div className='relative flex shrink-0 items-center justify-center stroke-border' style={{ width: 52, height: 52 }}>
      <svg viewBox='0 0 52 52' className='size-full -rotate-90 overflow-visible'>
        <circle cx='26' cy='26' r={r} fill='none' stroke='currentColor' strokeWidth='5' strokeLinecap='round' className='text-primary/20' />
        <circle
          cx='26' cy='26' r={r} fill='none' stroke='currentColor' strokeWidth='5'
          strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)}
          strokeLinecap='round' className={`transition-all duration-700 ${color}`}
        />
      </svg>
      <div className='absolute inset-0 flex items-center justify-center text-xs font-medium'>{Math.round(pct)}%</div>
    </div>
  )
}

function TrendBadge({ delta }: { delta: number }) {
  const up = delta >= 0
  return (
    <Badge className='bg-primary/10 h-6 rounded-sm px-3 py-1 text-primary'>
      {up ? '+' : ''}{delta}%
    </Badge>
  )
}

export default function TrainingDashboardHub() {
  const [saved, setSaved] = useState<SavedSessionsResponse | null>(null)
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
    getSavedSessions(false)
      .then(setSaved)
      .catch(() => setError(true))
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
    const totalTime = durations.reduce((a, b) => a + b, 0)
    const thisWeek = saved?.this_week ?? 0
    const prevWeek = Math.max(total - thisWeek, 0)
    const weekDelta = prevWeek > 0 ? Math.round(((thisWeek - prevWeek) / prevWeek) * 100) : thisWeek > 0 ? 100 : 0
    const feedbackPct = total ? Math.round((rated.length / total) * 100) : 0

    const perLevel = Object.fromEntries(
      LEVEL_ORDER.map(l => [l, sessions.filter(s => s.level === l).length])
    ) as Record<string, number>

    // Hero area chart — sessions per day (last 7)
    const areaData = (saved?.weekly ?? []).map(p => ({
      day: p.day.slice(0, 3),
      sessions: p.sessions
    }))

    // Report card (Income/Expense/Profit style)
    const bestSession = [...rated].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))[0] ?? null
    const dayKeys = new Set<string>()
    for (const s of sessions) {
      if (s.completed_at) dayKeys.add(new Date(s.completed_at).toDateString())
    }

    return {
      total, avgRating, avgDuration, totalTime, thisWeek, weekDelta,
      feedbackPct, perLevel, areaData, bestSession, activeDays: dayKeys.size,
      weekly: saved?.weekly ?? []
    }
  }, [saved])

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

  // KPI stat cards (the reference's 4 top cards)
  const kpis = [
    { icon: TicketCheck, cls: 'bg-chart-1/10 text-chart-1', delta: m.weekDelta, deltaUp: m.weekDelta >= 0, value: String(m.total), label: 'Sessions totales', badge: `${m.thisWeek} cette semaine` },
    { icon: Timer, cls: 'bg-chart-2/10 text-chart-2', delta: null, deltaUp: true, value: fmtDuration(m.avgDuration), label: 'Durée moyenne', badge: m.totalTime ? `${fmtDuration(m.totalTime)} cumulées` : '—' },
    { icon: Star, cls: 'bg-chart-3/10 text-chart-3', delta: null, deltaUp: true, value: m.avgRating != null ? `${m.avgRating.toFixed(1)} / 5` : '—', label: 'Note moyenne', badge: `${m.feedbackPct}% avec avis` },
    { icon: BookMarked, cls: 'bg-chart-4/10 text-chart-4', delta: null, deltaUp: true, value: String(m.activeDays), label: 'Jours actifs', badge: 'Depuis le début' }
  ]

  // Level ring breakdown (the "Vehicles Condition" card style)
  const RING_COLORS = ['stroke-chart-1', 'stroke-chart-2', 'stroke-chart-3', 'stroke-chart-5']

  return (
    <div className='grid grid-cols-2 gap-6 xl:grid-cols-3'>
      {/* ── Header row : 4 KPI cards + Customers-style highlight ── */}
      <div className='col-span-2 grid grid-cols-2 gap-6 xl:grid-cols-4'>
        {loading
          ? [0, 1, 2, 3].map(i => <Skeleton key={i} className='h-40 rounded-xl' />)
          : kpis.map((k, i) => {
            const Icon = k.icon
            return (
              <Card key={i}>
                <CardHeader className='flex items-center justify-between'>
                  <Avatar className='size-9.5 rounded-sm'>
                    <AvatarFallback className={`size-9.5 shrink-0 rounded-sm ${k.cls}`}>
                      <Icon className='size-4.75' />
                    </AvatarFallback>
                  </Avatar>
                  {k.delta !== null && (
                    <p className='flex items-center gap-1 text-base'>
                      {k.delta >= 0 ? '+' : ''}{k.delta}%
                      {k.deltaUp ? <ChevronUp className='size-4' /> : <ChevronDown className='size-4' />}
                    </p>
                  )}
                </CardHeader>
                <CardContent className='flex flex-1 flex-col justify-between gap-4'>
                  <p className='flex flex-col gap-1'>
                    <span className='text-lg font-semibold'>{k.value}</span>
                    <span className='text-muted-foreground text-sm'>{k.label}</span>
                  </p>
                  <Badge className='bg-primary/10 w-fit text-primary'>{k.badge}</Badge>
                </CardContent>
              </Card>
            )
          })}
      </div>

      {/* Customers-style highlight card with rings */}
      <Card className='relative justify-between max-xl:col-span-full'>
        <CardHeader className='flex flex-col gap-3'>
          <span className='text-base font-medium'>Régularité</span>
          <Badge className='bg-primary/10 w-fit text-primary'>Jours d&apos;entraînement</Badge>
        </CardHeader>
        <CardContent className='flex items-center gap-2'>
          <span className='text-2xl font-semibold'>{m.activeDays}</span>
          <span className='text-sm text-green-600 dark:text-green-400'>
            {m.activeDays > 0 ? `+${m.activeDays} jour${m.activeDays > 1 ? 's' : ''}` : '—'}
          </span>
        </CardContent>
        <div className='absolute right-4 bottom-4'>
          <Ring pct={100} color='stroke-chart-2' />
        </div>
      </Card>

      {/* ── Hero card : Total Income area chart (2/3) + Report list (1/3) ── */}
      <Card className='col-span-2 grid gap-0 py-0 lg:grid-cols-3'>
        <div className='flex flex-col rounded-none border-b py-6 shadow-none ring-0 max-lg:border-b lg:col-span-2 lg:border-r'>
          <CardHeader className='flex justify-between'>
            <div className='flex flex-col gap-1'>
              <span className='text-lg font-semibold'>Activité d&apos;entraînement</span>
              <span className='text-muted-foreground text-sm'>Vue hebdomadaire</span>
            </div>
            <Button variant='ghost' size='icon' className='text-muted-foreground rounded-full' aria-label='Menu'>
              <EllipsisVertical className='size-4' />
            </Button>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className='h-60 w-full rounded-md' />
            ) : (
              <ChartContainer config={AREA_CONFIG} className='h-60 max-h-80 min-h-48 w-full'>
                <AreaChart data={m.areaData} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id='fillSessions' x1='0' y1='0' x2='0' y2='1'>
                      <stop offset='20%' stopColor='var(--chart-2)' stopOpacity='1' />
                      <stop offset='80%' stopColor='var(--chart-2)' stopOpacity='0' />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray='3' stroke='var(--border)' vertical={false} />
                  <XAxis dataKey='day' tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }} />
                  <ChartTooltip content={<ChartTooltipContent />} cursor={false} />
                  <Area dataKey='sessions' stroke='var(--chart-2)' strokeWidth={2} fill='url(#fillSessions)' fillOpacity={0.6} />
                </AreaChart>
              </ChartContainer>
            )}
          </CardContent>
        </div>

        {/* Report half */}
        <div className='flex flex-col gap-10 rounded-none py-6 shadow-none ring-0'>
          <CardHeader className='flex justify-between'>
            <div className='flex flex-col gap-1'>
              <span className='text-lg font-semibold'>Bilan</span>
              <span className='text-muted-foreground text-sm'>Activité globale</span>
            </div>
            <Button variant='ghost' size='icon' className='text-muted-foreground rounded-full' aria-label='Menu'>
              <EllipsisVertical className='size-4' />
            </Button>
          </CardHeader>
          <CardContent className='grow text-base'>
            <div className='flex h-full flex-col gap-4'>
              <div className='bg-muted flex grow items-center gap-4 rounded-md px-4 py-2'>
                <Avatar className='size-10 rounded-sm'>
                  <AvatarFallback className='rounded-sm bg-card'>
                    <Timer className='size-6 stroke-[1.5] text-chart-2' />
                  </AvatarFallback>
                </Avatar>
                <div className='flex flex-col gap-0.5'>
                  <span className='text-muted-foreground font-medium'>Temps cumulé</span>
                  <span className='text-lg font-medium'>{fmtDuration(m.totalTime)}</span>
                </div>
              </div>
              <div className='bg-muted flex grow items-center gap-4 rounded-md px-4 py-2'>
                <Avatar className='size-10 rounded-sm'>
                  <AvatarFallback className='rounded-sm bg-card'>
                    <Star className='size-6 stroke-[1.5] text-chart-1' />
                  </AvatarFallback>
                </Avatar>
                <div className='flex flex-col gap-0.5'>
                  <span className='text-muted-foreground font-medium'>Note moyenne</span>
                  <span className='text-lg font-medium'>{m.avgRating != null ? `${m.avgRating.toFixed(1)} / 5` : '—'}</span>
                </div>
              </div>
              <div className='bg-muted flex grow items-center gap-4 rounded-md px-4 py-2'>
                <Avatar className='size-10 rounded-sm'>
                  <AvatarFallback className='rounded-sm bg-card'>
                    <Trophy className='size-6 stroke-[1.5] text-chart-5' />
                  </AvatarFallback>
                </Avatar>
                <div className='flex min-w-0 flex-col gap-0.5'>
                  <span className='text-muted-foreground font-medium'>Meilleure session</span>
                  <span className='truncate text-lg font-medium capitalize'>
                    {m.bestSession ? `Entretien ${m.bestSession.doctor_style}` : 'Aucune notée'}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </div>
      </Card>

      {/* ── Row : Monthly campaign state (per-format) ── */}
      <Card className='col-span-2 justify-between xl:col-span-1'>
        <CardHeader className='flex justify-between'>
          <div className='flex flex-col gap-1'>
            <span className='text-lg font-semibold'>Répartition par format</span>
            <span className='text-muted-foreground text-sm'>{m.total} session(s) au total</span>
          </div>
          <Button variant='ghost' size='icon' className='text-muted-foreground rounded-full' aria-label='Menu'>
            <EllipsisVertical className='size-4' />
          </Button>
        </CardHeader>
        <CardContent className='flex flex-1 flex-col justify-between gap-4'>
          {Object.entries(FORMAT_LABELS).map(([key, label], i) => {
            const count = sessions.filter(s => s.visit_format === key).length
            const pct = m.total ? Math.round((count / m.total) * 100) : 0
            const Icon = [Mail, MailOpen, MousePointerClick][i] ?? Mail
            const cls = ['bg-chart-1/10 text-chart-1', 'bg-chart-2/10 text-chart-2', 'bg-chart-3/10 text-chart-3'][i]
            return (
              <div key={key} className='flex items-center justify-between gap-2'>
                <div className='flex items-center gap-2'>
                  <Avatar className='size-8 rounded-sm'>
                    <AvatarFallback className={`shrink-0 rounded-sm *:size-4 ${cls}`}>
                      <Icon />
                    </AvatarFallback>
                  </Avatar>
                  <span className='text-base font-medium'>{label}</span>
                </div>
                <div className='flex items-center gap-2 text-sm'>
                  <span className='text-muted-foreground'>{count}</span>
                  <span>{pct}%</span>
                </div>
              </div>
            )
          })}
        </CardContent>
      </Card>

      {/* ── Total earning-style card : level bar chart ── */}
      <Card className='col-span-2 justify-between gap-4 xl:col-span-1'>
        <CardHeader className='flex justify-between'>
          <div className='flex flex-col gap-4'>
            <span className='text-lg font-semibold'>Progression par niveau</span>
            <div className='flex items-center gap-3'>
              <span className='text-4xl font-semibold'>{m.total}</span>
              <span className='text-sm text-muted-foreground'>sessions</span>
            </div>
          </div>
          <Button variant='ghost' size='icon' className='text-muted-foreground rounded-full' aria-label='Menu'>
            <EllipsisVertical className='size-4' />
          </Button>
        </CardHeader>
        <CardContent className='flex flex-col justify-between gap-4'>
          {loading ? (
            <Skeleton className='h-40 w-full rounded-md' />
          ) : (
            <ChartContainer config={TIMELINE_CONFIG} className='h-40 w-full'>
              <BarChart data={LEVEL_ORDER.map(level => ({ name: (LEVEL_META_Typed[level]?.label ?? level).slice(0, 3), sessions: m.perLevel[level] ?? 0 }))}>
                <XAxis dataKey='name' tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} />
                <ChartTooltip content={<ChartTooltipContent />} cursor={false} />
                <Bar dataKey='sessions' radius={6} barSize={18} fill='var(--chart-5)' />
              </BarChart>
            </ChartContainer>
          )}
          <div className='space-y-4'>
            <div className='flex items-center justify-between gap-2'>
              <div className='flex items-center gap-3'>
                <Avatar className='size-8 rounded-sm'>
                  <AvatarFallback className='rounded-sm bg-primary/10 text-primary'>
                    <Sparkles className='size-5' />
                  </AvatarFallback>
                </Avatar>
                <div className='flex flex-col gap-0.5'>
                  <span className='text-base font-medium'>Cette semaine</span>
                  <span className='text-muted-foreground text-xs'>Sessions réalisées</span>
                </div>
              </div>
              <span className='text-sm'>+{m.thisWeek}</span>
            </div>
            <div className='flex items-center justify-between gap-2'>
              <div className='flex items-center gap-3'>
                <Avatar className='size-8 rounded-sm'>
                  <AvatarFallback className='rounded-sm bg-primary/10 text-primary'>
                    <TrendingUp className='size-5' />
                  </AvatarFallback>
                </Avatar>
                <div className='flex flex-col gap-0.5'>
                  <span className='text-base font-medium'>Vs semaine passée</span>
                  <span className='text-muted-foreground text-xs'>Évolution d&apos;activité</span>
                </div>
              </div>
              <span className='text-sm'>{m.weekDelta >= 0 ? '+' : ''}{m.weekDelta}%</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Launch plan card (the "For Business Shark" checkbox card) ── */}
      <Card className='col-span-2 justify-between gap-4 xl:col-span-1'>
        <CardHeader>
          <div className='flex items-center justify-between gap-2'>
            <span className='text-lg font-semibold'>Prêt pour une nouvelle visite ?</span>
            <Button variant='ghost' size='icon' className='text-muted-foreground rounded-full' aria-label='Menu'>
              <EllipsisVertical className='size-4' />
            </Button>
          </div>
          <p className='text-muted-foreground text-sm'>
            Choisissez le niveau et le profil du médecin, puis lancez la simulation en situation réelle.
          </p>
        </CardHeader>
        <CardContent className='space-y-2'>
          <Label className='text-base font-medium'>Format de visite</Label>
          {Object.entries(FORMAT_LABELS).map(([key, label], i) => {
            const durations: Record<string, string> = { flash: '2 min', standard: '4 min', approfondie: '8 min' }
            return (
              <Link key={key} href='/simulation' className='block'>
                <div className='flex cursor-pointer items-center gap-3 rounded-md border px-4 py-2 transition-colors hover:border-primary'>
                  <Checkbox checked={i === 0} readOnly aria-readonly />
                  <div className='flex w-full items-center justify-between gap-2'>
                    <p className='text-sm leading-none font-medium'>{label}</p>
                    <Badge className='bg-primary/10 h-6 rounded-sm px-3 py-1 text-primary'>
                      {durations[key]}
                    </Badge>
                  </div>
                </div>
              </Link>
            )
          })}
        </CardContent>
        <CardContent className='flex flex-col gap-2'>
          <div className='flex items-center justify-between text-sm'>
            <span>Note moyenne</span>
            <span>{m.avgRating != null ? `${m.avgRating.toFixed(1)} / 5` : '—'}</span>
          </div>
          <div className='flex items-center justify-between'>
            <span className='text-sm'>Sessions terminées</span>
            <span className='text-lg font-medium'>{m.total}</span>
          </div>
        </CardContent>
        <CardContent>
          <Link href='/simulation'>
            <Button className='h-10 w-full gap-2'>
              <PlayCircle className='size-5' /> Lancer une simulation
            </Button>
          </Link>
        </CardContent>
      </Card>

      {/* ── Vehicles-style card : level breakdown with rings ── */}
      <Card className='col-span-2 justify-between gap-6 xl:col-span-1'>
        <CardHeader className='flex items-center justify-between'>
          <span className='text-lg font-semibold'>Répartition par niveau</span>
          <Button variant='ghost' size='icon' className='text-muted-foreground rounded-full' aria-label='Menu'>
            <EllipsisVertical className='size-4' />
          </Button>
        </CardHeader>
        <CardContent className='flex flex-1 flex-col justify-between gap-4'>
          {LEVEL_ORDER.map((level, i) => {
            const count = m.perLevel[level] ?? 0
            const pct = m.total ? (count / m.total) * 100 : 0
            return (
              <div key={level} className='flex items-center justify-between gap-2'>
                <div className='flex items-center gap-3'>
                  <Ring pct={pct} color={RING_COLORS[i % RING_COLORS.length]} />
                  <div className='flex flex-col gap-0.5'>
                    <span className='text-base font-medium'>{LEVEL_META_Typed[level]?.label ?? level}</span>
                    <span className='text-muted-foreground text-sm'>{count} session(s)</span>
                  </div>
                </div>
                <TrendBadge delta={pct > 0 ? Math.round(pct) : 0} />
              </div>
            )
          })}
        </CardContent>
      </Card>

      {/* ── Full-width sessions table with 3 filters + pagination ── */}
      <Card className='col-span-full py-0'>
        <div className='w-full'>
          <div className='border-b'>
            <div className='flex flex-col gap-4 p-6'>
              <div className='grid grid-cols-1 gap-6 max-md:*:last:col-span-full sm:grid-cols-2 md:grid-cols-3'>
                <div className='flex w-full flex-col gap-2'>
                  <Label htmlFor='tr-level'>Niveau</Label>
                  <Select value={levelFilter} onValueChange={v => setLevelFilter(v ?? 'all')}>
                    <SelectTrigger className='w-full capitalize' id='tr-level'><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value='all'>Tous</SelectItem>
                      {LEVEL_ORDER.map(k => (
                        <SelectItem key={k} value={k}>{LEVEL_META_Typed[k]?.label ?? k}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className='flex w-full flex-col gap-2'>
                  <Label htmlFor='tr-format'>Format</Label>
                  <Select value={formatFilter} onValueChange={v => setFormatFilter(v ?? 'all')}>
                    <SelectTrigger className='w-full' id='tr-format'><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value='all'>Tous</SelectItem>
                      <SelectItem value='flash'>Flash</SelectItem>
                      <SelectItem value='standard'>Standard</SelectItem>
                      <SelectItem value='approfondie'>Approfondie</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className='flex w-full flex-col gap-2'>
                  <Label htmlFor='tr-rated'>Avis</Label>
                  <Select value={ratedFilter} onValueChange={v => setRatedFilter(v ?? 'all')}>
                    <SelectTrigger className='w-full' id='tr-rated'><SelectValue /></SelectTrigger>
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
                          <TableCell className='text-sm'>{FORMAT_LABELS[s.visit_format] ?? s.visit_format}</TableCell>
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
