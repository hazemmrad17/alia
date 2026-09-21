import React from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { BarChart3, TrendingUp, DollarSign, Activity, Users, ArrowUpRight } from 'lucide-react'
import CampaignStatCards from '@/views/dashboards/campaign/campaign-stat-cards'
import SalesTransactionOverview from '@/views/dashboards/sales/sales-transaction-overview'
import SalesDetailsRadial from '@/views/dashboards/sales/sales-details-radial'

export const metadata = {
  title: 'Analytics Dashboard | AdminCN',
  description: 'Detailed analytics on user acquisition, conversion rate, and performance.'
}

const AnalyticsDashboard = () => {
  return (
    <div className='grid grid-cols-6 gap-6'>
      <div className='col-span-full'>
        <div className='flex items-center gap-2 mb-2'>
          <BarChart3 className='size-6 text-primary' />
          <h1 className='text-2xl font-bold'>Analytics Overview</h1>
        </div>
        <p className='text-sm text-muted-foreground'>Real-time tracking of platform traffic, conversions, and user retention.</p>
      </div>

      <CampaignStatCards />
      <SalesTransactionOverview />
      <SalesDetailsRadial />
    </div>
  )
}

export default AnalyticsDashboard
