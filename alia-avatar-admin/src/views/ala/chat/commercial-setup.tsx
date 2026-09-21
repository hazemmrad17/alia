'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { listProducts } from '@/lib/alia-api'
import type { SessionConfig, VisitFormat } from '@/types/alia'

const FALLBACK_PRODUCTS = [
  'LV Fersang', 'LV Tetra B', 'PULMAX antitussif', 'Oligovit Vitamine C',
  'Vitonic Allaitement', 'CALMOSS', 'OMEVIE', 'MINCILIGNE',
  'HYDRA', 'VITONIC', 'FERBIOTIC', 'PHYTOTHERA',
]

const FORMATS: { id: VisitFormat; name: string; duration: string; desc: string }[] = [
  { id: 'flash', name: 'Flash', duration: '20-60s', desc: 'Quick product info, 1 key benefit' },
  { id: 'standard', name: 'Standard', duration: '2-4 min', desc: 'Full presentation with discovery & Q&A' },
  { id: 'approfondie', name: 'Approfondie', duration: '5-8 min', desc: 'Deep dive: indications, evidence, positioning' },
]

export default function CommercialSetup({ config, onChange, onStart }: {
  config: SessionConfig; onChange: (c: SessionConfig) => void; onStart: (c: SessionConfig) => void
}) {
  const [products, setProducts] = useState<string[]>(FALLBACK_PRODUCTS)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    listProducts()
      .then(res => { if (res.products.length > 0) setProducts(res.products.map(p => p.name)) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return (
    <Card className='p-8 max-w-4xl mx-auto'>
      <div className='mb-6'>
        <h3 className='text-xl font-bold'>Product Presentation Setup</h3>
        <p className='text-sm text-muted-foreground'>Choose a VITAL SA product to learn about</p>
      </div>

      {/* Product Selection */}
      <div className='mb-8'>
        <label className='block text-sm font-semibold mb-3 uppercase tracking-wide text-muted-foreground'>
          Select Product {loading && <span className='text-xs font-normal normal-case'>(loading...)</span>}
        </label>
        <select value={config.product} onChange={e => onChange({ ...config, product: e.target.value })}
          className='w-full p-4 border-2 border-border rounded-xl focus:border-primary focus:outline-none text-lg bg-background'>
          <option value=''>Choose a product to discover...</option>
          {products.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        {config.product && (
          <p className='text-sm text-primary mt-2 ml-1'>Selected: <strong>{config.product}</strong></p>
        )}
      </div>

      {/* Format */}
      <div className='mb-8'>
        <label className='block text-sm font-semibold mb-3 uppercase tracking-wide text-muted-foreground'>Presentation Format</label>
        <div className='grid grid-cols-3 gap-4'>
          {FORMATS.map(f => (
            <button key={f.id} onClick={() => onChange({ ...config, format: f.id })}
              className={`p-4 rounded-xl border-2 text-center transition-all ${config.format === f.id ? 'border-primary bg-primary/5' : 'border-border hover:border-border/80'}`}>
              <p className='font-semibold mt-1'>{f.name}</p>
              <p className='text-sm text-primary font-medium'>{f.duration}</p>
              <p className='text-xs text-muted-foreground mt-1'>{f.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Note */}
      <div className='bg-primary/5 border border-border rounded-xl p-4 mb-8 text-sm'>
        <p className='font-semibold mb-1'>What to expect:</p>
        <ul className='space-y-1 list-disc list-inside text-muted-foreground'>
          <li>ALIA will greet you and ask for permission to present</li>
          <li>You will learn about the product's indications, composition, and usage</li>
          <li>Feel free to ask questions at any time</li>
          <li>A CRM report will be generated at the end</li>
        </ul>
      </div>

      <Button className='w-full py-6 text-lg' disabled={!config.product}
        onClick={() => onStart(config)}>
        {config.product ? `Start Presentation: ${config.product}` : 'Select a product first'}
      </Button>
    </Card>
  )
}
