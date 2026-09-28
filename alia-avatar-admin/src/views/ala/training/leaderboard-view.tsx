'use client'

// ──────────────────────────────────────────────
// Leaderboard — friendly competition between the medical delegates of the
// same company. Duolingo-league vibes:
//   · podium for the top 3 (gold/silver/bronze),
//   · full ranking table with rank, XP, sessions, average score,
//   · the caller's own row is highlighted, and a sticky "my rank" banner
//     shows where you stand even when scrolled far down the board.
// Data comes from GET /api/v1/leaderboard (tenant-scoped, admins excluded).
// ──────────────────────────────────────────────

import { useEffect, useState } from 'react'

import { Crown, Medal, PlayCircle, RefreshCw, Trophy, UserRound } from 'lucide-react'

import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'

import { ApiError, getLeaderboard } from '@/lib/alia-api'
import type { LeaderboardEntry, LeaderboardResponse } from '@/lib/alia-api'

const LEVEL_LABELS: Record<string, string> = {
  debutant: 'Débutant',
  junior: 'Junior',
  confirme: 'Confirmé',
  expert: 'Expert'
}

const PODIUM_STYLES: Record<number, { ring: string; badge: string; icon: string }> = {
  1: { ring: 'ring-amber-400 bg-amber-400/15 text-amber-600 dark:text-amber-400', badge: 'bg-amber-400/15 text-amber-600 dark:text-amber-400', icon: '👑' },
  2: { ring: 'ring-slate-300 bg-slate-300/15 text-slate-600 dark:text-slate-300', badge: 'bg-slate-300/15 text-slate-600 dark:text-slate-300', icon: '🥈' },
  3: { ring: 'ring-amber-700/40 bg-amber-700/10 text-amber-700 dark:text-amber-500', badge: 'bg-amber-700/10 text-amber-700 dark:text-amber-500', icon: '🥉' }
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('')
}

