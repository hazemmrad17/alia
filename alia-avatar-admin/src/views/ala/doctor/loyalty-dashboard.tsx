'use client'

// ──────────────────────────────────────────────
// Mon espace fidélité Vital
//
// The doctor is Vital's client, not a manager: this screen is his loyalty
// portal. He sees the pitches he received from delegates, the Vital Points
// they earned him, his tier, and how close he is to the next gift. No rosters,
// no scoring of anyone — progress bars and rewards instead.
// ──────────────────────────────────────────────

import { useCallback, useEffect, useState } from 'react'

import Link from 'next/link'

import { Award, Gift, HeartHandshake, RefreshCw, Sparkles, TicketCheck } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

import {
  ApiError,
  getRewardsOverview,
  type GiftClaim,
  type LedgerEntry,
  type RewardGift,
  type RewardsOverview
} from '@/lib/alia-api'
import { cn } from '@/lib/utils'

const TIER_STYLES: Record<string, string> = {
  Bronze: 'bg-amber-700/10 text-amber-700 dark:text-amber-400',
  Argent: 'bg-slate-400/15 text-slate-600 dark:text-slate-300',
  Or: 'bg-yellow-500/15 text-yellow-700 dark:text-yellow-400'
}

function reasonLabel(reason: string): string {
  if (reason === 'pitch_received') return 'Présentation reçue'
  if (reason === 'feedback_given') return 'Feedback envoyé'
  if (reason === 'gift_claim') return 'Cadeau échangé'
  if (reason === 'admin_adjust') return 'Bonus Vital'
  return reason
}

