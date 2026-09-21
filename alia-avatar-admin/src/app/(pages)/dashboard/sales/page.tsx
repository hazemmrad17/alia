import React from 'react'
import SalesStatCards from '@/views/dashboards/sales/sales-stat-cards'
import SalesTransactionOverview from '@/views/dashboards/sales/sales-transaction-overview'
import SalesDetailsRadial from '@/views/dashboards/sales/sales-details-radial'
import SalesUpgradePlan from '@/views/dashboards/sales/sales-upgrade-plan'
import SalesEarningReport from '@/views/dashboards/sales/sales-earning-report'
import SalesMasterClassCard from '@/views/dashboards/sales/sales-masterclass-card'
import SalesInvoiceDatatable from '@/views/dashboards/sales/sales-invoice-datatable'

export const metadata = {
  title: 'Sales Dashboard | AdminCN',
  description: 'Overview of sales metrics, transactions, revenue, and invoices.'
}

const SalesDashboard = () => {
  return (
    <div className='grid grid-cols-6 gap-6'>
      {/* 6 Top Stat & Metric Cards */}
      <SalesStatCards />

      {/* Total Transaction & Report Overview */}
      <SalesTransactionOverview />

      {/* Total Sales Radial Breakdown */}
      <SalesDetailsRadial />

      {/* Upgrade Your Plan */}
      <SalesUpgradePlan />

      {/* Earning Report with Tabs */}
      <SalesEarningReport />

      {/* Design Strategy Master Class Event */}
      <SalesMasterClassCard />

      {/* Invoice & Sales Datatable */}
      <SalesInvoiceDatatable />
    </div>
  )
}

export default SalesDashboard
