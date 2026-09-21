import React from 'react'
import { ShoppingCart, Package, TrendingUp, DollarSign } from 'lucide-react'
import SalesDetailsRadial from '@/views/dashboards/sales/sales-details-radial'
import SalesTransactionOverview from '@/views/dashboards/sales/sales-transaction-overview'
import CampaignStatCards from '@/views/dashboards/campaign/campaign-stat-cards'
import SalesInvoiceDatatable from '@/views/dashboards/sales/sales-invoice-datatable'

export const metadata = {
  title: 'eCommerce Dashboard | AdminCN',
  description: 'Online store analytics, product conversion, sales channels, and checkout rates.'
}

const EcommerceDashboard = () => {
  return (
    <div className='grid grid-cols-6 gap-6'>
      <div className='col-span-full'>
        <div className='flex items-center gap-2 mb-2'>
          <ShoppingCart className='size-6 text-primary' />
          <h1 className='text-2xl font-bold'>eCommerce Store Intelligence</h1>
        </div>
        <p className='text-sm text-muted-foreground'>Omnichannel retail telemetry, cart abandonment rates, and order fulfillment.</p>
      </div>

      <CampaignStatCards />
      <SalesTransactionOverview />
      <SalesDetailsRadial />
      <SalesInvoiceDatatable />
    </div>
  )
}

export default EcommerceDashboard
