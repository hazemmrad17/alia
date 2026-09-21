'use client'

import React from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip } from 'recharts'
import { Button } from '@/components/ui/button'
import { MoreVertical } from 'lucide-react'

const revenueData = [
  { month: 'Jan', revenue: 45000, cost: 28000 },
  { month: 'Feb', revenue: 62000, cost: 35000 },
  { month: 'Mar', revenue: 58000, cost: 32000 },
  { month: 'Apr', revenue: 78000, cost: 42000 },
  { month: 'May', revenue: 95000, cost: 51000 },
  { month: 'Jun', revenue: 84000, cost: 46000 }
]

export const PaymentRevenueChart = () => {
  return (
    <Card className='col-span-full lg:col-span-3 2xl:col-span-4 flex flex-col justify-between'>
      <CardHeader className='flex flex-row items-center justify-between pb-2'>
        <div>
          <CardTitle className='text-lg font-semibold'>Total Revenue</CardTitle>
          <p className='text-xs text-muted-foreground'>Monthly earnings performance</p>
        </div>
        <Button variant='ghost' size='icon' className='size-8 text-muted-foreground'>
          <MoreVertical className='size-4' />
        </Button>
      </CardHeader>

      <CardContent className='pt-4'>
        <div className='h-64 w-full'>
          <ResponsiveContainer width='100%' height='100%'>
            <BarChart data={revenueData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <XAxis dataKey='month' stroke='currentColor' className='text-xs text-muted-foreground' tickLine={false} axisLine={false} />
              <YAxis stroke='currentColor' className='text-xs text-muted-foreground' tickLine={false} axisLine={false} tickFormatter={v => `$${v / 1000}k`} />
              <Tooltip cursor={{ fill: 'var(--muted, #f4f4f5)', opacity: 0.5 }} contentStyle={{ backgroundColor: 'var(--card)', borderRadius: '8px', border: '1px solid var(--border)' }} />
              <Bar dataKey='revenue' fill='var(--primary, #3b82f6)' radius={[4, 4, 0, 0]} />
              <Bar dataKey='cost' fill='var(--chart-3, #f59e0b)' radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
export default PaymentRevenueChart
