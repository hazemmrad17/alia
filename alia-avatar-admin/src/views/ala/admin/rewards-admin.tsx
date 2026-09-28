'use client'

// ──────────────────────────────────────────────
// Récompenses & fidélité (admin)
//
// What the platform account needs to run the doctor loyalty program: define
// the gift catalog, adjust a doctor's points, and fulfil (or cancel) the
// claims doctors submit from their portal.
// ──────────────────────────────────────────────

import { useCallback, useEffect, useState } from 'react'

import { Gift, PackageCheck, Plus, RefreshCw, X } from 'lucide-react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import {
  ApiError,
  adminCreateGift,
  adminListClaims,
  adminListGifts,
  adminUpdateClaim,
  adminUpdateGift,
  type GiftClaim,
  type RewardGift
} from '@/lib/alia-api'
import { cn } from '@/lib/utils'

function ClaimStatusBadge({ status }: { status: GiftClaim['status'] }) {
  return (
    <Badge
      variant='default'
      className={cn(
        status === 'delivered' && 'bg-green-600/10 text-green-600 dark:text-green-400',
        status === 'requested' && 'bg-amber-600/10 text-amber-600 dark:text-amber-400',
        status === 'cancelled' && 'bg-destructive/10 text-destructive'
      )}
    >
      {status === 'delivered' ? 'Livré' : status === 'requested' ? 'En préparation' : 'Annulé'}
    </Badge>
  )
}

