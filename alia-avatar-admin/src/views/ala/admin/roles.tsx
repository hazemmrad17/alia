'use client'

// ──────────────────────────────────────────────
// Rôles & permissions
//
// The role-centric twin of Comptes & accès. That page answers "who has an
// account, and let me change it"; this one answers "what does each role grant,
// and who holds it". The matrix it renders is transcribed in lib/roles-data.ts,
// never typed into the cards.
//
// Read-only on purpose. Re-roling, deactivating, resetting and deleting an
// account all live on Comptes & accès and are one click from every row here; a
// second copy of those controls would be a second place for the two pages to
// disagree about what a role means.
// ──────────────────────────────────────────────

import { useCallback, useEffect, useMemo, useState } from 'react'

import Link from 'next/link'

import type { LucideIcon } from 'lucide-react'
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  EllipsisVertical,
  Copy,
  Download,
  GraduationCap,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Stethoscope,
  UserPlus,
  Users
} from 'lucide-react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem } from '@/components/ui/pagination'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

import { ApiError, listAccounts } from '@/lib/alia-api'
import { ACCOUNT_ROLE_LABELS, getCurrentUser, initialsOf, type AccountRole, type AuthUser } from '@/lib/auth'
import {
  ROLE_ACTIONS,
  ROLE_ACTION_LABELS,
  ROLE_DEFINITIONS,
  allModules,
  roleActionCounts,
  roleDefinition,
  roleModules
} from '@/lib/roles-data'

const ROLE_ORDER: AccountRole[] = ['admin', 'doctor', 'delegate']

const ROLE_ICON: Record<AccountRole, LucideIcon> = {
  admin: ShieldCheck,
  doctor: Stethoscope,
  delegate: GraduationCap
}

const ROLE_TONE: Record<AccountRole, string> = {
  admin: 'bg-chart-1/10 text-chart-1',
  doctor: 'bg-chart-3/10 text-chart-3',
  delegate: 'bg-chart-2/10 text-chart-2'
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

function plural(count: number, singular: string, plural: string): string {
  return `${count} ${count > 1 ? plural : singular}`
}

/**
 * The page numbers to draw, with a gap where the run is too long to list. Five
 * entries around the current page plus the two ends is the shape the shared
 * pagination expects.
 */
function pageWindow(current: number, total: number): Array<number | 'gap'> {
  if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1)

  const wanted = new Set([1, total, current - 1, current, current + 1])
  const pages = [...wanted].filter(page => page >= 1 && page <= total).sort((a, b) => a - b)
  const drawn: Array<number | 'gap'> = []

  pages.forEach((page, index) => {
    if (index > 0 && page - pages[index - 1] > 1) drawn.push('gap')

    drawn.push(page)
  })

  return drawn
}

