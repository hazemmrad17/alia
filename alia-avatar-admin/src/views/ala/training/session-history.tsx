'use client'

// ──────────────────────────────────────────────
// Historique des sessions d'entraînement
//
// Liste les sessions réellement enregistrées côté serveur
// (`/api/v1/dashboard/saved-sessions`). Volontairement SANS scores : le détail de
// l'évaluation reste réservé au responsable. Le délégué voit ce qu'il sait déjà —
// quand il a joué, quelle configuration, et la note qu'il a lui-même laissée.
// ──────────────────────────────────────────────

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  CalendarDays, Star, PlayCircle, RefreshCw, Clock, Search, MessageSquareQuote
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table'

import { getSavedSessions } from '@/lib/alia-api'
import type { SavedSession, SavedSessionsResponse } from '@/lib/alia-api'
import { LEVEL_META } from '@/types/alia'

const FORMAT_LABELS: Record<string, string> = {
  flash: 'Flash',
  standard: 'Standard',
  approfondie: 'Approfondie'
}

/** Five stars, filled up to `value` — the delegate's own rating. */
function Stars({ value }: { value: number | null }) {
  if (!value) return <span className='text-xs text-muted-foreground'>—</span>
  return (
    <span className='inline-flex items-center gap-0.5' title={`${value} / 5`}>
      {[1, 2, 3, 4, 5].map(n => (
        <Star
          key={n}
          className={`size-3.5 ${n <= value ? 'text-amber-400 fill-amber-400' : 'text-muted-foreground/30'}`}
        />
      ))}
    </span>
  )
}

