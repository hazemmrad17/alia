'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Bookmark,
  Check,
  ChevronDown,
  FlaskConical,
  Fullscreen,
  Layers,
  ListChecks,
  Package,
  PackageOpen,
  Play,
  Settings,
  Share2,
  Volume2,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { loadCatalog } from '@/lib/catalog-data'
import type { Product } from '@/types/alia'
import { resolveRole } from '@/lib/user-role'
import { paletteFor, titleCase } from './product-catalog'

// Product photo with graceful fallback (hidden if not downloaded yet).
function ProductDetailPhoto({ name }: { name: string }) {
  const [failed, setFailed] = useState(false)
  if (failed) return null
  const slug = name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  /* eslint-disable @next/next/no-img-element */
  return (
    <img
      src={`/images/products/${slug}.jpg`}
      alt={name}
      onError={() => setFailed(true)}
      className='absolute inset-0 size-full object-contain p-4 drop-shadow-xl'
    />
  )
}

type FactTile = { icon: typeof Layers; label: string; value: string }

function Fact({ icon: Icon, label, value }: FactTile) {
  return (
    <div className='flex items-start gap-2.5 rounded-md border border-border/60 p-2.5'>
      <Icon className='mt-0.5 size-4 shrink-0 text-primary' />
      <div className='min-w-0'>
        <p className='text-xs text-muted-foreground'>{label}</p>
        <p className='truncate text-sm font-medium'>{value}</p>
      </div>
    </div>
  )
}

