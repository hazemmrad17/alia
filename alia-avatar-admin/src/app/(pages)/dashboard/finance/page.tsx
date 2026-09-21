import React from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Wallet, DollarSign, TrendingUp, CreditCard, ArrowUpRight } from 'lucide-react'
import SalesStatCards from '@/views/dashboards/sales/sales-stat-cards'
import SalesEarningReport from '@/views/dashboards/sales/sales-earning-report'
import SalesUpgradePlan from '@/views/dashboards/sales/sales-upgrade-plan'
import SalesInvoiceDatatable from '@/views/dashboards/sales/sales-invoice-datatable'

export const metadata = {
  title: 'Finance Dashboard | AdminCN',
  description: 'Financial accounting, cash flow, expenses, and transaction records.'
}

const FinanceDashboard = () => {
  return (
    <div className='grid grid-cols-6 gap-6'>
      <div className='col-span-full'>
        <div className='flex items-center gap-2 mb-2'>
          <Wallet className='size-6 text-emerald-500' />
          <h1 className='text-2xl font-bold'>Financial Management</h1>
        </div>
        <p className='text-sm text-muted-foreground'>Monitor liquidity, cash-flow velocity, and automated invoicing.</p>
      </div>

      <SalesStatCards />
      <SalesEarningReport />
      <SalesUpgradePlan />
      <SalesInvoiceDatatable />
    </div>
  )
}

export default FinanceDashboard
