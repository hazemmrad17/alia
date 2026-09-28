'use client'

// ──────────────────────────────────────────────
// Mes médecins
//
// The doctor side of the admin relationship, shaped like Mon équipe but reading
// a different object. A delegate is scored and climbs a ladder; a doctor is
// neither (docs/11-user-story-doctor.md: "Scoring: No", "Levels: None"), so what
// the manager needs here is the practice and the presentations received: which
// product, how it landed, and what was agreed next.
//
// Assignment lives on Comptes & accès, where accounts are created, so the two
// screens keep one job each.
// ──────────────────────────────────────────────

import { useCallback, useEffect, useMemo, useState } from 'react'

import Link from 'next/link'

import { AlertCircle, ArrowRight, CalendarDays, MapPin, RefreshCw, Stethoscope, UserMinus, Users } from 'lucide-react'

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
  getDoctorSessions,
  getDoctors,
  removeDoctorFromTeam,
  type DoctorPresentation,
  type DoctorRecord
} from '@/lib/alia-api'
import { getCurrentUser, initialsOf } from '@/lib/auth'

const FORMAT_LABELS: Record<string, string> = {
  flash: 'Flash',
  standard: 'Standard',
  approfondie: 'Approfondie'
}

/** How receptive the doctor was — the visit report's own vocabulary. */
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

function formatDuration(seconds: number): string {
  if (!seconds) return '—'

  const minutes = Math.floor(seconds / 60)
  const rest = Math.round(seconds % 60)

  return minutes ? `${minutes} min ${rest.toString().padStart(2, '0')}` : `${rest} s`
}