export default function SessionHistory() {
  const [data, setData] = useState<SavedSessionsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [levelFilter, setLevelFilter] = useState('all')
  const [formatFilter, setFormatFilter] = useState('all')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 10

  const load = async () => {
    setLoading(true)
    setError(false)
    try {
      setData(await getSavedSessions(false))
    } catch {
      setError(true)
    }
    setLoading(false)
  }

  useEffect(() => { void load() }, [])

  const sessions = data?.sessions ?? []

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()

    return sessions.filter(s => {
      if (levelFilter !== 'all' && s.level !== levelFilter) return false
      if (formatFilter !== 'all' && s.visit_format !== formatFilter) return false
      if (q && !`${s.doctor_style} ${s.comment ?? ''}`.toLowerCase().includes(q)) return false
      return true
    })
  }, [sessions, levelFilter, formatFilter, query])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  useEffect(() => { setPage(1) }, [levelFilter, formatFilter, query])
  const pageItems: SavedSession[] = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return (
    <div className='col-span-full space-y-6'>
      {/* ── En-tête + stats ── */}
      <div className='flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between'>
        <div>
          <h1 className='text-2xl font-bold flex items-center gap-2'>
            <CalendarDays className='size-6 text-primary' /> Mes sessions d&apos;entraînement
          </h1>
          <p className='text-sm text-muted-foreground'>
            Toutes vos simulations enregistrées. Votre évaluation détaillée est transmise à votre responsable.
          </p>
        </div>
        <div className='flex items-center gap-2'>
          <Button
            variant='outline'
            size='sm'
            onClick={() => void load()}
            disabled={loading}
            className='gap-1.5'
          >
            <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} /> Actualiser
          </Button>
          <Link
            href='/simulation'
            className='inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90'
          >
            <PlayCircle className='size-4' /> Nouvelle session
          </Link>
        </div>
      </div>

      <div className='grid gap-4 sm:grid-cols-3'>
        <Card>
          <CardHeader className='pb-2'>
            <CardDescription>Sessions enregistrées</CardDescription>
          </CardHeader>
          <CardContent>
            <p className='text-3xl font-bold tabular-nums'>{data?.total ?? '—'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className='pb-2'>
            <CardDescription>Cette semaine</CardDescription>
          </CardHeader>
          <CardContent>
            <p className='text-3xl font-bold tabular-nums'>{data?.this_week ?? '—'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className='pb-2'>
            <CardDescription>Votre note moyenne</CardDescription>
          </CardHeader>
          <CardContent className='flex items-center gap-2'>
            <p className='text-3xl font-bold tabular-nums'>
              {data?.average_rating !== null && data?.average_rating !== undefined ? data.average_rating : '—'}
            </p>
            {data?.average_rating ? <span className='text-sm text-muted-foreground'>/ 5</span> : null}
            {data?.rated ? (
              <span className='text-xs text-muted-foreground'>({data.rated} avis)</span>
            ) : null}
          </CardContent>
        </Card>
      </div>

      {/* ── Filtres ── */}
      <Card>
        <CardHeader className='flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between'>
          <div>
            <CardTitle>Historique</CardTitle>
            <CardDescription>{filtered.length} session(s) affichée(s)</CardDescription>
          </div>
          <div className='flex flex-wrap items-center gap-2'>
            <div className='relative'>
              <Search className='absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground' />
              <Input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder='Rechercher (profil, commentaire)…'
                className='h-9 w-56 pl-8 text-sm'
              />
            </div>
            <Select value={levelFilter} onValueChange={v => setLevelFilter(v ?? 'all')}>
              <SelectTrigger className='h-9 w-36 text-sm'>
                <SelectValue placeholder='Niveau' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='all'>Tous les niveaux</SelectItem>
                <SelectItem value='debutant'>Débutant</SelectItem>
                <SelectItem value='junior'>Junior</SelectItem>
                <SelectItem value='confirme'>Confirmé</SelectItem>
                <SelectItem value='expert'>Expert</SelectItem>
              </SelectContent>
            </Select>
            <Select value={formatFilter} onValueChange={v => setFormatFilter(v ?? 'all')}>
              <SelectTrigger className='h-9 w-36 text-sm'>
                <SelectValue placeholder='Format' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='all'>Tous les formats</SelectItem>
                <SelectItem value='flash'>Flash</SelectItem>
                <SelectItem value='standard'>Standard</SelectItem>
                <SelectItem value='approfondie'>Approfondie</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>

        <CardContent className='pt-0'>
          {loading ? (
            <div className='space-y-3'>
              {[0, 1, 2, 3].map(i => <Skeleton key={i} className='h-14 rounded-md' />)}
            </div>
          ) : error ? (
            <div className='py-12 text-center text-sm text-muted-foreground'>
              Impossible de charger vos sessions — le serveur d&apos;entraînement n&apos;est pas joignable.
            </div>
          ) : pageItems.length === 0 ? (
            <div className='py-14 text-center space-y-3'>
              <PlayCircle className='mx-auto size-9 text-muted-foreground/50' />
              <p className='text-sm text-muted-foreground'>
                Aucune session pour le moment. Lancez votre première simulation pour la voir apparaître ici.
              </p>
              <Link
                href='/simulation'
                className='inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90'
              >
                Démarrer une simulation
              </Link>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Niveau</TableHead>
                  <TableHead className='hidden sm:table-cell'>Profil médecin</TableHead>
                  <TableHead className='hidden md:table-cell'>Format</TableHead>
                  <TableHead className='text-center'>Votre note</TableHead>
                  <TableHead className='hidden lg:table-cell'>Votre commentaire</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageItems.map(s => {
                  const levelMeta = LEVEL_META[s.level as keyof typeof LEVEL_META]
                  const when = s.completed_at ? new Date(s.completed_at) : null
                  return (
                    <TableRow key={s.session_id}>
                      <TableCell className='whitespace-nowrap text-sm'>
                        {when
                          ? when.toLocaleDateString('fr-FR', {
                              day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
                            })
                          : '—'}
                      </TableCell>
                      <TableCell>
                        <Badge variant='secondary' className={`text-xs ${levelMeta?.textClass ?? ''}`}>
                          {levelMeta?.label ?? s.level}
                        </Badge>
                      </TableCell>
                      <TableCell className='hidden sm:table-cell text-sm capitalize'>{s.doctor_style}</TableCell>
                      <TableCell className='hidden md:table-cell text-sm'>
                        {FORMAT_LABELS[s.visit_format] ?? s.visit_format}
                      </TableCell>
                      <TableCell className='text-center'>
                        <Stars value={s.rating ?? null} />
                      </TableCell>
                      <TableCell className='hidden lg:table-cell text-sm text-muted-foreground max-w-[22rem]'>
                        {s.comment ? (
                          <span className='inline-flex items-start gap-1.5'>
                            <MessageSquareQuote className='mt-0.5 size-3.5 shrink-0 text-primary/70' />
                            <span className='line-clamp-2'>{s.comment}</span>
                          </span>
                        ) : (
                          <span className='text-muted-foreground/50'>Aucun</span>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}

          {!loading && !error && filtered.length > PAGE_SIZE && (
            <div className='mt-4 flex items-center justify-between'>
              <span className='text-xs text-muted-foreground flex items-center gap-1.5'>
                <Clock className='size-3.5' />
                Page {page} / {totalPages}
              </span>
              <div className='flex gap-2'>
                <Button
                  variant='outline'
                  size='sm'
                  disabled={page === 1}
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                >
                  Précédent
                </Button>
                <Button
                  variant='outline'
                  size='sm'
                  disabled={page >= totalPages}
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                >
                  Suivant
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
