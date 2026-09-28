'use client'

// ──────────────────────────────────────────────
// Détail d'une simulation — page d'évaluation
//
// The full review of one finished simulation, as a page (not a drawer): the
// headline score, the six visit steps scored one by one, the points forts and
// axes d'amélioration, where the session left the trainee on their level path,
// the CRM visit report, the whole message-by-message transcript and the
// feedback the trainee left.
//
// Reachable from every sessions table (row click or the eye action) at
// /dashboard/training/sessions/[id]. Data comes from
// GET /api/v1/sessions/{id}/detail, which scopes itself: an admin reads their
// tenant's sessions, everyone else only their own.
//
// Scores are stored on the backend's 0–10 evaluation scale (the scorer writes
// "Score Global: x/10"), so every figure here is normalised before being shown
// as a percentage — see scorePct().
// ──────────────────────────────────────────────

import { useEffect, useMemo, useState } from 'react'

import Link from 'next/link'
import {
  AlertTriangle,
  ArrowLeft,
  Award,
  Check,
  ClipboardCheck,
  Clock,
  Copy,
  FileText,
  Lightbulb,
  MessageSquare,
  PlayCircle,
  RefreshCw,
  Search,
  Sparkles,
  Star,
  Target,
  TrendingUp,
  User
} from 'lucide-react'

import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'

import { ALL_VISIT_STEPS, LEVEL_META, STEP_META } from '@/types/alia'
import { ApiError, getSessionDetail } from '@/lib/alia-api'
import type { LevelProgression, Objection, SessionDetail } from '@/lib/alia-api'
import { cn } from '@/lib/utils'

const MODE_LABELS: Record<string, string> = {
  training: 'Entraînement',
  commercial: 'Présentation médecin'
}

const FORMAT_LABELS: Record<string, string> = {
  flash: 'Flash',
  standard: 'Standard',
  approfondie: 'Approfondie'
}

// ── Score helpers ──
// The backend evaluates on a 0–10 scale; older rows written before that
// convention may still carry a /100 figure, so anything above 10 is treated as
// already being a percentage.

function scoreOutOfTen(value: number): number {
  return value > 10 ? value / 10 : value
}

function scorePct(value: number): number {
  return Math.max(0, Math.min(100, Math.round(scoreOutOfTen(value) * 10)))
}

function scoreLabel(value: number): string {
  return `${scoreOutOfTen(value).toFixed(1).replace('.', ',')}/10`
}

type Tone = { label: string; text: string; bar: string; stroke: string }

const TONES: Record<'high' | 'mid' | 'low', Tone> = {
  high: { label: 'Excellent', text: 'text-emerald-600 dark:text-emerald-400', bar: 'bg-emerald-500', stroke: 'stroke-emerald-500' },
  mid: { label: 'Solide', text: 'text-amber-600 dark:text-amber-400', bar: 'bg-amber-500', stroke: 'stroke-amber-500' },
  low: { label: 'À consolider', text: 'text-destructive', bar: 'bg-destructive', stroke: 'stroke-destructive' }
}

/** Thresholds mirror the backend scorer: ≥ 8 excellent, ≥ 6 solide. */
function toneFor(value: number): Tone {
  const score = scoreOutOfTen(value)

  return score >= 8 ? TONES.high : score >= 6 ? TONES.mid : TONES.low
}

function fmtDuration(seconds?: number | null): string {
  if (!seconds) return '—'
  const m = Math.floor(seconds / 60)
  const s = Math.round(seconds % 60)

  return m > 0 ? `${m} min ${String(s).padStart(2, '0')} s` : `${s} s`
}

