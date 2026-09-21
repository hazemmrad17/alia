import type { Metadata } from 'next'
import ProductDetailView from '@/views/ala/commercial/product-detail'

export const metadata: Metadata = {
  title: 'Product Details | ALIA Avatar',
  description: 'VITAL SA product details — formulation, indications, packaging, and dosing.'
}

type PageProps = {
  params: Promise<{ name: string }>
}

const ProductDetailPage = async ({ params }: PageProps) => {
  const { name } = await params

  return <ProductDetailView name={decodeURIComponent(name)} />
}

export default ProductDetailPage