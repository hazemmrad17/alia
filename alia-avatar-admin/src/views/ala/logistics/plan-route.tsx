'use client'

// Third-party Imports
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'

import Link from 'next/link'
import { useRouter } from 'next/navigation'

import { LngLatBounds, Map as MapLibreMap, Marker, setWorkerUrl } from 'maplibre-gl'
import { useTheme } from 'next-themes'

import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Check,
  Circle,
  FileText,
  MapPinned,
  Route as RouteIcon,
  Search,
  TriangleAlert,
  Truck,
  WandSparkles,
  X
} from 'lucide-react'
import { toast } from 'sonner'

// Component Imports
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'

// Util Imports
import { cn } from '@/lib/utils'

// Data Imports
import {
  PENDING_ORDERS,
  PLANNER_VEHICLES,
  ROUTES,
  depotOf,
  formatDuration,
  formatKm,
  formatRouteDate,
  formatShortDate,
  formatWeight,
  optimiseOrder,
  routeFigures,
  routePath,
  scheduleStopTimes,
  vehicleOf,
  type DepotId,
  type PendingOrder,
  type Route,
  type RouteStop
} from '@/lib/route-data'
import {
  getLocalRoutes,
  getServerRoutes,
  isUnread,
  nextRouteId,
  saveLocalRoute,
  subscribeLocalRoutes
} from '@/lib/route-drafts'
import { DEPOTS } from '@/lib/inventory-data'
import { isBlockingWarning } from '@/lib/fleet-data'

/**
 * Same trap as the live map: MapLibre looks for its worker next to the bundle the
 * bundler compiled into /_next/static, which the bundler never writes, and a
 * missing worker leaves the basemap blank. scripts/sync-map-worker.mjs copies it
 * to /public on every dev and build start.
 */
const MAP_WORKER_URL = '/maplibre/maplibre-gl-worker.mjs'

const BASEMAPS = {
  light: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
  dark: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'
}

/** The theme's primary is an oklch value, which MapLibre cannot parse. */
const LINE_COLOR = { light: '#0f8a6a', dark: '#1aa87d' }

/** A tournée is dispatched the day after it is planned. */
function defaultDate(): string {
  const date = new Date()

  date.setDate(date.getDate() + 1)

  return date.toISOString().slice(0, 10)
}

// ── Aperçu cartographique ─────────────────────────────────────────────────────

