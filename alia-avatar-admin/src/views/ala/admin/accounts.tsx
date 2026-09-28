'use client'

// ──────────────────────────────────────────────
// Comptes & accès
//
// Layout follows the admin template's users list: four KPI cards, a filter bar,
// a toolbar with Export / Add, a selectable table, and a pagination footer.
//
// It is the client-facing half of what the licence sells. A Directeur
// Commercial must be able to see who has access and give a new delegate an
// account the day they arrive, without anyone opening a file on the server.
//
// Permissions follow the API exactly rather than being re-implemented here: an
// administrator can create, re-role, deactivate, reset and delete, while a
// doctor never gets this page at all, and the server answers 403 to them for
// anything a non-admin tries, so this page is convenience, not the gate.
//
// Two edits are deliberately impossible (the API refuses them too): switching
// off your own account, and removing the last active administrator. The row
// controls for your own account are therefore disabled, which explains itself
// better than a request that fails.
// ──────────────────────────────────────────────

import { useCallback, useEffect, useMemo, useState } from 'react'

import type { LucideIcon } from 'lucide-react'
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  GraduationCap,
  KeyRound,
  Loader2,
  PencilLine,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  UserCheck,
  Stethoscope,
  UserPlus,
  Users,
  UserX,
  UserMinus
} from 'lucide-react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'

import {
  ApiError,
  assignDoctorToTeam,
  assignToTeam,
  changeOwnPassword,
  createAccount,
  deleteAccount,
  getDoctors,
  getTeam,
  listAccounts,
  removeDoctorFromTeam,
  removeFromTeam,
  resetAccountPassword,
  updateAccount
} from '@/lib/alia-api'
import { ACCOUNT_ROLE_LABELS, getCurrentUser, initialsOf, type AccountRole, type AuthUser } from '@/lib/auth'

const ROLE_ORDER: AccountRole[] = ['admin', 'doctor', 'delegate']

const ROLE_ICON: Record<AccountRole, LucideIcon> = {
  admin: ShieldCheck,
  doctor: Stethoscope,
  delegate: GraduationCap
}

const ROLE_STYLE: Record<AccountRole, { dot: string; icon: string; badge: string }> = {
  admin: { dot: 'bg-chart-1', icon: 'text-chart-1', badge: 'bg-chart-1/10 text-chart-1' },
  doctor: { dot: 'bg-chart-3', icon: 'text-chart-3', badge: 'bg-chart-3/10 text-chart-3' },
  delegate: { dot: 'bg-chart-2', icon: 'text-chart-2', badge: 'bg-chart-2/10 text-chart-2' }
}

type StatusFilter = 'all' | 'active' | 'inactive'
type SortKey = 'role' | 'name' | 'recent'

const PAGE_SIZES = [10, 25, 50]

/** 'fr-FR' so the dates read the way a Tunisian team writes them. */
function formatDate(value?: string | null): string {
  if (!value) return '—'

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) return '—'

  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}

function relativeLogin(value?: string | null): string {
  if (!value) return 'Jamais connecté'

  const then = new Date(value).getTime()

  if (Number.isNaN(then)) return '—'

  const minutes = Math.round((Date.now() - then) / 60000)

  if (minutes < 2) return "À l'instant"
  if (minutes < 60) return `Il y a ${minutes} min`

  const hours = Math.round(minutes / 60)

  if (hours < 24) return `Il y a ${hours} h`

  const days = Math.round(hours / 24)

  if (days < 31) return `Il y a ${days} j`

  return formatDate(value)
}

/**
 * Excel-ready CSV: UTF-8 BOM for the accents, semicolons because that is the
 * list separator French Excel expects.
 */
