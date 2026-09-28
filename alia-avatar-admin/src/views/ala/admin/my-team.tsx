'use client'

// ──────────────────────────────────────────────
// Mon équipe
//
// The admin side of the admin–delegate relationship: who is under my wing, what
// their sessions actually scored, and one click to release someone.
//
// The figures come from GET /team/sessions, not from the dashboard feed. That
// feed is anonymous on purpose — it backs pages a delegate may read — so it
// carries no identity at all, which made every "dernier score" on this page a
// permanent dash. The team log is admin-only and answers the manager's question
// directly: this delegate, these sessions, these scores.
//
// Assigning lives on Comptes & accès — where accounts are created — so the two
// screens keep one job each: this one manages the relationship, that one manages
// the accounts.
// ──────────────────────────────────────────────

import { useCallback, useEffect, useMemo, useState } from 'react'

import Link from 'next/link'

import {
  AlertCircle,
  ArrowRight,
  CalendarDays,
  GraduationCap,
  RefreshCw,
  Sparkles,
  UserMinus,
  Users
} from 'lucide-react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

import {
  ApiError,
  getTeam,
  getTeamSessions,
  listLevels,
  promoteDelegate,
  removeFromTeam,
  type LevelChange,
  type TeamDelegate,
  type TeamSession
} from '@/lib/alia-api'
import { ACCOUNT_ROLE_LABELS, getCurrentUser, initialsOf, type AccountRole, type AuthUser } from '@/lib/auth'
import type { LevelInfo } from '@/types/alia'

/** Levels run beginner → expert, which is also the promotion order. */
const LEVEL_ORDER = ['debutant', 'junior', 'confirme', 'expert']

const LEVEL_LABELS: Record<string, string> = {
  debutant: 'Débutant',
  junior: 'Junior',
  confirme: 'Confirmé',
  expert: 'Expert'
}

const FORMAT_LABELS: Record<string, string> = {
  flash: 'Flash',
  standard: 'Standard',
  approfondie: 'Approfondie'
}

/** How many recent scores the readiness average is taken over. */
const ROLLING_WINDOW = 5

function formatDate(value?: string | null): string {
  if (!value) return '—'

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) return '—'

  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}

function formatDuration(seconds: number): string {
  if (!seconds) return '—'

  const minutes = Math.floor(seconds / 60)
  const rest = Math.round(seconds % 60)

  return minutes ? `${minutes} min ${rest.toString().padStart(2, '0')}` : `${rest} s`
}

function score(value?: number | null): string {
  return typeof value === 'number' ? `${value.toFixed(1)}/10` : '—'
}

/** Everything the page knows about one delegate, derived from their sessions. */
interface DelegateStat {
  sessions: TeamSession[]
  scored: TeamSession[]
  last: TeamSession | null
  rolling: number | null
  certifiedLevel: string | null
  history: LevelChange[]
  nextLevel: LevelInfo | null
  ready: boolean
}

