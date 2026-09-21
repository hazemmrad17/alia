'use client'

import React from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip } from 'recharts'
import { Button } from '@/components/ui/button'
import { MoreVertical, TrendingUp, TrendingDown } from 'lucide-react'

const incomeOverviewData = [
  { day: 'Mon', income: 45, expense: 28 },
  { day: 'Tue', income: 60, expense: 35 },
  { day: 'Wed', income: 38, expense: 22 },
  { day: 'Thu', income: 75, expense: 45 },
  { day: 'Fri', income: 95, expense: 55 },
  { day: 'Sat', income: 70, expense: 40 },
  { day: 'Sun', income: 50, expense: 30 }
]

export const CampaignIncomeChart = () => {
  return (
    <Card className='col-span-full lg:col-span-4 grid grid-cols-1 md:grid-cols-5 p-0 overflow-hidden'>
      {/* Chart */}
      <div className='md:col-span-3 p-6 md:border-r border-border flex flex-col justify-between'>
        <div className='flex items-start justify-between mb-4'>
          <div>
            <h3 className='text-lg font-semibold'>Total Income</h3>
            <p className='text-sm text-muted-foreground'>Weekly report overview</p>
          </div>
          <Button variant='ghost' size='icon' className='size-8 text-muted-foreground'>
            <MoreVertical className='size-4' />
          </Button>
        </div>

        <div className='h-64 w-full'>
          <ResponsiveContainer width='100%' height='100%'>
            <BarChart data={incomeOverviewData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <XAxis dataKey='day' stroke='currentColor' className='text-xs text-muted-foreground' tickLine={false} axisLine={false} />
              <YAxis stroke='currentColor' className='text-xs text-muted-foreground' tickLine={false} axisLine={false} />
              <Tooltip cursor={{ fill: 'var(--muted, #f4f4f5)', opacity: 0.5 }} contentStyle={{ backgroundColor: 'var(--card)', borderRadius: '8px', border: '1px solid var(--border)' }} />
              <Bar dataKey='income' fill='var(--primary, #3b82f6)' radius={[4, 4, 0, 0]} />
              <Bar dataKey='expense' fill='var(--chart-4, #a855f7)' radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Report Breakdown */}
      <div className='md:col-span-2 p-6 flex flex-col justify-between bg-muted/20'>
        <div className='flex items-start justify-between'>
          <div>
            <h3 className='text-lg font-semibold'>Report</h3>
            <p className='text-sm text-muted-foreground'>Weekly activity summary</p>
          </div>
          <Button variant='ghost' size='icon' className='size-8 text-muted-foreground'>
            <MoreVertical className='size-4' />
          </Button>
        </div>

        <div className='space-y-4 my-6'>
          <div className='p-3 rounded-xl bg-card border border-border/50 flex items-center justify-between'>
            <div className='flex items-center gap-3'>
              <div className='size-3 rounded-full bg-primary' />
              <div className='flex flex-col'>
                <span className='text-sm font-semibold'>Income</span>
                <span className='text-xs text-muted-foreground'>Total revenue earned</span>
              </div>
            </div>
            <div className='text-right'>
              <span className='text-base font-bold'>$5,550</span>
              <span className='flex items-center justify-end text-xs text-emerald-500 font-semibold'>
                +14.2% <TrendingUp className='size-3 ml-0.5' />
              </span>
            </div>
          </div>

          <div className='p-3 rounded-xl bg-card border border-border/50 flex items-center justify-between'>
            <div className='flex items-center gap-3'>
              <div className='size-3 rounded-full bg-chart-4' />
              <div className='flex flex-col'>
                <span className='text-sm font-semibold'>Expense</span>
                <span className='text-xs text-muted-foreground'>Ad spending & campaigns</span>
              </div>
            </div>
            <div className='text-right'>
              <span className='text-base font-bold'>$1,850</span>
              <span className='flex items-center justify-end text-xs text-destructive font-semibold'>
                -4.8% <TrendingDown className='size-3 ml-0.5' />
              </span>
            </div>
          </div>
        </div>

        <div className='pt-3 border-t border-border flex items-center justify-between'>
          <span className='text-xs text-muted-foreground'>Net Profit: <strong className='text-foreground text-sm'>$3,700</strong></span>
          <Button variant='outline' size='sm' className='h-8'>Full Report</Button>
        </div>
      </div>
    </Card>
  )
}
export default CampaignIncomeChart
