import type { Metadata } from 'next'
import { Pill } from 'lucide-react'
import ProductCatalogView from '@/views/ala/commercial/product-catalog'

export const metadata: Metadata = {
  title: 'VITAL Products | ALIA Avatar',
  description: 'Complete VITAL SA product catalog with gamme, indications, and presentation info.'
}

const ProductCatalogPage = () => {
  return (
    <div className='grid grid-cols-6 gap-6'>
      <div className='col-span-full'>
        <div className='flex items-center gap-2 mb-2'>
          <Pill className='size-6 text-primary' />
          <h1 className='text-2xl font-bold'>VITAL Products</h1>
        </div>
        <p className='text-sm text-muted-foreground'>
          Complete VITAL SA product catalog — gamme, indications, and presentation info.
        </p>
      </div>

      <div className='col-span-full'>
        <ProductCatalogView />
      </div>
    </div>
  )
}

export default ProductCatalogPage
