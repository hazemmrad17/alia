'use client'

import React from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { MoreVertical, TrendingUp, CheckCircle2, DollarSign } from 'lucide-react'
import { Button } from '@/components/ui/button'

const radialData = [
  { name: 'Total Revenue', value: 87, color: 'var(--primary, #3b82f6)' },
  { name: 'Remaining', value: 13, color: 'var(--muted, #e4e4e7)' }
]

export const CampaignTotalEarning = () => {
  return (
    <Card className='col-span-full lg:col-span-2 flex flex-col justify-between'>
      <CardHeader>
        <div className='flex items-start justify-between'>
          <div>
            <CardTitle className='text-base font-semibold'>Total earning</CardTitle>
            <div className='flex items-baseline gap-2 mt-1'>
              <span className='text-2xl font-bold'>87%</span>
              <span className='flex items-center text-xs font-semibold text-emerald-500'>
                +38% <TrendingUp className='size-3 ml-0.5' />
              </span>
            </div>
          </div>
          <Button variant='ghost' size='icon' className='size-8 text-muted-foreground'>
            <MoreVertical className='size-4' />
          </Button>
        </div>
      </CardHeader>

      <CardContent className='flex flex-col items-center py-2'>
        <div className='relative size-40'>
          <ResponsiveContainer width='100%' height='100%'>
            <PieChart>
              <Pie
                data={radialData}
                cx='50%'
                cy='50%'
                innerRadius={50}
                outerRadius={68}
                startAngle={90}
                endAngle={-270}
                paddingAngle={0}
                dataKey='value'
                strokeWidth={0}
              >
                {radialData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className='absolute inset-0 flex flex-col items-center justify-center pointer-events-none'>
            <DollarSign className='size-6 text-primary' />
            <span className='text-xs font-semibold text-muted-foreground mt-0.5'>$48.2k</span>
          </div>
        </div>

        <div className='w-full grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-border text-xs'>
          <div className='flex items-center gap-2'>
            <div className='size-2.5 rounded-full bg-primary' />
            <div className='flex flex-col'>
              <span className='font-medium text-foreground'>Total revenue</span>
              <span className='text-muted-foreground font-semibold'>$48,250</span>
            </div>
          </div>

          <div className='flex items-center gap-2'>
            <div className='size-2.5 rounded-full bg-chart-2' />
            <div className='flex flex-col'>
              <span className='font-medium text-foreground'>Successful</span>
              <span className='text-muted-foreground font-semibold'>98.4%</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
export default CampaignTotalEarning
