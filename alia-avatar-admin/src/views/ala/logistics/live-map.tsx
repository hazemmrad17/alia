'use client'

// ──────────────────────────────────────────────
// Carte live — où est la force de vente, maintenant
//
// The operational board over the same field force the Flotte & tournées page
// analyses: each unit drawn where it actually is, its circuit, and the delay it
// has accumulated. The overview answers "how is the fleet doing"; this answers
// "where is VITAL-06 right now, and what do I tell the pharmacist waiting for
// her".
//
// Where the data comes from: src/lib/fleet-data.ts, the same registry as the
// overview — units, circuits and delays are that seed, and the city coordinates
// added alongside it are what puts a unit on the map. The backend has no fleet
// model yet, so a `GET /api/v1/fleet/units` replaces the registry and this page
// follows it for free.
//
// Why MapLibre and CARTO: they need no API key, and MapLibre keeps the
// attribution control CARTO and OpenStreetMap require. The basemap is fetched
// at runtime, so this page needs internet — without it the tiles stay blank
// while the pins, circuits and figures still draw, which is the failure mode to
// expect on a locked-down network.
// ──────────────────────────────────────────────

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import Link from 'next/link'
import { createRoot, type Root } from 'react-dom/client'

// Named imports: maplibre-gl v6 has no default export, and `Map` is aliased
// because the global Map is a different thing entirely.
import type { GeoJSONSource } from 'maplibre-gl'
import { LngLatBounds, Map as MapLibreMap, Marker, setWorkerUrl } from 'maplibre-gl'
import { useTheme } from 'next-themes'
import type { Feature, FeatureCollection, LineString } from 'geojson'
import {
  ArrowRight,
  Bell,
  CheckCheck,
  Clock3,
  ListFilter,
  LocateFixed,
  Minus,
  PackageOpen,
  Plus,
  RefreshCw,
  Route,
  Search,
  ShieldCheck,
  Store,
  Truck,
  User,
  Wrench,
  type LucideIcon
} from 'lucide-react'

import 'maplibre-gl/dist/maplibre-gl.css'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { ACCOUNT_ROLE_LABELS, getCurrentUser, workspaceFor } from '@/lib/auth'
import { clearRoadPathCache, roadPathForLeg } from '@/lib/road-snap'
import {
  currentStop,
  DELAY_THRESHOLD_MIN,
  delayedUnits,
  FLEET_UNITS,
  fleetTotals,
  formatDelay,
  formatMinutes,
  remainingCircuitKm,
  STATE_LABELS,
  stopEta,
  unitCircuitPath,
  unitPosition,
  type FleetState,
  type FleetUnit
} from '@/lib/fleet-data'
import { cn } from '@/lib/utils'

// CARTO's keyless basemaps. Two styles so the map belongs to the theme it is
// rendered in instead of glowing white inside a dark shell.
const BASEMAPS = {
  light: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
  dark: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'
}

/** Tunisia, roughly centred, zoomed so the whole field force is one screen. */
const TUNISIA_CENTER: [number, number] = [10.15, 35.6]
const INITIAL_ZOOM = 6

/**
 * Where MapLibre's worker is served from. Left to itself MapLibre looks for the
 * worker next to the bundle it was compiled into — a path inside
 * /_next/static/chunks that the bundler never writes — and the worker fails to
 * load. Tiles are parsed *in* that worker, so the failure shows up as a basemap
 * that never paints rather than as an obvious error. The files are copied there
 * by scripts/sync-map-worker.mjs on every dev and build start.
 */
const MAP_WORKER_URL = '/maplibre/maplibre-gl-worker.mjs'

type SortKey = 'delay' | 'state' | 'delegate' | 'progress'

/** What one circuit line carries into the map layer. */
type CircuitProperties = { id: string; color: string; selected: boolean }

const SORT_LABELS: Record<SortKey, string> = {
  delay: 'Retard',
  state: 'Statut',
  delegate: 'Délégué',
  progress: 'Avancement'
}

/**
 * One entry per fleet state: the icon, and every colour that state is drawn in —
 * the soft chip, the solid marker, the legend swatch and the map line.
 *
 * The classes are the theme's semantic status tokens (`--info`, `--success`,
 * `--warning`, defined in globals.css), so "en retard" is the same amber here as
 * it is anywhere else rather than a palette shade picked per page.
 *
 * `hex` is the exception, and not a duplicate for nothing: MapLibre paints on a
 * canvas and cannot read a CSS variable, so the colour has to exist as a literal.
 * It holds the same value as the token it sits beside, which is why every colour
 * a state has lives in this one record and cannot drift between the pin, the
 * circuit and the legend that explains them.
 */
