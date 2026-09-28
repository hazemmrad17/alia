// ──────────────────────────────────────────────
// MapLibre needs its worker served from a URL we control
//
// MapLibre GL finds its worker by resolving a sibling of whatever bundle it was
// compiled into. Inside a Next chunk that path is
// /_next/static/chunks/maplibre-gl-worker.mjs — a file the bundler never emits.
// The request comes back as the dev server's HTML 404 page, which the browser
// refuses to run as a module ("non-JavaScript MIME type"), and the worker dies.
//
// The consequence is not a console warning: vector tiles are parsed *in* the
// worker, so with no worker the basemap never paints. The pins, circuits and
// figures still draw, which is exactly how a broken map hides.
//
// So the files are copied into public/ and LiveMapView points MapLibre at them
// with setWorkerUrl(). Copying on every dev and build start means the served
// worker always matches the installed maplibre-gl version instead of slowly
// drifting away from it — public/maplibre is gitignored for that reason.
// ──────────────────────────────────────────────

import { cpSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)))
const sourceDir = join(projectRoot, 'node_modules', 'maplibre-gl', 'dist')
const targetDir = join(projectRoot, 'public', 'maplibre')

// maplibre-gl-worker.mjs imports its shared chunk by relative path
// (./maplibre-gl-shared.mjs), so the two have to sit side by side.
const FILES = ['maplibre-gl-worker.mjs', 'maplibre-gl-shared.mjs']

if (!existsSync(sourceDir)) {
  // Nothing to do before the dependency is installed — `npm install` runs this
  // script through predev/prebuild, not mid-install.
  console.warn('maplibre-gl is not installed yet — skipping worker sync.')

  process.exit(0)
}

mkdirSync(targetDir, { recursive: true })

for (const file of FILES) {
  cpSync(join(sourceDir, file), join(targetDir, file))
}

console.log(`maplibre worker synced → public/maplibre (${FILES.join(', ')})`)