function RoutePreviewMap({
  stops,
  depotId,
  returnToStart
}: {
  stops: RouteStop[]
  depotId: DepotId
  returnToStart: boolean
}) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  const markersRef = useRef<Marker[]>([])

  const { resolvedTheme } = useTheme()
  const theme: 'light' | 'dark' = resolvedTheme === 'light' ? 'light' : 'dark'

  const path = useMemo(() => routePath(stops, depotId, returnToStart), [stops, depotId, returnToStart])
  const depot = depotOf(depotId)

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    // Must run before the map is built: the worker pool is created with the first
    // tile request.
    setWorkerUrl(MAP_WORKER_URL)

    mapRef.current = new MapLibreMap({
      container: containerRef.current,
      style: BASEMAPS[theme],
      center: [10.15, 35.6],
      zoom: 7,
      attributionControl: { compact: true }
    })

    return () => {
      mapRef.current?.remove()
      mapRef.current = null
    }

    // The style is re-applied by the effect below, so the theme is deliberately
    // not a dependency here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    mapRef.current?.setStyle(BASEMAPS[theme])
  }, [theme])

  // The line: one GeoJSON source, redrawn when the circuit changes.
  useEffect(() => {
    const map = mapRef.current

    if (!map || path.length < 2) return

    const draw = () => {
      const data = {
        type: 'Feature' as const,
        properties: {},
        geometry: { type: 'LineString' as const, coordinates: path }
      }

      const source = map.getSource('preview')

      if (source) {
        ;(source as unknown as { setData: (next: typeof data) => void }).setData(data)
      } else {
        map.addSource('preview', { type: 'geojson', data })
        map.addLayer({
          id: 'preview',
          type: 'line',
          source: 'preview',
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: {
            'line-color': LINE_COLOR[theme],
            'line-width': 3,
            'line-opacity': 0.85,

            // Dashed: a plan, not a recorded track.
            'line-dasharray': [2, 1.5]
          }
        })
      }

      const bounds = new LngLatBounds()

      path.forEach(point => bounds.extend(point))
      map.fitBounds(bounds, { padding: 70, maxDuration: 700, maxZoom: 12 })
    }

    if (map.isStyleLoaded()) {
      draw()

      return
    }

    map.once('load', draw)

    return () => {
      map.off('load', draw)
    }
  }, [path, theme])

  // Pins: the dépôt, then one numbered marker per stop.
  useEffect(() => {
    const map = mapRef.current

    if (!map) return

    markersRef.current.forEach(marker => marker.remove())
    markersRef.current = []

    const depotPoint = path[0]

    if (depotPoint) {
      const element = document.createElement('div')

      element.className =
        'grid size-7 place-items-center rounded-md border-2 border-white bg-foreground text-[11px] font-bold text-background shadow'
      element.textContent = 'D'
      element.title = depot.name

      markersRef.current.push(new Marker({ element, anchor: 'center' }).setLngLat(depotPoint).addTo(map))
    }

    stops.forEach((stop, index) => {
      const point = path[index + 1]

      if (!point) return

      const element = document.createElement('div')

      element.className =
        'grid size-6 place-items-center rounded-full border-2 border-white bg-primary text-[11px] font-semibold text-primary-foreground shadow'
      element.textContent = String(index + 1)
      element.title = `${index + 1}. ${stop.officine} — ${stop.slot}`

      markersRef.current.push(new Marker({ element, anchor: 'center' }).setLngLat(point).addTo(map))
    })
  }, [path, stops, depot.name])

  return (
    <div className='border-border relative h-[22rem] w-full overflow-hidden rounded-xl border'>
      <div ref={containerRef} className='absolute inset-0' />
    </div>
  )
}

// ── États vides ───────────────────────────────────────────────────────────────

function EmptyState({
  icon: Icon,
  title,
  hint,
  padding
}: {
  icon: typeof MapPinned
  title: string
  hint: string
  padding: string
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-2 text-center', padding)}>
      <div className='bg-muted flex size-12 items-center justify-center rounded-full'>
        <Icon className='text-muted-foreground size-6' />
      </div>
      <p className='font-medium'>{title}</p>
      <p className='text-muted-foreground text-sm'>{hint}</p>
    </div>
  )
}

// ── Le composeur ──────────────────────────────────────────────────────────────

/**
 * Opens one tournée in the composer. A seeded tournée is known on the server, a
 * draft saved from this browser is not, so the local saves are read once the page
 * is mounted and take precedence — editing a saved draft must edit the draft.
 */
