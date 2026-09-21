'use client'

import React from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { AreaChart, Area, BarChart, Bar, ResponsiveContainer } from 'recharts'
import { TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight } from 'lucide-react'

const incomeData = [
  { val: 30 },
  { val: 45 },
  { val: 35 },
  { val: 65 },
  { val: 55 },
  { val: 75 },
  { val: 90 }
]

const expenseData = [
  { val: 40 },
  { val: 60 },
  { val: 30 },
  { val: 70 },
  { val: 50 },
  { val: 80 },
  { val: 45 }
]

export const PaymentStats = () => {
  return (
    <>
      {/* 1. Income this month */}
      <Card className='col-span-full sm:col-span-3 2xl:col-span-2 flex flex-col justify-between p-6'>
        <div className='flex items-start justify-between'>
          <div className='space-y-1'>
            <span className='text-sm text-muted-foreground'>Income this month</span>
            <div className='text-2xl font-bold'>$5,280</div>
            <div className='flex items-center gap-1 text-xs text-emerald-500 font-semibold'>
              +12.2% <ArrowUpRight className='size-3.5' />
              <span className='text-muted-foreground font-normal'>vs Last month</span>
            </div>
          </div>
          <div className='size-20'>
            <ResponsiveContainer width='100%' height='100%'>
              <AreaChart data={incomeData}>
                <defs>
                  <linearGradient id='colorPayIncome' x1='0' y1='0' x2='0' y2='1'>
                    <stop offset='5%' stopColor='var(--primary, #3b82f6)' stopOpacity={0.4} />
                    <stop offset='95%' stopColor='var(--primary, #3b82f6)' stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area type='monotone' dataKey='val' stroke='var(--primary, #3b82f6)' strokeWidth={2} fill='url(#colorPayIncome)' />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </Card>

      {/* 2. Expense this month */}
      <Card className='col-span-full sm:col-span-3 2xl:col-span-2 flex flex-col justify-between p-6'>
        <div className='flex items-start justify-between'>
          <div className='space-y-1'>
            <span className='text-sm text-muted-foreground'>Expense this month</span>
            <div className='text-2xl font-bold'>$4,120</div>
            <div className='flex items-center gap-1 text-xs text-destructive font-semibold'>
              -12.2% <ArrowDownRight className='size-3.5' />
              <span className='text-muted-foreground font-normal'>vs Last month</span>
            </div>
          </div>
          <div className='size-20'>
            <ResponsiveContainer width='100%' height='100%'>
              <BarChart data={expenseData}>
                <Bar dataKey='val' fill='var(--chart-5, #f43f5e)' radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </Card>

      {/* 3. Total orders */}
      <Card className='col-span-full sm:col-span-6 2xl:col-span-2 flex flex-col justify-between p-6'>
        <div className='flex items-center justify-between'>
          <span className='text-base font-semibold'>Total orders</span>
          <span className='text-xs text-muted-foreground'>Last Week</span>
        </div>
        <div className='flex items-baseline justify-between mt-4'>
          <span className='text-3xl font-bold'>42.4k</span>
          <span className='flex items-center text-sm font-semibold text-emerald-500'>
            +10.8% <ArrowUpRight className='size-4' />
          </span>
        </div>
      </Card>
    </>
  )
}
export default PaymentStats
