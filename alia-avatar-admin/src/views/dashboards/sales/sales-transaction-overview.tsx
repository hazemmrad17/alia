'use client'

import React from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip } from 'recharts'
import { CircleDollarSign, Wallet, MoreVertical } from 'lucide-react'
import { Button } from '@/components/ui/button'

const weeklyTransactionData = [
  { day: 'Mon', transactions: 35 },
  { day: 'Tue', transactions: 55 },
  { day: 'Wed', transactions: 40 },
  { day: 'Thu', transactions: 70 },
  { day: 'Fri', transactions: 90 },
  { day: 'Sat', transactions: 60 },
  { day: 'Sun', transactions: 45 }
]

export const SalesTransactionOverview = () => {
  return (
    <Card className='col-span-full lg:col-span-4 grid grid-cols-1 md:grid-cols-5 p-0 overflow-hidden'>
      {/* Chart Section */}
      <div className='md:col-span-3 p-6 md:border-r border-border flex flex-col justify-between'>
        <div className='flex items-start justify-between mb-4'>
          <div>
            <h3 className='text-lg font-semibold'>Total Transaction</h3>
            <p className='text-sm text-muted-foreground'>Weekly overview</p>
          </div>
          <Button variant='ghost' size='icon' className='size-8 text-muted-foreground'>
            <MoreVertical className='size-4' />
          </Button>
        </div>

        <div className='h-64 w-full'>
          <ResponsiveContainer width='100%' height='100%'>
            <BarChart data={weeklyTransactionData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <XAxis dataKey='day' stroke='currentColor' className='text-xs text-muted-foreground' tickLine={false} axisLine={false} />
              <YAxis stroke='currentColor' className='text-xs text-muted-foreground' tickLine={false} axisLine={false} />
              <Tooltip cursor={{ fill: 'var(--muted, #f4f4f5)', opacity: 0.5 }} contentStyle={{ backgroundColor: 'var(--card)', borderRadius: '8px', border: '1px solid var(--border)' }} />
              <Bar dataKey='transactions' fill='var(--chart-1, #3b82f6)' radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Report Summary Section */}
      <div className='md:col-span-2 p-6 flex flex-col justify-between bg-muted/20'>
        <div className='flex items-start justify-between'>
          <div>
            <h3 className='text-lg font-semibold'>Report</h3>
            <p className='text-sm text-muted-foreground'>Last month transactions $23.4K</p>
          </div>
          <Button variant='ghost' size='icon' className='size-8 text-muted-foreground'>
            <MoreVertical className='size-4' />
          </Button>
        </div>

        <div className='grid grid-cols-2 gap-4 my-6'>
          <div className='flex flex-col items-center text-center p-3 rounded-xl bg-card border border-border/50'>
            <div className='size-12 rounded-xl bg-chart-5/10 text-chart-5 flex items-center justify-center mb-3'>
              <CircleDollarSign className='size-6' />
            </div>
            <span className='text-xs text-muted-foreground'>This week</span>
            <span className='text-xl font-bold text-emerald-500 mt-1'>+82.46%</span>
          </div>

          <div className='flex flex-col items-center text-center p-3 rounded-xl bg-card border border-border/50'>
            <div className='size-12 rounded-xl bg-chart-2/10 text-chart-2 flex items-center justify-center mb-3'>
              <Wallet className='size-6' />
            </div>
            <span className='text-xs text-muted-foreground'>This week</span>
            <span className='text-xl font-bold text-primary mt-1'>-24.8%</span>
          </div>
        </div>

        <div className='pt-3 border-t border-border flex items-center justify-between'>
          <div className='flex flex-col'>
            <span className='text-xs text-muted-foreground'>Performance</span>
            <span className='text-sm font-semibold'>+94.13%</span>
          </div>
          <Button variant='outline' size='sm' className='h-8'>View Report</Button>
        </div>
      </div>
    </Card>
  )
}
export default SalesTransactionOverview
