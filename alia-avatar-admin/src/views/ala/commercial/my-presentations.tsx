'use client'

// ──────────────────────────────────────────────
// Mes présentations
//
// What the doctor himself received. The server scopes the feed to the signed-in
// account (scope: "self"), so no filter can widen it: a doctor reads his own
// presentations and nobody else's. No scores appear because none exist — the
// visit report is the object (docs/11-user-story-doctor.md).
// ──────────────────────────────────────────────

import { useEffect, useMemo, useState } from 'react'

import Link from 'next/link'

import { CalendarDays, PlayCircle, RefreshCw, Sparkles, Stethoscope } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'

import { getDoctorSessions, type DoctorPresentation } from '@/lib/alia-api'

const FORMAT_LABELS: Record<string, string> = {
  flash: 'Flash',
  standard: 'Standard',
  approfondie: 'Approfondie'
}

const ENGAGEMENT_STYLE: Record<string, string> = {
  receptive: 'bg-emerald-500/10 text-emerald-600',
  hesitant: 'bg-amber-500/10 text-amber-600',
  neutral: 'bg-muted text-muted-foreground',
  hostile: 'bg-destructive/10 text-destructive'
}

function formatDate(value?: string | null): string {
  if (!value) return '—'

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) return '—'

  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function MyPresentations() {
  const [sessions, setSessions] = useState<DoctorPresentation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const load = async () => {
    setLoading(true)
    setError(false)

    try {
      const log = await getDoctorSessions({ limit: 500 })

      setSessions(log.sessions)
    } catch {
      setError(true)
    }

    setLoading(false)
  }

  useEffect(() => {
    void load()
  }, [])

  const totals = useMemo(() => {
    const products = new Set(sessions.map(s => s.product_focus).filter(Boolean))
    const last = sessions[0] ?? null

    return { total: sessions.length, products: products.size, last }
  }, [sessions])

  return (
    <div className='col-span-full space-y-6'>
      <div className='flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between'>
        <div>
          <h1 className='flex items-center gap-2 text-2xl font-bold'>
            <CalendarDays className='text-primary size-6' /> Mes présentations
          </h1>
          <p className='text-muted-foreground text-sm'>
            Les présentations VITAL que vous avez reçues, avec la suite convenue à chaque fois.
          </p>
        </div>
        <div className='flex items-center gap-2'>
          <Button variant='outline' size='sm' onClick={() => void load()} disabled={loading} className='gap-1.5'>
            <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} /> Actualiser
          </Button>
          <Link
            href='/commercial'
            className='bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-9 items-center gap-1.5 rounded-md px-4 text-sm font-semibold transition-colors'
          >
            <PlayCircle className='size-4' /> Nouvelle présentation
          </Link>
        </div>
      </div>

      <div className='grid gap-4 sm:grid-cols-3'>
        <Card>
          <CardHeader className='pb-2'>
            <CardDescription>Présentations reçues</CardDescription>
          </CardHeader>
          <CardContent>
            <p className='text-3xl font-bold tabular-nums'>{loading ? '—' : totals.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className='pb-2'>
            <CardDescription>Produits découverts</CardDescription>
          </CardHeader>
          <CardContent>
            <p className='text-3xl font-bold tabular-nums'>{loading ? '—' : totals.products}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className='pb-2'>
            <CardDescription>Dernière présentation</CardDescription>
          </CardHeader>
          <CardContent>
            <p className='text-xl font-bold'>{loading ? '—' : (totals.last?.product_focus ?? '—')}</p>
            <p className='text-muted-foreground text-xs'>{formatDate(totals.last?.completed_at)}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Historique</CardTitle>
          <CardDescription>{sessions.length} présentation(s) enregistrée(s)</CardDescription>
        </CardHeader>

        <CardContent className='pt-0'>
          {loading ? (
            <div className='space-y-3'>
              {[0, 1, 2, 3].map(i => (
                <Skeleton key={i} className='h-14 rounded-md' />
              ))}
            </div>
          ) : error ? (
            <div className='text-muted-foreground py-12 text-center text-sm'>
              Impossible de charger vos présentations — le serveur ALIA n’est pas joignable.
            </div>
          ) : sessions.length === 0 ? (
            <div className='space-y-3 py-14 text-center'>
              <Stethoscope className='text-muted-foreground/50 mx-auto size-9' />
              <p className='text-muted-foreground text-sm'>
                Aucune présentation pour le moment. Votre première visite apparaîtra ici.
              </p>
              <Link
                href='/commercial'
                className='bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-9 items-center rounded-md px-4 text-sm font-semibold'
              >
                Recevoir une présentation
              </Link>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Produit</TableHead>
                  <TableHead className='hidden md:table-cell'>Format</TableHead>
                  <TableHead>Accueil</TableHead>
                  <TableHead className='hidden lg:table-cell'>Prochaine étape</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sessions.map(session => (
                  <TableRow key={session.session_id}>
                    <TableCell className='text-sm whitespace-nowrap'>{formatDate(session.completed_at)}</TableCell>
                    <TableCell className='text-sm font-medium'>{session.product_focus ?? '—'}</TableCell>
                    <TableCell className='hidden text-sm md:table-cell'>
                      {FORMAT_LABELS[session.visit_format] ?? session.visit_format}
                    </TableCell>
                    <TableCell>
                      {session.engagement_level ? (
                        <Badge
                          variant='secondary'
                          className={cn(
                            'gap-1 rounded-sm capitalize',
                            ENGAGEMENT_STYLE[session.engagement_level] ?? 'bg-muted text-muted-foreground'
                          )}
                        >
                          <Sparkles className='size-3' />
                          {session.engagement_level}
                        </Badge>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                    <TableCell className='text-muted-foreground hidden max-w-[22rem] text-sm lg:table-cell'>
                      {session.next_step ?? '—'}
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
