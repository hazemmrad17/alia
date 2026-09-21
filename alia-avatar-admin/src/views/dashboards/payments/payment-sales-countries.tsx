'use client'

import React from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { MoreVertical, ChevronUp, ChevronDown } from 'lucide-react'
import Image from 'next/image'

const countries = [
  {
    flag: '/images/flags/austria.webp',
    name: 'Austria',
    amount: '$867k',
    change: '20.3%',
    trend: 'up'
  },
  {
    flag: '/images/flags/china.webp',
    name: 'China',
    amount: '$1.2M',
    change: '15.7%',
    trend: 'up'
  },
  {
    flag: '/images/flags/switzerland.webp',
    name: 'Switzerland',
    amount: '$750k',
    change: '8.4%',
    trend: 'down'
  },
  {
    flag: '/images/flags/brazil.webp',
    name: 'Brazil',
    amount: '$640k',
    change: '12.1%',
    trend: 'up'
  },
  {
    flag: '/images/flags/india.webp',
    name: 'India',
    amount: '$910k',
    change: '18.9%',
    trend: 'up'
  }
]

export const PaymentSalesCountries = () => {
  return (
    <Card className='col-span-full lg:col-span-3 2xl:col-span-2 flex flex-col justify-between'>
      <CardHeader className='flex flex-row items-center justify-between pb-2'>
        <div>
          <CardTitle className='text-lg font-semibold'>Sales by countries</CardTitle>
          <CardDescription className='text-xs'>Monthly sales overview</CardDescription>
        </div>
        <Button variant='ghost' size='icon' className='size-8 text-muted-foreground'>
          <MoreVertical className='size-4' />
        </Button>
      </CardHeader>

      <CardContent className='space-y-4 pt-2'>
        {countries.map((item, index) => (
          <div key={index} className='flex items-center justify-between gap-4'>
            <div className='flex items-center gap-3'>
              <div className='size-9 overflow-hidden rounded-full border border-border/50 relative'>
                <Image src={item.flag} alt={item.name} fill className='object-cover' />
              </div>
              <div className='flex flex-col'>
                <span className='font-bold text-sm text-foreground'>{item.amount}</span>
                <span className='text-xs text-muted-foreground'>{item.name}</span>
              </div>
            </div>

            <span className={`flex items-center gap-0.5 text-xs font-semibold ${item.trend === 'up' ? 'text-emerald-500' : 'text-destructive'}`}>
              {item.trend === 'up' ? <ChevronUp className='size-3.5' /> : <ChevronDown className='size-3.5' />}
              {item.change}
            </span>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
export default PaymentSalesCountries
