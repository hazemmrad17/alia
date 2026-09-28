'use client'

// ──────────────────────────────────────────────
// Catalogue de cadeaux
//
// The doctor spends his Vital Points here. Claims are fulfilled manually by
// the tenant, so claiming just reserves the gift and deducts the points.
// ──────────────────────────────────────────────

import { useCallback, useEffect, useState } from 'react'

import { Gift, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  ApiError,
  adminListGifts,
  claimGift,
  listMyClaims,
  listRewardGifts,
  type GiftClaim,
  type RewardGift
} from '@/lib/alia-api'
import { cn } from '@/lib/utils'

export function GiftCatalog() {
  const [balance, setBalance] = useState<number | null>(null)
  const [gifts, setGifts] = useState<RewardGift[]>([])
  const [claims, setClaims] = useState<GiftClaim[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [claiming, setClaiming] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [catalog, mine] = await Promise.all([listRewardGifts(), listMyClaims()])
      setBalance(catalog.balance)
      setGifts(catalog.gifts)
      setClaims(mine.claims)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Impossible de charger le catalogue.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const onClaim = async (gift: RewardGift) => {
    setClaiming(gift.id)
    try {
      const res = await claimGift(gift.id)
      setBalance(res.balance)
      toast.success(`Demande enregistrée : ${gift.title}`, {
        description: 'Vital vous contactera pour la remise de votre cadeau.'
      })
      const mine = await listMyClaims()
      setClaims(mine.claims)
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Échange impossible.')
    } finally {
      setClaiming(null)
    }
  }

  return (
    <main className='mx-auto size-full max-w-360 flex-1 px-4 py-6 sm:px-6'>
      <div className='mb-6 flex flex-wrap items-center justify-between gap-3'>
        <div>
          <h1 className='text-2xl font-semibold tracking-tight'>Catalogue de cadeaux</h1>
          <p className='text-muted-foreground text-sm'>Échangez vos points Vital contre des récompenses.</p>
        </div>
        <div className='flex items-center gap-2'>
          <Badge variant='default' className='rounded-full px-3 py-1 text-sm'>
            <Gift className='size-4' /> {balance ?? '…'} pts
          </Badge>
          <Button variant='outline' onClick={() => void load()}>
            <RefreshCw /> Actualiser
          </Button>
        </div>
      </div>

      {loading ? (
        <div className='grid gap-4 sm:grid-cols-2 xl:grid-cols-3'>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className='h-44 rounded-xl' />
          ))}
        </div>
      ) : error ? (
        <Card className='border-destructive/40'>
          <CardHeader>
            <CardTitle className='text-destructive'>Oups</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant='outline' onClick={() => void load()}>
              <RefreshCw /> Réessayer
            </Button>
          </CardContent>
        </Card>
      ) : gifts.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Catalogue vide</CardTitle>
            <CardDescription>
              Vital prépare des récompenses pour vous — revenez bientôt, et continuez d&apos;accumuler des points en
              recevant vos présentations.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className='grid gap-4 sm:grid-cols-2 xl:grid-cols-3'>
          {gifts.map((gift) => {
            const affordable = balance !== null && balance >= gift.cost
            const outOfStock = gift.stock !== null && gift.stock !== undefined && gift.stock <= 0
            return (
              <Card key={gift.id} className='flex flex-col justify-between'>
                <CardHeader>
                  <div className='flex items-start justify-between gap-2'>
                    <CardTitle className='text-base'>{gift.title}</CardTitle>
                    <Badge variant='default' className='shrink-0'>
                      {gift.cost} pts
                    </Badge>
                  </div>
                  {gift.description ? <CardDescription>{gift.description}</CardDescription> : null}
                </CardHeader>
                <CardContent className='flex items-center justify-between gap-2'>
                  <span className='text-muted-foreground text-xs'>
                    {gift.stock === null || gift.stock === undefined
                      ? 'Stock illimité'
                      : outOfStock
                        ? 'Rupture de stock'
                        : `${gift.stock} disponible${gift.stock > 1 ? 's' : ''}`}
                  </span>
                  <Button size='sm' disabled={!affordable || outOfStock || claiming === gift.id} onClick={() => void onClaim(gift)}>
                    {claiming === gift.id ? 'Échange…' : outOfStock ? 'Indisponible' : affordable ? 'Échanger' : `${gift.cost - (balance ?? 0)} pts manquants`}
                  </Button>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {claims.length > 0 ? (
        <section className='mt-8'>
          <h2 className='mb-3 text-lg font-semibold'>Mes demandes</h2>
          <ul className='space-y-2'>
            {claims.map((claim) => (
              <li
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
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  )
}
