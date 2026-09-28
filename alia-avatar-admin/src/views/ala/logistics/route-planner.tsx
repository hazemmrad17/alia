'use client'

// Third-party Imports
import { useMemo, useState, useSyncExternalStore } from 'react'

import Link from 'next/link'
import { useRouter } from 'next/navigation'

import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleCheckBig,
  Copy,
  Ellipsis,
  Flag,
  FunnelX,
  LayoutGrid,
  MapPinned,
  Plus,
  Route as RouteIcon,
  Search,
  Trash2,
  Truck
} from 'lucide-react'
import { toast } from 'sonner'

// Component Imports
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

// Util Imports
import { cn } from '@/lib/utils'

// Data Imports
import {
  EMPTY_ROUTE_FILTERS,
  ROUTE_SORT_LABELS,
  ROUTE_STATUS_LABELS,
  ROUTE_STATUS_TONES,
  ROUTES,
  depotOf,
  driverOptions,
  figuresOf,
  filterRoutes,
  formatDuration,
  formatKm,
  formatRouteDate,
  initials,
  isFiltered,
  routeKpis,
  sortRoutes,
  vehicleOf,
  vehicleOptions,
  type Route,
  type RouteFilters,
  type RouteSortKey
} from '@/lib/route-data'
import {
  getLocalRoutes,
  getServerRoutes,
  mergeRoutes,
  removeLocalRoute,
  subscribeLocalRoutes
} from '@/lib/route-drafts'

const ROWS_PER_PAGE_OPTIONS = [10, 25, 50]

/** Every column the layout carries except the two that anchor a row. */
type ColumnKey = 'date' | 'stops' | 'driver' | 'vehicle' | 'distance' | 'duration' | 'status'

const COLUMN_LABELS: Record<ColumnKey, string> = {
  date: 'Date',
  stops: 'Arrêts',
  driver: 'Chauffeur',
  vehicle: 'Véhicule',
  distance: 'Distance',
  duration: 'Durée',
  status: 'Statut'
}

/** "24 sept. 2026" — the list's own date shape, and the CSV's. */
function csvCell(value: string | number): string {
  return `"${String(value).replace(/"/g, '""')}"`
}

/** The filtered list as a spreadsheet, separated by `;` and prefixed for Excel. */
function downloadCsv(routes: Route[]) {
  const header = [
    'Tournée',
    'Statut',
    'Date',
    'Départ',
    'Arrêts',
    'Chauffeur',
    'Plaque',
    'Unité',
    'Dépôt',
    'Distance (km)',
    'Durée (min)',
    'Fin estimée',
    'Colis',
    'Poids (kg)'
  ]

  const rows = routes.map(route => {
    const figures = figuresOf(route)
    const vehicle = vehicleOf(route.vehicleId)

    return [
      route.id,
      ROUTE_STATUS_LABELS[route.status],
      formatRouteDate(route.date),
      route.startAt,
      figures.stops,
      vehicle?.driver ?? '',
      vehicle?.plate ?? '',
      vehicle?.id ?? '',
      depotOf(route.depotId).name,
      figures.distanceKm.toFixed(1).replace('.', ','),
      Math.round(figures.durationMinutes),
      figures.endAt ?? '',
      figures.packages,
      Math.round(figures.weightKg)
    ]
  })

  const csv = [header, ...rows].map(row => row.map(csvCell).join(';')).join('\r\n')
  const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }))

  const anchor = document.createElement('a')

  anchor.href = url
  anchor.download = `tournees-${new Date().toISOString().slice(0, 10)}.csv`
  anchor.click()
  URL.revokeObjectURL(url)
}

// ── Bandeau de chiffres ───────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  caption,
  tone,
  icon: Icon
}: {
  label: string
  value: number
  caption: string
  tone: string
  icon: typeof Truck
}) {
  return (
    <Card size='sm'>
      <CardContent className='flex items-start justify-between gap-3'>
        <div className='min-w-0'>
          <p className='text-sm font-medium'>{label}</p>
          <p className='mt-1 truncate text-3xl font-bold tabular-nums'>{value}</p>
          <p className='text-muted-foreground mt-1 truncate text-xs'>{caption}</p>
        </div>

        <span className={cn('grid size-10 shrink-0 place-items-center rounded-xl **:data-[icon]:size-5', tone)}>
          <Icon className='size-5' />
        </span>
      </CardContent>
    </Card>
  )
}