const STATE_META: Record<FleetState, { icon: LucideIcon; chip: string; pin: string; line: string; hex: string }> = {
  en_route: { icon: Truck, chip: 'bg-info-soft text-info', pin: 'bg-info text-white', line: 'bg-info', hex: '#0284c7' },
  en_visite: {
    icon: Store,
    chip: 'bg-success-soft text-success',
    pin: 'bg-success text-white',
    line: 'bg-success',
    hex: '#16a34a'
  },
  chargement: {
    icon: PackageOpen,
    chip: 'bg-muted text-muted-foreground',
    pin: 'bg-gray-600 text-white',
    line: 'bg-gray-600 dark:bg-gray-400',
    hex: '#64748b'
  },
  attente: {
    icon: Clock3,
    chip: 'bg-warning-soft text-warning',
    pin: 'bg-warning text-white',
    line: 'bg-warning',
    hex: '#d97706'
  },
  immobilise: {
    icon: Wrench,
    chip: 'bg-destructive/10 text-destructive',
    pin: 'bg-destructive text-white',
    line: 'bg-destructive',
    hex: '#dc2626'
  }
}

/** States as the legend lists them: the working ones, then the stopped unit. */
const LEGEND_ORDER: FleetState[] = ['en_route', 'en_visite', 'chargement', 'attente', 'immobilise']

const isLate = (unit: FleetUnit) => unit.state !== 'immobilise' && unit.delayMinutes >= DELAY_THRESHOLD_MIN

/** A KPI tile: figure, context, and a tinted icon chip — the overview's anatomy. */
const StatCard = ({
  label,
  value,
  hint,
  icon: Icon,
  chip
}: {
  label: string
  value: string | number
  hint: string
  icon: LucideIcon
  chip: string
}) => (
  <Card size='sm'>
    <CardContent className='flex items-start justify-between gap-3'>
      <div className='min-w-0'>
        <p className='text-sm font-medium'>{label}</p>
        <p className='mt-1 truncate text-3xl font-bold tabular-nums'>{value}</p>
        <p className='text-muted-foreground mt-1 truncate text-xs'>{hint}</p>
      </div>
      <span className={cn('grid size-10 shrink-0 place-items-center rounded-xl [&>svg]:size-5', chip)}>
        <Icon />
      </span>
    </CardContent>
  </Card>
)

/**
 * The pin of one unit. React, not an HTML string, so it can reuse the same
 * Lucide icon and the same Tailwind classes as the rest of the app — a marker is
 * a DOM element MapLibre owns, so the child is mounted into its own root.
 */
const UnitPin = ({
  unit,
  selected,
  onSelect
}: {
  unit: FleetUnit
  selected: boolean
  onSelect: (id: string) => void
}) => {
  const meta = STATE_META[unit.state]
  const Icon = meta.icon

  // The heartbeat halo is the selection cue, exactly as the board draws it: the
  // animation paints the glow, so a Tailwind ring must not be added on top of it.
  const halo = selected ? ({ '--heartbeat-color': `${meta.hex}40` } as React.CSSProperties) : undefined

  return (
    <button
      type='button'
      onClick={() => onSelect(unit.id)}
      aria-label={`${unit.id} — ${unit.delegate}, ${STATE_LABELS[unit.state]}`}
      className={cn(
        'relative grid place-items-center rounded-full border-2 border-white shadow-md transition-transform',
        meta.pin,
        selected ? 'animate-heartbeat size-10' : 'size-8 hover:scale-110'
      )}
      style={halo}
    >
      <Icon className={selected ? 'size-5' : 'size-4'} />
      {isLate(unit) && (
        <span className='bg-warning absolute -top-2.5 -right-5 rounded-full border border-white px-1.5 py-0.5 text-[10px] leading-none font-semibold text-white'>
          +{unit.delayMinutes}m
        </span>
      )}
    </button>
  )
}

/**
 * The map itself. It owns the MapLibre instance and the pins, and hands the
 * instance back up through `mapRef` so the toolbar can recentre or zoom it.
 */
