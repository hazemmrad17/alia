// ──────────────────────────────────────────────
// Road snapping from the rendered basemap
//
// The live map's circuits used to be straight lines between city centres — a
// taut string across the country, wearing a dashed coat. This module rebuilds
// each leg as a polyline that follows the roads the basemap already renders, so
// the line a dispatcher sees is the road a van drives.
//
// How it works, honestly: MapLibre holds the rendered geometry of every layer.
// The CARTO styles draw roads in layers whose id contains "road" (road,
// road_major, road_minor…, plus bridges and tunnels). We pull that geometry with
// queryRenderedFeatures, gather every road segment into a graph keyed by
// rounding the endpoints, and walk it greedily from the leg's start toward its
// end — always taking the candidate edge that most reduces the remaining
// straight-line distance, with a hard cap on total detour.
//
// What this is not: a routing engine. Service tracks too thin for the basemap,
// one-way subtleties, turn restrictions — none of it is modelled. The walk can
// dead-end or detour through a parallel street. When it does, the caller falls
// back to the straight line it drew before, so the map never loses a circuit.
// The kilometre figures stay estimates for the same reason.
//
// Results are cached per leg: the road network does not move between renders,
// only a style swap invalidates it (a new style renders new geometry), and the
// live map clears the cache on style.load.
// ──────────────────────────────────────────────

import type { Map as MapLibreMap } from 'maplibre-gl'

type LngLat = [number, number]

/** Two coordinates are the same graph node below this many degrees (~11 m). */
const NODE_EPSILON = 0.0001

/** Nearest-road search radius, in degrees, around each leg endpoint (~1.1 km). */
const ENDPOINT_RADIUS = 0.01

/**
 * A leg longer than this many times its straight-line distance has wandered —
 * the walk is lost in a ring road. Past that we give up and the caller falls
 * back to the straight line.
 */
const MAX_DETOUR_FACTOR = 2.5

/** Safeguard against pathological graphs: walk at most this many edges. */
const MAX_EDGES = 4000

interface RoadNode {
  coord: LngLat

  /** Node keys this one connects to, with each edge's length in degrees. */
  edges: Map<string, number>
}

/** The key a coordinate hashes to: endpoints rounded hard enough to merge. */
function nodeKey(coord: LngLat): string {
  return `${Math.round(coord[0] / NODE_EPSILON)}:${Math.round(coord[1] / NODE_EPSILON)}`
}

function distance(a: LngLat, b: LngLat): number {
  const dx = a[0] - b[0]
  const dy = a[1] - b[1]

  return Math.hypot(dx, dy)
}

/**
 * Nearest node to a point, or null when nothing rendered lies within radius.
 * Endpoints are city centres, which the road network does not pass through
 * exactly, so both ends of a leg are snapped to their closest street.
 */
function nearestNode(nodes: Map<string, RoadNode>, point: LngLat): string | null {
  let best: string | null = null
  let bestDistance = ENDPOINT_RADIUS

  for (const [key, node] of nodes) {
    const d = distance(node.coord, point)

    if (d < bestDistance) {
      best = key
      bestDistance = d
    }
  }

  return best
}

/**
 * Every road segment the basemap currently renders, as a node graph. Rendered
 * features are already tiled and clipped, so a long road arrives as many short
 * segments — which is exactly what a greedy walk wants.
 */
function buildRoadGraph(map: MapLibreMap): Map<string, RoadNode> | null {
  // The CARTO styles name their road layers with "road" in the id; bridges and
  // tunnels are roads too and carry the same convention.
  const layers = map
    .getStyle()
    .layers?.map(layer => layer.id)
    .filter(id => id.includes('road') || id.includes('bridge') || id.includes('tunnel'))

  if (!layers || layers.length === 0) return null

  const nodes = new Map<string, RoadNode>()

  const addSegment = (a: LngLat, b: LngLat) => {
    const keyA = nodeKey(a)
    const keyB = nodeKey(b)

    if (keyA === keyB) return

    const length = distance(a, b)

    let nodeA = nodes.get(keyA)

    if (!nodeA) {
      nodeA = { coord: a, edges: new Map() }
      nodes.set(keyA, nodeA)
    }

    let nodeB = nodes.get(keyB)

    if (!nodeB) {
      nodeB = { coord: b, edges: new Map() }
      nodes.set(keyB, nodeB)
    }

    // Segments overlap where tiles clip them; the shorter duplicate wins.
    const existing = nodeA.edges.get(keyB)

    if (existing === undefined || length < existing) {
      nodeA.edges.set(keyB, length)
      nodeB.edges.set(keyA, length)
    }
  }

  try {
    // No filter expression: "$type" vs "geometry-type" differs across GL JS
    // versions, and a broken filter here silently empties the graph. The
    // geometry is type-checked in the loop instead.
    const features = map.queryRenderedFeatures(undefined, { layers })

    for (const feature of features) {
      const geometry = feature.geometry

      if (geometry.type !== 'LineString') continue

      const { coordinates } = geometry

      for (let index = 1; index < coordinates.length; index += 1) {
        addSegment(coordinates[index - 1] as LngLat, coordinates[index] as LngLat)
      }
    }
  } catch {
    // A style mid-load or a missing layer throws here; the caller falls back.
    return null
  }

  return nodes.size > 0 ? nodes : null
}