function fmtDateTime(value?: string | null): string {
  if (!value) return '—'

  return new Date(value).toLocaleString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

/** "introduction: Improve greeting" → the step key and the remark on its own. */
function splitRemark(remark: string): { step: string | null; text: string } {
  const at = remark.indexOf(':')

  if (at <= 0) return { step: null, text: remark }
  const key = remark.slice(0, at).trim()

  if (!(key in STEP_META)) return { step: null, text: remark }

  return { step: key, text: remark.slice(at + 1).trim() }
}

function objectionText(o: string | Objection): string {
  if (typeof o === 'string') return o

  return o.objection ?? JSON.stringify(o)
}

function levelLabel(level?: string | null): string | null {
  if (!level) return null

  return LEVEL_META[level as keyof typeof LEVEL_META]?.label ?? level
}

export default function SessionReview({ sessionId }: { sessionId: string }) {
  const [state, setState] = useState<{
    loading: boolean
    detail: SessionDetail | null
    error: string | null
  }>({ loading: true, detail: null, error: null })


  // Bumped by the retry button so the effect re-runs without setting state itself.
  const [attempt, setAttempt] = useState(0)
  const [query, setQuery] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let cancelled = false

    getSessionDetail(sessionId)
      .then((detail) => {
        if (!cancelled) setState({ loading: false, detail, error: null })
      })
      .catch((e) => {
        if (!cancelled) {
          setState({
            loading: false,
            detail: null,
            error: e instanceof ApiError ? e.message : 'Impossible de charger cette session.'
          })
        }
      })

    return () => {
      cancelled = true
    }
  }, [sessionId, attempt])

  const { loading, detail, error } = state

  const retry = () => {
    setState({ loading: true, detail: null, error: null })
    setAttempt((n) => n + 1)
  }

  const transcript = useMemo(() => detail?.transcript ?? [], [detail])

  const filteredTranscript = useMemo(() => {
    const q = query.trim().toLowerCase()

    if (!q) return transcript

    return transcript.filter((turn) => turn.content.toLowerCase().includes(q))
  }, [transcript, query])

  // ── Step scores, always in visit order so the review reads like the visit ──
  const steps = useMemo(() => {
    const scores = detail?.step_scores ?? {}

    return ALL_VISIT_STEPS.map((step) => ({
      key: step,
      meta: STEP_META[step],
      score: typeof scores[step] === 'number' ? scores[step] : null
    }))
  }, [detail])

  const scoredSteps = steps.filter((s) => s.score !== null)

  const stepAverage = scoredSteps.length
    ? scoredSteps.reduce((sum, s) => sum + scoreOutOfTen(s.score as number), 0) / scoredSteps.length
    : null

  if (loading) {
    return (
      <main className='mx-auto size-full max-w-360 flex-1 space-y-6 px-4 py-6 sm:px-6'>
        <div className='space-y-2'>
          <Skeleton className='h-4 w-40' />
          <Skeleton className='h-8 w-72' />
        </div>
        <div className='grid grid-cols-6 gap-6'>
          <Skeleton className='col-span-full h-72 rounded-xl 2xl:col-span-2' />
          <Skeleton className='col-span-full h-72 rounded-xl 2xl:col-span-4' />
          <Skeleton className='col-span-full h-64 rounded-xl' />
        </div>
      </main>
    )
  }

  if (error || !detail) {
    return (
      <main className='mx-auto size-full max-w-360 flex-1 px-4 py-6 sm:px-6'>
        <Card className='border-destructive/40 2xl:col-span-2'>
          <CardHeader>
            <CardTitle className='text-destructive'>Session indisponible</CardTitle>
            <CardDescription>
              {error ?? 'Cette session n’existe pas ou ne fait pas partie de votre historique.'}
            </CardDescription>
          </CardHeader>
          <CardContent className='flex flex-wrap gap-2'>
            <Button variant='outline' onClick={retry}>
              <RefreshCw /> Réessayer
            </Button>
            <Button variant='ghost' nativeButton={false} render={<Link href='/dashboard/training/simulator' />}>
              <ArrowLeft /> Retour à l’historique
            </Button>
          </CardContent>
        </Card>
      </main>
    )
  }

  const score = typeof detail.overall_score === 'number' ? detail.overall_score : null
  const tone = score !== null ? toneFor(score) : null
  const levelNext = detail.level_progression ?? null
  const crm = detail.crm ?? {}
  const levelMeta = LEVEL_META[detail.level as keyof typeof LEVEL_META]

  const copyTranscript = async () => {
    const text = transcript
      .map((turn) => `${turn.role === 'assistant' ? 'ALIA' : 'Délégué'} : ${turn.content}`)
      .join('\n\n')

    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard is unavailable (insecure context or denied) — nothing to do.
    }
  }

  return (
    <main className='mx-auto size-full max-w-360 flex-1 px-4 py-6 sm:px-6'>
      {/* ── Header ── */}
      <div className='mb-6 flex flex-wrap items-start justify-between gap-4'>
        <div className='flex min-w-0 flex-col gap-1'>
          <Link
            href='/dashboard/training/simulator'
            className='text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm'
          >
            <ArrowLeft className='size-4' /> Historique des sessions
          </Link>
          <h1 className='truncate text-2xl font-semibold tracking-tight'>
            {detail.product_focus || 'Session libre'}
          </h1>
          <p className='text-muted-foreground text-sm'>
            {fmtDateTime(detail.completed_at)} · {MODE_LABELS[detail.mode ?? ''] ?? detail.mode ?? 'Entraînement'}
            {detail.duration_seconds ? ` · ${fmtDuration(detail.duration_seconds)}` : ''}
          </p>
        </div>
        <div className='flex flex-wrap items-center gap-2'>
          {levelMeta ? (
            <Badge variant='secondary' className={cn('text-xs', levelMeta.textClass)}>
              {levelMeta.label}
            </Badge>
          ) : null}
          <Badge variant='outline' className='text-xs'>
            {FORMAT_LABELS[detail.visit_format ?? ''] ?? detail.visit_format ?? 'Format —'}
          </Badge>
          {detail.unscored ? (
            <Badge variant='outline' className='text-xs'>
              Non évaluée
            </Badge>
          ) : null}
        </div>
      </div>

      <div className='grid grid-cols-6 gap-6'>
        {/* ── Headline score ── */}
        <Card className='col-span-full 2xl:col-span-2'>
          <CardHeader>
            <CardTitle className='flex items-center gap-2 text-lg'>
              <Target className='text-primary size-5' /> Évaluation
            </CardTitle>
            <CardDescription>Note globale de la simulation, sur 10.</CardDescription>
          </CardHeader>
          <CardContent className='flex flex-col items-center gap-4'>
            {detail.unscored || score === null ? (
              <div className='bg-muted/40 text-muted-foreground w-full rounded-xl px-4 py-10 text-center text-sm'>
                {detail.unscored
                  ? 'Présentation reçue par un médecin — le médecin n’est jamais noté.'
                  : 'Cette session n’a pas encore été évaluée.'}
              </div>
            ) : (
              <>
                <ScoreDonut score={score} tone={tone as Tone} />
                <div className='flex flex-col items-center gap-1'>
                  <span className={cn('text-sm font-semibold', (tone as Tone).text)}>{(tone as Tone).label}</span>
                  <span className='text-muted-foreground text-xs'>
                    {Math.round(scoreOutOfTen(score))} XP gagnés sur cette session
                  </span>
                </div>
                {stepAverage !== null ? (
                  <div className='bg-muted/40 flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm'>
                    <span className='text-muted-foreground'>Moyenne des étapes</span>
                    <span className='font-medium tabular-nums'>{scoreLabel(stepAverage)}</span>
                  </div>
                ) : null}
              </>
            )}
          </CardContent>
        </Card>

        {/* ── Step by step ── */}
        <Card className='col-span-full 2xl:col-span-4'>
          <CardHeader>
            <CardTitle className='flex items-center gap-2 text-lg'>
              <TrendingUp className='text-primary size-5' /> Évaluation étape par étape
            </CardTitle>
            <CardDescription>
              Les six étapes de la visite VITAL — chaque barre est notée sur 10.
            </CardDescription>
          </CardHeader>
          <CardContent className='space-y-4'>
            {steps.map((step) => {
              const stepTone = step.score !== null ? toneFor(step.score) : null

              return (
                <div key={step.key} className='space-y-1.5'>
                  <div className='flex items-center justify-between gap-3 text-sm'>
                    <span className='flex items-center gap-2 font-medium'>
                      <span className={cn('size-2 rounded-full', step.meta.bgClass)} />
                      {step.meta.label}
                    </span>
                    {step.score !== null ? (
                      <span className={cn('font-semibold tabular-nums', stepTone?.text)}>
                        {scoreLabel(step.score)}
                      </span>
                    ) : (
                      <span className='text-muted-foreground text-xs'>Non évaluée</span>
                    )}
                  </div>
                  <div className='bg-muted flex h-2 w-full overflow-hidden rounded-full'>
                    <div
                      className={cn('h-full rounded-full transition-all', stepTone?.bar ?? 'bg-muted-foreground/20')}
                      style={{ width: `${step.score !== null ? scorePct(step.score) : 0}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>

        {/* ── Points forts / axes d'amélioration ── */}
        <Card className='col-span-full'>
          <CardHeader>
            <CardTitle className='flex items-center gap-2 text-lg'>
              <Lightbulb className='text-primary size-5' /> Points forts &amp; axes d’amélioration
            </CardTitle>
            <CardDescription>Ce que la simulation a mis en valeur, et ce qu’il reste à travailler.</CardDescription>
          </CardHeader>
          <CardContent className='grid grid-cols-1 gap-6 lg:grid-cols-2'>
            <div className='space-y-3'>
              <p className='flex items-center gap-2 text-xs font-semibold tracking-wide uppercase'>
                <Sparkles className='size-4 text-emerald-500' /> Points forts
              </p>
              {detail.strengths.length === 0 ? (
                <p className='text-muted-foreground text-sm'>Aucun point fort relevé sur cette session.</p>
              ) : (
                detail.strengths.map((remark, i) => (
                  <Remark key={i} remark={remark} kind='strength' />
                ))
              )}
            </div>
            <div className='space-y-3'>
              <p className='flex items-center gap-2 text-xs font-semibold tracking-wide uppercase'>
                <AlertTriangle className='size-4 text-amber-500' /> À travailler
              </p>
              {detail.areas_for_improvement.length === 0 ? (
                <p className='text-muted-foreground text-sm'>Rien à signaler — visitez une nouvelle fois pour affiner.</p>
              ) : (
                detail.areas_for_improvement.map((remark, i) => (
                  <Remark key={i} remark={remark} kind='area' />
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* ── Level progression ── */}
        <Card className='col-span-full lg:col-span-3 2xl:col-span-2'>
          <CardHeader>
            <CardTitle className='flex items-center gap-2 text-lg'>
              <Award className='text-primary size-5' /> Progression de niveau
            </CardTitle>
            <CardDescription>Où cette session vous laisse sur votre parcours.</CardDescription>
          </CardHeader>
          <CardContent className='space-y-4'>
            {levelNext ? (
              <LevelPath progression={levelNext} />
            ) : (
              <p className='text-muted-foreground text-sm'>
                Cette session n’a pas déclenché de calcul de niveau.
              </p>
            )}
            <Separator />
            <div className='grid grid-cols-2 gap-3 text-sm'>
              <Fact label='Niveau de la session' value={levelLabel(detail.level) ?? '—'} />
              <Fact label='Niveau atteint' value={levelLabel(levelNext?.current_level) ?? levelLabel(detail.level) ?? '—'} />
            </div>
          </CardContent>
        </Card>

        {/* ── CRM visit report ── */}
        <Card className='col-span-full lg:col-span-3 2xl:col-span-4'>
          <CardHeader>
            <CardTitle className='flex items-center gap-2 text-lg'>
              <ClipboardCheck className='text-primary size-5' /> Fiche de visite
            </CardTitle>
            <CardDescription>Ce qu’ALIA a retenu de l’échange avec le médecin simulé.</CardDescription>
          </CardHeader>
          <CardContent className='space-y-4 text-sm'>
            <div className='grid grid-cols-1 gap-3 sm:grid-cols-2'>
              <Fact label='Profil médecin' value={detail.doctor_style || '—'} capitalize />
              <Fact label='Spécialité' value={crm.doctor_specialty || '—'} />
              <Fact label='Engagement' value={crm.engagement_level || '—'} />
              <Fact
                label='Contexte'
                value={MODE_LABELS[crm.context ?? ''] ?? crm.context ?? '—'}
              />
            </div>

            {crm.need_identified ? (
              <Line label='Besoin identifié' value={crm.need_identified} />
            ) : null}
            {crm.message_delivered ? (
              <Line label='Message clé délivré' value={crm.message_delivered} />
            ) : null}
            {crm.next_step ? (
              <Line
                label='Prochaine étape'
                value={crm.next_step_date ? `${crm.next_step} (${crm.next_step_date})` : crm.next_step}
              />
            ) : null}

            {(crm.soncas_detected?.length ?? 0) > 0 ? (
              <div className='space-y-2'>
                <p className='text-muted-foreground text-xs font-semibold tracking-wide uppercase'>
                  Motivations SONDAGE détectées
                </p>
                <div className='flex flex-wrap gap-1.5'>
                  {crm.soncas_detected?.map((s, i) => (
                    <Badge key={i} variant='secondary' className='text-xs capitalize'>
                      {s}
                    </Badge>
                  ))}
                </div>
              </div>
            ) : null}

            {(crm.objections_encountered?.length ?? 0) > 0 ? (
              <div className='space-y-2'>
                <p className='text-muted-foreground text-xs font-semibold tracking-wide uppercase'>Objections</p>
                <div className='flex flex-wrap gap-1.5'>
                  {crm.objections_encountered?.map((o, i) => {
                    const handled = typeof o === 'object' ? o.handled : null

                    return (
                      <Badge
                        key={i}
                        className='border-none bg-amber-600/10 text-xs text-amber-600 dark:bg-amber-400/10 dark:text-amber-400'
                      >
                        {objectionText(o)}
                        {handled ? ` · ${handled}` : ''}
                      </Badge>
                    )
                  })}
                </div>
              </div>
            ) : null}

            {(crm.material_left?.length ?? 0) > 0 ? (
              <div className='space-y-2'>
                <p className='text-muted-foreground text-xs font-semibold tracking-wide uppercase'>
                  Matériel laissé
                </p>
                <div className='flex flex-wrap gap-1.5'>
                  {crm.material_left?.map((m, i) => (
                    <Badge key={i} variant='outline' className='text-xs'>
                      {m}
                    </Badge>
                  ))}
                </div>
              </div>
            ) : null}

            {!crm.need_identified && !crm.message_delivered && !crm.next_step ? (
              <p className='text-muted-foreground'>
                Aucune fiche de visite pour cette session — le rapport est produit par la simulation.
              </p>
            ) : null}
          </CardContent>
        </Card>

        {/* ── Transcript ── */}
        <Card className='col-span-full py-0 shadow-none'>
          <div className='flex flex-wrap items-center justify-between gap-3 border-b px-6 py-4'>
            <div className='flex items-center gap-2'>
              <MessageSquare className='text-primary size-5' />
              <span className='text-base font-medium'>Transcription</span>
              <Badge variant='secondary' className='text-xs'>
                {transcript.length} tour{transcript.length > 1 ? 's' : ''}
              </Badge>
            </div>
            <div className='flex items-center gap-2'>
              {transcript.length > 6 ? (
                <div className='relative'>
                  <Search className='text-muted-foreground absolute start-2.5 top-1/2 size-4 -translate-y-1/2' />
                  <Input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder='Rechercher dans la transcription…'
                    className='h-9 w-56 ps-8'
                  />
                </div>
              ) : null}
              {transcript.length > 0 ? (
                <Button variant='outline' size='sm' onClick={copyTranscript}>
                  {copied ? <Check /> : <Copy />} {copied ? 'Copié' : 'Copier'}
                </Button>
              ) : null}
            </div>
          </div>
          <CardContent className='px-6 py-5'>
            {transcript.length === 0 ? (
              <div className='flex flex-col items-center gap-2 py-10 text-center'>
                <FileText className='text-muted-foreground/60 size-8' />
                <p className='text-sm font-medium'>Transcription indisponible</p>
                <p className='text-muted-foreground max-w-md text-sm'>
                  Le verbatim n’est enregistré que pour les simulations jouées après l’activation du rapport
                  CRM. Les sessions plus anciennes conservent leurs scores et leur fiche, mais pas l’échange.
                </p>
              </div>
            ) : (
              <div className='space-y-4'>
                {filteredTranscript.length === 0 ? (
                  <p className='text-muted-foreground py-6 text-center text-sm'>
                    Aucun tour ne correspond à « {query} ».
                  </p>
                ) : (
                  filteredTranscript.map((turn, i) => {
                    const isAlia = turn.role === 'assistant'

                    return (
                      <div key={i} className={cn('flex gap-3', isAlia ? 'justify-start' : 'flex-row-reverse')}>
                        <Avatar className={cn('size-8 shrink-0 after:border-0', isAlia ? 'rounded-sm' : 'rounded-full')}>
                          <AvatarFallback
                            className={cn(isAlia ? 'bg-primary/10 text-primary' : 'bg-chart-2/10 text-chart-2')}
                          >
                            {isAlia ? <PlayCircle className='size-4' /> : <User className='size-4' />}
                          </AvatarFallback>
                        </Avatar>
                        <div
                          className={cn(
                            'max-w-[80%] rounded-xl px-4 py-2.5 text-sm',
                            isAlia ? 'bg-muted/60' : 'bg-primary/10'
                          )}
                        >
                          <p className='text-muted-foreground mb-0.5 text-[11px] font-medium'>
                            {isAlia ? 'ALIA' : 'Délégué'}
                          </p>
                          <p className='whitespace-pre-wrap'>{turn.content}</p>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Feedback left by the trainee ── */}
        <Card className='col-span-full lg:col-span-3'>
          <CardHeader>
            <CardTitle className='flex items-center gap-2 text-lg'>
              <Star className='text-primary size-5' /> Votre retour
            </CardTitle>
            <CardDescription>Ce que vous avez pensé de cette simulation.</CardDescription>
          </CardHeader>
          <CardContent className='space-y-3'>
            {detail.feedback ? (
              <>
                <div className='flex items-center gap-2'>
                  <span className='flex items-center gap-0.5'>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Star
                        key={n}
                        className={cn(
                          'size-4',
                          n <= (detail.feedback?.rating ?? 0)
                            ? 'fill-amber-400 text-amber-400'
                            : 'text-muted-foreground/30'
                        )}
                      />
                    ))}
                  </span>
                  <span className='text-muted-foreground text-sm'>
                    {detail.feedback.rating ? `${detail.feedback.rating}/5` : 'Sans note'}
                  </span>
                </div>
                {detail.feedback.comment ? (
                  <p className='text-sm italic'>« {detail.feedback.comment} »</p>
                ) : (
                  <p className='text-muted-foreground text-sm'>Aucun commentaire laissé.</p>
                )}
                {detail.feedback.would_recommend !== undefined ? (
                  <Badge variant='secondary' className='text-xs'>
                    {detail.feedback.would_recommend ? 'Recommande la simulation' : 'Ne recommande pas'}
                  </Badge>
                ) : null}
              </>
            ) : (
              <p className='text-muted-foreground text-sm'>
                Vous n’avez pas laissé de retour sur cette session.
              </p>
            )}
          </CardContent>
        </Card>

        {/* ── Raw facts ── */}
        <Card className='col-span-full lg:col-span-3'>
          <CardHeader>
            <CardTitle className='flex items-center gap-2 text-lg'>
              <Clock className='text-primary size-5' /> Détails de la session
            </CardTitle>
            <CardDescription>Les paramètres exacts dans lesquels la simulation a été jouée.</CardDescription>
          </CardHeader>
          <CardContent className='grid grid-cols-2 gap-3 text-sm'>
            <Fact label='Produit' value={detail.product_focus || 'Session libre'} />
            <Fact label='Niveau demandé' value={levelLabel(detail.level) ?? '—'} />
            <Fact label='Format' value={FORMAT_LABELS[detail.visit_format ?? ''] ?? detail.visit_format ?? '—'} />
            <Fact label='Durée' value={fmtDuration(detail.duration_seconds)} />
            <Fact label='Messages échangés' value={detail.messages ? String(detail.messages) : '—'} />
            <Fact label='Délégué' value={detail.owner_name ?? '—'} />
            <div className='col-span-2'>
              <Fact label='Identifiant de session' value={detail.session_id} mono />
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}

// ── Score donut ──

function ScoreDonut({ score, tone }: { score: number; tone: Tone }) {
  const pct = scorePct(score)
  const radius = 52
  const circumference = 2 * Math.PI * radius

  return (
    <div className='relative flex size-44 items-center justify-center'>
      <svg viewBox='0 0 120 120' className='size-44 -rotate-90'>
        <circle cx='60' cy='60' r={radius} fill='none' strokeWidth='12' className='stroke-muted' />
        <circle
          cx='60'
          cy='60'
          r={radius}
          fill='none'
          strokeWidth='12'
          strokeLinecap='round'
          className={tone.stroke}
          strokeDasharray={`${(pct / 100) * circumference} ${circumference}`}
        />
      </svg>
      <div className='absolute flex flex-col items-center'>
        <span className='text-3xl font-semibold tabular-nums'>
          {scoreOutOfTen(score).toFixed(1).replace('.', ',')}
        </span>
        <span className='text-muted-foreground text-xs'>sur 10</span>
      </div>
    </div>
  )
}

// ── Level path: current → next, with the threshold it had to clear ──

function LevelPath({ progression }: { progression: LevelProgression }) {
  const achieved = scoreOutOfTen(progression.score_achieved)
  const threshold = scoreOutOfTen(progression.threshold)
  const pct = Math.max(0, Math.min(100, Math.round((achieved / (threshold || 1)) * 100)))

  return (
    <div className='space-y-3'>
      <div className='flex items-center justify-between gap-3'>
        <Badge variant='secondary' className={cn('text-xs', LEVEL_META[progression.current_level as keyof typeof LEVEL_META]?.textClass)}>
          {levelLabel(progression.current_level) ?? progression.current_level}
        </Badge>
        <span className='text-muted-foreground text-xs'>→</span>
        <Badge
          className={cn(
            'border-none text-xs',
            progression.eligible
              ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
              : 'bg-muted text-muted-foreground'
          )}
        >
          {levelLabel(progression.next_level) ?? progression.next_level}
        </Badge>
      </div>
      <Progress value={pct} />
      <div className='flex items-center justify-between text-xs'>
        <span className='text-muted-foreground tabular-nums'>
          {achieved.toFixed(1).replace('.', ',')} / {threshold.toFixed(1).replace('.', ',')}
        </span>
        <span className={cn('font-medium', progression.eligible ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground')}>
          {progression.eligible
            ? `Niveau ${levelLabel(progression.next_level) ?? progression.next_level} atteint`
            : `Encore ${(threshold - achieved).toFixed(1).replace('.', ',')} point${(threshold - achieved) >= 2 ? 's' : ''}`}
        </span>
      </div>
    </div>
  )
}

// ── Small building blocks ──

function Remark({ remark, kind }: { remark: string; kind: 'strength' | 'area' }) {
  const { step, text } = splitRemark(remark)

  return (
    <div className='bg-muted/40 flex items-start gap-2 rounded-lg px-3 py-2 text-sm'>
      <span className={cn('mt-0.5 shrink-0', kind === 'strength' ? 'text-emerald-500' : 'text-amber-500')}>
        {kind === 'strength' ? <Check className='size-4' /> : <AlertTriangle className='size-4' />}
      </span>
      <span className='flex flex-col gap-0.5'>
        {step ? (
          <span className='text-muted-foreground text-[11px] font-semibold tracking-wide uppercase'>
            {STEP_META[step as keyof typeof STEP_META].label}
          </span>
        ) : null}
        <span>{text}</span>
      </span>
    </div>
  )
}

function Fact({ label, value, mono, capitalize }: { label: string; value: string; mono?: boolean; capitalize?: boolean }) {
  return (
    <div className='bg-muted/40 rounded-lg px-3 py-2'>
      <p className='text-muted-foreground text-xs'>{label}</p>
      <p className={cn('truncate font-medium', mono && 'font-mono text-xs', capitalize && 'capitalize')}>{value}</p>
    </div>
  )
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <p className='text-sm'>
      <span className='text-muted-foreground'>{label} : </span>
      {value}
    </p>
  )
}
