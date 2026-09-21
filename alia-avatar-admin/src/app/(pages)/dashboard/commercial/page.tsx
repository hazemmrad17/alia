import type { Metadata } from 'next'
import { ShoppingBag } from 'lucide-react'
import CommercialOverview from '@/views/ala/commercial/commercial-overview'

export const metadata: Metadata = {
  title: 'Commercial Dashboard | ALIA Avatar',
  description: 'Product presentation analytics — engagement, product reach, and CRM insights.'
}

const CommercialDashboardPage = () => {
  return (
    <div className='grid grid-cols-6 gap-6'>
      <div className='col-span-full'>
        <div className='flex items-center gap-2 mb-2'>
          <ShoppingBag className='size-6 text-green-600' />
          <h1 className='text-2xl font-bold'>Commercial Dashboard</h1>
        </div>
        <p className='text-sm text-muted-foreground'>
          Product presentation analytics — engagement, product reach, and CRM insights.
        </p>
      </div>

      <CommercialOverview />
    </div>
  )
}

export default CommercialDashboardPage