export function LoyaltyDashboard() {
  const [overview, setOverview] = useState<RewardsOverview | null>(null)
  const [claims, setClaims] = useState<GiftClaim[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [data, mine] = await Promise.all([getRewardsOverview(), import('@/lib/alia-api').then((m) => m.listMyClaims())])
      setOverview(data)
      setClaims(mine.claims)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Impossible de charger votre espace fidélité.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  if (loading) {
    return (
      <div className='grid gap-4 p-4 sm:p-6 md:grid-cols-3'>
        <Skeleton className='h-32 rounded-xl md:col-span-2' />
        <Skeleton className='h-32 rounded-xl' />
        <Skeleton className='h-72 rounded-xl md:col-span-3' />
      </div>
    )
  }

  if (error || !overview) {
    return (
      <div className='p-6'>
        <Card className='border-destructive/40'>
          <CardHeader>
            <CardTitle className='text-destructive'>Oups</CardTitle>
            <CardDescription>{error ?? 'Espace indisponible.'}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant='outline' onClick={() => void load()}>
              <RefreshCw /> Réessayer
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const { balance, tier, next_gift: nextGift, progress_to_next: progress, stats, recent_ledger: ledger } = overview

  return (
    <main className='mx-auto size-full max-w-360 flex-1 px-4 py-6 sm:px-6'>
      <div className='mb-6 flex flex-wrap items-center justify-between gap-3'>
        <div>
          <h1 className='text-2xl font-semibold tracking-tight'>Mon espace fidélité</h1>
          <p className='text-muted-foreground text-sm'>Vos présentations reçues, vos points Vital et vos cadeaux.</p>
        </div>
        <div className='flex items-center gap-2'>
          <Badge className={cn('rounded-full px-3 py-1 text-sm', TIER_STYLES[tier.name] ?? '')} variant='default'>
            <Award className='size-4' /> Niveau {tier.name}
          </Badge>
          <Button variant='outline' onClick={() => (window.location.href = '/dashboard/gifts')}>
            <Gift /> Catalogue cadeaux
          </Button>
        </div>
      </div>

      <div className='grid grid-cols-2 gap-6 xl:grid-cols-3'>
        {/* Stat cards row */}
        <div className='col-span-2 grid grid-cols-2 gap-6 xl:grid-cols-4'>
          <StatCard
            icon={<TicketCheck className='size-4.75' />}
            iconClass='bg-chart-1/10 text-chart-1'
            value={`${balance} pts`}
            label='Points disponibles'
            badge={`${stats.pitches_received} présentation${stats.pitches_received > 1 ? 's' : ''} reçue${stats.pitches_received > 1 ? 's' : ''}`}
          />
          <StatCard
            icon={<HeartHandshake className='size-4.75' />}
            iconClass='bg-chart-2/10 text-chart-2'
            value={String(stats.feedbacks_given)}
            label='Feedbacks envoyés'
            badge='Vos avis comptent'
          />
          <StatCard
            icon={<Gift className='size-4.75' />}
            iconClass='bg-chart-4/10 text-chart-4'
            value={String(stats.gifts_obtained)}
            label='Cadeaux obtenus'
            badge='Merci Vital'
          />
          <StatCard
            icon={<Sparkles className='size-4.75' />}
            iconClass='bg-chart-5/10 text-chart-5'
            value={`${overview.lifetime_points} pts`}
            label='Points cumulés'
            badge={`Niveau ${tier.name}`}
          />
        </div>

        {/* Progress to next gift */}
        <Card className='relative col-span-2 justify-between max-xl:col-span-full xl:col-span-1'>
          <CardHeader>
            <CardTitle className='flex items-center gap-2'>
              <Gift className='text-primary size-5' /> Prochain cadeau
            </CardTitle>
            <CardDescription>{nextGift ? 'Encore un effort !' : 'Le catalogue arrive bientôt.'}</CardDescription>
          </CardHeader>
          <CardContent className='flex flex-1 flex-col justify-end gap-3'>
            {nextGift ? (
              <>
                <p className='text-lg font-semibold'>{nextGift.title}</p>
                <div className='space-y-1.5'>
                  <Progress value={Math.round(progress * 100)} />
                  <p className='text-muted-foreground text-sm'>
                    Plus que{' '}
                    <span className='text-foreground font-semibold'>{Math.max(0, nextGift.cost - balance)} pts</span>{' '}
                    pour l&apos;obtenir ({balance}/{nextGift.cost})
                  </p>
                </div>
              </>
            ) : (
              <p className='text-muted-foreground text-sm'>
                Recevez des présentations de vos délégués Vital pour accumuler des points et débloquer des cadeaux.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Ledger card */}
        <Card className='col-span-2 max-xl:col-span-full xl:col-span-2'>
          <CardHeader>
            <CardTitle>Activité récente</CardTitle>
            <CardDescription>Comment vos points ont évolué.</CardDescription>
          </CardHeader>
          <CardContent>
            {ledger.length === 0 ? (
              <p className='text-muted-foreground py-6 text-center text-sm'>
                Rien pour le moment — chaque présentation reçue vous rapporte 50 points.
              </p>
            ) : (
              <ul className='space-y-2'>
                {(ledger as LedgerEntry[]).map((entry) => (
                  <li
                    key={entry.id}
                    className='bg-muted/40 flex items-center justify-between gap-3 rounded-md px-4 py-2.5'
                  >
                    <div className='flex flex-col'>
                      <span className='text-sm font-medium'>{reasonLabel(entry.reason)}</span>
                      <span className='text-muted-foreground text-xs'>
                        {new Date(entry.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                      </span>
                    </div>
                    <span
                      className={cn(
                        'text-sm font-semibold',
                        entry.delta >= 0 ? 'text-green-600 dark:text-green-400' : 'text-destructive'
                      )}
                    >
                      {entry.delta >= 0 ? '+' : ''}
                      {entry.delta} pts
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* My claims */}
        <Card className='col-span-2 max-xl:col-span-full xl:col-span-1'>
          <CardHeader>
            <CardTitle>Mes demandes de cadeaux</CardTitle>
            <CardDescription>Suivi de vos récompenses.</CardDescription>
          </CardHeader>
          <CardContent className='space-y-2'>
            {claims.length === 0 ? (
              <p className='text-muted-foreground py-6 text-center text-sm'>
                Aucune demande — échangez vos points dans le{' '}
                <Link className='text-primary underline' href='/dashboard/gifts'>
                  catalogue
                </Link>
                .
              </p>
            ) : (
              claims.map((claim) => (
                <div
                  key={claim.id}
                  className='bg-muted/40 flex items-center justify-between gap-3 rounded-md px-4 py-2.5'
                >
                  <div className='flex flex-col'>
                    <span className='text-sm font-medium'>{claim.gift_title ?? 'Cadeau'}</span>
                    <span className='text-muted-foreground text-xs'>
                      {new Date(claim.requested_at).toLocaleDateString('fr-FR')}
                    </span>
                  </div>
                  <Badge
                    variant='default'
                    className={cn(
                      claim.status === 'delivered' && 'bg-green-600/10 text-green-600 dark:text-green-400',
                      claim.status === 'requested' && 'bg-amber-600/10 text-amber-600 dark:text-amber-400',
                      claim.status === 'cancelled' && 'bg-destructive/10 text-destructive'
                    )}
                  >
                    {claim.status === 'delivered' ? 'Livré' : claim.status === 'requested' ? 'En préparation' : 'Annulé'}
                  </Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Points rules — small footer card */}
        <Card className='col-span-2 xl:col-span-3'>
          <CardHeader>
            <CardTitle className='text-base'>Comment gagner des points ?</CardTitle>
          </CardHeader>
          <CardContent className='grid gap-3 sm:grid-cols-3'>
            <div className='bg-muted/40 rounded-md p-4'>
              <p className='text-2xl font-semibold text-primary'>+50</p>
              <p className='text-muted-foreground text-sm'>Chaque présentation d&apos;un délégué Vital que vous recevez</p>
            </div>
            <div className='bg-muted/40 rounded-md p-4'>
              <p className='text-2xl font-semibold text-primary'>+15</p>
              <p className='text-muted-foreground text-sm'>Chaque feedback laissé après une visite</p>
            </div>
            <div className='bg-muted/40 rounded-md p-4'>
              <p className='text-2xl font-semibold text-primary'>Argent → Or</p>
              <p className='text-muted-foreground text-sm'>
                Montez de niveau grâce à vos points cumulés (250 / 600) et débloquez plus vite vos cadeaux
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}

function StatCard({
  icon,
  iconClass,
  value,
  label,
  badge
}: {
  icon: React.ReactNode
  iconClass: string
  value: string
  label: string
  badge: string
}) {
  return (
    <Card>
      <CardHeader className='flex items-center justify-between'>
        <span
          className={cn(
            'flex size-9.5 items-center justify-center rounded-sm [&>svg]:size-4.75',
            iconClass
          )}
        >
          {icon}
        </span>
        <Badge variant='default' className='max-w-36 truncate'>
          {badge}
        </Badge>
      </CardHeader>
      <CardContent className='flex flex-1 flex-col justify-between gap-4'>
        <p className='flex flex-col gap-1'>
          <span className='text-lg font-semibold'>{value}</span>
          <span className='text-muted-foreground text-sm'>{label}</span>
        </p>
      </CardContent>
    </Card>
  )
}