/** Excel-ready CSV: UTF-8 BOM for the accents, semicolons for French Excel. */
function downloadCsv(rows: AuthUser[]) {
  const header = ['Nom', 'E-mail', 'Rôle', 'Modules', 'État', 'Créé le', 'Dernière connexion']

  const body = rows.map(account => [
    account.full_name,
    account.email,
    ACCOUNT_ROLE_LABELS[account.role],
    roleModules(account.role).length,
    account.is_active ? 'Actif' : 'Désactivé',
    account.created_at ?? '',
    account.last_login_at ?? ''
  ])

  const csv = [header, ...body]
    .map(line => line.map(value => `"${String(value).replace(/"/g, '""')}"`).join(';'))
    .join('\r\n')

  const url = URL.createObjectURL(new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8;' }))
  const link = document.createElement('a')

  link.href = url
  link.download = `roles-alia-${new Date().toISOString().slice(0, 10)}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

// ── Une carte de rôle ─────────────────────────────────────────────────────────

function RoleCard({
  role,
  accountCount,
  onFilter,
  onDetail
}: {
  role: AccountRole

  /** null while the roster is loading, or when it could not be read at all. */
  accountCount: number | null
  onFilter: (role: AccountRole) => void
  onDetail: (role: AccountRole) => void
}) {
  const definition = roleDefinition(role)
  const counts = roleActionCounts(role)
  const modules = roleModules(role)
  const Icon = ROLE_ICON[role]

  return (
    <Card>
      <CardContent className='flex flex-col gap-3'>
        <div className='flex justify-between gap-2'>
          <div className='min-w-0'>
            <h4 className='flex items-center gap-2 text-base leading-tight font-medium'>
              <Icon className={cn('size-4 shrink-0', ROLE_TONE[role].split(' ')[1])} />
              {ACCOUNT_ROLE_LABELS[role]}
            </h4>
            <p className='text-muted-foreground mt-0.5 text-xs'>
              {/* A failed read is not a count of zero, so it shows as unknown
                  rather than claiming three roles hold nobody. */}
              {accountCount === null ? 'Comptes indisponibles' : plural(accountCount, 'compte', 'comptes')}
            </p>
            <p className='text-muted-foreground mt-1 text-xs'>{definition.purpose}</p>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant='ghost'
                  size='icon'
                  className='size-8'
                  aria-label={`Actions — ${ACCOUNT_ROLE_LABELS[role]}`}
                />
              }
            >
              <EllipsisVertical className='size-4' />
            </DropdownMenuTrigger>

            <DropdownMenuContent align='end' className='w-64'>
              <DropdownMenuItem onClick={() => onFilter(role)}>
                <Users />
                <span>Filtrer la liste sur ce rôle</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onDetail(role)}>
                <ShieldCheck />
                <span>Détail des permissions</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  void navigator.clipboard?.writeText(ACCOUNT_ROLE_LABELS[role])
                }}
              >
                <Copy />
                <span>Copier le nom du rôle</span>
              </DropdownMenuItem>

              <DropdownMenuSeparator />

              <DropdownMenuItem disabled>Rôle du socle — non modifiable</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className='bg-muted/50 flex items-center justify-between rounded-md px-3 py-2'>
          {ROLE_ACTIONS.map(action => (
            <div key={action} className='flex flex-col items-center gap-0.5'>
              <span className='text-foreground text-sm font-semibold tabular-nums'>{counts[action]}</span>
              <span className='text-muted-foreground text-[10px]'>{ROLE_ACTION_LABELS[action]}</span>
            </div>
          ))}

          <div className='bg-border h-6 w-px' />

          <div className='flex flex-col items-center gap-0.5'>
            <span className='text-foreground text-sm font-semibold tabular-nums'>{modules.length}</span>
            <span className='text-muted-foreground text-[10px]'>Total</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ── La page ───────────────────────────────────────────────────────────────────

export default function AdminRoles() {
  const [accounts, setAccounts] = useState<AuthUser[]>([])
  const [loading, setLoading] = useState(true)
  const [forbidden, setForbidden] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const [query, setQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState<'all' | AccountRole>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [sortKey, setSortKey] = useState<SortKey>('role')

  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(PAGE_SIZES[0])

  const [detailRole, setDetailRole] = useState<AccountRole | null>(null)
  const [addRoleOpen, setAddRoleOpen] = useState(false)

  const me = useMemo(() => getCurrentUser(), [])

  /**
   * Narrowing the list can leave the reader on a page that no longer exists, so
   * every filter resets the pagination as it is applied — done here rather than in
   * an effect, which would only render the stale page once before correcting it.
   */
  const refilter =
    <T,>(apply: (value: T) => void) =>
    (value: T) => {
      apply(value)
      setPage(1)
    }

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const data = await listAccounts()

      setAccounts(data.users)
      setForbidden(false)
    } catch (e) {
      if (e instanceof ApiError && e.status === 403) setForbidden(true)
      else setError('Impossible de charger les comptes. Vérifiez que le serveur ALIA est démarré.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const countsByRole = useMemo(() => {
    const counts = { admin: 0, doctor: 0, delegate: 0 } as Record<AccountRole, number>

    for (const account of accounts) counts[account.role] += 1

    return counts
  }, [accounts])

  const filtered = useMemo(() => {
    const wanted = query.trim().toLowerCase()

    const rows = accounts
      .filter(account => (roleFilter === 'all' ? true : account.role === roleFilter))
      .filter(account =>
        statusFilter === 'all' ? true : statusFilter === 'active' ? account.is_active : !account.is_active
      )
      .filter(account => (wanted ? `${account.full_name} ${account.email}`.toLowerCase().includes(wanted) : true))

    return rows.sort((a, b) => {
      if (sortKey === 'name') return a.full_name.localeCompare(b.full_name)

      if (sortKey === 'recent') {
        return new Date(b.last_login_at ?? 0).getTime() - new Date(a.last_login_at ?? 0).getTime()
      }

      return ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role) || a.full_name.localeCompare(b.full_name)
    })
  }, [accounts, query, roleFilter, statusFilter, sortKey])

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const pageItems = filtered.slice((safePage - 1) * pageSize, safePage * pageSize)

  const from = filtered.length === 0 ? 0 : (safePage - 1) * pageSize + 1
  const to = Math.min(safePage * pageSize, filtered.length)

  if (forbidden) {
    return (
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
    )
  }

  const detail = detailRole ? roleDefinition(detailRole) : null
  const moduleTotal = allModules().length

  return (
    <div className='flex flex-col gap-6'>
      {/* ── Les rôles ── */}
      <div className='grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3'>
        {ROLE_DEFINITIONS.map(definition => (
          <RoleCard
            key={definition.role}
            role={definition.role}
            accountCount={loading || error ? null : countsByRole[definition.role]}
            onFilter={setRoleFilter}
            onDetail={setDetailRole}
          />
        ))}

        <Card className='items-center justify-center'>
          <CardContent className='flex flex-col items-center justify-center gap-4'>
            <div className='text-center'>
              <p className='text-lg font-medium'>Nouveau rôle</p>
              <p className='text-muted-foreground mt-1 text-sm'>Ajoutez un rôle, s’il n’existe pas encore.</p>
            </div>

            <Button variant='outline' className='gap-1.5' onClick={() => setAddRoleOpen(true)}>
              <Plus className='size-4' />
              Nouveau rôle
            </Button>
          </CardContent>
        </Card>
      </div>

      {notice && (
        <Alert>
          <ShieldCheck className='size-4' />
          <AlertDescription>{notice}</AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert variant='destructive'>
          <AlertCircle className='size-4' />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* ── Les comptes et leur rôle ── */}
      <Card className='gap-0 overflow-hidden py-0 shadow-none'>
        <CardHeader className='border-b px-6 py-5'>
          <CardTitle className='text-lg font-medium'>Comptes et rôles</CardTitle>
          <CardDescription>
            Retrouvez les comptes de l’entreprise et le rôle associé à chacun, sur {moduleTotal} modules.
          </CardDescription>
        </CardHeader>

        <CardContent className='p-0'>
          <div className='w-full'>
            {/* Filtres */}
            <div className='border-b'>
              <div className='flex flex-col gap-4 border-b p-6'>
                <div className='grid grid-cols-1 gap-6 max-md:*:last:col-span-full sm:grid-cols-2 md:grid-cols-3'>
                  <div className='flex w-full flex-col gap-2'>
                    <Label htmlFor='roles-filter-role'>Rôle</Label>
                    <Select
                      value={roleFilter}
                      onValueChange={refilter((v: string | null) => setRoleFilter((v ?? 'all') as 'all' | AccountRole))}
                    >
                      <SelectTrigger id='roles-filter-role' className='w-full'>
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
                    <Label htmlFor='roles-filter-status'>État</Label>
                    <Select
                      value={statusFilter}
                      onValueChange={refilter((v: string | null) => setStatusFilter((v ?? 'all') as StatusFilter))}
                    >
                      <SelectTrigger id='roles-filter-status' className='w-full'>
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
                    <Label htmlFor='roles-filter-sort'>Trier par</Label>
                    <Select
                      value={sortKey}
                      onValueChange={refilter((v: string | null) => setSortKey((v ?? 'role') as SortKey))}
                    >
                      <SelectTrigger id='roles-filter-sort' className='w-full'>
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
                  <Label htmlFor='roles-search' className='sr-only'>
                    Rechercher un compte
                  </Label>
                  <div className='relative'>
                    <Search className='text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2' />
                    <Input
                      id='roles-search'
                      value={query}
                      onChange={e => refilter(setQuery)(e.target.value)}
                      placeholder='Rechercher un nom ou un e-mail'
                      className='pl-9'
                    />
                  </div>
                </div>

                <div className='flex flex-wrap items-center gap-2 sm:justify-between'>
                  <div className='flex items-center gap-2'>
                    <Label htmlFor='roles-rows' className='sr-only'>
                      Afficher
                    </Label>
                    <Select
                      value={String(pageSize)}
                      onValueChange={refilter((v: string | null) => setPageSize(Number(v ?? 10)))}
                    >
                      <SelectTrigger id='roles-rows' className='w-fit whitespace-nowrap'>
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

                  {/* The labels collapse below lg, so each button carries its own
                      name: an icon on its own is not a name. */}
                  <Button
                    variant='outline'
                    className='gap-1.5'
                    aria-label='Exporter en CSV'
                    disabled={loading || filtered.length === 0}
                    onClick={() => downloadCsv(filtered)}
                  >
                    <Download className='size-4' />
                    <span className='max-lg:hidden'>Exporter</span>
                  </Button>

                  <Button
                    variant='outline'
                    className='gap-1.5'
                    aria-label='Actualiser la liste'
                    disabled={loading}
                    onClick={() => void load()}
                  >
                    <RefreshCw className={cn('size-4', loading && 'animate-spin')} />
                    <span className='max-lg:hidden'>Actualiser</span>
                  </Button>

                  <Button
                    className='gap-1.5'
                    aria-label='Créer un compte'
                    nativeButton={false}
                    render={<Link href='/admin/accounts' />}
                  >
                    <UserPlus className='size-4' />
                    <span className='max-lg:hidden'>Nouveau compte</span>
                  </Button>
                </div>
              </div>
            </div>

            {/* Table */}
            {loading ? (
              <div className='space-y-2 p-6'>
                {[0, 1, 2, 3].map(row => (
                  <Skeleton key={row} className='h-12 w-full' />
                ))}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className='border-t'>
                    <TableHead>Personne</TableHead>
                    <TableHead>Rôle</TableHead>
                    <TableHead>Périmètre</TableHead>
                    <TableHead>État</TableHead>
                    <TableHead>Dernière connexion</TableHead>
                    <TableHead>Créé le</TableHead>
                    <TableHead className='last:px-4 last:text-right'>Actions</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {pageItems.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className='text-muted-foreground py-10 text-center text-sm'>
                        {error ? 'Liste indisponible.' : 'Aucun compte ne correspond à ces filtres.'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    pageItems.map(account => {
                      const isSelf = account.id === me?.id
                      const RoleIcon = ROLE_ICON[account.role]
                      const modules = roleModules(account.role)

                      return (
                        <TableRow key={account.id} className='h-14'>
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
                                </span>
                                <span className='text-muted-foreground'>{account.email}</span>
                              </div>
                            </div>
                          </TableCell>

                          <TableCell>
                            <div className='flex items-center gap-2'>
                              <RoleIcon className={cn('size-4', ROLE_TONE[account.role].split(' ')[1])} />
                              <span className='capitalize'>{ACCOUNT_ROLE_LABELS[account.role]}</span>
                            </div>
                          </TableCell>

                          <TableCell className='text-muted-foreground'>
                            <Tooltip>
                              <TooltipTrigger render={<span />}>
                                {plural(modules.length, 'module', 'modules')}
                              </TooltipTrigger>
                              <TooltipContent className='max-w-64'>{modules.join(' · ')}</TooltipContent>
                            </Tooltip>
                          </TableCell>

                          <TableCell>
                            <div className='flex items-center gap-2'>
                              <span
                                className={cn(
                                  'size-2 rounded-full',
                                  account.is_active ? 'bg-green-600' : 'bg-muted-foreground/40'
                                )}
                              />
                              <span className='text-muted-foreground text-xs'>
                                {account.is_active ? 'Actif' : 'Désactivé'}
                              </span>
                            </div>
                          </TableCell>

                          <TableCell className='text-muted-foreground text-sm'>
                            {relativeLogin(account.last_login_at)}
                          </TableCell>

                          <TableCell className='text-sm'>{formatDate(account.created_at)}</TableCell>

                          <TableCell className='last:px-4'>
                            <div className='flex items-center justify-end gap-1'>
                              <Tooltip>
                                <TooltipTrigger
                                  render={
                                    <Button
                                      variant='ghost'
                                      size='icon'
                                      aria-label={`Ouvrir ${account.full_name} dans Comptes & accès`}
                                      nativeButton={false}
                                      render={<Link href='/admin/accounts' />}
                                    />
                                  }
                                >
                                  <Users className='size-4' />
                                </TooltipTrigger>
                                <TooltipContent>Ouvrir dans Comptes &amp; accès</TooltipContent>
                              </Tooltip>

                              <Tooltip>
                                <TooltipTrigger
                                  render={
                                    <Button
                                      variant='ghost'
                                      size='icon'
                                      aria-label={`Copier l’e-mail de ${account.full_name}`}
                                      onClick={() => {
                                        void navigator.clipboard?.writeText(account.email)
                                        setNotice(`E-mail copié : ${account.email}`)
                                      }}
                                    />
                                  }
                                >
                                  <Copy className='size-4' />
                                </TooltipTrigger>
                                <TooltipContent>Copier l’e-mail</TooltipContent>
                              </Tooltip>

                              <DropdownMenu>
                                <DropdownMenuTrigger
                                  render={
                                    <Button
                                      variant='ghost'
                                      size='icon'
                                      aria-label={`Autres actions — ${account.full_name}`}
                                    />
                                  }
                                >
                                  <EllipsisVertical className='size-4' />
                                </DropdownMenuTrigger>

                                <DropdownMenuContent align='end' className='w-64'>
                                  <DropdownMenuItem onClick={() => setDetailRole(account.role)}>
                                    <ShieldCheck />
                                    <span>Détail du rôle {ACCOUNT_ROLE_LABELS[account.role]}</span>
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => {
                                      void navigator.clipboard?.writeText(account.email)
                                      setNotice(`E-mail copié : ${account.email}`)
                                    }}
                                  >
                                    <Copy />
                                    <span>Copier l’e-mail</span>
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem nativeButton={false} render={<Link href='/admin/accounts' />}>
                                    <UserPlus />
                                    <span>Modifier dans Comptes &amp; accès</span>
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </TableCell>
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

              <Pagination className='mx-auto w-full justify-center'>
                <PaginationContent>
                  <PaginationItem>
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
                  </PaginationItem>

                  {pageWindow(safePage, totalPages).map((entry, index) =>
                    entry === 'gap' ? (
                      <PaginationItem key={`gap-${index}`}>
                        <PaginationEllipsis />
                      </PaginationItem>
                    ) : (
                      <PaginationItem key={entry}>
                        <Button
                          variant={entry === safePage ? 'default' : 'ghost'}
                          size='icon'
                          aria-current={entry === safePage ? 'page' : undefined}
                          className={cn(
                            'size-9',
                            entry !== safePage && 'bg-primary/10 text-primary hover:bg-primary/20'
                          )}
                          onClick={() => setPage(entry)}
                        >
                          {entry}
                        </Button>
                      </PaginationItem>
                    )
                  )}

                  <PaginationItem>
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
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Détail d'un rôle ── */}
      <Dialog open={detail !== null} onOpenChange={open => !open && setDetailRole(null)}>
        <DialogContent className='sm:max-w-lg'>
          <DialogHeader>
            <DialogTitle className='flex items-center gap-2'>
              {detailRole && (
                <>
                  {(() => {
                    const Icon = ROLE_ICON[detailRole]

                    return <Icon className={cn('size-5', ROLE_TONE[detailRole].split(' ')[1])} />
                  })()}
                  {ACCOUNT_ROLE_LABELS[detailRole]}
                </>
              )}
            </DialogTitle>
            <DialogDescription>{detail?.purpose}</DialogDescription>
          </DialogHeader>

          <div className='max-h-96 space-y-0 overflow-y-auto'>
            {detail?.grants.map(grant => (
              <div key={grant.module} className='flex items-start justify-between gap-3 border-b py-2.5 last:border-0'>
                <div className='min-w-0'>
                  <p className='text-sm font-medium'>{grant.module}</p>
                  {grant.own && <p className='text-muted-foreground text-xs'>Ses propres enregistrements</p>}
                </div>

                <div className='flex shrink-0 flex-wrap justify-end gap-1'>
                  {grant.actions.map(action => (
                    <Badge key={action} variant='secondary' className='rounded-sm text-[10px]'>
                      {ROLE_ACTION_LABELS[action]}
                    </Badge>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button variant='outline' onClick={() => setDetailRole(null)}>
              Fermer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Nouveau rôle ── */}
      <Dialog open={addRoleOpen} onOpenChange={setAddRoleOpen}>
        <DialogContent className='sm:max-w-md'>
          <DialogHeader>
            <DialogTitle className='flex items-center gap-2'>
              <ShieldCheck className='size-5' /> Les rôles sont définis par le socle
            </DialogTitle>
            <DialogDescription>
              Les trois rôles — Administrateur, Médecin / Pharmacien et Délégué Médical — accompagnent la plateforme :
              c’est le serveur qui décide de ce que chacun peut appeler, et le menu de chaque compte en découle.
            </DialogDescription>
          </DialogHeader>

          <Alert>
            <AlertCircle className='size-4' />
            <AlertDescription>
              Un quatrième rôle demanderait une évolution de l’API (les règles d’accès y sont écrites), pas une
              modification depuis cet écran. Pour donner un accès à une nouvelle personne, choisissez le rôle qui
              correspond à son usage.
            </AlertDescription>
          </Alert>

          <DialogFooter>
            <Button variant='outline' onClick={() => setAddRoleOpen(false)}>
              Fermer
            </Button>
            <Button className='gap-1.5' nativeButton={false} render={<Link href='/admin/accounts' />}>
              <UserPlus className='size-4' />
              Créer un compte
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
