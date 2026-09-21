'use client'

import React from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { CreditCard, Landmark, Wallet, ArrowDown, ArrowUp, MoreVertical } from 'lucide-react'

const transactions = [
  {
    title: 'Credit Card',
    subtitle: 'Digital Ocean',
    amount: '-$2,820',
    type: 'expense',
    icon: CreditCard,
    color: 'bg-primary/10 text-primary'
  },
  {
    title: 'Bank account',
    subtitle: 'Received money',
    amount: '+$1,260',
    type: 'income',
    icon: Landmark,
    color: 'bg-emerald-500/10 text-emerald-500'
  },
  {
    title: 'Mastercard',
    subtitle: 'Netflix subscription',
    amount: '-$19.99',
    type: 'expense',
    icon: CreditCard,
    color: 'bg-chart-4/10 text-chart-4'
  },
  {
    title: 'Wallet',
    subtitle: 'MacBook Pro Purchase',
    amount: '-$2,499',
    type: 'expense',
    icon: Wallet,
    color: 'bg-amber-500/10 text-amber-500'
  }
]

export const PaymentTransactionsList = () => {
  return (
    <Card className='col-span-full lg:col-span-3 2xl:col-span-2 flex flex-col justify-between'>
      <CardHeader className='flex flex-row items-center justify-between pb-2'>
        <CardTitle className='text-lg font-semibold'>Transactions</CardTitle>
        <Button variant='ghost' size='icon' className='size-8 text-muted-foreground'>
          <MoreVertical className='size-4' />
        </Button>
      </CardHeader>

      <CardContent className='space-y-4 pt-2'>
        {transactions.map((item, index) => {
          const Icon = item.icon
          return (
            <div key={index} className='flex items-center justify-between gap-2'>
              <div className='flex items-center gap-3'>
                <div className={`size-10 rounded-md flex items-center justify-center ${item.color}`}>
                  <Icon className='size-5' />
                </div>
                <div className='flex flex-col'>
                  <span className='font-semibold text-sm text-foreground'>{item.title}</span>
                  <span className='text-xs text-muted-foreground'>{item.subtitle}</span>
                </div>
              </div>

              <div className='flex items-center gap-2'>
                <span className={`text-sm font-bold ${item.type === 'income' ? 'text-emerald-500' : 'text-foreground'}`}>
                  {item.amount}
                </span>
                <div className={`size-6 rounded-full flex items-center justify-center ${item.type === 'income' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-muted text-muted-foreground'}`}>
                  {item.type === 'income' ? <ArrowUp className='size-3.5' /> : <ArrowDown className='size-3.5' />}
                </div>
              </div>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
export default PaymentTransactionsList