// ── En-tête triable ───────────────────────────────────────────────────────────

function SortHead({
  column,
  sort,
  onSort
}: {
  column: RouteSortKey
  sort: { key: RouteSortKey; descending: boolean }
  onSort: (key: RouteSortKey) => void
}) {
  const active = sort.key === column

  return (
    <TableHead
      tabIndex={0}
      aria-sort={active ? (sort.descending ? 'descending' : 'ascending') : undefined}
      onClick={() => onSort(column)}
      onKeyDown={event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onSort(column)
        }
      }}
      className='group/sort focus-visible:ring-ring/50 cursor-pointer select-none focus-visible:ring-2 focus-visible:outline-none'
    >
      <span className='text-muted-foreground inline-flex w-full items-center justify-between gap-1 text-sm font-medium'>
        <span>{ROUTE_SORT_LABELS[column]}</span>

        {active ? (
          sort.descending ? (
            <ArrowDown className='text-foreground size-3.5' />
          ) : (
            <ArrowUp className='text-foreground size-3.5' />
          )
        ) : (
          <ArrowUp className='size-3.5 opacity-0 transition-opacity group-hover/sort:opacity-60' />
        )}
      </span>
    </TableHead>
  )
}

// ── La page ───────────────────────────────────────────────────────────────────

export function RoutePlanner() {
  const router = useRouter()

  const [filters, setFilters] = useState<RouteFilters>(EMPTY_ROUTE_FILTERS)
  const [rowsPerPage, setRowsPerPage] = useState(ROWS_PER_PAGE_OPTIONS[0])
  const [page, setPage] = useState(1)
  const [sort, setSort] = useState<{ key: RouteSortKey; descending: boolean }>({ key: 'date', descending: true })
  const [hidden, setHidden] = useState<ColumnKey[]>([])

  // Tournées saved from the composer live in this browser: the server has no way
  // to know about them, so it renders the empty snapshot and the browser renders
  // its own once hydrated.
  const local = useSyncExternalStore(subscribeLocalRoutes, getLocalRoutes, getServerRoutes)

  const routes = useMemo(() => mergeRoutes(ROUTES, local), [local])
  const localIds = useMemo(() => new Set(local.map(entry => entry.id)), [local])

  const kpis = useMemo(() => routeKpis(routes), [routes])

  const matching = useMemo(
    () => sortRoutes(filterRoutes(routes, filters), sort.key, sort.descending),
    [routes, filters, sort]
  )

  const totalPages = Math.max(1, Math.ceil(matching.length / rowsPerPage))

  // Clamped rather than stored: filtering down to one page must not leave the
  // table pointing at a page that no longer exists.
  const safePage = Math.min(page, totalPages)
  const first = matching.length === 0 ? 0 : (safePage - 1) * rowsPerPage + 1
  const last = Math.min(safePage * rowsPerPage, matching.length)
  const pageRows = matching.slice((safePage - 1) * rowsPerPage, safePage * rowsPerPage)

  const shown = (key: ColumnKey) => !hidden.includes(key)

  const openRoute = (id: string) => router.push(`/dashboard/logistics/route-planner/${id}`)

  const toggleSort = (key: RouteSortKey) =>
    setSort(current => (current.key === key ? { key, descending: !current.descending } : { key, descending: false }))

  const statusItems = [
    { label: 'Tous les statuts', value: 'all' },
    ...(Object.keys(ROUTE_STATUS_LABELS) as Array<keyof typeof ROUTE_STATUS_LABELS>).map(status => ({
      label: ROUTE_STATUS_LABELS[status],
      value: status
    }))
  ]

  const driverItems = [
    { label: 'Tous les chauffeurs', value: 'all' },
    ...driverOptions().map(name => ({ label: name, value: name }))
  ]

  const vehicleItems = [
    { label: 'Tous les véhicules', value: 'all' },
    ...vehicleOptions().map(option => ({ label: option.label, value: option.value }))
  ]

  return (
    <div className='space-y-6'>
      <div className='flex justify-between gap-4 max-sm:flex-col sm:items-center'>
        <div>
          <h1 className='text-3xl font-bold tracking-tight'>Planificateur de tournées</h1>
          <p className='text-muted-foreground mt-1 text-sm'>
            Planifiez les circuits, ordonnez les arrêts et affectez véhicules et chauffeurs.
          </p>
        </div>

        <Button className='gap-2' nativeButton={false} render={<Link href='/dashboard/logistics/route-planner/new' />}>
          <Plus className='size-4' />
          Créer une tournée
        </Button>
      </div>

      <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4'>
        <KpiCard
          label='Tournées planifiées'
          value={kpis.total}
          caption='Tous statuts confondus'
          tone='bg-info-soft text-info'
          icon={RouteIcon}
        />
        <KpiCard
          label='En tournée'
          value={kpis.enTournee}
          caption='Actuellement sur la route'
          tone='bg-warning-soft text-warning'
          icon={Truck}
        />
        <KpiCard
          label='Prêtes à expédier'
          value={kpis.prete}
          caption='Véhicule et chauffeur affectés'
          tone='bg-accent text-accent-foreground'
          icon={CircleCheckBig}
        />
        <KpiCard
          label='Terminées'
          value={kpis.terminee}
          caption='Tous les arrêts livrés'
          tone='bg-success-soft text-success'
          icon={Flag}
        />
      </div>

      <Card className='gap-0 py-0'>
        <div className='flex flex-col gap-3 border-b px-4 py-3 lg:flex-row lg:items-start lg:justify-between'>
          <div className='flex flex-col gap-3 sm:flex-row sm:items-center'>
            <InputGroup className='sm:w-72'>
              <InputGroupAddon>
                <Search />
              </InputGroupAddon>
              <InputGroupInput
                value={filters.search}
                onChange={event => setFilters(current => ({ ...current, search: event.target.value }))}
                placeholder='Rechercher une tournée...'
                aria-label='Rechercher une tournée'
              />
            </InputGroup>

            <Select
              items={ROWS_PER_PAGE_OPTIONS.map(option => ({ label: String(option), value: String(option) }))}
              value={String(rowsPerPage)}
              onValueChange={(value: string | null) => {
                if (value) setRowsPerPage(Number(value))
              }}
            >
              <SelectTrigger className='w-full sm:w-20' aria-label='Lignes par page'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {ROWS_PER_PAGE_OPTIONS.map(option => (
                    <SelectItem key={option} value={String(option)}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>

          <div className='flex flex-wrap items-center gap-2 **:data-[slot="select-trigger"]:max-sm:w-full lg:justify-end'>
            <Select
              items={statusItems}
              value={filters.status}
              onValueChange={(value: string | null) => {
                if (value) setFilters(current => ({ ...current, status: value }))
              }}
            >
              <SelectTrigger className='w-40' aria-label='Filtrer par statut'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {statusItems.map(item => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>

            <Select
              items={driverItems}
              value={filters.driver}
              onValueChange={(value: string | null) => {
                if (value) setFilters(current => ({ ...current, driver: value }))
              }}
            >
              <SelectTrigger className='w-44' aria-label='Filtrer par chauffeur'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {driverItems.map(item => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>

            <Select
              items={vehicleItems}
              value={filters.vehicle}
              onValueChange={(value: string | null) => {
                if (value) setFilters(current => ({ ...current, vehicle: value }))
              }}
            >
              <SelectTrigger className='w-44' aria-label='Filtrer par véhicule'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {vehicleItems.map(item => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>

            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button variant='secondary' className='gap-1.5'>
                    Exporter <ChevronDown className='size-4' />
                  </Button>
                }
              />

              <DropdownMenuContent align='end' className='w-56'>
                <DropdownMenuItem
                  onClick={() => {
                    downloadCsv(matching)

                    toast.success('Export CSV', {
                      description: `${matching.length} tournée${matching.length > 1 ? 's' : ''} exportée${matching.length > 1 ? 's' : ''}`
                    })
                  }}
                >
                  Télécharger en CSV
                </DropdownMenuItem>

                <DropdownMenuItem
                  onClick={() => {
                    const text = matching
                      .map(
                        route => `${route.id} · ${ROUTE_STATUS_LABELS[route.status]} · ${formatRouteDate(route.date)}`
                      )
                      .join('\n')

                    void navigator.clipboard.writeText(text)
                    toast.success('Liste copiée', { description: `${matching.length} lignes` })
                  }}
                >
                  Copier la liste
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant='outline'
                    size='icon'
                    className='size-8'
                    aria-label='Effacer les filtres'
                    disabled={!isFiltered(filters)}
                    onClick={() => setFilters(EMPTY_ROUTE_FILTERS)}
                  />
                }
              >
                <FunnelX className='size-4' />
              </TooltipTrigger>
              <TooltipContent>Effacer les filtres</TooltipContent>
            </Tooltip>

            <DropdownMenu>
              <DropdownMenuTrigger
                render={<Button variant='outline' size='icon' className='size-8' aria-label='Choisir les colonnes' />}
              >
                <LayoutGrid className='size-4' />
              </DropdownMenuTrigger>

              <DropdownMenuContent align='end' className='w-48'>
                {(Object.keys(COLUMN_LABELS) as ColumnKey[]).map(column => (
                  <DropdownMenuCheckboxItem
                    key={column}
                    checked={shown(column)}
                    onCheckedChange={checked =>
                      setHidden(current => (checked ? current.filter(key => key !== column) : [...current, column]))
                    }
                  >
                    {COLUMN_LABELS[column]}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow className='hover:bg-transparent'>
              <TableHead className='text-muted-foreground text-sm font-medium'>Tournée</TableHead>

              {shown('date') && <SortHead column='date' sort={sort} onSort={toggleSort} />}
              {shown('stops') && <SortHead column='stops' sort={sort} onSort={toggleSort} />}
              {shown('driver') && <SortHead column='driver' sort={sort} onSort={toggleSort} />}
              {shown('vehicle') && <SortHead column='vehicle' sort={sort} onSort={toggleSort} />}
              {shown('distance') && <SortHead column='distance' sort={sort} onSort={toggleSort} />}
              {shown('duration') && <SortHead column='duration' sort={sort} onSort={toggleSort} />}
              {shown('status') && <SortHead column='status' sort={sort} onSort={toggleSort} />}

              <TableHead className='text-muted-foreground text-sm font-medium'>Actions</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {pageRows.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className='text-muted-foreground py-10 text-center'>
                  Aucune tournée ne correspond à ces filtres.
                </TableCell>
              </TableRow>
            )}

            {pageRows.map(route => {
              const figures = figuresOf(route)
              const vehicle = vehicleOf(route.vehicleId)
              const depot = depotOf(route.depotId)

              return (
                <TableRow
                  key={route.id}
                  role='link'
                  tabIndex={0}
                  aria-label={`Ouvrir la tournée ${route.id}`}
                  onClick={() => openRoute(route.id)}
                  onKeyDown={event => {
                    if (event.key === 'Enter') openRoute(route.id)
                  }}
                  className='focus-visible:ring-ring/50 cursor-pointer transition-colors focus-visible:ring-2 focus-visible:outline-none'
                >
                  <TableCell>
                    <div className='flex flex-col'>
                      <span className='text-foreground font-semibold'>{route.id}</span>
                      <span className='text-muted-foreground text-xs'>Départ {route.startAt}</span>
                    </div>
                  </TableCell>

                  {shown('date') && (
                    <TableCell>
                      <span className='whitespace-nowrap'>{formatRouteDate(route.date)}</span>
                    </TableCell>
                  )}

                  {shown('stops') && (
                    <TableCell>
                      <span className='tabular-nums'>{figures.stops}</span>
                    </TableCell>
                  )}

                  {shown('driver') && (
                    <TableCell>
                      {vehicle ? (
                        <div className='flex items-center gap-2.5'>
                          <span className='bg-muted flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold'>
                            {initials(vehicle.driver)}
                          </span>
                          <span className='font-medium'>{vehicle.driver}</span>
                        </div>
                      ) : (
                        <span className='text-muted-foreground'>—</span>
                      )}
                    </TableCell>
                  )}

                  {shown('vehicle') && (
                    <TableCell>
                      {vehicle ? (
                        <div className='flex flex-col'>
                          <span className='font-medium'>{vehicle.plate}</span>
                          <span className='text-muted-foreground text-xs'>{vehicle.id}</span>
                        </div>
                      ) : (
                        <span className='text-muted-foreground'>—</span>
                      )}
                    </TableCell>
                  )}

                  {shown('distance') && (
                    <TableCell>
                      <span className='whitespace-nowrap tabular-nums'>{formatKm(figures.distanceKm)}</span>
                    </TableCell>
                  )}

                  {shown('duration') && (
                    <TableCell>
                      <span className='whitespace-nowrap tabular-nums'>{formatDuration(figures.durationMinutes)}</span>
                    </TableCell>
                  )}

                  {shown('status') && (
                    <TableCell>
                      <Badge variant='outline' className={cn('border-0', ROUTE_STATUS_TONES[route.status])}>
                        {ROUTE_STATUS_LABELS[route.status]}
                      </Badge>
                    </TableCell>
                  )}

                  <TableCell onClick={event => event.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <Button variant='ghost' size='icon' className='size-8' aria-label='Actions de la tournée' />
                        }
                      >
                        <Ellipsis className='size-4' />
                      </DropdownMenuTrigger>

                      <DropdownMenuContent align='end' className='w-60'>
                        <DropdownMenuItem onClick={() => openRoute(route.id)}>Ouvrir la tournée</DropdownMenuItem>

                        <DropdownMenuItem
                          disabled={!vehicle}
                          onClick={() => router.push(`/dashboard/logistics/live-map?unit=${vehicle?.id}`)}
                        >
                          <MapPinned className='size-4' />
                          Voir l’unité sur la carte
                        </DropdownMenuItem>

                        <DropdownMenuSeparator />

                        <DropdownMenuItem
                          onClick={() => {
                            void navigator.clipboard.writeText(route.id)
                            toast.success('Identifiant copié', { description: route.id })
                          }}
                        >
                          <Copy className='size-4' />
                          Copier l’identifiant
                        </DropdownMenuItem>

                        {localIds.has(route.id) && (
                          <>
                            <DropdownMenuSeparator />

                            <DropdownMenuItem
                              variant='destructive'
                              onClick={() => {
                                removeLocalRoute(route.id)
                                toast.success('Tournée supprimée', { description: route.id })
                              }}
                            >
                              <Trash2 className='size-4' />
                              Supprimer la tournée
                            </DropdownMenuItem>
                          </>
                        )}

                        <DropdownMenuSeparator />

                        <DropdownMenuItem disabled>Dépôt : {depot.name}</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>

        <div className='flex items-center justify-between gap-3 border-t px-4 py-3 max-sm:flex-col'>
          <p className='text-muted-foreground text-sm'>
            Affichage {first} à {last} sur {matching.length} tournées
          </p>

          <nav aria-label='pagination' className='flex items-center gap-1'>
            <Button
              variant='outline'
              size='icon'
              className='size-8'
              aria-label='Page précédente'
              disabled={safePage <= 1}
              onClick={() => setPage(safePage - 1)}
            >
              <ChevronLeft className='size-4' />
            </Button>

            {Array.from({ length: totalPages }, (_, index) => index + 1).map(number => (
              <Button
                key={number}
                variant={number === safePage ? 'default' : 'ghost'}
                size='icon'
                aria-current={number === safePage ? 'page' : undefined}
                className={cn('size-8', number !== safePage && 'bg-primary/10 text-primary hover:bg-primary/20')}
                onClick={() => setPage(number)}
              >
                {number}
              </Button>
            ))}

            <Button
              variant='outline'
              size='icon'
              className='size-8'
              aria-label='Page suivante'
              disabled={safePage >= totalPages}
              onClick={() => setPage(safePage + 1)}
            >
              <ChevronRight className='size-4' />
            </Button>
          </nav>
        </div>
      </Card>
    </div>
  )
}
