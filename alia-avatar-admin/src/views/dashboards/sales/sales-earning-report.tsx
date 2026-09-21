'use client'

import React, { useState } from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip } from 'recharts'
import { ArrowUpRight, MoreVertical } from 'lucide-react'
import { Button } from '@/components/ui/button'

const netProfitData = [
  { day: 'Mo', value: 45 },
  { day: 'Tu', value: 30 },
  { day: 'We', value: 65 },
  { day: 'Th', value: 40 },
  { day: 'Fr', value: 85 },
  { day: 'Sa', value: 50 },
  { day: 'Su', value: 70 }
]

const totalIncomeData = [
  { day: 'Mo', value: 60 },
  { day: 'Tu', value: 75 },
  { day: 'We', value: 40 },
  { day: 'Th', value: 90 },
  { day: 'Fr', value: 65 },
  { day: 'Sa', value: 80 },
  { day: 'Su', value: 95 }
]

const totalExpenseData = [
  { day: 'Mo', value: 25 },
  { day: 'Tu', value: 40 },
  { day: 'We', value: 20 },
  { day: 'Th', value: 50 },
  { day: 'Fr', value: 35 },
  { day: 'Sa', value: 45 },
  { day: 'Su', value: 30 }
]

export const SalesEarningReport = () => {
  return (
    <Card className='col-span-full lg:col-span-4 flex flex-col justify-between'>
      <CardHeader className='pb-2'>
        <div className='flex items-start justify-between'>
          <div>
            <CardTitle className='text-lg font-semibold'>Earning Report</CardTitle>
            <CardDescription className='text-sm'>Weekly Earning overview</CardDescription>
          </div>
          <Button variant='ghost' size='icon' className='size-8 text-muted-foreground'>
            <MoreVertical className='size-4' />
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        <Tabs defaultValue='profit' className='w-full'>
          <TabsList className='grid grid-cols-3 w-full mb-6'>
            <TabsTrigger value='profit' className='text-xs py-2'>Net profit</TabsTrigger>
            <TabsTrigger value='income' className='text-xs py-2'>Total income</TabsTrigger>
            <TabsTrigger value='expense' className='text-xs py-2'>Total expense</TabsTrigger>
          </TabsList>

          <TabsContent value='profit' className='space-y-4'>
            <div className='flex items-baseline gap-3'>
              <span className='text-3xl font-bold'>$1,623</span>
              <span className='flex items-center text-xs font-semibold text-emerald-500'>
                +20.3% <ArrowUpRight className='size-3.5' />
              </span>
              <span className='text-xs text-muted-foreground ml-auto'>Sales overview</span>
            </div>
            <div className='h-52 w-full'>
              <ResponsiveContainer width='100%' height='100%'>
                <BarChart data={netProfitData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <XAxis dataKey='day' stroke='currentColor' className='text-xs text-muted-foreground' tickLine={false} axisLine={false} />
                  <YAxis stroke='currentColor' className='text-xs text-muted-foreground' tickLine={false} axisLine={false} />
                  <Tooltip cursor={{ fill: 'var(--muted, #f4f4f5)', opacity: 0.5 }} contentStyle={{ backgroundColor: 'var(--card)', borderRadius: '8px', border: '1px solid var(--border)' }} />
                  <Bar dataKey='value' fill='var(--chart-1, #3b82f6)' radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </TabsContent>

          <TabsContent value='income' className='space-y-4'>
            <div className='flex items-baseline gap-3'>
              <span className='text-3xl font-bold'>$5,600</span>
              <span className='flex items-center text-xs font-semibold text-emerald-500'>
                +16.2% <ArrowUpRight className='size-3.5' />
              </span>
              <span className='text-xs text-muted-foreground ml-auto'>Sales, Affiliation</span>
            </div>
            <div className='h-52 w-full'>
              <ResponsiveContainer width='100%' height='100%'>
                <BarChart data={totalIncomeData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <XAxis dataKey='day' stroke='currentColor' className='text-xs text-muted-foreground' tickLine={false} axisLine={false} />
                  <YAxis stroke='currentColor' className='text-xs text-muted-foreground' tickLine={false} axisLine={false} />
                  <Tooltip cursor={{ fill: 'var(--muted, #f4f4f5)', opacity: 0.5 }} contentStyle={{ backgroundColor: 'var(--card)', borderRadius: '8px', border: '1px solid var(--border)' }} />
                  <Bar dataKey='value' fill='var(--chart-2, #10b981)' radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </TabsContent>

          <TabsContent value='expense' className='space-y-4'>
            <div className='flex items-baseline gap-3'>
              <span className='text-3xl font-bold'>$980</span>
              <span className='flex items-center text-xs font-semibold text-destructive'>
                -5.4%
              </span>
              <span className='text-xs text-muted-foreground ml-auto'>ADVT, Marketing</span>
            </div>
            <div className='h-52 w-full'>
              <ResponsiveContainer width='100%' height='100%'>
                <BarChart data={totalExpenseData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <XAxis dataKey='day' stroke='currentColor' className='text-xs text-muted-foreground' tickLine={false} axisLine={false} />
                  <YAxis stroke='currentColor' className='text-xs text-muted-foreground' tickLine={false} axisLine={false} />
                  <Tooltip cursor={{ fill: 'var(--muted, #f4f4f5)', opacity: 0.5 }} contentStyle={{ backgroundColor: 'var(--card)', borderRadius: '8px', border: '1px solid var(--border)' }} />
                  <Bar dataKey='value' fill='var(--chart-5, #f43f5e)' radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
export default SalesEarningReport
