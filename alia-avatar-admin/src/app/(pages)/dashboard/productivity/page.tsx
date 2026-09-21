import React from 'react'
import { Briefcase, CheckCircle2, Clock, Users } from 'lucide-react'
import SalesMasterClassCard from '@/views/dashboards/sales/sales-masterclass-card'
import CampaignMonthlyState from '@/views/dashboards/campaign/campaign-monthly-state'
import CampaignStatCards from '@/views/dashboards/campaign/campaign-stat-cards'

export const metadata = {
  title: 'Productivity Dashboard | AdminCN',
  description: 'Team productivity, sprint velocity, task tracking, and milestone completion.'
}

const ProductivityDashboard = () => {
  return (
    <div className='grid grid-cols-6 gap-6'>
      <div className='col-span-full'>
        <div className='flex items-center gap-2 mb-2'>
          <Briefcase className='size-6 text-primary' />
          <h1 className='text-2xl font-bold'>Team Productivity</h1>
        </div>
        <p className='text-sm text-muted-foreground'>Sprint goals, individual output velocity, and collaboration benchmarks.</p>
      </div>

      <CampaignStatCards />
      <CampaignMonthlyState />
      <SalesMasterClassCard />
    </div>
  )
}

export default ProductivityDashboard