export function RouteEditor({ id }: { id: string }) {
  const seeded = ROUTES.find(entry => entry.id === id) ?? null
  const local = useSyncExternalStore(subscribeLocalRoutes, getLocalRoutes, getServerRoutes)

  // Until the browser's copy has been read, a miss is not yet a missing tournée.
  const checked = !isUnread(local)
  const route = local.find(entry => entry.id === id) ?? seeded

  if (!route) {
    return (
      <Card className='gap-0 py-0'>
        <CardContent className='p-4'>
          <EmptyState
            icon={RouteIcon}
            title={checked ? 'Tournée introuvable' : 'Chargement de la tournée...'}
            hint={checked ? `Aucune tournée ${id} : elle a peut-être été supprimée de ce navigateur.` : 'Un instant.'}
            padding='py-16'
          />

          {checked && (
            <div className='flex justify-center'>
              <Button
                variant='outline'
                nativeButton={false}
                render={<Link href='/dashboard/logistics/route-planner' />}
              >
                Retour au planificateur
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  return <PlanRoute key={route.id} route={route} />
}

export function PlanRoute({ route }: { route?: Route }) {
  const router = useRouter()
  const editing = Boolean(route)

  const [depotId, setDepotId] = useState<DepotId | null>(route?.depotId ?? null)
  const [vehicleId, setVehicleId] = useState<string | null>(route?.vehicleId ?? null)
  const [date, setDate] = useState(route?.date ?? defaultDate())
  const [startAt, setStartAt] = useState(route?.startAt ?? '08:00')
  const [returnToStart, setReturnToStart] = useState(route?.returnToStart ?? true)
  const [notes, setNotes] = useState(route?.notes ?? '')
  const [stops, setStops] = useState<RouteStop[]>(route?.stops ?? [])
  const [selected, setSelected] = useState<string[]>([])
  const [orderSearch, setOrderSearch] = useState('')

  const vehicle = vehicleOf(vehicleId)

  // Slots follow the depot and the departure time, so a plan is never shown with
  // times that belong to another circuit.
  const scheduledStops = useMemo(
    () => (depotId ? scheduleStopTimes(stops, depotId, startAt, returnToStart).stops : stops),
    [stops, depotId, startAt, returnToStart]
  )

  const figures = useMemo(
    () => routeFigures(scheduledStops, depotId ?? 'tunis', startAt, returnToStart, vehicleId),
    [scheduledStops, depotId, startAt, returnToStart, vehicleId]
  )

  const chosen = new Set(scheduledStops.map(stop => stop.orderId))

  const available: PendingOrder[] = useMemo(() => {
    const wanted = orderSearch.trim().toLowerCase()

    return PENDING_ORDERS.filter(order => !chosen.has(order.id))
      .filter(order => (depotId ? order.depotId === depotId : true))
      .filter(order =>
        wanted === ''
          ? true
          : `${order.id} ${order.officine} ${order.city} ${order.address}`.toLowerCase().includes(wanted)
      )
      .sort((a, b) => a.windowFrom.localeCompare(b.windowFrom) || a.id.localeCompare(b.id))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderSearch, depotId, scheduledStops])

  const readiness = [
    { label: 'Arrêts affectés', done: scheduledStops.length > 0 },
    { label: 'Dépôt de départ choisi', done: depotId !== null },
    { label: 'Véhicule affecté', done: vehicleId !== null },
    { label: 'Chauffeur affecté', done: Boolean(vehicle) },
    { label: 'Horaire défini', done: date !== '' && startAt !== '' }
  ]

  const readyCount = readiness.filter(item => item.done).length
  const canAdd = depotId !== null && selected.length > 0

  // The registry already knows which units cannot leave today — a flat tyre, a
  // morning at the workshop. Assigning one is allowed (the planner may be looking
  // at tomorrow) but dispatching it is not.
  const blockingWarning = vehicle?.warnings.find(isBlockingWarning) ?? null

  const addSelected = () => {
    if (!canAdd || !depotId) return

    const picked = PENDING_ORDERS.filter(order => selected.includes(order.id))

    const added: RouteStop[] = picked.map((order, index) => ({
      id: `NEW-${order.id}-${index}`,
      orderId: order.id,
      officine: order.officine,
      city: order.city,
      address: order.address,
      slot: '00:00',
      packages: order.packages,
      weightKg: order.weightKg,
      state: 'planifiee'
    }))

    setStops(current => [...current, ...added])
    setSelected([])

    toast.success('Arrêts ajoutés', {
      description: `${added.length} commande${added.length > 1 ? 's' : ''} · ${depotOf(depotId).name}`
    })
  }

  const removeStop = (id: string) => setStops(current => current.filter(stop => stop.id !== id))

  const moveStop = (index: number, direction: -1 | 1) =>
    setStops(current => {
      const next = [...current]
      const target = index + direction

      if (target < 0 || target >= next.length) return current
      ;[next[index], next[target]] = [next[target], next[index]]

      return next
    })

  const optimise = () => {
    if (!depotId) return

    setStops(current => optimiseOrder(current, depotId))
    toast.success('Séquence optimisée', { description: 'Plus proche voisin depuis le dépôt' })
  }

  const persist = (status: Route['status']) => {
    if (!depotId) return

    // A new plan takes the next free serial, counting the saves this browser
    // already holds. Read on save rather than on render, so nothing here depends
    // on storage existing during the server pass.
    const id = route?.id ?? nextRouteId([...ROUTES.map(entry => entry.id), ...getLocalRoutes().map(entry => entry.id)])

    saveLocalRoute({ id, status, date, depotId, vehicleId, startAt, returnToStart, stops: scheduledStops, notes })

    toast.success(status === 'prete' ? 'Tournée expédiée' : 'Brouillon enregistré', {
      description: `${id} · ${depotOf(depotId).name}`
    })

    router.push('/dashboard/logistics/route-planner')
  }

  return (
    <div className='space-y-6'>
      <Button
        variant='link'
        className='text-muted-foreground hover:text-foreground h-auto gap-1.5 px-0'
        nativeButton={false}
        render={<Link href='/dashboard/logistics/route-planner' />}
      >
        <ArrowLeft className='size-4' />
        Retour au planificateur
      </Button>

      <div className='space-y-6'>
        <div className='flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between'>
          <div>
            <h1 className='text-3xl font-bold tracking-tight'>
              {editing ? 'Modifier la tournée' : 'Planifier une tournée'}
            </h1>
            <p className='text-muted-foreground mt-1 text-sm'>
              Choisissez les commandes non assignées, ordonnez les arrêts, puis affectez un véhicule et un chauffeur.
            </p>
          </div>

          <div className='flex flex-wrap gap-2'>
            <Button
              variant='outline'
              className='gap-1.5'
              nativeButton={false}
              render={<Link href='/dashboard/logistics/route-planner' />}
            >
              Annuler
            </Button>

            <Button
              variant='outline'
              className='gap-1.5'
              disabled={!depotId || scheduledStops.length === 0}
              onClick={() => persist('brouillon')}
            >
              <FileText className='size-4' />
              Enregistrer le brouillon
            </Button>

            <Button
              className='gap-1.5'
              disabled={readyCount < 5 || blockingWarning !== null}
              onClick={() => persist('prete')}
            >
              <Truck className='size-4' />
              Expédier la tournée
            </Button>
          </div>
        </div>

        <div className='grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-[380px_minmax(0,1fr)_340px]'>
          {/* ── Commandes non assignées ── */}
          <Card className='h-fit gap-0 py-0'>
            <CardHeader className='flex flex-wrap items-center justify-between gap-1.5 px-5 pt-5'>
              <CardTitle className='font-heading text-base font-medium'>Commandes non assignées</CardTitle>
              <Badge variant='secondary' className='rounded-sm'>
                {available.length}
              </Badge>
            </CardHeader>

            <CardContent className='space-y-4 p-4'>
              <InputGroup>
                <InputGroupAddon>
                  <Search />
                </InputGroupAddon>
                <InputGroupInput
                  value={orderSearch}
                  onChange={event => setOrderSearch(event.target.value)}
                  placeholder='Rechercher une commande...'
                  aria-label='Rechercher une commande non assignée'
                />
              </InputGroup>

              <ScrollArea className='-mr-2 h-[26rem] pr-2'>
                {available.length === 0 ? (
                  <p className='text-muted-foreground py-10 text-center text-sm'>
                    Aucune commande en attente pour ce dépôt.
                  </p>
                ) : (
                  <ul className='space-y-2'>
                    {available.map(order => {
                      const checked = selected.includes(order.id)

                      return (
                        <li
                          key={order.id}
                          onClick={() =>
                            setSelected(current =>
                              checked ? current.filter(id => id !== order.id) : [...current, order.id]
                            )
                          }
                          className={cn(
                            'hover:border-primary/40 flex cursor-pointer items-start gap-3 rounded-2xl border p-3 transition-colors',
                            checked && 'border-primary/50 bg-primary/5'
                          )}
                        >
                          <span onClick={event => event.stopPropagation()}>
                            <Checkbox
                              checked={checked}
                              onCheckedChange={() =>
                                setSelected(current =>
                                  checked ? current.filter(id => id !== order.id) : [...current, order.id]
                                )
                              }
                              className='mt-0.5'
                              aria-label={`Sélectionner la commande ${order.id}`}
                            />
                          </span>

                          <div className='min-w-0 flex-1 space-y-1'>
                            <div className='flex items-center justify-between gap-2'>
                              <span className='truncate text-sm font-medium'>{order.id}</span>
                              <span className='text-muted-foreground shrink-0 text-xs tabular-nums'>
                                {order.packages} colis
                              </span>
                            </div>

                            <p className='truncate text-sm'>{order.officine}</p>
                            <p className='text-muted-foreground truncate text-xs'>{order.address}</p>
                            <p className='text-muted-foreground text-xs tabular-nums'>
                              {formatShortDate(order.date)} · {order.windowFrom} → {order.windowTo}
                            </p>
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </ScrollArea>

              <Button className='w-full gap-2' disabled={!canAdd} onClick={addSelected}>
                Ajouter la sélection
                {selected.length > 0 && <span className='tabular-nums'>({selected.length})</span>}
              </Button>
            </CardContent>
          </Card>

          {/* ── Aperçu et séquence ── */}
          <div className='min-w-0 space-y-6'>
            <Card className='gap-0 py-0'>
              <CardHeader className='flex flex-wrap items-center justify-between gap-3 px-5 pt-5'>
                <div className='min-w-0'>
                  <CardTitle className='font-heading text-base font-medium'>Aperçu de la tournée</CardTitle>
                  <p className='text-muted-foreground mt-1 text-sm'>
                    {scheduledStops.length} arrêt{scheduledStops.length > 1 ? 's' : ''} ·{' '}
                    {returnToStart ? 'Retour au dépôt' : 'Fin au dernier arrêt'}
                  </p>
                </div>

                <DropdownMenu>
                  <DropdownMenuTrigger render={<Button variant='secondary' className='gap-1.5' />}>
                    <WandSparkles className='size-4' />
                    Optimiser
                  </DropdownMenuTrigger>

                  <DropdownMenuContent align='end'>
                    <DropdownMenuItem disabled={!depotId || stops.length < 2} onClick={optimise}>
                      Réordonner par proximité
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      disabled={stops.length < 2}
                      onClick={() => setStops(current => [...current].reverse())}
                    >
                      Inverser l’ordre
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </CardHeader>

              <CardContent className='space-y-3 p-4'>
                {depotId && scheduledStops.length > 0 ? (
                  <RoutePreviewMap stops={scheduledStops} depotId={depotId} returnToStart={returnToStart} />
                ) : (
                  <EmptyState
                    icon={MapPinned}
                    title='Rien à cartographier pour l’instant'
                    hint='Choisissez un dépôt de départ et ajoutez des arrêts pour prévisualiser la tournée.'
                    padding='py-16'
                  />
                )}
              </CardContent>
            </Card>

            <Card className='gap-0 py-0'>
              <CardHeader className='flex flex-wrap items-center justify-between gap-1.5 px-5 pt-5'>
                <CardTitle className='font-heading text-base font-medium'>Séquence des arrêts</CardTitle>
                <span className='text-muted-foreground text-sm tabular-nums'>{scheduledStops.length} arrêts</span>
              </CardHeader>

              <CardContent className='p-4'>
                {scheduledStops.length === 0 ? (
                  <EmptyState
                    icon={RouteIcon}
                    title='Aucun arrêt ordonné'
                    hint='Sélectionnez des commandes dans la liste non assignée pour construire la séquence.'
                    padding='py-12'
                  />
                ) : (
                  <ul className='space-y-2'>
                    {scheduledStops.map((stop, index) => (
                      <li key={stop.id} className='flex items-start gap-3 rounded-2xl border p-3'>
                        <span className='bg-muted grid size-6 shrink-0 place-items-center rounded-full text-xs font-semibold tabular-nums'>
                          {index + 1}
                        </span>

                        <div className='min-w-0 flex-1'>
                          <div className='flex items-center justify-between gap-2'>
                            <span className='truncate text-sm font-medium'>{stop.officine}</span>
                            <span className='text-muted-foreground shrink-0 text-xs tabular-nums'>{stop.slot}</span>
                          </div>

                          <p className='text-muted-foreground truncate text-xs'>
                            {stop.city} · {stop.packages} colis · {formatWeight(stop.weightKg)} · {stop.orderId}
                          </p>
                        </div>

                        <div className='flex shrink-0 items-center gap-1'>
                          <Button
                            variant='ghost'
                            size='icon'
                            className='size-7'
                            aria-label={`Monter ${stop.officine}`}
                            disabled={index === 0}
                            onClick={() => moveStop(index, -1)}
                          >
                            <ArrowUp className='size-3.5' />
                          </Button>

                          <Button
                            variant='ghost'
                            size='icon'
                            className='size-7'
                            aria-label={`Descendre ${stop.officine}`}
                            disabled={index === scheduledStops.length - 1}
                            onClick={() => moveStop(index, 1)}
                          >
                            <ArrowDown className='size-3.5' />
                          </Button>

                          <Button
                            variant='ghost'
                            size='icon'
                            className='size-7'
                            aria-label={`Retirer ${stop.officine}`}
                            onClick={() => removeStop(stop.id)}
                          >
                            <X className='size-3.5' />
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>

          {/* ── Ressources, résumé, préparation ── */}
          <div className='space-y-6'>
            <Card className='gap-0 py-0'>
              <CardHeader className='px-5 pt-5'>
                <CardTitle className='font-heading text-base font-medium'>Affecter les ressources</CardTitle>
              </CardHeader>

              <CardContent className='p-4'>
                <FieldGroup className='grid grid-cols-1 gap-6'>
                  <Field>
                    <FieldLabel htmlFor='route-depot'>
                      Dépôt de départ <span className='text-destructive'>*</span>
                    </FieldLabel>

                    <Select
                      items={DEPOTS.map(depot => ({ label: depot.name, value: depot.id }))}
                      value={depotId ?? ''}
                      onValueChange={(value: string | null) => value && setDepotId(value as DepotId)}
                    >
                      <SelectTrigger id='route-depot' className='w-full'>
                        <SelectValue placeholder='Choisir un dépôt' />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {DEPOTS.map(depot => (
                            <SelectItem key={depot.id} value={depot.id}>
                              {depot.name}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </Field>

                  <Field>
                    <FieldLabel htmlFor='route-vehicle'>Véhicule</FieldLabel>

                    <Select
                      items={PLANNER_VEHICLES.map(unit => ({
                        label: `${unit.plate} · ${unit.car} · ${unit.driver}${
                          unit.warnings.some(isBlockingWarning) ? ' (immobilisée)' : ''
                        }`,
                        value: unit.id
                      }))}
                      value={vehicleId ?? ''}
                      onValueChange={(value: string | null) => setVehicleId(value)}
                    >
                      <SelectTrigger id='route-vehicle' className='w-full'>
                        <SelectValue placeholder='Non affecté' />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {PLANNER_VEHICLES.map(unit => (
                            <SelectItem key={unit.id} value={unit.id}>
                              {unit.plate} · {unit.car} · {unit.driver}
                              {unit.warnings.some(isBlockingWarning) && ' (immobilisée)'}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>

                    <FieldDescription>
                      {vehicle
                        ? `${vehicle.payloadKg} kg de charge utile · ${vehicle.packageSlots} colis. Le chauffeur suit le véhicule.`
                        : 'La charge et le type décident du véhicule ; son chauffeur vient avec lui.'}
                    </FieldDescription>

                    {vehicle && depotId && vehicle.depotId !== depotId && (
                      <p className='text-muted-foreground text-xs'>
                        Basé à {depotOf(vehicle.depotId).name} ; cette tournée part de {depotOf(depotId).name}.
                      </p>
                    )}

                    {vehicle?.warnings.map(warning => (
                      <p
                        key={warning}
                        className={cn(
                          'flex items-start gap-1.5 text-xs',
                          isBlockingWarning(warning) ? 'text-destructive' : 'text-warning'
                        )}
                      >
                        <TriangleAlert className='mt-0.5 size-3.5 shrink-0' />
                        {warning}
                      </p>
                    ))}
                  </Field>

                  <Field>
                    <div className='flex items-center justify-between gap-2'>
                      <FieldLabel htmlFor='route-driver'>Chauffeur</FieldLabel>

                      <Button
                        variant='link'
                        className='h-auto gap-1 p-0 text-xs'
                        nativeButton={false}
                        render={<Link href='/dashboard/logistics' />}
                      >
                        Voir dans la flotte
                      </Button>
                    </div>

                    <Input
                      id='route-driver'
                      readOnly
                      disabled
                      value={vehicle?.driver ?? ''}
                      placeholder='Sélectionnez un véhicule pour affecter son chauffeur'
                    />

                    <FieldDescription>
                      Il suit le véhicule : il se change sur la fiche de l’unité, dans la flotte.
                    </FieldDescription>
                  </Field>

                  <Field>
                    <FieldLabel htmlFor='route-date'>
                      Date de tournée <span className='text-destructive'>*</span>
                    </FieldLabel>

                    {/* The native picker follows the browser's locale, and Chromium
                        ignores lang on a date input: on an en-US machine the field
                        reads 09/24/2026 next to dates written "24 sept.". The
                        attribute still helps the browsers that honour it, and the
                        line below spells the day out in French whatever the browser
                        decides. */}
                    <Input
                      id='route-date'
                      type='date'
                      lang='fr'
                      value={date}
                      onChange={event => setDate(event.target.value)}
                      className='justify-between'
                    />

                    <FieldDescription className='tabular-nums'>
                      {date ? formatRouteDate(date) : 'Aucune date choisie'}
                    </FieldDescription>
                  </Field>

                  <Field>
                    <FieldLabel htmlFor='route-start'>
                      Heure de départ <span className='text-destructive'>*</span>
                    </FieldLabel>

                    <Input
                      id='route-start'
                      type='time'
                      lang='fr'
                      value={startAt}
                      onChange={event => setStartAt(event.target.value)}
                    />
                  </Field>

                  <Field orientation='horizontal' className='items-center justify-between'>
                    <FieldLabel htmlFor='route-return'>Retour au dépôt</FieldLabel>

                    <Switch
                      id='route-return'
                      checked={returnToStart}
                      onCheckedChange={setReturnToStart}
                      aria-label='Revenir au dépôt de départ'
                    />
                  </Field>

                  <Field>
                    <FieldLabel htmlFor='route-notes'>Consignes de dispatch</FieldLabel>

                    <Textarea
                      id='route-notes'
                      rows={3}
                      maxLength={500}
                      value={notes}
                      onChange={event => setNotes(event.target.value)}
                      placeholder='Tout ce que le chauffeur doit savoir avant le départ'
                    />

                    <FieldDescription className='tabular-nums'>{notes.length} / 500</FieldDescription>
                  </Field>
                </FieldGroup>
              </CardContent>
            </Card>

            <Card className='gap-0 py-0'>
              <CardHeader className='px-5 pt-5'>
                <CardTitle className='font-heading text-base font-medium'>Résumé de la tournée</CardTitle>
              </CardHeader>

              <CardContent className='space-y-4 p-4 text-sm'>
                <dl className='space-y-3'>
                  {[
                    { label: 'Arrêts', value: String(figures.stops) },
                    { label: 'Distance', value: figures.stops > 0 ? formatKm(figures.distanceKm) : '—' },
                    { label: 'Durée', value: figures.stops > 0 ? formatDuration(figures.durationMinutes) : '—' },
                    { label: 'Fin estimée', value: figures.endAt ?? '—' },
                    { label: 'Colis', value: String(figures.packages) },
                    { label: 'Poids', value: formatWeight(figures.weightKg) }
                  ].map(line => (
                    <div key={line.label} className='flex items-baseline justify-between gap-4'>
                      <dt className='text-muted-foreground'>{line.label}</dt>
                      <dd className='min-w-0 truncate text-right font-medium tabular-nums'>{line.value}</dd>
                    </div>
                  ))}
                </dl>

                <Separator />

                <div className='space-y-2'>
                  <div className='flex items-baseline justify-between gap-4'>
                    <span className='text-muted-foreground'>Capacité utilisée</span>
                    <span className='font-medium tabular-nums'>
                      {figures.capacityPercent === null ? 'Aucun véhicule' : `${figures.capacityPercent.toFixed(0)} %`}
                    </span>
                  </div>

                  <Progress
                    value={figures.capacityPercent ?? 0}
                    aria-label='Capacité utilisée du véhicule'
                    className={cn(
                      '**:data-[slot=progress-track]:h-2',
                      (figures.capacityPercent ?? 0) > 100 && '**:data-[slot=progress-indicator]:bg-destructive'
                    )}
                  />

                  <p className='text-muted-foreground text-xs'>{figures.capacityLabel}</p>

                  {(figures.capacityPercent ?? 0) > 100 && (
                    <p className='text-destructive text-xs'>
                      Le chargement dépasse la capacité du véhicule : retirez des arrêts ou prenez une unité plus
                      grande.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className='gap-0 py-0'>
              <CardHeader className='flex flex-wrap items-center justify-between gap-1.5 px-5 pt-5'>
                <CardTitle className='font-heading text-base font-medium'>Préparation</CardTitle>
                <Badge
                  variant='default'
                  className={cn(
                    'border-0',
                    readyCount === 5 ? 'bg-success-soft text-success' : 'bg-muted text-muted-foreground'
                  )}
                >
                  {readyCount} / 5
                </Badge>
              </CardHeader>

              <CardContent className='p-4 text-sm'>
                <ul className='space-y-2'>
                  {readiness.map(item => (
                    <li key={item.label} className='flex items-center gap-2'>
                      {item.done ? (
                        <Check className='text-success size-4 shrink-0' />
                      ) : (
                        <Circle className='text-muted-foreground size-4 shrink-0' />
                      )}
                      <span className={item.done ? undefined : 'text-muted-foreground'}>{item.label}</span>
                    </li>
                  ))}
                </ul>{' '}
                {blockingWarning && (
                  <p className='text-destructive mt-4 text-xs'>
                    {vehicle?.id} est immobilisée ({blockingWarning.toLowerCase()}) : affectez une autre unité, ou
                    gardez la tournée en brouillon.
                  </p>
                )}
                {readyCount < 5 && (
                  <p className='text-muted-foreground mt-4 text-xs'>
                    Les cinq points doivent être remplis pour expédier la tournée. Un brouillon peut être enregistré à
                    tout moment.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