export default function MyTeam() {
  const me = useMemo(() => getCurrentUser(), [])

  const [delegates, setDelegates] = useState<TeamDelegate[]>([])
  const [manager, setManager] = useState<AuthUser | null>(null)
  const [sessions, setSessions] = useState<TeamSession[]>([])
  const [levels, setLevels] = useState<LevelInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [delegateFilter, setDelegateFilter] = useState('all')

  const isAdmin = me?.role === 'admin'

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const team = await getTeam()

      setDelegates(team.delegates)
      setManager(team.manager)

      // The log is admin-only; a delegate gets their manager and nothing more,
      // so asking for it would only turn a working page into a 403.
      if (!isAdmin) {
        setSessions([])

        return
      }

      const log = await getTeamSessions({ limit: 500 })

      setSessions(log.sessions)

      // Thresholds come from the platform's own level list rather than a copy
      // pasted here, so a change to /levels moves this page with it.
      try {
        const published = await listLevels()

        setLevels(published.levels)
      } catch {
        setLevels([])
      }
    } catch (e) {
      setError(
        e instanceof ApiError && e.status === 403
          ? 'La gestion d’équipe est réservée à l’administrateur de ce délégué.'
          : 'Impossible de charger l’équipe. Vérifiez que le serveur ALIA est démarré.'
      )
    } finally {
      setLoading(false)
    }
  }, [isAdmin])

  useEffect(() => {
    void load()
  }, [load])

  /** Sessions grouped per delegate, newest first, with the rolling figures. */
  const stats = useMemo(() => {
    const byDelegate = new Map<string, TeamSession[]>()

    for (const session of sessions) {
      const existing = byDelegate.get(session.user_id)

      if (existing) existing.push(session)
      else byDelegate.set(session.user_id, [session])
    }

    const result = new Map<string, DelegateStat>()

    // One entry per delegate, not per session: a delegate who has not trained
    // yet still belongs on the page, with an empty record rather than no card.
    for (const delegate of delegates) {
      const rows = byDelegate.get(delegate.id) ?? []
      const scored = rows.filter(row => typeof row.overall_score === 'number')
      const window = scored.slice(0, ROLLING_WINDOW)

      const rolling = window.length
        ? window.reduce((total, row) => total + (row.overall_score as number), 0) / window.length
        : null

      // Progression follows the level the manager granted, not the level a
      // session happened to be played at.
      const certifiedLevel = delegate.current_level ?? null
      const index = certifiedLevel ? LEVEL_ORDER.indexOf(certifiedLevel) : -1

      const nextLevel =
        index >= 0 && index < LEVEL_ORDER.length - 1 ? levels.find(l => l.id === LEVEL_ORDER[index + 1]) : null

      result.set(delegate.id, {
        sessions: rows,
        scored,
        last: rows[0] ?? null,
        rolling,
        certifiedLevel,
        history: delegate.level_history ?? [],
        nextLevel: nextLevel ?? null,

        // Only the score half of the docs/10 criteria is measurable from stored
        // reports; the qualitative ones are still a human judgement.
        ready: Boolean(rolling != null && nextLevel && rolling >= nextLevel.min_score)
      })
    }

    return result
  }, [sessions, levels, delegates])

  const teamSessions = useMemo(
    () => (delegateFilter === 'all' ? sessions : sessions.filter(s => s.user_id === delegateFilter)),
    [sessions, delegateFilter]
  )

  const totals = useMemo(() => {
    const scored = sessions.filter(s => typeof s.overall_score === 'number')

    return {
      delegates: delegates.length,
      sessions: sessions.length,
      average: scored.length
        ? scored.reduce((total, s) => total + (s.overall_score as number), 0) / scored.length
        : null
    }
  }, [delegates.length, sessions])

  const release = useCallback(async (delegate: TeamDelegate) => {
    setBusyId(delegate.id)

    try {
      await removeFromTeam(delegate.id)
      setDelegates(current => current.filter(entry => entry.id !== delegate.id))
      setSessions(current => current.filter(session => session.user_id !== delegate.id))
      setNotice(`${delegate.full_name} a quitté votre équipe.`)
    } catch {
      setError('Impossible de retirer ce délégué.')
    } finally {
      setBusyId(null)
    }
  }, [])

  const promote = useCallback(async (delegate: TeamDelegate, level: string, label: string) => {
    setBusyId(delegate.id)
    setError(null)

    try {
      const result = await promoteDelegate(delegate.id, level)

      setDelegates(current =>
        current.map(entry => (entry.id === delegate.id ? { ...entry, ...result.delegate } : entry))
      )
      setNotice(`${delegate.full_name} est désormais au niveau « ${label} ».`)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Impossible de promouvoir ce délégué.')
    } finally {
      setBusyId(null)
    }
  }, [])

  if (!isAdmin) {
    return (
      <div className='flex flex-col gap-6'>
        <div>
          <h1 className='font-heading text-xl font-semibold'>Mon responsable</h1>
          <p className='text-muted-foreground mt-1 text-sm'>
            Le compte administrateur qui suit vos sessions et valide vos passages de niveau.
          </p>
        </div>

        {loading ? (
          <Skeleton className='h-24 w-full' />
        ) : manager ? (
          <Card>
            <CardContent className='flex items-center gap-3'>
              <Avatar className='size-10'>
                <AvatarFallback className='bg-primary/10 text-primary text-sm'>
                  {initialsOf(manager.full_name)}
                </AvatarFallback>
              </Avatar>
              <div className='min-w-0'>
                <p className='truncate text-sm font-medium'>{manager.full_name}</p>
                <p className='text-muted-foreground truncate text-xs'>{manager.email}</p>
                {delegates[0]?.current_level && (
                  <p className='text-muted-foreground truncate text-[10px]'>
                    Votre niveau certifié : {LEVEL_LABELS[delegates[0].current_level] ?? delegates[0].current_level}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className='flex flex-col gap-2 py-6'>
              <span className='flex items-center gap-2 text-lg font-semibold'>
                <Users className='text-muted-foreground size-5' /> Aucun responsable assigné
              </span>
              <p className='text-muted-foreground text-sm'>
                Votre compte ({me ? ACCOUNT_ROLE_LABELS[me.role as AccountRole] : 'rôle inconnu'}) n’est encore rattaché
                à aucun administrateur.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    )
  }

  return (
    <div className='flex flex-col gap-6'>
      <div>
        <h1 className='font-heading text-xl font-semibold'>Mon équipe</h1>
        <p className='text-muted-foreground mt-1 text-sm'>
          Les délégués médicaux sous votre aile — leur progression et le journal de leurs sessions.
        </p>
      </div>

      {notice && (
        <Alert>
          <GraduationCap className='size-4' />
          <AlertDescription>{notice}</AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert variant='destructive'>
          <AlertCircle className='size-4' />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {!loading && !error && (
        <div className='grid grid-cols-1 gap-5 sm:grid-cols-3'>
          <Card>
            <CardContent className='flex flex-col gap-1'>
              <span className='text-2xl font-semibold'>{totals.delegates}</span>
              <span className='text-muted-foreground text-sm'>Délégués</span>
            </CardContent>
          </Card>
          <Card>
            <CardContent className='flex flex-col gap-1'>
              <span className='text-2xl font-semibold'>{totals.sessions}</span>
              <span className='text-muted-foreground text-sm'>Sessions enregistrées</span>
            </CardContent>
          </Card>
          <Card>
            <CardContent className='flex flex-col gap-1'>
              <span className='text-2xl font-semibold'>{score(totals.average)}</span>
              <span className='text-muted-foreground text-sm'>Score moyen de l’équipe</span>
            </CardContent>
          </Card>
        </div>
      )}

      <div className='grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3'>
        {loading ? (
          <>
            {[0, 1, 2].map(index => (
              <Skeleton key={index} className='h-52 w-full' />
            ))}
          </>
        ) : delegates.length === 0 ? (
          <Card className='sm:col-span-2 xl:col-span-3'>
            <CardContent className='flex flex-col items-center gap-3 py-10 text-center'>
              <Users className='text-muted-foreground size-8' />
              <p className='text-lg font-medium'>Aucun délégué dans votre équipe</p>
              <p className='text-muted-foreground max-w-md text-sm'>
                Affectez un délégué depuis Comptes &amp; accès : chaque ligne de compte délégué peut rejoindre votre
                équipe depuis son menu d’actions.
              </p>
              <Button
                variant='outline'
                className='gap-1.5'
                nativeButton={false}
                render={<Link href='/admin/accounts' />}
              >
                Ouvrir Comptes &amp; accès <ArrowRight className='size-4' />
              </Button>
            </CardContent>
          </Card>
        ) : (
          delegates.map(delegate => {
            const stat = stats.get(delegate.id)
            const last = stat?.last ?? null
            const busy = busyId === delegate.id

            return (
              <Card key={delegate.id}>
                <CardContent className='flex flex-col gap-3'>
                  <div className='flex items-start justify-between gap-2'>
                    <div className='flex min-w-0 items-center gap-3'>
                      <Avatar className='size-10'>
                        <AvatarFallback className='bg-primary/10 text-primary text-sm'>
                          {initialsOf(delegate.full_name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className='min-w-0'>
                        <p className='truncate text-sm font-medium'>{delegate.full_name}</p>
                        <p className='text-muted-foreground truncate text-xs'>{delegate.email}</p>
                        {delegate.assigned_at && (
                          <p className='text-muted-foreground truncate text-[10px]'>
                            Dans l’équipe depuis le {formatDate(delegate.assigned_at)}
                            {delegate.previous_manager_name && ` · repris de ${delegate.previous_manager_name}`}
                          </p>
                        )}
                      </div>
                    </div>

                    <Tooltip>
                      <TooltipTrigger
                        render={
                          <Button
                            variant='ghost'
                            size='icon'
                            disabled={busy}
                            aria-label={`Retirer ${delegate.full_name} de l'équipe`}
                            onClick={() => void release(delegate)}
                          />
                        }
                      >
                        <UserMinus className={cn('size-4', busy && 'animate-pulse')} />
                      </TooltipTrigger>
                      <TooltipContent>Retirer de l’équipe</TooltipContent>
                    </Tooltip>
                  </div>

                  <div className='bg-muted/50 flex items-center justify-between rounded-md px-3 py-2'>
                    <div className='flex flex-col items-center gap-0.5'>
                      <span className='text-foreground text-sm font-semibold tabular-nums'>
                        {score(last?.overall_score)}
                      </span>
                      <span className='text-muted-foreground text-[10px]'>Dernier score</span>
                    </div>

                    <div className='bg-border h-6 w-px' />

                    <div className='flex flex-col items-center gap-0.5'>
                      <span className='text-foreground text-sm font-semibold tabular-nums'>{score(stat?.rolling)}</span>
                      <span className='text-muted-foreground text-[10px]'>5 dernières</span>
                    </div>

                    <div className='bg-border h-6 w-px' />

                    <div className='flex flex-col items-center gap-0.5'>
                      <span className='text-foreground text-sm font-semibold tabular-nums'>
                        {stat?.sessions.length ?? 0}
                      </span>
                      <span className='text-muted-foreground text-[10px]'>Sessions</span>
                    </div>

                    <div className='bg-border h-6 w-px' />

                    <div className='flex flex-col items-center gap-0.5'>
                      <span className='text-foreground flex items-center gap-1 text-sm font-semibold'>
                        <CalendarDays className='text-muted-foreground size-3' />
                        {formatDate(last?.completed_at)}
                      </span>
                      <span className='text-muted-foreground text-[10px]'>Dernière</span>
                    </div>
                  </div>

                  <div className='flex items-center justify-between gap-2 text-xs'>
                    <Tooltip>
                      <TooltipTrigger
                        render={
                          <span className='text-muted-foreground'>
                            Niveau certifié :{' '}
                            <span className='text-foreground font-medium'>
                              {stat?.certifiedLevel ? (LEVEL_LABELS[stat.certifiedLevel] ?? stat.certifiedLevel) : '—'}
                            </span>
                          </span>
                        }
                      />
                      <TooltipContent className='max-w-64'>
                        {stat && stat.history.length
                          ? `Dernier changement le ${formatDate(stat.history[0].changed_at)}` +
                            (stat.history[0].from_level
                              ? `, depuis « ${LEVEL_LABELS[stat.history[0].from_level] ?? stat.history[0].from_level} »`
                              : '')
                          : 'Aucun changement enregistré : le niveau de départ.'}
                      </TooltipContent>
                    </Tooltip>

                    {stat?.nextLevel && (
                      <Tooltip>
                        <TooltipTrigger
                          render={
                            <Badge variant={stat.ready ? 'default' : 'secondary'} className='gap-1'>
                              {stat.ready ? <Sparkles className='size-3' /> : null}
                              {stat.ready ? `Prêt : ${stat.nextLevel.name}` : `Objectif ${stat.nextLevel.name}`}
                            </Badge>
                          }
                        />
                        <TooltipContent className='max-w-64'>
                          {stat.ready
                            ? `Moyenne des ${ROLLING_WINDOW} dernières sessions ≥ ${stat.nextLevel.min_score}/10, le seuil de « ${stat.nextLevel.name} ».`
                            : `Le seuil de « ${stat.nextLevel.name} » est ${stat.nextLevel.min_score}/10 sur les ${ROLLING_WINDOW} dernières sessions.`}{' '}
                          Seuls les critères chiffrés sont suivis ici — la conformité et l’engagement restent une
                          appréciation humaine.
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </div>

                  {stat && stat.ready && stat.nextLevel && (
                    <Button
                      size='sm'
                      className='w-full gap-1.5'
                      disabled={busy}
                      onClick={() => void promote(delegate, stat.nextLevel!.id, stat.nextLevel!.name)}
                    >
                      <Sparkles className='size-3.5' />
                      Promouvoir en {stat.nextLevel.name}
                    </Button>
                  )}

                  <Button
                    variant='outline'
                    size='sm'
                    className='w-full justify-between'
                    onClick={() => setDelegateFilter(delegate.id)}
                  >
                    Voir ses sessions <ArrowRight className='size-4' />
                  </Button>
                </CardContent>
              </Card>
            )
          })
        )}
      </div>

      <Card className='gap-0 overflow-hidden py-0 shadow-none'>
        <CardHeader className='border-b px-6 py-5'>
          <CardTitle className='text-lg font-medium'>Sessions de l’équipe</CardTitle>
          <CardDescription>
            Le journal des visites de vos délégués, avec les scores par étape — les sessions antérieures à
            l’identification des comptes (avant le 22 septembre) n’ont pas d’auteur et n’apparaissent pas ici.
          </CardDescription>
        </CardHeader>

        <CardContent className='p-0'>
          <div className='flex flex-col gap-4 border-b p-6 sm:flex-row sm:items-center sm:justify-between'>
            <div className='flex w-full flex-col gap-2 sm:max-w-xs'>
              <label className='text-sm font-medium' htmlFor='team-delegate-filter'>
                Filtrer par délégué
              </label>
              <Select value={delegateFilter} onValueChange={value => setDelegateFilter(value ?? 'all')}>
                <SelectTrigger id='team-delegate-filter' className='w-full' disabled={loading}>
                  {/* base-ui renders the raw value unless given a render function,
                      and a delegate id is not what should show in this filter. */}
                  <SelectValue>
                    {(value: string) =>
                      value === 'all'
                        ? 'Toute l’équipe'
                        : (delegates.find(delegate => delegate.id === value)?.full_name ?? value)
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='all'>Toute l’équipe</SelectItem>
                  {delegates.map(delegate => (
                    <SelectItem key={delegate.id} value={delegate.id}>
                      {delegate.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button variant='outline' className='gap-1.5' disabled={loading} onClick={() => void load()}>
              <RefreshCw className={cn('size-4', loading && 'animate-spin')} />
              Actualiser
            </Button>
          </div>

          {loading ? (
            <div className='flex flex-col gap-3 p-6'>
              {[0, 1, 2].map(index => (
                <Skeleton key={index} className='h-8 w-full' />
              ))}
            </div>
          ) : teamSessions.length === 0 ? (
            <p className='text-muted-foreground p-6 text-sm'>
              Aucune session enregistrée pour cette sélection. Les sessions jouées par vos délégués apparaîtront ici dès
              qu’elles seront terminées.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className='p-4 font-semibold'>Date</TableHead>
                  <TableHead className='p-4 font-semibold'>Délégué</TableHead>
                  <TableHead className='p-4 font-semibold'>Niveau</TableHead>
                  <TableHead className='p-4 font-semibold'>Format</TableHead>
                  <TableHead className='p-4 font-semibold'>Durée</TableHead>
                  <TableHead className='p-4 text-right font-semibold'>Score</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {teamSessions.map(session => (
                  <TableRow key={session.session_id}>
                    <TableCell className='text-muted-foreground p-4 whitespace-nowrap'>
                      {formatDate(session.completed_at)}
                    </TableCell>
                    <TableCell className='p-4 font-medium'>{session.user_name ?? 'Compte inconnu'}</TableCell>
                    <TableCell className='p-4'>{LEVEL_LABELS[session.level] ?? session.level}</TableCell>
                    <TableCell className='p-4'>{FORMAT_LABELS[session.visit_format] ?? session.visit_format}</TableCell>
                    <TableCell className='text-muted-foreground p-4 whitespace-nowrap'>
                      {formatDuration(session.duration_seconds)}
                    </TableCell>
                    <TableCell className='p-4 text-right font-medium tabular-nums'>
                      {score(session.overall_score)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
