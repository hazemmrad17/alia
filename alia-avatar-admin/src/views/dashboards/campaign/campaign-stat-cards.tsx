'use client'

import React from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  TicketCheck,
  ShoppingCart,
  DollarSign,
  BookMarked,
  ChevronUp,
  ChevronDown,
  Users
} from 'lucide-react'

export const CampaignStatCards = () => {
  return (
    <>
      <div className='col-span-full xl:col-span-2 grid grid-cols-2 gap-6'>
        {/* Total Sales */}
        <Card className='justify-between'>
          <CardHeader className='flex flex-row items-center justify-between pb-2'>
            <Avatar className='size-9.5 rounded-md'>
              <AvatarFallback className='bg-chart-1/10 text-chart-1 rounded-md'>
                <TicketCheck className='size-5' />
              </AvatarFallback>
            </Avatar>
            <span className='flex items-center text-sm font-semibold text-emerald-500'>
              +38% <ChevronUp className='size-4' />
            </span>
          </CardHeader>
          <CardContent className='flex flex-col gap-3'>
            <div>
              <div className='text-xl font-bold'>$13.4k</div>
              <div className='text-xs text-muted-foreground'>Total Sales</div>
            </div>
            <Badge variant='secondary' className='w-fit text-[11px] font-normal bg-primary/10 text-primary'>
              Last 6 months
            </Badge>
          </CardContent>
        </Card>

        {/* Total Orders */}
        <Card className='justify-between'>
          <CardHeader className='flex flex-row items-center justify-between pb-2'>
            <Avatar className='size-9.5 rounded-md'>
              <AvatarFallback className='bg-chart-2/10 text-chart-2 rounded-md'>
                <ShoppingCart className='size-5' />
              </AvatarFallback>
            </Avatar>
            <span className='flex items-center text-sm font-semibold text-emerald-500'>
              +22% <ChevronUp className='size-4' />
            </span>
          </CardHeader>
          <CardContent className='flex flex-col gap-3'>
            <div>
              <div className='text-xl font-bold'>155K</div>
              <div className='text-xs text-muted-foreground'>Total Orders</div>
            </div>
            <Badge variant='secondary' className='w-fit text-[11px] font-normal bg-primary/10 text-primary'>
              Last 4 months
            </Badge>
          </CardContent>
        </Card>

        {/* Total Profit */}
        <Card className='justify-between'>
          <CardHeader className='flex flex-row items-center justify-between pb-2'>
            <Avatar className='size-9.5 rounded-md'>
              <AvatarFallback className='bg-chart-3/10 text-chart-3 rounded-md'>
                <DollarSign className='size-5' />
              </AvatarFallback>
            </Avatar>
            <span className='flex items-center text-sm font-semibold text-destructive'>
              -16% <ChevronDown className='size-4' />
            </span>
          </CardHeader>
          <CardContent className='flex flex-col gap-3'>
            <div>
              <div className='text-xl font-bold'>$89.34k</div>
              <div className='text-xs text-muted-foreground'>Total Profit</div>
            </div>
            <Badge variant='secondary' className='w-fit text-[11px] font-normal bg-primary/10 text-primary'>
              Last One year
            </Badge>
          </CardContent>
        </Card>

        {/* Bookmarks */}
        <Card className='justify-between'>
          <CardHeader className='flex flex-row items-center justify-between pb-2'>
            <Avatar className='size-9.5 rounded-md'>
              <AvatarFallback className='bg-chart-4/10 text-chart-4 rounded-md'>
                <BookMarked className='size-5' />
              </AvatarFallback>
            </Avatar>
            <span className='flex items-center text-sm font-semibold text-emerald-500'>
              +38% <ChevronUp className='size-4' />
            </span>
          </CardHeader>
          <CardContent className='flex flex-col gap-3'>
            <div>
              <div className='text-xl font-bold'>$1,200</div>
              <div className='text-xs text-muted-foreground'>Bookmarks</div>
            </div>
            <Badge variant='secondary' className='w-fit text-[11px] font-normal bg-primary/10 text-primary'>
              Last 6 months
            </Badge>
          </CardContent>
        </Card>
      </div>

      {/* Customers Card with Illustration */}
      <Card className='col-span-full xl:col-span-1 flex flex-col justify-between relative overflow-hidden'>
        <CardHeader className='pb-2'>
          <div className='flex items-center justify-between'>
            <CardTitle className='text-base font-semibold'>Customers</CardTitle>
            <Badge variant='secondary' className='bg-primary/10 text-primary text-[11px]'>
              Daily customers
            </Badge>
          </div>
        </CardHeader>
        <CardContent className='pt-2'>
          <div className='flex items-baseline gap-2'>
            <span className='text-3xl font-bold'>42.4k</span>
            <span className='text-sm font-semibold text-emerald-500'>+9.2%</span>
          </div>
          <p className='text-xs text-muted-foreground mt-1'>
            Target reached: 88% of daily estimated target.
          </p>
        </CardContent>

        {/* Abstract decorative wave illustration */}
        <div className='w-full h-24 mt-auto opacity-80 flex items-end'>
          <svg className='w-full h-full text-primary/20' viewBox='0 0 100 40' preserveAspectRatio='none'>
            <path
              d='M0 30 C 20 10, 40 35, 60 15 C 80 0, 90 25, 100 20 L 100 40 L 0 40 Z'
              fill='currentColor'
            />
            <path
              d='M0 35 C 30 20, 50 40, 70 25 C 85 15, 95 30, 100 28 L 100 40 L 0 40 Z'
              fill='currentColor'
              opacity='0.5'
            />
          </svg>
        </div>
      </Card>
    </>
  )
}
export default CampaignStatCards
