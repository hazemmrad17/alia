import React from 'react'
import PaymentStats from '@/views/dashboards/payments/payment-stats'
import PaymentHistoryTable from '@/views/dashboards/payments/payment-history-table'
import PaymentRevenueChart from '@/views/dashboards/payments/payment-revenue-chart'
import PaymentSalesCountries from '@/views/dashboards/payments/payment-sales-countries'
import PaymentTransactionsList from '@/views/dashboards/payments/payment-transactions-list'
import TotalEarningCard from '@/views/dashboards/widgets/widget-total-earning'
import TransactionDatatable, { type Item } from '@/views/datatables/datatable-transaction'
import { Card } from '@/components/ui/card'

export const metadata = {
  title: 'Payments Dashboard | AdminCN',
  description: 'Payment gateway status, processing rates, refunds, and authorizations.'
}

const earningData = [
  {
    img: '/images/widgets/zipcar.webp',
    platform: 'Zipcar',
    technologies: 'Vuejs & HTML',
    earnings: '-$23,569.26',
    progressPercentage: 75
  },
  {
    img: '/images/widgets/bitbank.webp',
    platform: 'Bitbank',
    technologies: 'Figma & React',
    earnings: '-$12,650.31',
    progressPercentage: 25
  },
  {
    img: '/images/widgets/aviato.webp',
    platform: 'Aviato',
    technologies: 'HTML & Angular',
    earnings: '+$18,240.00',
    progressPercentage: 60
  }
]

const transactionData: Item[] = [
  {
    id: '1',
    avatar: '/images/avatars/avatar-1.webp',
    avatarFallback: 'JA',
    name: 'Jack Alfredo',
    amount: 316.0,
    status: 'paid',
    email: 'jack@shadcnstudio.com',
    paidBy: 'mastercard'
  },
  {
    id: '2',
    avatar: '/images/avatars/avatar-2.webp',
    avatarFallback: 'MG',
    name: 'Maria Gonzalez',
    amount: 253.4,
    status: 'pending',
    email: 'maria.g@shadcnstudio.com',
    paidBy: 'visa'
  },
  {
    id: '3',
    avatar: '/images/avatars/avatar-3.webp',
    avatarFallback: 'JD',
    name: 'John Doe',
    amount: 852.0,
    status: 'paid',
    email: 'john.doe@shadcnstudio.com',
    paidBy: 'mastercard'
  },
  {
    id: '4',
    avatar: '/images/avatars/avatar-4.webp',
    avatarFallback: 'EC',
    name: 'Emily Carter',
    amount: 889.0,
    status: 'pending',
    email: 'emily.carter@shadcnstudio.com',
    paidBy: 'visa'
  },
  {
    id: '5',
    avatar: '/images/avatars/avatar-5.webp',
    avatarFallback: 'DL',
    name: 'David Lee',
    amount: 723.16,
    status: 'paid',
    email: 'david.lee@shadcnstudio.com',
    paidBy: 'mastercard'
  }
]

const PaymentsDashboard = () => {
  return (
    <div className='grid grid-cols-6 gap-6'>
      {/* 3 Top Stat Cards */}
      <PaymentStats />

      {/* Payment History Table & Total Revenue Chart */}
      <PaymentHistoryTable />
      <PaymentRevenueChart />

      {/* Sales by Countries */}
      <PaymentSalesCountries />

      {/* Transactions List */}
      <PaymentTransactionsList />

      {/* Total Earning */}
      <TotalEarningCard
        title='Total Earning'
        earning={24650}
        trend='up'
        percentage={10}
        comparisonText='Compare to last year ($84,325)'
        earningData={earningData}
        className='col-span-full lg:col-span-3 2xl:col-span-2 justify-between gap-5'
      />

      {/* Full Transaction Datatable */}
      <Card className='col-span-full w-full py-0'>
        <TransactionDatatable data={transactionData} />
      </Card>
    </div>
  )
}

export default PaymentsDashboard
