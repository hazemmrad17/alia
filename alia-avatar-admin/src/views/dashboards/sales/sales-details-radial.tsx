'use client'

import React from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { Store, Globe, ArrowUpRight, ArrowDownRight } from 'lucide-react'

const salesBreakdown = [
  { name: 'Online Store', value: 20000, color: 'var(--chart-1, #3b82f6)' },
  { name: 'Offline Store', value: 12000, color: 'var(--chart-2, #10b981)' }
]

export const SalesDetailsRadial = () => {
  return (
    <Card className='col-span-full lg:col-span-2 flex flex-col justify-between'>
      <CardHeader className='pb-0'>
        <div className='flex items-center justify-between'>
          <CardTitle className='text-lg font-semibold'>Total sales</CardTitle>
          <span className='text-xs font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary'>Details</span>
        </div>
        <div className='flex items-baseline gap-2 mt-2'>
          <span className='text-2xl font-bold'>$2,150.00</span>
          <span className='text-xs font-semibold text-emerald-500'>+5%</span>
        </div>
      </CardHeader>

      <CardContent className='flex flex-col items-center justify-center my-auto py-4'>
        <div className='relative size-44'>
          <ResponsiveContainer width='100%' height='100%'>
            <PieChart>
              <Pie
                data={salesBreakdown}
                cx='50%'
                cy='50%'
                innerRadius={55}
                outerRadius={75}
                paddingAngle={4}
                dataKey='value'
                strokeWidth={0}
              >
                {salesBreakdown.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
          <div className='absolute inset-0 flex flex-col items-center justify-center pointer-events-none'>
            <span className='text-xl font-bold'>84%</span>
            <span className='text-xs text-muted-foreground'>Completed</span>
          </div>
        </div>

        <div className='w-full grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-border'>
          <div className='flex flex-col'>
            <div className='flex items-center gap-1.5 text-xs text-muted-foreground'>
              <Globe className='size-3.5 text-primary' />
              <span>Online Store</span>
            </div>
            <div className='flex items-baseline gap-1 mt-1'>
              <span className='text-base font-bold'>$20k</span>
              <span className='text-xs text-emerald-500 font-semibold'>+12.6%</span>
            </div>
          </div>

          <div className='flex flex-col'>
            <div className='flex items-center gap-1.5 text-xs text-muted-foreground'>
              <Store className='size-3.5 text-emerald-500' />
              <span>Offline Store</span>
            </div>
            <div className='flex items-baseline gap-1 mt-1'>
              <span className='text-base font-bold'>$12k</span>
              <span className='text-xs text-destructive font-semibold'>-4.2%</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
export default SalesDetailsRadial
