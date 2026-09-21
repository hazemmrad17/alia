import { NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'

// Local mirror of the backend's GET /api/v1/products. Used only when the
// FastAPI backend is unreachable, so the full catalog stays browsable offline.
const DATA_PATH = path.join(process.cwd(), '..', 'backend', 'data', 'processed', 'products_llm.json')

export async function GET() {
  try {
    const raw = await fs.readFile(DATA_PATH, 'utf-8')
    const products = JSON.parse(raw) as Record<string, unknown>[]

    const mapped = products.map(p => ({
      name: String(p.name ?? ''),
      gamme: String(p.gamme ?? ''),
      presentation: String(p.presentation ?? ''),
      packaging: String(p.packaging ?? ''),
      indications: Array.isArray(p.indications) ? (p.indications as unknown[]).slice(0, 5) : [],
      age_range: p.age_range ?? null,
      composition: Array.isArray(p.composition) ? p.composition : [],
      posologie: p.posologie ?? {},
    }))

    return NextResponse.json({ total: mapped.length, products: mapped })
  } catch {
    return NextResponse.json({ total: 0, products: [] })
  }
}