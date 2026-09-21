'use client'

import React from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip
} from 'recharts'
import { ArrowUpRight, ArrowDownRight, TrendingUp, TrendingDown, DollarSign } from 'lucide-react'

const profitData = [
  { day: 'Mon', current: 40, previous: 24 },
  { day: 'Tue', current: 30, previous: 13 },
  { day: 'Wed', current: 20, previous: 38 },
  { day: 'Thu', current: 67, previous: 39 },
  { day: 'Fri', current: 48, previous: 48 },
  { day: 'Sat', current: 75, previous: 38 },
  { day: 'Sun', current: 55, previous: 43 }
]

const orderData = [
  { day: 'M', orders: 40 },
  { day: 'T', orders: 65 },
  { day: 'W', orders: 35 },
  { day: 'T', orders: 85 },
  { day: 'F', orders: 45 },
  { day: 'S', orders: 70 },
  { day: 'S', orders: 50 }
]

const profitMonthData = [
  { month: 'Jan', value: 30 },
  { month: 'Feb', value: 45 },
  { month: 'Mar', value: 35 },
  { month: 'Apr', value: 65 },
  { month: 'May', value: 50 },
  { month: 'Jun', value: 75 },
  { month: 'Jul', value: 85 }
]

const userReachData = [
  { day: '1', reach: 20 },
  { day: '2', reach: 35 },
  { day: '3', reach: 28 },
  { day: '4', reach: 52 },
  { day: '5', reach: 45 },
  { day: '6', reach: 68 },
  { day: '7', reach: 60 }
]

export const SalesStatCards = () => {
  return (
    <>
      {/* 1. Total Profit */}
      <Card className='justify-between col-span-6 sm:col-span-3 lg:col-span-2 max-xl:col-span-2 max-md:col-span-3'>
        <CardHeader className='pb-2'>
          <div className='flex items-center gap-2'>
            <CardTitle className='text-xl font-bold'>$88.5k</CardTitle>
            <span className='flex items-center text-sm font-medium text-destructive'>
              -18% <ArrowDownRight className='size-4' />
            </span>
          </div>
          <CardDescription className='text-sm'>Total Profit</CardDescription>
        </CardHeader>
        <CardContent className='pt-0'>
          <div className='h-24 w-full'>
            <ResponsiveContainer width='100%' height='100%'>
              <AreaChart data={profitData} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id='colorProfit' x1='0' y1='0' x2='0' y2='1'>
                    <stop offset='5%' stopColor='var(--chart-4, #a855f7)' stopOpacity={0.4} />
                    <stop offset='95%' stopColor='var(--chart-4, #a855f7)' stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area
                  type='monotone'
                  dataKey='current'
                  stroke='var(--chart-4, #a855f7)'
                  strokeWidth={2}
                  fillOpacity={1}
                  fill='url(#colorProfit)'
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* 2. Order Last Week */}
      <Card className='col-span-6 sm:col-span-3 lg:col-span-2 max-xl:col-span-2 max-md:col-span-3'>
        <CardHeader className='pb-2'>
          <CardTitle className='text-lg font-semibold'>Order</CardTitle>
          <CardDescription className='text-sm'>Last week</CardDescription>
        </CardHeader>
        <CardContent className='pt-0'>
          <div className='h-16 w-full mb-2'>
            <ResponsiveContainer width='100%' height='100%'>
              <BarChart data={orderData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                <Bar dataKey='orders' fill='var(--primary, #3b82f6)' radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className='flex items-center justify-between'>
            <span className='text-xl font-bold'>124K</span>
            <span className='flex items-center text-sm font-semibold text-primary'>
              +12.6% <ArrowUpRight className='size-4' />
            </span>
          </div>
        </CardContent>
      </Card>

      {/* 3. Profit Last Month */}
      <Card className='col-span-6 sm:col-span-3 lg:col-span-2 max-xl:col-span-2 max-md:col-span-3'>
        <CardHeader className='pb-2'>
          <CardTitle className='text-lg font-semibold'>Profit</CardTitle>
          <CardDescription className='text-sm'>Last Month</CardDescription>
        </CardHeader>
        <CardContent className='pt-0'>
          <div className='h-16 w-full mb-2'>
            <ResponsiveContainer width='100%' height='100%'>
              <AreaChart data={profitMonthData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id='colorMonthProfit' x1='0' y1='0' x2='0' y2='1'>
                    <stop offset='5%' stopColor='var(--chart-2, #10b981)' stopOpacity={0.4} />
                    <stop offset='95%' stopColor='var(--chart-2, #10b981)' stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area
                  type='monotone'
                  dataKey='value'
                  stroke='var(--chart-2, #10b981)'
                  strokeWidth={2}
                  fillOpacity={1}
                  fill='url(#colorMonthProfit)'
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className='flex items-center justify-between'>
            <span className='text-xl font-bold'>624K</span>
            <span className='flex items-center text-sm font-semibold text-emerald-500'>
              +12.6% <ArrowUpRight className='size-4' />
            </span>
          </div>
        </CardContent>
      </Card>

      {/* 4. User Reach */}
      <Card className='col-span-6 sm:col-span-3 lg:col-span-2 max-xl:col-span-2 max-md:col-span-3'>
        <CardHeader className='pb-2'>
          <CardTitle className='text-lg font-semibold'>User reach</CardTitle>
          <CardDescription className='text-sm'>Last week</CardDescription>
        </CardHeader>
        <CardContent className='pt-0'>
          <div className='h-16 w-full mb-2'>
            <ResponsiveContainer width='100%' height='100%'>
              <LineChart data={userReachData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                <Line
                  type='monotone'
                  dataKey='reach'
                  stroke='var(--chart-3, #f59e0b)'
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className='flex items-center justify-between'>
            <span className='text-xl font-bold'>32K</span>
            <span className='flex items-center text-sm font-semibold text-amber-500'>
              +12% <ArrowUpRight className='size-4' />
            </span>
          </div>
        </CardContent>
      </Card>

      {/* 5. Total Income */}
      <Card className='col-span-6 sm:col-span-3 lg:col-span-2 max-xl:col-span-2 max-md:col-span-3'>
        <CardContent className='p-6 flex flex-col justify-between h-full'>
          <div className='flex items-center justify-between'>
            <span className='text-sm font-medium text-muted-foreground'>Total Income</span>
            <span className='text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium'>Last week</span>
          </div>
          <div className='flex items-baseline justify-between mt-4'>
            <span className='text-2xl font-bold'>$4,673</span>
            <span className='flex items-center text-sm font-semibold text-emerald-500'>
              +25.2% <TrendingUp className='size-4 ml-1' />
            </span>
          </div>
        </CardContent>
      </Card>

      {/* 6. Total Expense */}
      <Card className='col-span-6 sm:col-span-3 lg:col-span-2 max-xl:col-span-2 max-md:col-span-3'>
        <CardContent className='p-6 flex flex-col justify-between h-full'>
          <div className='flex items-center justify-between'>
            <span className='text-sm font-medium text-muted-foreground'>Total Expense</span>
            <span className='text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium'>Last month</span>
          </div>
          <div className='flex items-baseline justify-between mt-4'>
            <span className='text-2xl font-bold'>$1.28K</span>
            <span className='flex items-center text-sm font-semibold text-destructive'>
              -12.2% <TrendingDown className='size-4 ml-1' />
            </span>
          </div>
        </CardContent>
      </Card>
    </>
  )
}
export default SalesStatCards
