/**
 * Fetch real product photos for the VITAL catalog.
 *
 * Strategy:
 *  1. Google Custom Search API (image search, free 100 queries/day).
 *     - Needs GOOGLE_API_KEY + GOOGLE_CSE_ID (https://programmablesearchengine.google.com/,
 *       enable "Image search" + "Search the entire web").
 *  2. Fallback: DuckDuckGo image endpoint (no key, best-effort).
 *
 * Downloads into alia-avatar-admin/public/images/products/<slug>.jpg
 *
 * Usage:
 *   node scripts/fetch-product-images.mjs            # all products
 *   node scripts/fetch-product-images.mjs --force    # re-download existing
 *
 * Requires: npm i node-fetch  (or run on Node 18+ where fetch is global)
 */
import { mkdirSync, writeFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const OUT_DIR = join(ROOT, 'public', 'images', 'products')

// ── Product list: fetched live from the backend catalog, with fallback ──
const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
const FALLBACK_PRODUCTS = [
  'LV Fersang',
  'Oligovit Vitamine C',
  'CALMOSS',
  'VITONIC',
  'Magné B6',
  'Spasfon Lyoc',
  'Doliprane 1000',
  'FERBIOTIC',
]

async function loadProducts() {
  try {
    const res = await fetch(`${API}/api/v1/products`, { signal: AbortSignal.timeout(8000) })
    if (!res.ok) throw new Error(String(res.status))
    const data = await res.json()
    const list = (data.products ?? data ?? []).map(p => p.name).filter(Boolean)
    if (list.length) return list
  } catch (e) {
    console.warn(`Backend catalog unavailable (${e.message}) — using ${FALLBACK_PRODUCTS.length} demo products.`)
  }
  return FALLBACK_PRODUCTS
}

const GOOGLE_KEY = process.env.GOOGLE_API_KEY
const GOOGLE_CSE = process.env.GOOGLE_CSE_ID
const FORCE = process.argv.includes('--force')
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36'

const slug = s => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

async function googleImage(query) {
  if (!GOOGLE_KEY || !GOOGLE_CSE) return null
  const url = new URL('https://www.googleapis.com/customsearch/v1')
  url.searchParams.set('key', GOOGLE_KEY)
  url.searchParams.set('cx', GOOGLE_CSE)
  url.searchParams.set('searchType', 'image')
  url.searchParams.set('num', '5')
  url.searchParams.set('imgSize', 'medium')
  url.searchParams.set('q', `${query} médicament boîte`)
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Google CSE ${res.status}: ${await res.text()}`)
  const data = await res.json()
  const items = data.items ?? []
  // Prefer jpegs from pharmacy sites; take the first downloadable one
  for (const it of items) {
    const link = it.link ?? ''
    const mime = it.mime ?? ''
    if ((mime.startsWith('image/jpeg') || mime.startsWith('image/png') || /\.(jpe?g|png)(\?|$)/i.test(link)) && it.image?.width >= 200) {
      return link
    }
  }
  return items[0]?.link ?? null
}

async function duckduckgoImage(query) {
  // 1) get the vqd token
  const tokenRes = await fetch(`https://duckduckgo.com/?q=${encodeURIComponent(query)}&iax=images&ia=images`, { headers: { 'User-Agent': UA } })
  const vqd = (await tokenRes.text()).match(/vqd=["']?([\d-]+)["']?/)?.[1]
  if (!vqd) return null
  // 2) query the images endpoint
  const api = new URL('https://duckduckgo.com/i.js')
  api.searchParams.set('l', 'fr-fr')
  api.searchParams.set('o', 'json')
  api.searchParams.set('q', query)
  api.searchParams.set('vqd', vqd)
  const res = await fetch(api, { headers: { 'User-Agent': UA, Referer: 'https://duckduckgo.com/' } })
  if (!res.ok) return null
  const data = await res.json().catch(() => null)
  const results = (data?.results ?? []).filter(r => /\.(jpe?g|png)(\?|$)/i.test(r.image))
  return results[0]?.image ?? null
}

async function bingImage(query) {
  // Bing image search scraping (no API key). The murl entries appear both as
  // "murl":"https://…" and HTML-escaped / backslash-escaped variants.
  const res = await fetch(`https://www.bing.com/images/search?q=${encodeURIComponent(query)}`, {
    headers: { 'User-Agent': UA, 'Accept-Language': 'fr-FR,fr;q=0.9' }
  })
  if (!res.ok) return null
  const html = await res.text()
  const unescaped = html
    .replace(/&quot;/g, '"')
    .replace(/\\\"/g, '"')
    .replace(/\\u0026/g, '&')
  const urls = [...unescaped.matchAll(/"murl":"(https?:[^"]+?)"/g)].map(m => m[1])
  const good = urls.filter(u => /\.(jpe?g|png)(\?|$)/i.test(u) && !/caffeina|wikimedia.*svg/i.test(u))
  return good[0] ?? urls[0] ?? null
}

async function download(url, dest) {
  const res = await fetch(url, { headers: { 'User-Agent': UA, Referer: new URL(url).origin } })
  if (!res.ok) throw new Error(`download ${res.status}`)
  const buf = Buffer.from(await res.arrayBuffer())
  if (buf.length < 5_000) throw new Error('image too small / placeholder')
  writeFileSync(dest, buf)
  return buf.length
}

mkdirSync(OUT_DIR, { recursive: true })
const PRODUCTS = await loadProducts()
console.log(`Fetching images for ${PRODUCTS.length} products…\n`)

let ok = 0, skipped = 0, failed = []

// Skip long descriptive names (e.g. "Vitalité et Immunité") that aren't real
// branded products — they won't return useful product-pack photos.
const isBrandish = name => /[A-Z0-9]/.test(name) && name.replace(/[^A-Za-z0-9À-ÿ]/g, '').length >= 5

for (const name of PRODUCTS) {
  if (!isBrandish(name)) { console.log(`- ${name}: not a branded product, skipping`); continue }
  const dest = join(OUT_DIR, `${slug(name)}.jpg`)
  if (!FORCE && existsSync(dest)) { skipped++; continue }

  const queries = [name, `${name} VITAL SA`, `${name} comprimés`]
  let url = null, source = ''
  for (const q of queries) {
    try { url = await googleImage(q); if (url) { source = 'google'; break } } catch (e) { console.warn(`  google: ${e.message}`) }
    if (!url) { try { url = await duckduckgoImage(q); if (url) { source = 'duckduckgo'; break } } catch {} }
    if (!url) { try { url = await bingImage(q); if (url) { source = 'bing'; break } } catch {} }
  }
  if (!url) { failed.push(name); console.error(`✗ ${name}: no image found`); continue }

  try {
    const bytes = await download(url, dest)
    ok++
    console.log(`✓ ${name} ← ${source} (${Math.round(bytes / 1024)} KB)`)
  } catch (e) {
    failed.push(name)
    console.error(`✗ ${name}: ${e.message}`)
  }
  await new Promise(r => setTimeout(r, 1200)) // be polite
}

console.log(`\nDone. ok=${ok} skipped=${skipped} failed=${failed.length}`)
if (failed.length) console.log('Failed:', failed.join(', '))
console.log('Next: restart the frontend — the catalog picks up /images/products automatically.')
