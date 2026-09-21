'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Package, Search, Pill, Play, ArrowRight, PlugZap, PackageOpen } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { loadCatalog } from '@/lib/catalog-data'
import type { Product } from '@/types/alia'
import { resolveRole } from '@/lib/user-role'

const PAGE_SIZE = 6

// Cover palettes (gradient + badge colors + brand-strip accent). The gamme name
// is hashed onto a palette so any of the ~35 real gammes gets a stable color.
type Palette = { gradient: string; badge: string; accent: string }

const PALETTES: Palette[] = [
  { gradient: 'from-rose-500/90 to-rose-800', badge: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300', accent: '#e11d48' },
  { gradient: 'from-amber-500/90 to-amber-800', badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300', accent: '#d97706' },
  { gradient: 'from-purple-500/90 to-purple-800', badge: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300', accent: '#7c3aed' },
  { gradient: 'from-emerald-500/90 to-emerald-800', badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300', accent: '#059669' },
  { gradient: 'from-blue-500/90 to-blue-800', badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300', accent: '#2563eb' },
  { gradient: 'from-orange-500/90 to-orange-800', badge: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300', accent: '#ea580c' },
  { gradient: 'from-cyan-500/90 to-cyan-800', badge: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300', accent: '#0891b2' },
  { gradient: 'from-fuchsia-500/90 to-fuchsia-800', badge: 'bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-900/40 dark:text-fuchsia-300', accent: '#c026d3' },
]

export const paletteFor = (gamme: string): Palette => {
  const hash = [...gamme].reduce((acc, ch) => acc + ch.charCodeAt(0), 0)
  return PALETTES[hash % PALETTES.length]
}

// API names arrive in ALL CAPS — restore readable case while keeping accents.
// Word starts are uppercased (é/è/à stay intact) and short French prepositions
// stay lowercase: "Boîte de 30 comprimés" not "Boîte De 30 Comprimés".
const FRENCH_STOPWORDS = new Set(['de', 'du', 'des', 'en', 'à', 'et', 'la', 'le', 'les', 'au', 'aux', 'sur', 'pour', 'avec'])

export const titleCase = (value: string): string =>
  value
    .toLowerCase()
    .replace(/(^|[\s\-/])(\p{L}+)/gu, (match, sep: string, word: string) => {
      const first = sep === ' ' && FRENCH_STOPWORDS.has(word) ? word : word.charAt(0).toUpperCase() + word.slice(1)
      return sep + first
    })

// Slugify a product name the same way scripts/fetch-product-images.mjs does,
// so /images/products/<slug>.jpg resolves when the photo was downloaded.
const productImage = (name: string): string =>
  `/images/products/${name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}.jpg`

function ProductPhoto({ name, gamme }: { name: string; gamme: string }) {
  const [failed, setFailed] = useState(false)

  if (failed) return <ProductPack name={name} gamme={gamme} />

  return (
    /* eslint-disable @next/next/no-img-element */
    <img
      src={productImage(name)}
      alt={name}
      loading='lazy'
      onError={() => setFailed(true)}
      className='absolute inset-0 size-full object-contain p-3 drop-shadow-lg'
    />
  )
}

// Stylized product-pack front used as card cover when no real photo exists.
function ProductPack({ name, gamme }: { name: string; gamme: string }) {
  const accent = paletteFor(gamme).accent

  return (
    <div className='relative flex h-full w-full items-center justify-center'>
      <div className='pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_72%_18%,rgba(255,255,255,0.3),transparent_58%)]' />
      <div className='relative h-[88%] w-36 max-w-[85%] overflow-hidden rounded-md bg-white shadow-xl shadow-black/25 ring-1 ring-black/10'>
        {/* Brand strip */}
        <div className='h-1.5 w-full' style={{ backgroundColor: accent }} />
        <div className='flex items-center justify-between px-2.5 pt-2'>
          <span className='text-[11px] font-black tracking-widest text-slate-900'>VITAL</span>
          <span className='text-[8px] font-semibold uppercase tracking-wider text-slate-400'>Santé</span>
        </div>
        {/* Pack body */}
        <div className='flex flex-col items-center justify-center gap-1 px-2 py-1.5 text-center'>
          <Pill className='size-6 text-slate-800' strokeWidth={2.2} />
          <span className='line-clamp-2 text-xs font-extrabold uppercase leading-tight tracking-tight text-slate-900'>
            {name}
          </span>
        </div>
      </div>
    </div>
  )
}

function pageWindow(current: number, total: number): (number | '…')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)

  const pages = new Set<number>([1, total, current - 1, current, current + 1])
  const sorted = [...pages].filter(p => p >= 1 && p <= total).sort((a, b) => a - b)
  const out: (number | '…')[] = []

  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) out.push('…')
    out.push(p)
  })

  return out
}

export default function ProductCatalogView() {
  const router = useRouter()
  const [products, setProducts] = useState<Product[]>([])
  const [source, setSource] = useState<'api' | 'local' | 'demo' | 'loading'>('loading')
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [gamme, setGamme] = useState('all')
  const [page, setPage] = useState(1)
  const [isDelegate, setIsDelegate] = useState(false)

  useEffect(() => {
    // /products is role-neutral; the stored role (or delegate by default) decides the action labels.
    setIsDelegate(resolveRole(window.location.pathname) === 'delegate')
  }, [])

  useEffect(() => {
    let mounted = true

    loadCatalog().then(({ products: loaded, source: src }) => {
      if (!mounted) return
      setProducts(loaded)
      setSource(src)
      setLoading(false)
    })

    return () => { mounted = false }
  }, [])

  const gammes = useMemo(
    () => [...new Set(products.map(p => p.gamme).filter((g): g is string => !!g))].sort(),
    [products]
  )

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()

    return products.filter(p => {
      if (gamme !== 'all' && p.gamme !== gamme) return false
      if (!q) return true

      return [
        p.name,
        p.gamme,
        p.presentation,
        p.packaging,
        ...(p.indications ?? []),
      ]
        .filter(Boolean)
        .some(field => field!.toLowerCase().includes(q))
    })
  }, [products, search, gamme])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const pageItems = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  const startSession = (productName: string) => {
    router.push(
      isDelegate
        ? '/simulation'
        : `/commercial?product=${encodeURIComponent(productName)}`
    )
  }

  return (
    <div className='space-y-5'>
      {/* Controls */}
      <div className='flex items-center justify-between gap-3 flex-wrap'>
        <div className='relative flex-1 min-w-52 max-w-sm'>
          <Search className='absolute left-2.5 top-2.5 size-4 text-muted-foreground' />
          <Input
            placeholder='Search products, gamme, indication…'
            className='pl-9'
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
          />
        </div>

        <div className='flex items-center gap-2'>
          <Select value={gamme} onValueChange={v => { if (v) { setGamme(v); setPage(1) } }}>
            <SelectTrigger className='w-44'>
              <SelectValue placeholder='All gammes' />
            </SelectTrigger>
            <SelectContent className='max-h-72'>
              <SelectItem value='all'>All gammes</SelectItem>
              {gammes.map(g => (
                <SelectItem key={g} value={g}>{titleCase(g)}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className='flex items-center gap-2'>
            <Package className='size-4 text-primary' />
            <span className='text-sm font-medium whitespace-nowrap'>
              {products.length} products
            </span>
          </div>
        </div>
      </div>

      {/* Data source notice */}
      {!loading && source !== 'api' && (
        <div className='flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-300'>
          <PlugZap className='size-3.5 shrink-0' />
          {source === 'local' ? (
            <>Backend offline — browsing the full VITAL catalog ({products.length} products) from local data.</>
          ) : (
            <>Backend offline — showing a sample of {products.length} products. Start the API to browse the full VITAL catalog.</>
          )}
        </div>
      )}

      {/* Course-style product cards */}
      {loading ? (
        <div className='grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3'>
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className='overflow-hidden'>
              <Skeleton className='h-36 w-full rounded-none' />
              <CardContent className='space-y-3 p-4'>
                <Skeleton className='h-4 w-3/4' />
                <Skeleton className='h-3 w-1/2' />
                <Skeleton className='h-8 w-full' />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className='flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground'>
          <PackageOpen className='size-10 opacity-30' />
          <p className='text-sm'>No products found for &ldquo;{search}&rdquo;</p>
        </div>
      ) : (
        <>
          <div className='grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3'>
            {pageItems.map(product => {
              const style = paletteFor(product.gamme ?? '')
              const displayName = titleCase(product.name)
              const packagingLine = [product.presentation, product.packaging].filter(Boolean).join(' · ')
              const visibleIndications = (product.indications ?? []).slice(0, 3)
              const extraIndications = (product.indications?.length ?? 0) - visibleIndications.length

              return (
                <Card key={product.name} className='group overflow-hidden transition-shadow hover:shadow-lg'>
                  {/* Cover / thumbnail */}
                  <button
                type='button'
                onClick={() => router.push(`/products/${encodeURIComponent(product.name)}`)}
                className={`relative flex h-36 w-full cursor-pointer items-center justify-center bg-gradient-to-br ${style.gradient} p-4 text-left transition-[filter] hover:brightness-110`}
                aria-label={`Open details for ${displayName}`}
              >
                    <ProductPhoto name={displayName} gamme={product.gamme ?? ''} />
                    {product.gamme && (
                      <Badge className={`absolute left-3 top-3 ${style.badge} border-0 text-[11px]`}>
                        {titleCase(product.gamme)}
                      </Badge>
                    )}
                    {product.presentation && (
                      <Badge variant='secondary' className='absolute right-3 top-3 max-w-[45%] bg-background/80 text-[11px] backdrop-blur'>
                        <span className='truncate'>{titleCase(product.presentation)}</span>
                      </Badge>
                    )}
                  </button>

                  <CardContent className='p-4'>
                    <button
                      type='button'
                      onClick={() => router.push(`/products/${encodeURIComponent(product.name)}`)}
                      className='text-left transition-colors hover:text-primary'
                    >
                      <h3 className='text-base font-bold leading-snug'>{displayName}</h3>
                    </button>

                    {packagingLine && (
                      <p className='mt-1 flex items-center gap-1.5 text-xs text-muted-foreground'>
                        <Package className='size-3.5 shrink-0' />
                        <span className='truncate'>{packagingLine}</span>
                      </p>
                    )}

                    {visibleIndications.length > 0 && (
                      <div className='mt-3 flex flex-wrap gap-1.5'>
                        {visibleIndications.map(ind => (
                          <Badge key={ind} variant='outline' className='px-2 py-0 text-[11px] font-normal'>
                            {titleCase(ind)}
                          </Badge>
                        ))}
                        {extraIndications > 0 && (
                          <Badge variant='outline' className='px-2 py-0 text-[11px] font-normal text-muted-foreground'>
                            +{extraIndications}
                          </Badge>
                        )}
                      </div>
                    )}

                    <div className='mt-4 flex items-center gap-2'>
                      <Button
                        size='sm'
                        variant='outline'
                        className='flex-1'
                        onClick={() => router.push(isDelegate ? '/simulation' : '/commercial')}
                      >
                        <Play className='mr-1.5 size-3.5' />
                        {isDelegate ? 'Simulator' : 'Configure'}
                      </Button>
                      <Button size='sm' className='flex-1' onClick={() => startSession(product.name)}>
                        {isDelegate ? 'Practice' : 'Present'}
                        <ArrowRight className='ml-1.5 size-3.5' />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <>
              <p className='text-center text-xs text-muted-foreground'>
                Showing {pageItems.length > 0 ? (currentPage - 1) * PAGE_SIZE + 1 : 0}–
                {(currentPage - 1) * PAGE_SIZE + pageItems.length} of {filtered.length}
              </p>
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      href='#'
                      text=''
                      aria-disabled={currentPage === 1}
                      className={currentPage === 1 ? 'pointer-events-none opacity-50' : ''}
                      onClick={e => { e.preventDefault(); setPage(Math.max(1, currentPage - 1)) }}
                    />
                  </PaginationItem>

                  {pageWindow(currentPage, totalPages).map((p, i) =>
                    p === '…' ? (
                      <PaginationItem key={`e${i}`}>
                        <PaginationEllipsis />
                      </PaginationItem>
                    ) : (
                      <PaginationItem key={p}>
                        <PaginationLink
                          href='#'
                          isActive={p === currentPage}
                          onClick={e => { e.preventDefault(); setPage(p) }}
                        >
                          {p}
                        </PaginationLink>
                      </PaginationItem>
                    )
                  )}

                  <PaginationItem>
                    <PaginationNext
                      href='#'
                      text=''
                      aria-disabled={currentPage === totalPages}
                      className={currentPage === totalPages ? 'pointer-events-none opacity-50' : ''}
                      onClick={e => { e.preventDefault(); setPage(Math.min(totalPages, currentPage + 1)) }}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </>
          )}
        </>
      )}
    </div>
  )
}