export default function MyDoctors() {
  const me = useMemo(() => getCurrentUser(), [])

  const [doctors, setDoctors] = useState<DoctorRecord[]>([])
  const [manager, setManager] = useState<DoctorRecord | null>(null)
  const [presentations, setPresentations] = useState<DoctorPresentation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [doctorFilter, setDoctorFilter] = useState('all')

  const isAdmin = me?.role === 'admin'

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const list = await getDoctors()

      setDoctors(list.doctors)

      // `manager` is only meaningful for a doctor reading their own referent.
      setManager(list.manager as DoctorRecord | null)

      const log = await getDoctorSessions({ limit: 500 })

      setPresentations(log.sessions)
    } catch (e) {
      setError(
        e instanceof ApiError && e.status === 403
          ? 'Le suivi des médecins est réservé à l’administrateur.'
          : 'Impossible de charger les médecins. Vérifiez que le serveur ALIA est démarré.'
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  /** Presentations grouped per doctor, newest first. */
  const byDoctor = useMemo(() => {
    const map = new Map<string, DoctorPresentation[]>()

    for (const session of presentations) {
      const existing = map.get(session.doctor_id)

      if (existing) existing.push(session)
      else map.set(session.doctor_id, [session])
    }

    return map
  }, [presentations])

  const teamPresentations = useMemo(
    () => (doctorFilter === 'all' ? presentations : presentations.filter(p => p.doctor_id === doctorFilter)),
    [presentations, doctorFilter]
  )

  const totals = useMemo(() => {
    const products = new Set(presentations.map(p => p.product_focus).filter(Boolean))

    return {
      doctors: doctors.length,
      presentations: presentations.length,
      products: products.size
    }
  }, [doctors.length, presentations])

  const release = useCallback(async (doctor: DoctorRecord) => {
    setBusyId(doctor.id)
    setError(null)

    try {
      await removeDoctorFromTeam(doctor.id)
      setDoctors(current => current.filter(entry => entry.id !== doctor.id))
      setPresentations(current => current.filter(session => session.doctor_id !== doctor.id))
      setNotice(`${doctor.full_name} ne fait plus partie de votre liste.`)
    } catch {
      setError('Impossible de retirer ce médecin.')
    } finally {
      setBusyId(null)
    }
  }, [])

  if (!isAdmin) {
    return (
      <div className='flex flex-col gap-6'>
        <div>
          <h1 className='font-heading text-xl font-semibold'>Mon référent</h1>
          <p className='text-muted-foreground mt-1 text-sm'>
            Le compte VITAL qui suit les présentations reçues et prépare la suite.
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
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className='flex flex-col gap-2 py-6'>
              <span className='flex items-center gap-2 text-lg font-semibold'>
                <Users className='text-muted-foreground size-5' /> Aucun référent assigné
              </span>
              <p className='text-muted-foreground text-sm'>
                Votre compte n’est encore rattaché à aucun administrateur VITAL.
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
        <h1 className='font-heading text-xl font-semibold'>Mes médecins</h1>
        <p className='text-muted-foreground mt-1 text-sm'>
          Les médecins et pharmaciens que vous suivez — leurs présentations et la suite convenue.
        </p>
      </div>

      {notice && (
        <Alert>
          <Stethoscope className='size-4' />
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
              <span className='text-2xl font-semibold'>{totals.doctors}</span>
              <span className='text-muted-foreground text-sm'>Médecins suivis</span>
            </CardContent>
          </Card>
          <Card>
            <CardContent className='flex flex-col gap-1'>
              <span className='text-2xl font-semibold'>{totals.presentations}</span>
              <span className='text-muted-foreground text-sm'>Présentations reçues</span>
            </CardContent>
          </Card>
          <Card>
            <CardContent className='flex flex-col gap-1'>
              <span className='text-2xl font-semibold'>{totals.products}</span>
              <span className='text-muted-foreground text-sm'>Produits présentés</span>
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
        ) : doctors.length === 0 ? (
          <Card className='sm:col-span-2 xl:col-span-3'>
            <CardContent className='flex flex-col items-center gap-3 py-10 text-center'>
              <Stethoscope className='text-muted-foreground size-8' />
              <p className='text-lg font-medium'>Aucun médecin dans votre liste</p>
              <p className='text-muted-foreground max-w-md text-sm'>
                Rattachez un médecin depuis Comptes &amp; accès : chaque ligne de compte médecin peut rejoindre votre
                liste depuis son menu d’actions.
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
          doctors.map(doctor => {
            const rows = byDoctor.get(doctor.id) ?? []
            const last = rows[0] ?? null
            const busy = busyId === doctor.id

            return (
              <Card key={doctor.id}>
                <CardContent className='flex flex-col gap-3'>
                  <div className='flex items-start justify-between gap-2'>
                    <div className='flex min-w-0 items-center gap-3'>
                      <Avatar className='size-10'>
                        <AvatarFallback className='bg-primary/10 text-primary text-sm'>
                          {initialsOf(doctor.full_name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className='min-w-0'>
                        <p className='truncate text-sm font-medium'>{doctor.full_name}</p>
                        <p className='text-muted-foreground truncate text-xs'>{doctor.email}</p>
                        {doctor.assigned_at && (
                          <p className='text-muted-foreground truncate text-[10px]'>
                            Suivi depuis le {formatDate(doctor.assigned_at)}
                            {doctor.previous_manager_name && ` · repris de ${doctor.previous_manager_name}`}
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
                            aria-label={`Retirer ${doctor.full_name} de ma liste`}
                            onClick={() => void release(doctor)}
                          />
                        }
                      >
                        <UserMinus className={cn('size-4', busy && 'animate-pulse')} />
                      </TooltipTrigger>
                      <TooltipContent>Retirer de ma liste</TooltipContent>
                    </Tooltip>
                  </div>

                  <div className='flex flex-wrap items-center gap-1.5 text-xs'>
                    {doctor.specialty && (
                      <Badge variant='secondary' className='gap-1'>
                        <Stethoscope className='size-3' />
                        {doctor.specialty}
                      </Badge>
                    )}
                    {doctor.city && (
                      <Badge variant='secondary' className='gap-1'>
                        <MapPin className='size-3' />
                        {doctor.city}
                      </Badge>
                    )}
                  </div>

                  <div className='bg-muted/50 flex items-center justify-between rounded-md px-3 py-2'>
                    <div className='flex flex-col items-center gap-0.5'>
                      <span className='text-foreground text-sm font-semibold'>{rows.length}</span>
                      <span className='text-muted-foreground text-[10px]'>Présentations</span>
                    </div>

                    <div className='bg-border h-6 w-px' />

                    <div className='flex flex-col items-center gap-0.5'>
                      <span className='text-foreground max-w-28 truncate text-sm font-semibold'>
                        {last?.product_focus ?? '—'}
                      </span>
                      <span className='text-muted-foreground text-[10px]'>Dernier produit</span>
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

                  {last?.next_step && (
                    <p className='text-muted-foreground text-xs'>
                      Suite convenue : <span className='text-foreground font-medium'>{last.next_step}</span>
                      {last.next_step_date ? ` (${formatDate(last.next_step_date)})` : ''}
                    </p>
                  )}

                  <Button
                    variant='outline'
                    size='sm'
                    className='w-full justify-between'
                    onClick={() => setDoctorFilter(doctor.id)}
                  >
                    Voir ses présentations <ArrowRight className='size-4' />
                  </Button>
                </CardContent>
              </Card>
            )
          })
        )}
      </div>

      <Card className='gap-0 overflow-hidden py-0 shadow-none'>
        <CardHeader className='border-b px-6 py-5'>
          <CardTitle className='text-lg font-medium'>Présentations reçues</CardTitle>
          <CardDescription>
            Le compte rendu de visite de vos médecins — produit présenté, accueil et prochaine étape. Ces échanges ne
            sont pas notés : un médecin n’est pas évalué.
          </CardDescription>
        </CardHeader>

        <CardContent className='p-0'>
          <div className='flex flex-col gap-4 border-b p-6 sm:flex-row sm:items-center sm:justify-between'>
            <div className='flex w-full flex-col gap-2 sm:max-w-xs'>
              <label className='text-sm font-medium' htmlFor='doctor-filter'>
                Filtrer par médecin
              </label>
              <Select value={doctorFilter} onValueChange={value => setDoctorFilter(value ?? 'all')}>
                <SelectTrigger id='doctor-filter' className='w-full' disabled={loading}>
                  {/* base-ui renders the raw value unless given a render function,
                      and a doctor id is not what should show in this filter. */}
                  <SelectValue>
                    {(value: string) =>
                      value === 'all'
                        ? 'Tous mes médecins'
                        : (doctors.find(doctor => doctor.id === value)?.full_name ?? value)
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='all'>Tous mes médecins</SelectItem>
                  {doctors.map(doctor => (
                    <SelectItem key={doctor.id} value={doctor.id}>
                      {doctor.full_name}
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
          ) : teamPresentations.length === 0 ? (
            <p className='text-muted-foreground p-6 text-sm'>
              Aucune présentation enregistrée pour cette sélection. Les visites reçues par vos médecins apparaîtront ici
              dès qu’elles seront terminées.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className='p-4 font-semibold'>Date</TableHead>
                  <TableHead className='p-4 font-semibold'>Médecin</TableHead>
                  <TableHead className='p-4 font-semibold'>Produit</TableHead>
                  <TableHead className='p-4 font-semibold'>Format</TableHead>
                  <TableHead className='p-4 font-semibold'>Durée</TableHead>
                  <TableHead className='p-4 font-semibold'>Accueil</TableHead>
                  <TableHead className='p-4 font-semibold'>Prochaine étape</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {teamPresentations.map(session => (
                  <TableRow key={session.session_id}>
                    <TableCell className='text-muted-foreground p-4 whitespace-nowrap'>
                      {formatDate(session.completed_at)}
                    </TableCell>
                    <TableCell className='p-4 font-medium'>{session.doctor_name ?? 'Compte inconnu'}</TableCell>
                    <TableCell className='p-4'>{session.product_focus ?? '—'}</TableCell>
                    <TableCell className='p-4'>{FORMAT_LABELS[session.visit_format] ?? session.visit_format}</TableCell>
                    <TableCell className='text-muted-foreground p-4 whitespace-nowrap'>
                      {formatDuration(session.duration_seconds)}
                    </TableCell>
                    <TableCell className='p-4'>
                      {session.engagement_level ? (
                        <Badge
                          variant='secondary'
                          className={cn(
                            'rounded-sm capitalize',
                            ENGAGEMENT_STYLE[session.engagement_level] ?? 'bg-muted text-muted-foreground'
                          )}
                        >
                          {session.engagement_level}
                        </Badge>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                    <TableCell className='text-muted-foreground p-4'>{session.next_step ?? '—'}</TableCell>
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
