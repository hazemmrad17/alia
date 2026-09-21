import { listProducts } from './alia-api'
import type { Product } from '@/types/alia'

export type CatalogSource = 'api' | 'local' | 'demo'

export const DEMO_PRODUCTS: Product[] = [
  { name: 'LV Fersang', gamme: 'Hématologie', packaging: 'Boîte de 30 comprimés', indications: ['Anémie ferriprive', 'Carence en fer', 'Grossesse'] },
  { name: 'Oligovit Vitamine C', gamme: 'Vitamines & Minéraux', packaging: 'Tube de 20 comprimés effervescents', indications: ['Carence en vitamine C', 'Immunité', 'Fatigue'] },
  { name: 'CALMOSS', gamme: 'Neurologie', packaging: 'Boîte de 20 comprimés', indications: ['Anxiété légère', 'Troubles du sommeil', 'Stress'] },
  { name: 'VITONIC', gamme: 'Vitamines & Minéraux', packaging: 'Flacon de 200 ml sirop', indications: ['Fatigue générale', 'Convalescence', 'Croissance'] },
  { name: 'Magné B6', gamme: 'Minéraux', packaging: 'Boîte de 60 comprimés', indications: ['Carence en magnésium', 'Crampes', 'Fatigue'] },
  { name: 'Spasfon Lyoc', gamme: 'Gastro-entérologie', packaging: 'Boîte de 10 lyophilisats', indications: ['Spasmes digestifs', 'Douleurs abdominales'] },
  { name: 'Doliprane 1000', gamme: 'Antalgiques', packaging: 'Boîte de 8 comprimés', indications: ['Douleurs modérées', 'Fièvre'] },
  { name: 'FERBIOTIC', gamme: 'Hématologie', packaging: 'Boîte de 30 gélules', indications: ['Anémie', 'Grossesse', 'Allaitement'] },
]

// Order of preference: live backend → local JSON mirror (same-origin /api/products) → demo samples.
export async function loadCatalog(): Promise<{ products: Product[]; source: CatalogSource }> {
  try {
    const res = await listProducts()
    if (res.products.length > 0) return { products: res.products, source: 'api' }
  } catch {
    // backend offline — try the local mirror below
  }

  try {
    const local = await fetch('/api/products', { signal: AbortSignal.timeout(5000) })
    if (local.ok) {
      const data = (await local.json()) as { products?: Product[] }
      if (data.products && data.products.length > 0) return { products: data.products, source: 'local' }
    }
  } catch {
    // no local mirror either — fall through to demo data
  }

  return { products: DEMO_PRODUCTS, source: 'demo' }
}