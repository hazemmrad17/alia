import type { Metadata } from 'next'
import { Package } from 'lucide-react'
import ProductPerformanceView from '@/views/ala/commercial/product-performance'

export const metadata: Metadata = {
  title: 'Product Performance | ALIA Avatar',
  description: 'Which VITAL SA products are getting traction with doctors.'
}

const ProductPerformancePage = () => {
  return (
    <div className='grid grid-cols-6 gap-6'>
      <div className='col-span-full'>
        <div className='flex items-center gap-2 mb-2'>
          <Package className='size-6 text-green-600' />
          <h1 className='text-2xl font-bold'>Product Performance</h1>
        </div>
        <p className='text-sm text-muted-foreground'>
          Which VITAL SA products are getting the most traction with doctors.
        </p>
      </div>

      <div className='col-span-full'>
        <ProductPerformanceView />
      </div>
    </div>
  )
}

export default ProductPerformancePage