const FleetMap = ({
  units,
  selectedId,
  onSelect,
  mapRef,
  theme
}: {
  units: FleetUnit[]
  selectedId: string | null
  onSelect: (id: string) => void
  mapRef: React.RefObject<MapLibreMap | null>
  theme: 'light' | 'dark'
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const pinsRef = useRef<Array<{ marker: Marker; root: Root }>>([])

  // Create the map once. Later effects move it; this one only builds it.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    // Debug handle for the preview harness: lets tooling reach the instance
    // without a React ref chain. Harmless in production.
    if (typeof window !== 'undefined') {
      ;(window as unknown as Record<string, unknown>).__fleetMap = mapRef
    }

    // Must happen before the map is created: the worker pool is built with the
    // first tile request.
    setWorkerUrl(MAP_WORKER_URL)

    const map = new MapLibreMap({
      container: containerRef.current,
      style: BASEMAPS[theme],
      center: TUNISIA_CENTER,
      zoom: INITIAL_ZOOM,

      // CARTO and OpenStreetMap require the credit, so the control stays on.
      attributionControl: { compact: true }
    })

    mapRef.current = map

    return () => {
      map.remove()
      mapRef.current = null
    }

    // The basemap is re-applied by the style effect below, so it is deliberately
    // not a dependency here: rebuilding the map on a theme change would throw
    // away the position the user was looking at.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapRef])

  // Follow the theme without rebuilding the map.
  useEffect(() => {
    // A new style renders new road geometry, so every cached leg is stale.
    clearRoadPathCache()

    mapRef.current?.setStyle(BASEMAPS[theme])
  }, [theme, mapRef])

  // Draw each circuit. Called after every style load — a new style drops the
  // sources and layers with the old one, and the road geometry it rendered —
  // and whenever the filter changes.
  const drawCircuits = useCallback(() => {
    const map = mapRef.current

    if (!map || !map.isStyleLoaded()) return

    const features: Array<Feature<LineString, CircuitProperties>> = []

    units.forEach(unit => {
      const stops = unitCircuitPath(unit)

      // A circuit of one stop has nothing to draw.
      if (stops.length < 2) return

      // Each leg hugs the roads the basemap renders; a leg whose walk fails
      // (style not ready, dead end, no road within reach) keeps the straight
      // line so no circuit is ever lost from the map.
      const path: Array<[number, number]> = [stops[0]]

      for (let index = 1; index < stops.length; index += 1) {
        const snapped = roadPathForLeg(map, stops[index - 1], stops[index])

        if (snapped) path.push(...snapped.slice(1))
        else path.push(stops[index])
      }

      features.push({
        type: 'Feature',
        properties: { id: unit.id, color: STATE_META[unit.state].hex, selected: unit.id === selectedId },
        geometry: { type: 'LineString', coordinates: path }
      })
    })

    const collection: FeatureCollection<LineString, CircuitProperties> = { type: 'FeatureCollection', features }

    const existing = map.getSource('circuits') as GeoJSONSource | undefined

    if (existing) {
      existing.setData(collection)

      return
    }

    map.addSource('circuits', { type: 'geojson', data: collection })
    map.addLayer({
      id: 'circuits',
      type: 'line',
      source: 'circuits',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': ['get', 'color'],
        'line-width': ['case', ['get', 'selected'], 4, 2],
        'line-opacity': 0.8,

        // Dashed: this is the planned circuit, not a recorded track.
        'line-dasharray': [2, 1.5]
      }
    })
  }, [units, selectedId, mapRef])

  useEffect(() => {
    const map = mapRef.current

    if (!map) return

    const onStyleLoad = () => drawCircuits()

    map.on('style.load', onStyleLoad)

    return () => {
      map.off('style.load', onStyleLoad)
    }
  }, [drawCircuits, mapRef])

  useEffect(() => {
    drawCircuits()
  }, [drawCircuits])

  // queryRenderedFeatures only sees geometry the viewport is currently drawing,
  // so a leg can only be snapped while both its cities are on screen. As the
  // user pans and zooms, more legs become snappable — and each result is
  // cached, so the map progressively upgrades to full road-following circuits
  // as it is explored. A move-end that snaps nothing new does not re-set the
  // source data, so panning stays cheap.
  useEffect(() => {
    const map = mapRef.current

    if (!map) return

    let timer: ReturnType<typeof setTimeout> | null = null

    const onMoveEnd = () => {
      if (timer) clearTimeout(timer)

      timer = setTimeout(() => {
        if (!map.isStyleLoaded()) return

        // Cheap probe: would any unit's path improve?
        let improved = false

        units.forEach(unit => {
          const stops = unitCircuitPath(unit)

          for (let index = 1; index < stops.length && !improved; index += 1) {
            if (!roadPathForLeg(map, stops[index - 1], stops[index])) improved = true
          }
        })

        if (improved) drawCircuits()
      }, 250)
    }

    map.on('moveend', onMoveEnd)

    return () => {
      map.off('moveend', onMoveEnd)

      if (timer) clearTimeout(timer)
    }
  }, [drawCircuits, units, mapRef])

  // Pins are re-created whenever the visible set or the selection changes: eight
  // markers is not worth a diffing pass.
  useEffect(() => {
    const map = mapRef.current

    if (!map) return

    // React 19 cannot unmount a root synchronously while a render is in flight
    // (the effect re-runs on selection, i.e. mid-render), so each unmount is
    // pushed to the next task; the marker itself — plain MapLibre state — is
    // removed immediately.
    const releasePins = () => {
      pinsRef.current.forEach(({ marker, root }) => {
        setTimeout(() => root.unmount(), 0)
        marker.remove()
      })
      pinsRef.current = []
    }

    releasePins()

    units.forEach(unit => {
      const position = unitPosition(unit)

      if (!position) return

      const element = document.createElement('div')
      const root = createRoot(element)

      root.render(<UnitPin unit={unit} selected={unit.id === selectedId} onSelect={onSelect} />)

      const marker = new Marker({ element, anchor: 'center' }).setLngLat([position.lng, position.lat]).addTo(map)

      pinsRef.current.push({ marker, root })
    })

    return () => {
      releasePins()
    }
  }, [units, selectedId, onSelect, mapRef])

  return <div ref={containerRef} className='size-full' />
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function LiveMapView({ initialUnit }: { initialUnit?: string }) {
  // Read once: the account only changes when someone signs out.
  const me = useMemo(() => getCurrentUser(), [])
  const { resolvedTheme } = useTheme()
  const mapRef = useRef<MapLibreMap | null>(null)

  // `?unit=VITAL-06` from the operations overview: the map opens on the unit
  // running the visit that was opened. A name the registry does not know is
  // ignored, and the page frames the whole force as it always does.
  const focus = useMemo(
    () => (initialUnit && FLEET_UNITS.some(unit => unit.id === initialUnit) ? initialUnit : null),
    [initialUnit]
  )

  const [query, setQuery] = useState('')
  const [stateFilter, setStateFilter] = useState<FleetState | 'all'>('all')
  const [sortKey, setSortKey] = useState<SortKey>('delay')
  const [selectedId, setSelectedId] = useState<string | null>(focus ?? FLEET_UNITS[0]?.id ?? null)

  const totals = useMemo(() => fleetTotals(), [])
  const late = useMemo(() => delayedUnits(), [])
  const sectors = useMemo(() => new Set(FLEET_UNITS.map(unit => unit.sector)).size, [])

  /** The unit the banner is about: the most delayed one, if any. */
  const lead = late[0] ?? null
  const leadStop = lead ? currentStop(lead) : null

  const visibleUnits = useMemo(() => {
    const wanted = query.trim().toLowerCase()

    const filtered = FLEET_UNITS.filter(unit => {
      if (stateFilter !== 'all' && unit.state !== stateFilter) return false
      if (!wanted) return true

      const stop = currentStop(unit)

      const haystack = [unit.id, unit.delegate, unit.sector, unit.plate, stop?.name ?? '', stop?.city ?? '']
        .join(' ')
        .toLowerCase()

      return haystack.includes(wanted)
    })

    return [...filtered].sort((a, b) => {
      if (sortKey === 'delay') return b.delayMinutes - a.delayMinutes
      if (sortKey === 'delegate') return a.delegate.localeCompare(b.delegate, 'fr')
      if (sortKey === 'state') return STATE_LABELS[a.state].localeCompare(STATE_LABELS[b.state], 'fr')

      const done = (unit: FleetUnit) => unit.stops.filter(stop => stop.state === 'terminee').length

      return done(b) - done(a)
    })
  }, [query, stateFilter, sortKey])

  /** Frame every unit currently on the board. */
  const recenter = useCallback(() => {
    const map = mapRef.current
    const points = visibleUnits.map(unitPosition).filter(position => position !== null)

    if (!map || points.length === 0) return

    if (points.length === 1) {
      map.flyTo({ center: [points[0].lng, points[0].lat], zoom: 11, duration: 700 })

      return
    }

    const bounds = new LngLatBounds()

    points.forEach(position => bounds.extend([position.lng, position.lat]))
    map.fitBounds(bounds, { padding: 80, maxDuration: 900, maxZoom: 10 })
  }, [visibleUnits])

  const select = useCallback((id: string) => {
    setSelectedId(id)

    const unit = FLEET_UNITS.find(candidate => candidate.id === id)
    const position = unit ? unitPosition(unit) : null

    if (position) mapRef.current?.flyTo({ center: [position.lng, position.lat], zoom: 11, duration: 700 })
  }, [])

  // Frame the fleet once the map has its first style, so the page opens on the
  // whole force rather than on an arbitrary centre — or on one unit, when the
  // operations overview asked for it.
  useEffect(() => {
    const map = mapRef.current

    if (!map) return

    const onFirstLoad = () => (focus ? select(focus) : recenter())

    map.on('load', onFirstLoad)

    return () => {
      map.off('load', onFirstLoad)
    }
  }, [recenter, select, focus])

  // The field force is the platform's view. The nav item is absent from a
  // doctor's and a delegate's navbar; this covers typing the URL, and matches how
  // /admin/accounts answers the same situation.
  if (me && workspaceFor(me.role) !== 'admin') {
    return (
      <div className='col-span-full'>
        <Card>
          <CardContent className='flex flex-col gap-2 py-6'>
            <span className='flex items-center gap-2 text-lg font-semibold'>
              <ShieldCheck className='text-muted-foreground size-5' /> Accès restreint
            </span>
            <p className='text-muted-foreground text-sm'>
              La carte live est réservée aux administrateurs. Votre rôle ({ACCOUNT_ROLE_LABELS[me.role]}) n’y a pas
              accès.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className='space-y-6'>
      {/* Header */}
      <div className='flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between'>
        <div>
          <h1 className='text-3xl font-bold tracking-tight'>Carte live</h1>
          <p className='text-muted-foreground mt-1 text-sm'>
            Suivez les unités en tournée, leurs circuits et les retards à traiter, en temps réel.
          </p>
        </div>
        <div className='flex flex-wrap gap-2'>
          <Button
            variant='secondary'
            size='sm'
            className='gap-2'
            onClick={() => {
              setQuery('')
              setStateFilter('all')
              recenter()
            }}
          >
            <RefreshCw className='size-4' /> Actualiser
          </Button>
          <Button
            size='sm'
            className='gap-2'
            nativeButton={false}
            render={<Link href='/dashboard/logistics/route-planner' />}
          >
            <Route className='size-4' /> Planificateur de tournées
          </Button>
        </div>
      </div>

      {/* Figures */}
      <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
        <StatCard
          label='Unités actives'
          value={totals.units}
          hint={`${sectors} secteurs couverts`}
          icon={Truck}
          chip='bg-info-soft text-info'
        />
        <StatCard
          label='En tournée'
          value={totals.moving}
          hint='Hors dépôt et hors atelier'
          icon={Route}
          chip='bg-success-soft text-success'
        />
        <StatCard
          label='En retard'
          value={late.length}
          hint={`Plus de ${DELAY_THRESHOLD_MIN} min de retard`}
          icon={Clock3}
          chip='bg-warning-soft text-warning'
        />
        <StatCard
          label='Alertes'
          value={totals.alerts}
          hint='Alertes opérationnelles ouvertes'
          icon={Bell}
          chip='bg-destructive/10 text-destructive'
        />
      </div>

      {/* The unit that needs a phone call */}
      {lead ? (
        <Card className='flex-row flex-wrap items-center justify-between gap-x-4 gap-y-6 p-4'>
          <div className='flex items-center gap-2'>
            <Truck className='text-muted-foreground size-4' />
            <span className='text-sm font-semibold'>{lead.id}</span>
          </div>
          <div className='flex items-center gap-2'>
            <User className='text-muted-foreground size-4' />
            <span className='text-sm'>{lead.delegate}</span>
          </div>
          <Badge className={cn('rounded-sm border-none', STATE_META[lead.state].chip)}>
            {STATE_LABELS[lead.state]}
          </Badge>
          <div>
            <p className='text-muted-foreground text-xs'>Prochain arrêt</p>
            <p className='text-sm font-semibold'>
              {leadStop ? leadStop.name : '—'}
              {leadStop ? `, ${leadStop.city}` : ''}
            </p>
          </div>
          <div>
            <p className='text-muted-foreground text-xs'>ETA</p>
            <p className='text-sm font-semibold'>{stopEta(lead, leadStop) ?? '—'}</p>
          </div>
          <div>
            <p className='text-muted-foreground text-xs'>Dans cet état depuis</p>
            <p className='text-sm font-semibold'>{formatMinutes(lead.minutesInState)}</p>
          </div>
          <div>
            <p className='text-muted-foreground text-xs'>Distance restante</p>
            <p className='text-sm font-semibold'>{remainingCircuitKm(lead)} km</p>
          </div>
          <div>
            <p className='text-muted-foreground text-xs'>Arrêts terminés</p>
            <p className='text-sm font-semibold'>
              {lead.stops.filter(stop => stop.state === 'terminee').length} sur {lead.stops.length}
            </p>
          </div>
          <div>
            <p className='text-muted-foreground text-xs'>Alertes de retard</p>
            <p className='text-warning text-sm font-semibold'>{formatDelay(lead.delayMinutes)}</p>
          </div>
          <Button
            variant='outline'
            size='sm'
            className='gap-1.5'
            nativeButton={false}
            render={<Link href='/dashboard/logistics' />}
          >
            Voir la tournée <ArrowRight className='size-4' />
          </Button>
        </Card>
      ) : (
        <Card className='flex-row flex-wrap items-center justify-between gap-4 p-4'>
          <div className='flex items-center gap-2'>
            <CheckCheck className='text-success size-4' />
            <span className='text-sm font-semibold'>Aucun retard à traiter</span>
          </div>
          <p className='text-muted-foreground text-sm'>Toutes les unités en service sont dans les délais planifiés.</p>
        </Card>
      )}

      {/* Board */}
      <div className='grid gap-6 md:grid-cols-[340px_minmax(0,1fr)]'>
        {/* Fleet list */}
        <Card className='h-[560px] gap-0 overflow-hidden py-0 md:h-[702px]'>
          <CardHeader className='space-y-3 border-b p-4'>
            <CardTitle className='text-base font-semibold'>Flotte active</CardTitle>
            <div className='flex items-center gap-2'>
              <InputGroup className='flex-1'>
                <InputGroupAddon>
                  <Search />
                </InputGroupAddon>
                <InputGroupInput
                  value={query}
                  onChange={event => setQuery(event.target.value)}
                  placeholder='Rechercher une unité…'
                  aria-label='Rechercher une unité, un délégué ou un arrêt'
                />
              </InputGroup>
              <Select value={stateFilter} onValueChange={value => setStateFilter(value as FleetState | 'all')}>
                <SelectTrigger size='sm' className='w-36 shrink-0' aria-label='Filtrer par statut'>
                  <SelectValue>
                    {(value: string) =>
                      value === 'all' ? 'Tous les statuts' : (STATE_LABELS[value as FleetState] ?? 'Tous les statuts')
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='all'>
                    <ListFilter className='size-4' /> Tous les statuts
                  </SelectItem>
                  {LEGEND_ORDER.map(state => (
                    <SelectItem key={state} value={state}>
                      {STATE_LABELS[state]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className='flex items-center justify-between'>
              <p className='text-muted-foreground text-xs'>
                {visibleUnits.length} unité{visibleUnits.length > 1 ? 's' : ''} sur {FLEET_UNITS.length}
              </p>
              <Select value={sortKey} onValueChange={value => setSortKey(value as SortKey)}>
                <SelectTrigger size='sm' className='w-32' aria-label='Trier les unités'>
                  <SelectValue>{(value: string) => `Tri : ${SORT_LABELS[value as SortKey]}`}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(SORT_LABELS) as SortKey[]).map(key => (
                    <SelectItem key={key} value={key}>
                      {SORT_LABELS[key]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>

          <CardContent className='min-h-0 flex-1 p-0'>
            {visibleUnits.length === 0 ? (
              <p className='text-muted-foreground p-4 text-sm'>Aucune unité ne correspond à ce filtre.</p>
            ) : (
              <ScrollArea className='h-full'>
                <div className='divide-border divide-y'>
                  {visibleUnits.map(unit => {
                    const stop = currentStop(unit)
                    const meta = STATE_META[unit.state]
                    const Icon = meta.icon
                    const active = unit.id === selectedId
                    const done = unit.stops.filter(candidate => candidate.state === 'terminee').length

                    return (
                      <button
                        key={unit.id}
                        type='button'
                        onClick={() => select(unit.id)}
                        className={cn(
                          'hover:bg-muted/50 block w-full p-4 pl-5 text-left transition-colors',
                          active && 'bg-muted/50 border-primary border-l-4'
                        )}
                      >
                        <div className='flex items-start justify-between gap-3'>
                          <div className='flex items-start gap-3'>
                            <Icon className='text-muted-foreground mt-0.5 size-4 shrink-0' />
                            <div className='space-y-0.5'>
                              <p className='text-sm font-semibold'>{unit.id}</p>
                              <p className='text-muted-foreground text-xs'>{unit.delegate}</p>
                              <p className='text-muted-foreground text-xs'>
                                {stop ? `Prochain arrêt : ${stop.name}, ${stop.city}` : `${done} arrêts terminés`}
                              </p>
                            </div>
                          </div>
                          <div className='shrink-0 text-right'>
                            <Badge className={cn('rounded-sm border-none', meta.chip)}>
                              {STATE_LABELS[unit.state]}
                            </Badge>
                            <p className='mt-1 text-xs font-semibold'>{stopEta(unit, stop) ?? '—'}</p>
                            {unit.delayMinutes > 0 && (
                              <p className='text-destructive text-xs font-semibold'>{formatDelay(unit.delayMinutes)}</p>
                            )}
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </ScrollArea>
            )}
          </CardContent>

          <div className='shrink-0 border-t p-2'>
            <Button
              variant='ghost'
              size='sm'
              className='w-full justify-between'
              nativeButton={false}
              render={<Link href='/dashboard/logistics' />}
            >
              Voir toutes les unités <ArrowRight className='size-4' />
            </Button>
          </div>
        </Card>

        {/* Map */}
        <Card className='relative h-[560px] overflow-hidden p-0 md:h-[702px]'>
          <FleetMap
            units={visibleUnits}
            selectedId={selectedId}
            onSelect={select}
            mapRef={mapRef}
            theme={resolvedTheme === 'dark' ? 'dark' : 'light'}
          />

          <div className='absolute top-4 right-4 z-10 flex flex-col gap-2'>
            <Button
              variant='outline'
              size='icon'
              className='bg-background size-9 shadow'
              aria-label='Recentrer la carte'
              onClick={recenter}
            >
              <LocateFixed className='size-4' />
            </Button>
          </div>

          <div className='absolute right-2 bottom-10 z-10 flex flex-col overflow-hidden rounded-md border shadow-sm'>
            <button
              type='button'
              aria-label='Zoom avant'
              onClick={() => mapRef.current?.zoomIn()}
              className='bg-background hover:bg-accent flex size-8 items-center justify-center border-b'
            >
              <Plus className='size-4' />
            </button>
            <button
              type='button'
              aria-label='Zoom arrière'
              onClick={() => mapRef.current?.zoomOut()}
              className='bg-background hover:bg-accent flex size-8 items-center justify-center'
            >
              <Minus className='size-4' />
            </button>
          </div>

          {/* Legend. Reads its colours from STATE_META, so a pin and its line can
              never be a different colour from the key that explains them. */}
          <div className='bg-background absolute bottom-4 left-4 z-10 space-y-2 rounded-lg border p-3 text-xs shadow'>
            {LEGEND_ORDER.map(state => (
              <div key={state} className='flex items-center gap-2'>
                <span className={cn('h-0.5 w-4 rounded-full', STATE_META[state].line)} />
                <span className='text-muted-foreground'>{STATE_LABELS[state]}</span>
              </div>
            ))}
            <p className='text-muted-foreground border-t pt-2 text-[11px]'>
              Circuits planifiés · positions mises à jour à la dernière remontée
            </p>
          </div>
        </Card>
      </div>

      <Separator />
      <p className='text-muted-foreground text-xs'>
        Positions issues du registre flotte interne (seed) : le suivi GPS n’est pas encore branché. Les distances sont
        estimées à vol de route, pas mesurées par un moteur d’itinéraire.
      </p>
    </div>
  )
}