// Simple accordion module (no dependency) — matches the "Course Content" panel.
function ContentModule({ title, meta, children, defaultOpen = true }: { title: string; meta?: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className='rounded-md border border-border/60'>
      <button
        type='button'
        onClick={() => setOpen(o => !o)}
        className='flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left'
      >
        <span className='text-sm font-semibold'>{title}</span>
        <span className='flex items-center gap-2'>
          {meta && <span className='text-xs text-muted-foreground'>{meta}</span>}
          <ChevronDown className={`size-4 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
        </span>
      </button>
      {open && <div className='border-t border-border/60 px-3 py-2'>{children}</div>}
    </div>
  )
}

function ContentRow({ label, meta, done = false }: { label: string; meta?: string; done?: boolean }) {
  return (
    <div className='flex items-center justify-between gap-2 py-1.5'>
      <span className='flex min-w-0 items-center gap-2 text-sm'>
        {done ? (
          <span className='flex size-4 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground'>
            <Check className='size-3' />
          </span>
        ) : (
          <span className='size-4 shrink-0 rounded-full border border-border' />
        )}
        <span className='truncate'>{label}</span>
      </span>
      {meta && <span className='shrink-0 text-xs text-muted-foreground'>{meta}</span>}
    </div>
  )
}

export default function ProductDetailView({ name }: { name: string }) {
  const router = useRouter()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [isDelegate, setIsDelegate] = useState(false)

  useEffect(() => {
    setIsDelegate(resolveRole(window.location.pathname) === 'delegate')
  }, [])

  useEffect(() => {
    let mounted = true

    loadCatalog().then(({ products: loaded }) => {
      if (!mounted) return
      setProducts(loaded)
      setLoading(false)
    })

    return () => { mounted = false }
  }, [])

  const product = useMemo(
    () => products.find(p => p.name.toLowerCase() === decodeURIComponent(name).toLowerCase()),
    [products, name]
  )

  if (loading) {
    return (
      <div className='grid grid-cols-6 gap-6'>
        <div className='col-span-6 xl:col-span-4'>
          <Skeleton className='h-72 w-full rounded-xl' />
          <Skeleton className='mt-4 h-4 w-2/3' />
          <Skeleton className='mt-2 h-3 w-1/3' />
          <Skeleton className='mt-6 h-24 w-full' />
        </div>
        <div className='col-span-6 xl:col-span-2'>
          <Skeleton className='h-72 w-full rounded-xl' />
        </div>
      </div>
    )
  }

  if (!product) {
    return (
      <div className='flex flex-col items-center justify-center gap-4 py-24 text-center'>
        <PackageOpen className='size-12 text-muted-foreground/40' />
        <div>
          <p className='text-lg font-semibold'>Product not found</p>
          <p className='text-sm text-muted-foreground'>&ldquo;{decodeURIComponent(name)}&rdquo; is not in the catalog.</p>
        </div>
        <Button variant='outline' onClick={() => router.push('/products/catalog')}>
          <ArrowLeft className='mr-1.5 size-4' />
          Back to catalog
        </Button>
      </div>
    )
  }

  const style = paletteFor(product.gamme ?? '')
  const displayName = titleCase(product.name)
  const packagingLine = [product.presentation, product.packaging].filter(Boolean).join(' · ')
  const indications = product.indications ?? []
  const composition = product.composition ?? []
  const posologie = product.posologie

  // "By the numbers" facts
  const facts: FactTile[] = [
    { icon: Layers, label: 'Gamme', value: product.gamme ? titleCase(product.gamme) : '—' },
    { icon: Package, label: 'Présentation', value: product.presentation ? titleCase(product.presentation) : '—' },
    { icon: PackageOpen, label: 'Conditionnement', value: product.packaging ? titleCase(product.packaging) : '—' },
    { icon: ListChecks, label: 'Indications', value: indications.length > 0 ? `${indications.length} listed` : '—' },
    { icon: FlaskConical, label: 'Actifs', value: composition.length > 0 ? `${composition.length} ingredient${composition.length > 1 ? 's' : ''}` : '—' },
    { icon: Volume2, label: 'Age range', value: product.age_range ? titleCase(String(product.age_range)) : '—' },
  ]

  // ── Description paragraphs built from real data ──
  const posologieRows: string[] = []
  try {
    if (posologie) {
      if (typeof posologie.note === 'string' && posologie.note.trim()) posologieRows.push(posologie.note.trim())
      const table = posologie.table
      if (Array.isArray(table)) {
        for (const row of table.slice(0, 8)) {
          if (row && typeof row === 'object') {
            const entries = Object.entries(row as Record<string, unknown>)
            if (entries.length > 0) posologieRows.push(entries.map(([k, v]) => `${k}: ${v ?? ''}`).join(' · '))
          }
        }
      } else if (table && typeof table === 'object') {
        for (const [k, v] of Object.entries(table as Record<string, unknown>).slice(0, 8)) {
          if (v !== null && v !== undefined && typeof v !== 'object') posologieRows.push(`${k}: ${v}`)
        }
      }
    }
  } catch { /* tolerate odd posologie shapes */ }

  const startSession = () => {
    router.push(isDelegate ? '/simulation' : `/commercial?product=${encodeURIComponent(product.name)}`)
  }

  return (
    <div className='grid grid-cols-6 gap-6'>
      {/* ── Main column ── */}
      <div className='col-span-6 xl:col-span-4'>
        <button
          type='button'
          onClick={() => router.push('/products/catalog')}
          className='mb-4 flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-primary'
        >
          <ArrowLeft className='size-4' />
          Back to catalog
        </button>

        <Card>
          {/* Header */}
          <CardHeader className='flex-row flex-wrap items-start justify-between gap-3'>
            <div>
              <CardTitle className='text-xl'>{displayName}</CardTitle>
              <CardDescription>
                {product.gamme ? `${titleCase(product.gamme)} · ` : ''}VITAL SA
              </CardDescription>
            </div>
            <div className='flex items-center gap-2'>
              {product.gamme && (
                <Badge className={`border-0 ${style.badge}`}>{titleCase(product.gamme)}</Badge>
              )}
              {product.presentation && (
                <Badge variant='outline'>{titleCase(product.presentation)}</Badge>
              )}
              <Button variant='ghost' size='icon' className='size-8' aria-label='Share'>
                <Share2 className='size-4' />
              </Button>
              <Button variant='ghost' size='icon' className='size-8' aria-label='Bookmark'>
                <Bookmark className='size-4' />
              </Button>
            </div>
          </CardHeader>

          {/* Player-style cover */}
          <div className='relative mx-6 mb-1 overflow-hidden rounded-lg'>
            <div className={`relative flex h-56 items-center justify-center bg-gradient-to-br ${style.gradient}`}>
              <div className='pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.22),transparent_55%)]' />
              <ProductDetailPhoto name={titleCase(product.name)} />
              {/* Decorative video controls */}
              <button
                type='button'
                onClick={startSession}
                aria-label='Start a session'
                className='relative flex size-14 items-center justify-center rounded-full bg-white/95 text-slate-900 shadow-lg transition-transform hover:scale-105'
              >
                <Play className='ml-0.5 size-6 fill-current' />
              </button>
              {/* Bottom control bar */}
              <div className='absolute inset-x-0 bottom-0 flex items-center gap-3 bg-black/35 px-4 py-2.5 backdrop-blur-sm'>
                <Play className='size-4 text-white' />
                <div className='relative h-1 flex-1 rounded-full bg-white/30'>
                  <div className='absolute inset-y-0 left-0 w-1/3 rounded-full bg-white' />
                  <span className='absolute left-1/3 top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow' />
                </div>
                <Volume2 className='size-4 text-white' />
                <Settings className='size-4 text-white' />
                <Fullscreen className='size-4 text-white' />
              </div>
            </div>
          </div>

          <CardContent className='space-y-6 p-6'>
            {/* About */}
            <section>
              <h2 className='mb-2 text-base font-bold'>About this product</h2>
              <p className='text-sm leading-relaxed text-muted-foreground'>
                {displayName} is a {product.presentation ? titleCase(product.presentation) : 'product'} from the{' '}
                <span className='font-medium text-foreground'>{product.gamme ? titleCase(product.gamme) : 'VITAL'}</span> gamme
                {product.packaging ? `, available as ${titleCase(product.packaging)}` : ''}.{' '}
                {indications.length > 0 && (
                  <>It is indicated for: {indications.map(i => titleCase(i)).join(', ')}.</>
                )}
              </p>
            </section>

            {/* By the numbers */}
            <section>
              <h2 className='mb-3 text-base font-bold'>By the numbers</h2>
              <div className='grid grid-cols-2 gap-3 sm:grid-cols-3'>
                {facts.map(f => <Fact key={f.label} {...f} />)}
              </div>
            </section>

            {/* Description */}
            <section>
              <h2 className='mb-2 text-base font-bold'>Description</h2>
              <div className='space-y-3 text-sm leading-relaxed text-muted-foreground'>
                <p>
                  This reference sheet supports ALIA&apos;s commercial and training conversations on{' '}
                  <span className='font-medium text-foreground'>{displayName}</span>. It mirrors the VITAL
                  product data used by the avatar: presentation, packaging, indications and, where available,
                  formulation and dosing.
                </p>

                {composition.length > 0 && (
                  <div>
                    <p className='mb-1.5 font-medium text-foreground'>Formulation</p>
                    <ul className='space-y-1'>
                      {composition.map((c, i) => (
                        <li key={i} className='flex items-center gap-2'>
                          <Check className='size-3.5 shrink-0 text-primary' />
                          <span>
                            {c.ingredient ? titleCase(c.ingredient) : 'Ingredient'}
                            {c.quantity ? <span className='text-muted-foreground'> · {titleCase(c.quantity)}</span> : null}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {posologieRows.length > 0 && (
                  <div>
                    <p className='mb-1.5 font-medium text-foreground'>Posologie</p>
                    <ul className='space-y-1'>
                      {posologieRows.map((r, i) => (
                        <li key={i} className='flex items-start gap-2'>
                          <span className='mt-1.5 size-1.5 shrink-0 rounded-full bg-primary' />
                          <span>{titleCase(r)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </section>
          </CardContent>
        </Card>
      </div>

      {/* ── Right rail: Product Content + CTA ── */}
      <div className='col-span-6 space-y-4 xl:col-span-2'>
        <Card>
          <CardHeader className='flex-row items-center justify-between gap-2'>
            <div>
              <CardTitle className='text-base'>Product Content</CardTitle>
              <CardDescription>{indications.length + composition.length + posologieRows.length + 2} sections</CardDescription>
            </div>
            <ChevronDown className='size-4 text-muted-foreground' />
          </CardHeader>
          <CardContent className='space-y-2'>
            <ContentModule title='Indications' meta={`${indications.length} items`}>
              {indications.length > 0 ? (
                indications.map(i => <ContentRow key={i} label={titleCase(i)} done />)
              ) : (
                <p className='py-1 text-sm text-muted-foreground'>Not specified</p>
              )}
            </ContentModule>

            <ContentModule title='Formulation' meta={`${composition.length} items`} defaultOpen={composition.length > 0}>
              {composition.length > 0 ? (
                composition.map((c, i) => (
                  <ContentRow key={i} label={c.ingredient ? titleCase(c.ingredient) : 'Ingredient'} meta={c.quantity ? titleCase(c.quantity) : undefined} />
                ))
              ) : (
                <p className='py-1 text-sm text-muted-foreground'>Not available in the source data</p>
              )}
            </ContentModule>

            <ContentModule title='Posologie' meta={posologieRows.length > 0 ? `${posologieRows.length} rows` : '—'} defaultOpen={posologieRows.length > 0}>
              {posologieRows.length > 0 ? (
                posologieRows.map((r, i) => <ContentRow key={i} label={r} />)
              ) : (
                <p className='py-1 text-sm text-muted-foreground'>Not available in the source data</p>
              )}
            </ContentModule>

            <ContentModule title='Presentation & Packaging' meta='2 items'>
              <ContentRow label='Présentation' meta={product.presentation ? titleCase(product.presentation) : '—'} done={!!product.presentation} />
              <ContentRow label='Conditionnement' meta={product.packaging ? titleCase(product.packaging) : '—'} done={!!product.packaging} />
            </ContentModule>
          </CardContent>
        </Card>

        {/* CTA */}
        <Card>
          <CardContent className='space-y-2 p-4'>
            <Button className='w-full' onClick={startSession}>
              <Play className='mr-1.5 size-4' />
              {isDelegate ? 'Practice this product' : 'Present this product'}
            </Button>
            <Button variant='outline' className='w-full' onClick={() => router.push(isDelegate ? '/simulation' : '/commercial')}>
              {isDelegate ? 'Open simulator' : 'Configure presentation'}
            </Button>
            <p className='pt-1 text-center text-xs text-muted-foreground'>
              Starts a live {isDelegate ? 'training' : 'commercial'} session focused on {displayName}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}