export function RewardsAdmin() {
  const [gifts, setGifts] = useState<RewardGift[]>([])
  const [claims, setClaims] = useState<GiftClaim[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [cost, setCost] = useState('100')
  const [stock, setStock] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [giftList, claimList] = await Promise.all([adminListGifts(), adminListClaims()])
      setGifts(giftList.gifts)
      setClaims(claimList.claims)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Impossible de charger les récompenses.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const onCreate = async () => {
    setSaving(true)
    try {
      await adminCreateGift({
        title: title.trim(),
        description: description.trim() || null,
        cost: Number.parseInt(cost || '0', 10) || 0,
        stock: stock.trim() === '' ? null : Math.max(0, Number.parseInt(stock, 10) || 0)
      })
      toast.success('Cadeau ajouté au catalogue.')
      setDialogOpen(false)
      setTitle('')
      setDescription('')
      setCost('100')
      setStock('')
      await load()
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Création impossible.')
    } finally {
      setSaving(false)
    }
  }

  const onToggleGift = async (gift: RewardGift) => {
    try {
      await adminUpdateGift(gift.id, { active: !gift.active })
      await load()
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Mise à jour impossible.')
    }
  }

  const onDeliver = async (claim: GiftClaim) => {
    try {
      await adminUpdateClaim(claim.id, 'delivered')
      toast.success(`Cadeau « ${claim.gift_title} » marqué comme livré.`)
      await load()
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Mise à jour impossible.')
    }
  }

  const onCancel = async (claim: GiftClaim) => {
    try {
      await adminUpdateClaim(claim.id, 'cancelled')
      await load()
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Mise à jour impossible.')
    }
  }

  const pending = claims.filter((c) => c.status === 'requested')

  return (
    <div className='mx-auto size-full max-w-360 flex-1 px-4 py-6 sm:px-6'>
      <div className='mb-6 flex flex-wrap items-center justify-between gap-3'>
        <div>
          <h1 className='text-2xl font-semibold tracking-tight'>Récompenses & fidélité</h1>
          <p className='text-muted-foreground text-sm'>
            Le catalogue de cadeaux et les demandes de vos médecins.
          </p>
        </div>
        <div className='flex items-center gap-2'>
          <Button variant='outline' onClick={() => void load()}>
            <RefreshCw /> Actualiser
          </Button>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus /> Nouveau cadeau
          </Button>
        </div>
      </div>

      {loading ? (
        <div className='space-y-4'>
          <Skeleton className='h-48 rounded-xl' />
          <Skeleton className='h-48 rounded-xl' />
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
      ) : (
        <div className='grid gap-6 xl:grid-cols-2'>
          {/* Gift catalog */}
          <Card>
            <CardHeader>
              <CardTitle className='flex items-center gap-2'>
                <Gift className='size-5' /> Catalogue ({gifts.length})
              </CardTitle>
              <CardDescription>Visible par les médecins de votre structure.</CardDescription>
            </CardHeader>
            <CardContent>
              {gifts.length === 0 ? (
                <p className='text-muted-foreground py-8 text-center text-sm'>
                  Aucun cadeau — créez le premier pour lancer le programme.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cadeau</TableHead>
                      <TableHead>Coût</TableHead>
                      <TableHead>Stock</TableHead>
                      <TableHead>Actif</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {gifts.map((gift) => (
                      <TableRow key={gift.id}>
                        <TableCell>
                          <span className='font-medium'>{gift.title}</span>
                          {gift.description ? (
                            <p className='text-muted-foreground line-clamp-1 text-xs'>{gift.description}</p>
                          ) : null}
                        </TableCell>
                        <TableCell>{gift.cost} pts</TableCell>
                        <TableCell>{gift.stock ?? '∞'}</TableCell>
                        <TableCell>
                          <Switch checked={gift.active} onCheckedChange={() => void onToggleGift(gift)} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Claims inbox */}
          <Card>
            <CardHeader>
              <CardTitle className='flex items-center gap-2'>
                <PackageCheck className='size-5' /> Demandes
                {pending.length > 0 ? (
                  <Badge variant='default' className='ml-1 bg-amber-600/10 text-amber-600 dark:text-amber-400'>
                    {pending.length} en attente
                  </Badge>
                ) : null}
              </CardTitle>
              <CardDescription>Les cadeaux que les médecins ont échangés contre leurs points.</CardDescription>
            </CardHeader>
            <CardContent>
              {claims.length === 0 ? (
                <p className='text-muted-foreground py-8 text-center text-sm'>Aucune demande pour le moment.</p>
              ) : (
                <ul className='space-y-2'>
                  {claims.map((claim) => (
                    <li
                      key={claim.id}
                      className='bg-muted/40 flex flex-wrap items-center justify-between gap-3 rounded-md px-4 py-3'
                    >
                      <div className='flex flex-col'>
                        <span className='text-sm font-medium'>{claim.gift_title ?? 'Cadeau'}</span>
                        <span className='text-muted-foreground text-xs'>
                          {claim.doctor_name ?? claim.doctor_id} ·{' '}
                          {new Date(claim.requested_at).toLocaleDateString('fr-FR')}
                        </span>
                      </div>
                      <div className='flex items-center gap-2'>
                        <ClaimStatusBadge status={claim.status} />
                        {claim.status === 'requested' ? (
                          <>
                            <Button size='sm' onClick={() => void onDeliver(claim)}>
                              <PackageCheck /> Livré
                            </Button>
                            <Button size='sm' variant='ghost' onClick={() => void onCancel(claim)}>
                              <X /> Annuler
                            </Button>
                          </>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Create gift dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nouveau cadeau</DialogTitle>
            <DialogDescription>Il apparaîtra aussitôt dans le catalogue des médecins.</DialogDescription>
          </DialogHeader>
          <div className='space-y-4'>
            <div className='space-y-2'>
              <Label htmlFor='gift-title'>Titre</Label>
              <Input
                id='gift-title'
                value={title}
                placeholder='Échantillonnage HYDRA'
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div className='space-y-2'>
              <Label htmlFor='gift-desc'>Description (optionnelle)</Label>
              <Textarea
                id='gift-desc'
                value={description}
                placeholder="Un lot d'échantillons offert par votre délégué."
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <div className='grid grid-cols-2 gap-4'>
              <div className='space-y-2'>
                <Label htmlFor='gift-cost'>Coût (points)</Label>
                <Input id='gift-cost' type='number' min={0} value={cost} onChange={(e) => setCost(e.target.value)} />
              </div>
              <div className='space-y-2'>
                <Label htmlFor='gift-stock'>Stock (vide = illimité)</Label>
                <Input id='gift-stock' type='number' min={0} value={stock} onChange={(e) => setStock(e.target.value)} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant='outline' onClick={() => setDialogOpen(false)}>
              Annuler
            </Button>
            <Button disabled={!title.trim() || saving} onClick={() => void onCreate()}>
              {saving ? 'Création…' : 'Créer le cadeau'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