/**
 * A road-following polyline from `from` to `to`, or null when the walk fails —
 * the caller then keeps the straight line it already had.
 *
 * `map` must have its style loaded and roads rendered; the caller owns that
 * timing (see the live map's style.load handler).
 */
export function snapLegToRoads(map: MapLibreMap, from: LngLat, to: LngLat): LngLat[] | null {
  const graph = buildRoadGraph(map)

  if (!graph) return null

  const start = nearestNode(graph, from)
  const goal = nearestNode(graph, to)

  if (!start || !goal) return null

  // The straight line a successful walk may not exceed. City legs are far
  // shorter than this ceiling is generous; it exists to cut ring-road spirals.
  const direct = distance(from, to)
  const budget = direct * MAX_DETOUR_FACTOR

  // Greedy walk: from the reached node, take the edge whose far end most
  // reduces the straight-line distance to the goal. A* would be better in
  // theory; on rendered road segments the greedy walk with a detour budget is
  // simpler and the failure mode is a fallback, not a wrong delivery.
  const path: string[] = [start]
  const visited = new Set<string>([start])
  const startNode = graph.get(start)

  if (!startNode) return null

  let travelled = 0

  while (path.length < MAX_EDGES) {
    const current = path[path.length - 1]
    const node = graph.get(current)

    if (!node) break

    if (current === goal) break

    let bestKey: string | null = null
    let bestRemaining = Infinity
    let bestLength = 0

    for (const [nextKey, length] of node.edges) {
      if (visited.has(nextKey)) continue

      const nextNode = graph.get(nextKey)

      if (!nextNode) continue

      const remaining = distance(nextNode.coord, to)

      if (remaining < bestRemaining) {
        bestRemaining = remaining
        bestKey = nextKey
        bestLength = length
      }
    }

    // Dead end — every neighbour is visited. Backtrack one step and try the
    // next-best edge from there, bounded so a cul-de-sac cannot loop.
    if (!bestKey) {
      if (path.length === 1) break

      const stepped = path.pop() as string

      travelled -= graph.get(stepped) ? distance(graph.get(path[path.length - 1])!.coord, graph.get(stepped)!.coord) : 0

      continue
    }

    if (travelled + bestLength > budget) return null

    travelled += bestLength
    visited.add(bestKey)
    path.push(bestKey)
  }

  const lastKey = path[path.length - 1]

  if (lastKey !== goal) return null

  // Endpoints are city centres, not road nodes — pin them so the line still
  // touches the pin it belongs to.
  const coordinates: LngLat[] = [from]

  for (const key of path) {
    const node = graph.get(key)

    if (node) coordinates.push(node.coord)
  }

  coordinates.push(to)

  return coordinates
}

// ── The cache ─────────────────────────────────────────────────────────────────

const cache = new Map<string, LngLat[]>()

function legKey(from: LngLat, to: LngLat): string {
  return `${from[0].toFixed(4)},${from[1].toFixed(4)}|${to[0].toFixed(4)},${to[1].toFixed(4)}`
}

/**
 * Road-following polyline for one leg, cached. Returns null when the roads
 * could not be followed (style not ready, walk failed); the caller keeps its
 * straight line in that case.
 */
export function roadPathForLeg(map: MapLibreMap, from: LngLat, to: LngLat): LngLat[] | null {
  const key = legKey(from, to)

  const cached = cache.get(key)

  if (cached) return cached

  const snapped = snapLegToRoads(map, from, to)

  if (snapped) cache.set(key, snapped)

  return snapped
}

/** A style swap renders new geometry — drop every cached leg. */
export function clearRoadPathCache() {
  cache.clear()
}