function downloadCsv(rows: AuthUser[]) {
  const header = ['Nom', 'E-mail', 'Rôle', 'État', 'Créé le', 'Dernière connexion']

  const body = rows.map(account => [
    account.full_name,
    account.email,
    ACCOUNT_ROLE_LABELS[account.role],
    account.is_active ? 'Actif' : 'Désactivé',
    account.created_at ?? '',
    account.last_login_at ?? ''
  ])

  const csv = [header, ...body]
    .map(line => line.map(value => `"${String(value).replace(/"/g, '""')}"`).join(';'))
    .join('\r\n')

  const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')

  link.href = url
  link.download = `comptes-alia-${new Date().toISOString().slice(0, 10)}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

/** Shared shape for the two dialogs that collect a password. */
function PasswordDialog({
  open,
  onOpenChange,
  title,
  description,
  requireCurrent,
  onSubmit
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  requireCurrent?: boolean
  onSubmit: (currentPassword: string, newPassword: string) => Promise<void>
}) {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) {
      setCurrent('')
      setNext('')
      setError(null)
    }
  }, [open])

  const submit = async () => {
    setSaving(true)
    setError(null)

    try {
      await onSubmit(current, next)
      onOpenChange(false)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "L'opération a échoué.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-md'>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className='space-y-4'>
          {requireCurrent && (
            <div className='space-y-2'>
              <Label htmlFor='current-password'>Mot de passe actuel</Label>
              <Input
                id='current-password'
                type='password'
                value={current}
                onChange={e => setCurrent(e.target.value)}
                placeholder='••••••••'
              />
            </div>
          )}

          <div className='space-y-2'>
            <Label htmlFor='new-password'>Nouveau mot de passe</Label>
            <Input
              id='new-password'
              type='password'
              value={next}
              onChange={e => setNext(e.target.value)}
              placeholder='8 caractères minimum'
            />
            <p className='text-muted-foreground text-xs'>
              Communiquez-le à la personne concernée ; elle pourra le changer ensuite.
            </p>
          </div>

          {error && (
            <Alert variant='destructive'>
              <AlertCircle className='size-4' />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant='outline' onClick={() => onOpenChange(false)} disabled={saving}>
            Annuler
          </Button>
          <Button onClick={() => void submit()} disabled={saving || next.length < 8}>
            {saving && <Loader2 className='size-4 animate-spin' />}
            Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default function AdminAccounts() {
  const [accounts, setAccounts] = useState<AuthUser[]>([])
  const [loading, setLoading] = useState(true)
  const [forbidden, setForbidden] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  // The admin's own delegates and doctors. Kept as plain id lists: the roster
  // here is about accounts, and "is this one mine" is the only relationship
  // question this page asks. The working views live on Mon équipe / Mes médecins.
  const [teamIds, setTeamIds] = useState<string[]>([])
  const [doctorIds, setDoctorIds] = useState<string[]>([])

  // filters
  const [query, setQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState<'all' | AccountRole>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [sortKey, setSortKey] = useState<SortKey>('role')

  // paging + selection
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(PAGE_SIZES[0])
  const [selected, setSelected] = useState<string[]>([])
  const [bulkBusy, setBulkBusy] = useState(false)

  // dialogs
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newRole, setNewRole] = useState<AccountRole>('delegate')
  const [newSpecialty, setNewSpecialty] = useState('')
  const [newCity, setNewCity] = useState('')
  const [createError, setCreateError] = useState<string | null>(null)
  const [createSaving, setCreateSaving] = useState(false)

  // Profile edit. Separate from the create dialog rather than one dialog in two
  // modes: the two collect different things (a password exists only at
  // creation, a practice only matters once the account does), and the create
  // dialog is long enough already.
  const [profileTarget, setProfileTarget] = useState<AuthUser | null>(null)
  const [profileName, setProfileName] = useState('')
  const [profileSpecialty, setProfileSpecialty] = useState('')
  const [profileCity, setProfileCity] = useState('')
  const [profileError, setProfileError] = useState<string | null>(null)
  const [profileSaving, setProfileSaving] = useState(false)

  const [resetTarget, setResetTarget] = useState<AuthUser | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<AuthUser | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [ownPasswordOpen, setOwnPasswordOpen] = useState(false)

  // Read once: the session cannot change while this page is open without a
  // redirect, and it saves threading it through every row.
  const me = useMemo(() => getCurrentUser(), [])
  const canManage = me?.role === 'admin'

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const data = await listAccounts()

      setAccounts(data.users)
      setForbidden(false)

      // A 403 here would mean the account list is readable but the roster is not
      // — unlikely, and not worth failing the page over.
      if (canManage) {
        // Two rosters, two audiences. Loading them together keeps the page from
        // failing on one, and neither is required to render the account list.
        const [team, doctors] = await Promise.allSettled([getTeam(), getDoctors()])

        setTeamIds(team.status === 'fulfilled' ? team.value.delegates.map(delegate => delegate.id) : [])
        setDoctorIds(doctors.status === 'fulfilled' ? doctors.value.doctors.map(doctor => doctor.id) : [])
      }
    } catch (e) {
      if (e instanceof ApiError && e.status === 403) setForbidden(true)
      else setError('Impossible de charger les comptes. Vérifiez que le serveur ALIA est démarré.')
    } finally {
      setLoading(false)
    }
  }, [canManage])

  useEffect(() => {
    void load()
  }, [load])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()

    const rows = accounts
      .filter(account => (roleFilter === 'all' ? true : account.role === roleFilter))
      .filter(account =>
        statusFilter === 'all' ? true : statusFilter === 'active' ? account.is_active : !account.is_active
      )
      .filter(account => (q ? `${account.full_name} ${account.email}`.toLowerCase().includes(q) : true))

    return rows.sort((a, b) => {
      if (sortKey === 'name') return a.full_name.localeCompare(b.full_name)

      if (sortKey === 'recent') {
        return new Date(b.last_login_at ?? 0).getTime() - new Date(a.last_login_at ?? 0).getTime()
      }

      return ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role) || a.full_name.localeCompare(b.full_name)
    })
  }, [accounts, query, roleFilter, statusFilter, sortKey])

  // Any filter change can leave the user on a page that no longer exists.
  useEffect(() => {
    setPage(1)
  }, [query, roleFilter, statusFilter, sortKey, pageSize])

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const pageItems = filtered.slice((safePage - 1) * pageSize, safePage * pageSize)

  const counts = useMemo(() => {
    const byRole = ROLE_ORDER.reduce<Record<AccountRole, number>>(
      (acc, role) => ({ ...acc, [role]: accounts.filter(a => a.role === role).length }),
      { admin: 0, doctor: 0, delegate: 0 }
    )

    // Real numbers, not decoration: accounts created in the last 30 days.
    const monthAgo = Date.now() - 30 * 24 * 3600 * 1000

    const newThisMonth = accounts.filter(a => {
      const created = a.created_at ? new Date(a.created_at).getTime() : 0

      return created > monthAgo
    }).length

    return {
      total: accounts.length,
      active: accounts.filter(a => a.is_active).length,
      inactive: accounts.filter(a => !a.is_active).length,
      newThisMonth,
      byRole
    }
  }, [accounts])

  const apply = async (
    account: AuthUser,
    patch: { role?: AccountRole; is_active?: boolean; full_name?: string; specialty?: string; city?: string }
  ) => {
    setBusyId(account.id)
    setError(null)
    setNotice(null)

    try {
      const updated = await updateAccount(account.id, patch)

      setAccounts(prev => prev.map(a => (a.id === updated.id ? updated : a)))
      setNotice(`${updated.full_name} — mis à jour.`)
    } catch (e) {
      // The lockout rules live on the server, so its message is what the user
      // needs to read; a generic one here would hide the actual reason.
      setError(e instanceof ApiError ? e.message : 'La modification a échoué.')
    } finally {
      setBusyId(null)
    }
  }

  /**
   * Open the profile dialog on a row, pre-filled with what is stored.
   *
   * The practice fields are absent for most accounts, so an empty string is the
   * normal starting point — and is also what clears the field server-side.
   */
  const openProfile = (account: AuthUser) => {
    setProfileTarget(account)
    setProfileName(account.full_name ?? '')
    setProfileSpecialty(account.specialty ?? '')
    setProfileCity(account.city ?? '')
    setProfileError(null)
  }

  const submitProfile = async () => {
    if (!profileTarget) return

    setProfileSaving(true)
    setProfileError(null)

    try {
      const updated = await updateAccount(profileTarget.id, {
        full_name: profileName.trim(),
        specialty: profileSpecialty.trim(),
        city: profileCity.trim()
      })

      setAccounts(prev => prev.map(a => (a.id === updated.id ? updated : a)))
      setNotice(`${updated.full_name} — profil mis à jour.`)
      setProfileTarget(null)
    } catch (e) {
      setProfileError(e instanceof ApiError ? e.message : 'La modification a échoué.')
    } finally {
      setProfileSaving(false)
    }
  }

  /**
   * Move a delegate in or out of my team. Only delegates can be assigned — the
   * server refuses anyone else, so the menu items are only rendered for them.
   */
  const toggleTeam = async (account: AuthUser) => {
    const member = teamIds.includes(account.id)

    setBusyId(account.id)
    setError(null)
    setNotice(null)

    try {
      if (member) {
        await removeFromTeam(account.id)
        setTeamIds(prev => prev.filter(id => id !== account.id))
        setNotice(`${account.full_name} a quitté votre équipe.`)
      } else {
        await assignToTeam(account.id)
        setTeamIds(prev => [...prev, account.id])
        setNotice(`${account.full_name} a rejoint votre équipe.`)
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'L’affectation a échoué.')
    } finally {
      setBusyId(null)
    }
  }

  /**
   * Move a doctor in or out of my list. Only doctors can be assigned here — the
   * server refuses anyone else, so the menu items are only rendered for them.
   */
  const toggleDoctor = async (account: AuthUser) => {
    const member = doctorIds.includes(account.id)

    setBusyId(account.id)
    setError(null)
    setNotice(null)

    try {
      if (member) {
        await removeDoctorFromTeam(account.id)
        setDoctorIds(prev => prev.filter(id => id !== account.id))
        setNotice(`${account.full_name} ne fait plus partie de vos médecins.`)
      } else {
        await assignDoctorToTeam(account.id)
        setDoctorIds(prev => [...prev, account.id])
        setNotice(`${account.full_name} a rejoint vos médecins.`)
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'L’affectation a échoué.')
    } finally {
      setBusyId(null)
    }
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    setError(null)
    setNotice(null)

    try {
      await deleteAccount(deleteTarget.id)
      setAccounts(prev => prev.filter(a => a.id !== deleteTarget.id))
      setSelected(prev => prev.filter(id => id !== deleteTarget.id))
      setNotice(`${deleteTarget.full_name} — compte supprimé.`)
      setDeleteTarget(null)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'La suppression a échoué.')
    } finally {
      setDeleting(false)
    }
  }

  const submitCreate = async () => {
    setCreateSaving(true)
    setCreateError(null)

    try {
      const created = await createAccount({
        email: newEmail.trim(),
        password: newPassword,
        full_name: newName.trim(),
        role: newRole,

        // Only a doctor has a practice to describe; the API ignores the rest.
        specialty: newRole === 'doctor' ? newSpecialty.trim() : undefined,
        city: newRole === 'doctor' ? newCity.trim() : undefined
      })

      setAccounts(prev => [...prev, created])
      setNotice(`Compte créé pour ${created.full_name}.`)
      setCreating(false)
      setNewName('')
      setNewEmail('')
      setNewPassword('')
      setNewRole('delegate')
      setNewSpecialty('')
      setNewCity('')
    } catch (e) {
      setCreateError(e instanceof ApiError ? e.message : 'La création du compte a échoué.')
    } finally {
      setCreateSaving(false)
    }
  }

  /** Bulk (de)activation. Your own account is skipped, since the API refuses it. */
  const bulkSetActive = async (active: boolean) => {
    const targets = accounts.filter(a => selected.includes(a.id) && a.id !== me?.id)

    if (targets.length === 0) {
      setError('Aucun compte sélectionné ne peut être modifié (le vôtre est exclu).')

      return
    }

    setBulkBusy(true)
    setError(null)

    try {
      const results = await Promise.all(
        targets.map(account =>
          updateAccount(account.id, { is_active: active }).then(
            updated => ({ ok: true as const, updated }),
            (e: unknown) => ({ ok: false as const, message: e instanceof ApiError ? e.message : 'échec' })
          )
        )
      )

      const updatedRows = results.filter(r => r.ok).map(r => r.updated)

      setAccounts(prev => prev.map(a => updatedRows.find(u => u.id === a.id) ?? a))

      const failures = results.filter(r => !r.ok)
      const skipped = selected.length - targets.length

      setNotice(
        `${updatedRows.length} compte(s) ${active ? 'activé(s)' : 'désactivé(s)'}` +
          (skipped ? `, ${skipped} ignoré(s) (votre compte)` : '') +
          '.'
      )

      if (failures.length) setError(`${failures.length} compte(s) n'ont pas pu être modifiés.`)
      setSelected([])
    } finally {
      setBulkBusy(false)
    }
  }

  const visibleIds = pageItems.map(a => a.id)
  const selectedOnPage = visibleIds.filter(id => selected.includes(id))
  const allOnPageSelected = visibleIds.length > 0 && selectedOnPage.length === visibleIds.length

  if (forbidden) {
    return (
      <div className='col-span-full'>
        <Card>
          <CardContent className='flex flex-col gap-2 py-6'>
            <span className='flex items-center gap-2 text-lg font-semibold'>
              <ShieldCheck className='text-muted-foreground size-5' /> Accès restreint
            </span>
            <p className='text-muted-foreground text-sm'>
              La gestion des comptes est réservée aux administrateurs. Votre rôle (
              {me ? ACCOUNT_ROLE_LABELS[me.role] : 'inconnu'}) n’y a pas accès.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const from = filtered.length === 0 ? 0 : (safePage - 1) * pageSize + 1
  const to = Math.min(safePage * pageSize, filtered.length)

  return (
    <div className='flex flex-col gap-3 lg:gap-6'>
      {/* ── Chiffres ── */}
      <div className='grid grid-cols-1 gap-3 sm:grid-cols-2 lg:gap-6 xl:grid-cols-4'>
        <Card>
          <CardContent className='flex flex-row items-start justify-between'>
            <div className='space-y-1'>
              <p className='text-muted-foreground text-sm font-medium'>Comptes</p>
              <div className='flex items-center gap-2'>
                <h4 className='text-2xl font-medium'>{loading ? '—' : counts.total}</h4>
                {!loading && counts.newThisMonth > 0 && (
                  <p className='text-sm font-medium text-green-600 dark:text-green-400'>(+{counts.newThisMonth})</p>
                )}
              </div>
              <p className='text-muted-foreground text-xs'>Ce mois-ci</p>
            </div>
            <div className='bg-primary/10 text-primary flex size-9.5 items-center justify-center rounded-md'>
              <Users className='size-4' />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className='flex flex-row items-start justify-between'>
            <div className='space-y-1'>
              <p className='text-muted-foreground text-sm font-medium'>Actifs</p>
              <div className='flex items-center gap-2'>
                <h4 className='text-2xl font-medium'>{loading ? '—' : counts.active}</h4>
              </div>
              <p className='text-muted-foreground text-xs'>Peuvent se connecter</p>
            </div>
            <div className='flex size-9.5 items-center justify-center rounded-md bg-green-500/10 text-green-600 dark:text-green-400'>
              <UserCheck className='size-4' />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className='flex flex-row items-start justify-between'>
            <div className='space-y-1'>
              <p className='text-muted-foreground text-sm font-medium'>Désactivés</p>
              <div className='flex items-center gap-2'>
                <h4 className='text-2xl font-medium'>{loading ? '—' : counts.inactive}</h4>
              </div>
              <p className='text-muted-foreground text-xs'>Accès suspendu</p>
            </div>
            <div className='bg-destructive/10 text-destructive flex size-9.5 items-center justify-center rounded-md'>
              <UserX className='size-4' />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className='flex flex-row items-start justify-between'>
            <div className='space-y-1'>
              <p className='text-muted-foreground text-sm font-medium'>Administrateurs</p>
              <div className='flex items-center gap-2'>
                <h4 className='text-2xl font-medium'>{loading ? '—' : counts.byRole.admin}</h4>
              </div>
              <p className='text-muted-foreground text-xs'>Accès total</p>
            </div>
            <div className='flex size-9.5 items-center justify-center rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400'>
              <ShieldCheck className='size-4' />
            </div>
          </CardContent>
        </Card>
      </div>

      {!canManage && (
        <Alert>
          <ShieldCheck className='size-4' />
          <AlertDescription>
            Vous consultez la liste en lecture seule. Seul un administrateur peut créer un compte, changer un rôle ou
            réinitialiser un mot de passe.
          </AlertDescription>
        </Alert>
      )}

      {notice && (
        <Alert>
          <CheckCircle2 className='size-4' />
          <AlertDescription>{notice}</AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert variant='destructive'>
          <AlertCircle className='size-4' />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* ── Liste ── */}
      <Card className='overflow-hidden py-0 shadow-none'>
        <div className='w-full'>
          {/* Filtres */}
          <div className='border-b'>
            <div className='flex flex-col gap-4 border-b p-6'>
              <div className='grid grid-cols-1 gap-6 max-md:*:last:col-span-full sm:grid-cols-2 md:grid-cols-3'>
                <div className='flex w-full flex-col gap-2'>
                  <Label htmlFor='filter-role'>Rôle</Label>
                  <Select value={roleFilter} onValueChange={v => setRoleFilter((v ?? 'all') as 'all' | AccountRole)}>
                    <SelectTrigger id='filter-role' className='w-full'>
                      <SelectValue>
                        {(value: string) =>
                          value === 'all' ? 'Tous les rôles' : ACCOUNT_ROLE_LABELS[value as AccountRole]
                        }
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value='all'>Tous les rôles</SelectItem>
                      {ROLE_ORDER.map(role => (
                        <SelectItem key={role} value={role}>
                          {ACCOUNT_ROLE_LABELS[role]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className='flex w-full flex-col gap-2'>
                  <Label htmlFor='filter-status'>État</Label>
                  <Select value={statusFilter} onValueChange={v => setStatusFilter((v ?? 'all') as StatusFilter)}>
                    <SelectTrigger id='filter-status' className='w-full'>
                      <SelectValue>
                        {(value: string) =>
                          value === 'all' ? 'Tous les états' : value === 'active' ? 'Actifs' : 'Désactivés'
                        }
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value='all'>Tous les états</SelectItem>
                      <SelectItem value='active'>Actifs</SelectItem>
                      <SelectItem value='inactive'>Désactivés</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className='flex w-full flex-col gap-2'>
                  <Label htmlFor='filter-sort'>Trier par</Label>
                  <Select value={sortKey} onValueChange={v => setSortKey((v ?? 'role') as SortKey)}>
                    <SelectTrigger id='filter-sort' className='w-full'>
                      <SelectValue>
                        {(value: string) =>
                          value === 'name' ? 'Nom' : value === 'recent' ? 'Dernière connexion' : 'Rôle'
                        }
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value='role'>Rôle</SelectItem>
                      <SelectItem value='name'>Nom</SelectItem>
                      <SelectItem value='recent'>Dernière connexion</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Barre d'outils */}
            <div className='flex gap-4 p-6 max-sm:flex-col sm:items-center sm:justify-between'>
              <div className='w-full max-w-2xs'>
                <Label htmlFor='search-account' className='sr-only'>
                  Rechercher
                </Label>
                <div className='relative'>
                  <Search className='text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2' />
                  <Input
                    id='search-account'
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    placeholder='Rechercher un nom ou un e-mail'
                    className='pl-9'
                  />
                </div>
              </div>

              <div className='flex flex-wrap items-center gap-2 sm:justify-between'>
                <div className='flex items-center gap-2'>
                  <Label htmlFor='rows-per-page' className='sr-only'>
                    Afficher
                  </Label>
                  <Select value={String(pageSize)} onValueChange={v => setPageSize(Number(v ?? 10))}>
                    <SelectTrigger id='rows-per-page' className='w-fit whitespace-nowrap'>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PAGE_SIZES.map(size => (
                        <SelectItem key={size} value={String(size)}>
                          {size}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Button
                  variant='outline'
                  className='gap-1.5'
                  onClick={() => downloadCsv(filtered)}
                  disabled={loading || filtered.length === 0}
                >
                  <Download className='size-4' />
                  <span className='max-lg:hidden'>Exporter</span>
                </Button>

                <Button variant='outline' className='gap-1.5' onClick={() => void load()} disabled={loading}>
                  <RefreshCw className={cn('size-4', loading && 'animate-spin')} />
                  <span className='max-lg:hidden'>Actualiser</span>
                </Button>

                <Button variant='outline' className='gap-1.5' onClick={() => setOwnPasswordOpen(true)}>
                  <KeyRound className='size-4' />
                  <span className='max-lg:hidden'>Mon mot de passe</span>
                </Button>

                {canManage && (
                  <Button className='gap-1.5' onClick={() => setCreating(true)}>
                    <Plus className='size-4' />
                    <span className='max-lg:hidden'>Nouveau compte</span>
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Sélection multiple */}
          {selected.length > 0 && canManage && (
            <div className='bg-muted/40 flex flex-wrap items-center justify-between gap-3 border-b px-6 py-3'>
              <p className='text-sm font-medium'>{selected.length} compte(s) sélectionné(s)</p>
              <div className='flex items-center gap-2'>
                <Button
                  variant='outline'
                  size='sm'
                  disabled={bulkBusy}
                  onClick={() => void bulkSetActive(true)}
                  className='gap-1.5'
                >
                  {bulkBusy ? <Loader2 className='size-3.5 animate-spin' /> : <UserCheck className='size-3.5' />}
                  Activer
                </Button>
                <Button
                  variant='outline'
                  size='sm'
                  disabled={bulkBusy}
                  onClick={() => void bulkSetActive(false)}
                  className='gap-1.5'
                >
                  {bulkBusy ? <Loader2 className='size-3.5 animate-spin' /> : <UserX className='size-3.5' />}
                  Désactiver
                </Button>
                <Button variant='ghost' size='sm' onClick={() => setSelected([])} disabled={bulkBusy}>
                  Annuler
                </Button>
              </div>
            </div>
          )}

          {/* Table */}
          {loading ? (
            <div className='space-y-2 p-6'>
              {[0, 1, 2, 3].map(i => (
                <Skeleton key={i} className='h-12 w-full' />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className='border-t'>
                  {canManage && (
                    <TableHead className='first:pl-4 last:w-12'>
                      <Checkbox
                        aria-label='Tout sélectionner'
                        checked={allOnPageSelected}
                        indeterminate={selectedOnPage.length > 0 && !allOnPageSelected}
                        onCheckedChange={checked => {
                          setSelected(prev =>
                            checked
                              ? Array.from(new Set([...prev, ...visibleIds]))
                              : prev.filter(id => !visibleIds.includes(id))
                          )
                        }}
                      />
                    </TableHead>
                  )}
                  <TableHead>Personne</TableHead>
                  <TableHead>Rôle</TableHead>
                  <TableHead>Pratique</TableHead>
                  <TableHead>État</TableHead>
                  <TableHead>Dernière connexion</TableHead>
                  <TableHead>Créé le</TableHead>
                  {canManage && <TableHead className='last:px-4 last:text-right'>Actions</TableHead>}
                </TableRow>
              </TableHeader>

              <TableBody>
                {pageItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={canManage ? 8 : 6} className='text-muted-foreground py-10 text-center text-sm'>
                      Aucun compte ne correspond à ces filtres.
                    </TableCell>
                  </TableRow>
                ) : (
                  pageItems.map(account => {
                    const isSelf = account.id === me?.id
                    const locked = isSelf
                    const busy = busyId === account.id
                    const RoleIcon = ROLE_ICON[account.role]
                    const style = ROLE_STYLE[account.role]

                    return (
                      <TableRow
                        key={account.id}
                        data-state={selected.includes(account.id) ? 'selected' : false}
                        className='h-14'
                      >
                        {canManage && (
                          <TableCell className='first:pl-4'>
                            <Checkbox
                              aria-label={`Sélectionner ${account.full_name}`}
                              checked={selected.includes(account.id)}
                              onCheckedChange={checked =>
                                setSelected(prev =>
                                  checked ? [...prev, account.id] : prev.filter(id => id !== account.id)
                                )
                              }
                            />
                          </TableCell>
                        )}

                        <TableCell>
                          <div className='flex items-center gap-2'>
                            <Avatar className='size-9'>
                              <AvatarFallback className='bg-primary/10 text-primary text-xs'>
                                {initialsOf(account.full_name)}
                              </AvatarFallback>
                            </Avatar>
                            <div className='flex flex-col'>
                              <span className='flex items-center gap-1.5 font-medium'>
                                {account.full_name}
                                {isSelf && (
                                  <Badge variant='secondary' className='text-xs'>
                                    vous
                                  </Badge>
                                )}
                                {teamIds.includes(account.id) && (
                                  <Badge variant='outline' className='text-xs'>
                                    mon équipe
                                  </Badge>
                                )}
                                {doctorIds.includes(account.id) && (
                                  <Badge variant='outline' className='text-xs'>
                                    mes médecins
                                  </Badge>
                                )}
                              </span>
                              <span className='text-muted-foreground'>{account.email}</span>
                            </div>
                          </div>
                        </TableCell>

                        <TableCell>
                          {canManage && !locked ? (
                            <Select
                              value={account.role}
                              onValueChange={v => void apply(account, { role: (v ?? account.role) as AccountRole })}
                            >
                              <SelectTrigger size='sm' className='w-44' disabled={busy}>
                                {/* base-ui renders the raw value unless given a
                                    render function, and "delegate" is not what
                                    should show in a role column. */}
                                <SelectValue>
                                  {(value: string) => ACCOUNT_ROLE_LABELS[value as AccountRole]}
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent>
                                {ROLE_ORDER.map(role => (
                                  <SelectItem key={role} value={role}>
                                    {ACCOUNT_ROLE_LABELS[role]}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <div className='flex items-center gap-2'>
                              <RoleIcon className={cn('size-4', style.icon)} />
                              <span className='capitalize'>{ACCOUNT_ROLE_LABELS[account.role]}</span>
                            </div>
                          )}
                        </TableCell>

                        {/*
                          The practice, in the table rather than only behind a
                          dialog: a doctor with no specialty is an account that
                          cannot be presented to properly, and "nobody filled it
                          in" is invisible unless it is shown as missing.
                        */}
                        <TableCell className='text-sm'>
                          {account.role === 'doctor' ? (
                            <div className='flex flex-col'>
                              <span className={cn(!account.specialty && 'text-muted-foreground')}>
                                {account.specialty || 'Spécialité à renseigner'}
                              </span>
                              <span
                                className={cn(
                                  'text-xs',
                                  account.city ? 'text-muted-foreground' : 'text-muted-foreground/70'
                                )}
                              >
                                {account.city || 'Ville à renseigner'}
                              </span>
                            </div>
                          ) : (
                            <span className='text-muted-foreground'>—</span>
                          )}
                        </TableCell>

                        <TableCell>
                          <div className='flex items-center gap-2'>
                            {canManage ? (
                              <Switch
                                checked={account.is_active}
                                disabled={locked || busy}
                                onCheckedChange={checked => void apply(account, { is_active: checked })}
                                aria-label={`Activer ${account.full_name}`}
                              />
                            ) : (
                              <span
                                className={cn(
                                  'size-2 rounded-full',
                                  account.is_active ? 'bg-green-600' : 'bg-muted-foreground/40'
                                )}
                              />
                            )}
                            <span className='text-muted-foreground text-xs'>
                              {account.is_active ? 'Actif' : 'Désactivé'}
                            </span>
                          </div>
                        </TableCell>

                        <TableCell className='text-muted-foreground text-sm'>
                          {relativeLogin(account.last_login_at)}
                        </TableCell>

                        <TableCell className='text-sm'>{formatDate(account.created_at)}</TableCell>

                        {canManage && (
                          <TableCell className='last:px-4'>
                            <div className='flex items-center justify-end gap-1'>
                              {busy && <Loader2 className='text-muted-foreground size-4 animate-spin' />}

                              <Button
                                variant='ghost'
                                size='icon'
                                aria-label='Réinitialiser le mot de passe'
                                title='Réinitialiser le mot de passe'
                                disabled={busy}
                                onClick={() => setResetTarget(account)}
                              >
                                <KeyRound className='size-4' />
                              </Button>

                              <Button
                                variant='ghost'
                                size='icon'
                                aria-label='Supprimer le compte'
                                title='Supprimer le compte'
                                className='hover:text-destructive'
                                disabled={busy || locked}
                                onClick={() => setDeleteTarget(account)}
                              >
                                <Trash2 className='size-4' />
                              </Button>

                              <DropdownMenu>
                                <DropdownMenuTrigger
                                  render={
                                    <Button variant='ghost' size='icon' aria-label='Autres actions' disabled={busy} />
                                  }
                                >
                                  <ChevronDown className='size-4' />
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align='end' className='w-56'>
                                  <DropdownMenuItem onClick={() => openProfile(account)}>
                                    <PencilLine />
                                    <span>Modifier le profil</span>
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => setResetTarget(account)}>
                                    <KeyRound />
                                    <span>Réinitialiser le mot de passe</span>
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    disabled={locked}
                                    onClick={() => void apply(account, { is_active: !account.is_active })}
                                  >
                                    {account.is_active ? <UserX /> : <UserCheck />}
                                    <span>{account.is_active ? 'Désactiver le compte' : 'Activer le compte'}</span>
                                  </DropdownMenuItem>
                                  {account.role === 'delegate' && !isSelf && (
                                    <DropdownMenuItem onClick={() => void toggleTeam(account)}>
                                      {teamIds.includes(account.id) ? <UserMinus /> : <UserPlus />}
                                      <span>
                                        {teamIds.includes(account.id)
                                          ? 'Retirer de mon équipe'
                                          : 'Ajouter à mon équipe'}
                                      </span>
                                    </DropdownMenuItem>
                                  )}
                                  {account.role === 'doctor' && !isSelf && (
                                    <DropdownMenuItem onClick={() => void toggleDoctor(account)}>
                                      {doctorIds.includes(account.id) ? <UserMinus /> : <UserPlus />}
                                      <span>
                                        {doctorIds.includes(account.id)
                                          ? 'Retirer de mes médecins'
                                          : 'Ajouter à mes médecins'}
                                      </span>
                                    </DropdownMenuItem>
                                  )}
                                  <DropdownMenuItem
                                    onClick={() => {
                                      void navigator.clipboard?.writeText(account.email)
                                      setNotice(`E-mail copié : ${account.email}`)
                                    }}
                                  >
                                    <Users />
                                    <span>Copier l’e-mail</span>
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    variant='destructive'
                                    disabled={locked}
                                    onClick={() => setDeleteTarget(account)}
                                  >
                                    <Trash2 />
                                    <span>Supprimer définitivement</span>
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          )}

          {/* Pagination */}
          <div className='flex items-center justify-between gap-3 px-6 py-4 max-sm:flex-col md:max-lg:flex-col'>
            <p className='text-muted-foreground text-sm whitespace-nowrap' aria-live='polite'>
              Affichage <span>{from}</span> à <span>{to}</span> sur <span>{filtered.length}</span> entrée(s)
            </p>

            <nav aria-label='pagination' className='mx-auto flex w-full justify-center'>
              <ul className='flex items-center gap-1'>
                <li>
                  <Button
                    variant='ghost'
                    size='sm'
                    className='gap-1.5'
                    disabled={safePage <= 1}
                    onClick={() => setPage(safePage - 1)}
                  >
                    <ChevronLeft className='size-4' />
                    <span className='max-sm:hidden'>Précédent</span>
                  </Button>
                </li>

                {Array.from({ length: totalPages }, (_, index) => index + 1).map(number => (
                  <li key={number}>
                    <Button
                      variant={number === safePage ? 'default' : 'ghost'}
                      size='icon'
                      aria-current={number === safePage ? 'page' : undefined}
                      className={cn('size-9', number !== safePage && 'bg-primary/10 text-primary hover:bg-primary/20')}
                      onClick={() => setPage(number)}
                    >
                      {number}
                    </Button>
                  </li>
                ))}

                <li>
                  <Button
                    variant='ghost'
                    size='sm'
                    className='gap-1.5'
                    disabled={safePage >= totalPages}
                    onClick={() => setPage(safePage + 1)}
                  >
                    <span className='max-sm:hidden'>Suivant</span>
                    <ChevronRight className='size-4' />
                  </Button>
                </li>
              </ul>
            </nav>
          </div>
        </div>
      </Card>

      {/* ── Création ── */}
      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent className='sm:max-w-md'>
          <DialogHeader>
            <DialogTitle className='flex items-center gap-2'>
              <UserPlus className='size-5' /> Nouveau compte
            </DialogTitle>
            <DialogDescription>
              Créez l’accès d’un délégué ou d’un médecin. Le mot de passe est à communiquer à la personne.
            </DialogDescription>
          </DialogHeader>

          <div className='space-y-4'>
            <div className='space-y-2'>
              <Label htmlFor='acc-name'>Nom complet</Label>
              <Input
                id='acc-name'
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder='Karim Benali'
              />
            </div>

            <div className='space-y-2'>
              <Label htmlFor='acc-email'>E-mail professionnel</Label>
              <Input
                id='acc-email'
                type='email'
                value={newEmail}
                onChange={e => setNewEmail(e.target.value)}
                placeholder='prenom.nom@vital.tn'
              />
            </div>

            <div className='space-y-2'>
              <Label htmlFor='acc-role'>Rôle</Label>
              <Select value={newRole} onValueChange={v => setNewRole((v ?? 'delegate') as AccountRole)}>
                <SelectTrigger id='acc-role' className='w-full'>
                  <SelectValue>{(value: string) => ACCOUNT_ROLE_LABELS[value as AccountRole]}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {ROLE_ORDER.map(role => (
                    <SelectItem key={role} value={role}>
                      {ACCOUNT_ROLE_LABELS[role]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className='text-muted-foreground text-xs'>
                {newRole === 'delegate'
                  ? 'Formation uniquement : ses visites et ses progrès.'
                  : newRole === 'doctor'
                    ? 'Reçoit les présentations ALIA. Aucun accès aux comptes ni aux scores des délégués.'
                    : 'Accès total, y compris la gestion des comptes.'}
              </p>
            </div>

            {newRole === 'doctor' && (
              <div className='grid gap-4 sm:grid-cols-2'>
                <div className='space-y-2'>
                  <Label htmlFor='acc-specialty'>Spécialité</Label>
                  <Input
                    id='acc-specialty'
                    value={newSpecialty}
                    onChange={e => setNewSpecialty(e.target.value)}
                    placeholder='Médecine Générale'
                  />
                </div>
                <div className='space-y-2'>
                  <Label htmlFor='acc-city'>Ville</Label>
                  <Input id='acc-city' value={newCity} onChange={e => setNewCity(e.target.value)} placeholder='Tunis' />
                </div>
              </div>
            )}

            <div className='space-y-2'>
              <Label htmlFor='acc-password'>Mot de passe initial</Label>
              <Input
                id='acc-password'
                type='password'
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder='8 caractères minimum'
              />
            </div>

            {createError && (
              <Alert variant='destructive'>
                <AlertCircle className='size-4' />
                <AlertDescription>{createError}</AlertDescription>
              </Alert>
            )}
          </div>

          <DialogFooter>
            <Button variant='outline' onClick={() => setCreating(false)} disabled={createSaving}>
              Annuler
            </Button>
            <Button
              onClick={() => void submitCreate()}
              disabled={createSaving || !newName.trim() || !newEmail.trim() || newPassword.length < 8}
            >
              {createSaving && <Loader2 className='size-4 animate-spin' />}
              Créer le compte
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Profil ── */}
      <Dialog open={profileTarget !== null} onOpenChange={open => !open && setProfileTarget(null)}>
        <DialogContent className='sm:max-w-lg'>
          <DialogHeader>
            <DialogTitle className='flex items-center gap-2'>
              <PencilLine className='size-5' /> Modifier le profil
            </DialogTitle>
            <DialogDescription>
              {profileTarget?.email} — le rôle et l’état se modifient directement dans la liste.
            </DialogDescription>
          </DialogHeader>

          <div className='space-y-4'>
            <div className='space-y-2'>
              <Label htmlFor='profile-name'>Nom complet</Label>
              <Input id='profile-name' value={profileName} onChange={e => setProfileName(e.target.value)} />
            </div>

            {profileTarget?.role === 'doctor' && (
              <div className='grid gap-4 sm:grid-cols-2'>
                <div className='space-y-2'>
                  <Label htmlFor='profile-specialty'>Spécialité</Label>
                  <Input
                    id='profile-specialty'
                    value={profileSpecialty}
                    onChange={e => setProfileSpecialty(e.target.value)}
                    placeholder='Médecine Générale'
                  />
                </div>
                <div className='space-y-2'>
                  <Label htmlFor='profile-city'>Ville</Label>
                  <Input
                    id='profile-city'
                    value={profileCity}
                    onChange={e => setProfileCity(e.target.value)}
                    placeholder='Tunis'
                  />
                </div>
                <p className='text-muted-foreground text-xs sm:col-span-2'>
                  Vider un champ l’efface : un médecin sans ville n’est pas un médecin à Tunis.
                </p>
              </div>
            )}

            {profileError && (
              <Alert variant='destructive'>
                <AlertCircle className='size-4' />
                <AlertDescription>{profileError}</AlertDescription>
              </Alert>
            )}
          </div>

          <DialogFooter>
            <Button variant='outline' onClick={() => setProfileTarget(null)} disabled={profileSaving}>
              Annuler
            </Button>
            <Button onClick={() => void submitProfile()} disabled={profileSaving || profileName.trim().length < 2}>
              {profileSaving && <Loader2 className='size-4 animate-spin' />}
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Suppression ── */}
      <Dialog open={deleteTarget !== null} onOpenChange={open => !open && setDeleteTarget(null)}>
        <DialogContent className='sm:max-w-md'>
          <DialogHeader>
            <DialogTitle className='flex items-center gap-2'>
              <UserX className='text-destructive size-5' /> Supprimer ce compte ?
            </DialogTitle>
            <DialogDescription>
              {deleteTarget?.full_name} ({deleteTarget?.email}) sera supprimé définitivement.
            </DialogDescription>
          </DialogHeader>

          <Alert>
            <AlertCircle className='size-4' />
            <AlertDescription>
              Pour une personne qui quitte le laboratoire, préférez la désactivation : son historique de formation reste
              alors attribué. La suppression sert surtout à corriger une adresse saisie par erreur.
            </AlertDescription>
          </Alert>

          <DialogFooter>
            <Button variant='outline' onClick={() => setDeleteTarget(null)} disabled={deleting}>
              Annuler
            </Button>
            <Button variant='destructive' onClick={() => void confirmDelete()} disabled={deleting}>
              {deleting && <Loader2 className='size-4 animate-spin' />}
              Supprimer définitivement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Réinitialisation (admin) ── */}
      <PasswordDialog
        open={resetTarget !== null}
        onOpenChange={open => !open && setResetTarget(null)}
        title={`Réinitialiser — ${resetTarget?.full_name ?? ''}`}
        description='Définissez un nouveau mot de passe pour cette personne.'
        onSubmit={(_, newPassword) => resetAccountPassword(resetTarget!.id, newPassword)}
      />

      {/* ── Mon mot de passe ── */}
      <PasswordDialog
        open={ownPasswordOpen}
        onOpenChange={setOwnPasswordOpen}
        title='Mon mot de passe'
        description='Votre mot de passe actuel est demandé pour confirmer le changement.'
        requireCurrent
        onSubmit={(currentPassword, newPassword) => changeOwnPassword(currentPassword, newPassword)}
      />
    </div>
  )
}