export default function LeaderboardView() {
  const [data, setData] = useState<LeaderboardResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = () => {
    setLoading(true)
    setError(null)
    getLeaderboard()
      .then(setData)
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Impossible de charger le classement.'))
      .finally(() => setLoading(false))
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, [])

  if (loading) {
    return (
      <div className='w-full space-y-6'>
        <Skeleton className='h-40 rounded-xl' />
        <Skeleton className='h-96 rounded-xl' />
      </div>
    )
  }

  if (error) {
    return (
      <div className='w-full p-6'>
        <Card className='border-destructive/40'>
          <CardHeader>
            <CardTitle className='text-destructive'>Oups</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant='outline' onClick={load}>
              <RefreshCw /> Réessayer
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const entries = data?.entries ?? []
  const me = data?.me ?? null
  const top3 = entries.slice(0, 3)

  return (
    <div className='w-full space-y-6'>
      {/* ── Podium (top 3) ── */}
      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2 text-lg'>
            <Trophy className='size-5 text-amber-500' /> Podium
          </CardTitle>
          <CardDescription>
            Classement des délégués de votre entreprise — 1 XP par point de score, 10 XP par session non évaluée.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {top3.length === 0 ? (
            <p className='text-muted-foreground py-6 text-center text-sm'>
              Aucun délégué actif pour l'instant — lancez une session pour ouvrir le classement !
            </p>
          ) : (
            <div className='grid grid-cols-1 items-end justify-items-center gap-4 sm:grid-cols-3'>
              {/* 2nd, 1st, 3rd on desktop */}
              {[top3[1], top3[0], top3[2]].filter(Boolean).map((e, i) => {
                const rank = e.rank
                const style = PODIUM_STYLES[rank]
                const height = rank === 1 ? 'sm:h-36' : 'sm:h-28'
                return (
                  <div key={e.user_id} className='flex w-full flex-col items-center gap-2'>
                    <Avatar className={cn('size-14 ring-2 ring-offset-2 ring-offset-background', style.ring)}>
                      <AvatarFallback className={cn('text-lg font-semibold', style.ring)}>
                        {initials(e.full_name) || <UserRound className='size-6' />}
                      </AvatarFallback>
                    </Avatar>
                    <div className='flex flex-col items-center'>
                      <span className='flex items-center gap-1 text-sm font-medium'>
                        {rank === 1 ? <Crown className='text-amber-500 size-4' /> : null}
                        {e.full_name}
                      </span>
                      <Badge className={cn('h-5 rounded-4xl border-none px-2 text-xs', style.badge)}>
                        {e.xp.toLocaleString('fr-FR')} XP
                      </Badge>
                    </div>
                    <div
                      className={cn(
                        'flex w-full items-start justify-center rounded-t-xl bg-primary/10 pt-2 text-2xl font-bold text-primary',
                        height
                      )}
                    >
                      #{rank}
                    </div>
                    <span className='sr-only'>Rang {rank}</span>
                    {i === -1 ? <Medal className='hidden' /> : null}
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── My rank banner ── */}
      {me ? (
        <Card className='border-primary/30 bg-primary/5'>
          <CardContent className='flex items-center justify-between gap-4 py-4'>
            <div className='flex items-center gap-3'>
              <Badge className='h-8 w-8 justify-center rounded-full border-none bg-primary p-0 text-sm font-bold text-primary-foreground'>
                #{me.rank}
              </Badge>
              <div className='flex flex-col'>
                <span className='font-medium'>Votre position</span>
                <span className='text-muted-foreground text-sm'>
                  {me.rank === 1
                    ? 'Vous menez le classement !'
                    : me.rank <= entries.length
                      ? `À ${Math.max(1, (entries[me.rank - 2]?.xp ?? me.xp + 1) - me.xp)} XP du rang précédent`
                      : ''}
                </span>
              </div>
            </div>
            <div className='flex items-center gap-4 text-sm'>
              <span className='font-semibold'>{me.xp.toLocaleString('fr-FR')} XP</span>
              <span className='text-muted-foreground'>{me.sessions} session(s)</span>
              <span className='text-muted-foreground'>
                {me.avg_score !== null ? `Moy. ${me.avg_score}/100` : '—'}
              </span>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* ── Full ranking table ── */}
      <Card className='py-0'>
        <div className='border-b px-6 py-4'>
          <span className='text-base font-medium'>Classement complet</span>
        </div>
        <div className='relative w-full overflow-x-auto'>
          <Table>
            <TableHeader>
              <TableRow className='h-14 border-t'>
                <TableHead className='first:pl-4'>Rang</TableHead>
                <TableHead>Délégué</TableHead>
                <TableHead>Niveau</TableHead>
                <TableHead>Sessions</TableHead>
                <TableHead>Score moyen</TableHead>
                <TableHead>Meilleur</TableHead>
                <TableHead className='last:pr-4 text-end'>XP</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className='text-muted-foreground py-10 text-center'>
                    Aucun classement pour le moment.
                  </TableCell>
                </TableRow>
              ) : (
                entries.map((e) => (
                  <TableRow
                    key={e.user_id}
                    className={cn('h-14', e.is_me && 'bg-primary/5 font-medium')}
                  >
                    <TableCell className='p-2 pl-4 align-middle'>
                      <span className='flex items-center gap-2'>
                        {e.rank <= 3 ? (
                          <span className='text-lg'>{PODIUM_STYLES[e.rank].icon}</span>
                        ) : (
                          <span className='text-muted-foreground w-6 text-center'>#{e.rank}</span>
                        )}
                      </span>
                    </TableCell>
                    <TableCell className='p-2 align-middle'>
                      <div className='flex items-center gap-2'>
                        <Avatar className='size-9'>
                          <AvatarFallback className='bg-primary/10 text-primary text-xs font-semibold'>
                            {initials(e.full_name) || <PlayCircle className='size-4' />}
                          </AvatarFallback>
                        </Avatar>
                        <div className='flex flex-col'>
                          <span>
                            {e.full_name}
                            {e.is_me ? <span className='text-primary'> (vous)</span> : null}
                          </span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className='p-2 align-middle'>
                      <Badge variant='default' className='bg-primary/10 text-primary'>
                        {e.current_level ? (LEVEL_LABELS[e.current_level] ?? e.current_level) : '—'}
                      </Badge>
                    </TableCell>
                    <TableCell className='text-muted-foreground p-2 align-middle'>{e.sessions}</TableCell>
                    <TableCell className='p-2 align-middle'>
                      {e.avg_score !== null ? `${e.avg_score}/100` : '—'}
                    </TableCell>
                    <TableCell className='p-2 align-middle'>
                      {e.best_score !== null ? `${e.best_score}/100` : '—'}
                    </TableCell>
                    <TableCell className='p-2 pr-4 align-middle text-end'>
                      <span className='font-semibold'>{e.xp.toLocaleString('fr-FR')} XP</span>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  )
}
