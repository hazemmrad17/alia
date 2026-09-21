import React from 'react'
import CampaignStatCards from '@/views/dashboards/campaign/campaign-stat-cards'
import CampaignIncomeChart from '@/views/dashboards/campaign/campaign-income-chart'
import CampaignMonthlyState from '@/views/dashboards/campaign/campaign-monthly-state'
import CampaignTotalEarning from '@/views/dashboards/campaign/campaign-total-earning'
import CampaignBusinessCard from '@/views/dashboards/campaign/campaign-business-card'
import CampaignVehiclesCard from '@/views/dashboards/campaign/campaign-vehicles-card'
import CampaignPerformanceTable from '@/views/dashboards/campaign/campaign-performance-table'

export const metadata = {
  title: 'Campaign Dashboard | AdminCN',
  description: 'Marketing campaign performance, channels, reach, and analytics.'
}

const CampaignDashboard = () => {
  return (
    <div className='grid grid-cols-2 gap-6 xl:grid-cols-3'>
      {/* Top 5 Stat & Customer Cards */}
      <CampaignStatCards />

      {/* Total Income & Expense Chart */}
      <CampaignIncomeChart />

      {/* Monthly Campaign State */}
      <CampaignMonthlyState />

      {/* Total Earning Radial Widget */}
      <CampaignTotalEarning />

      {/* Business Shark Plan */}
      <CampaignBusinessCard />

      {/* Campaign Condition / Fleet Widget */}
      <CampaignVehiclesCard />

      {/* Campaign Performance Table */}
      <CampaignPerformanceTable />
    </div>
  )
}

export default CampaignDashboard
