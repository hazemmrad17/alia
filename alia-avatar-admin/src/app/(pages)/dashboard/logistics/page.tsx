import React from 'react'
import { Truck, Package, ShieldCheck, MapPin } from 'lucide-react'
import CampaignVehiclesCard from '@/views/dashboards/campaign/campaign-vehicles-card'
import SalesTransactionOverview from '@/views/dashboards/sales/sales-transaction-overview'
import CampaignStatCards from '@/views/dashboards/campaign/campaign-stat-cards'

export const metadata = {
  title: 'Logistics Dashboard | AdminCN',
  description: 'Fleet tracking, route logistics, delivery times, and inventory distribution.'
}

const LogisticsDashboard = () => {
  return (
    <div className='grid grid-cols-6 gap-6'>
      <div className='col-span-full'>
        <div className='flex items-center gap-2 mb-2'>
          <Truck className='size-6 text-primary' />
          <h1 className='text-2xl font-bold'>Logistics & Fleet Operations</h1>
        </div>
        <p className='text-sm text-muted-foreground'>Real-time tracking of dispatch units, fuel efficiency, and fulfillment hubs.</p>
      </div>

      <CampaignStatCards />
      <SalesTransactionOverview />
      <CampaignVehiclesCard />
    </div>
  )
}

export default LogisticsDashboard
