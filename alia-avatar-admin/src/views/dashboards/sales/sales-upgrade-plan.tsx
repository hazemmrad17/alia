'use client'

import React from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { CreditCard, Sparkles, Plus, MoreVertical } from 'lucide-react'
import Image from 'next/image'

export const SalesUpgradePlan = () => {
  return (
    <Card className='col-span-full lg:col-span-2 flex flex-col justify-between relative overflow-hidden'>
      {/* Decorative gradient / background */}
      <div className='absolute top-0 right-0 -mt-8 -mr-8 size-36 rounded-full bg-primary/10 blur-2xl pointer-events-none' />

      <CardHeader>
        <div className='flex items-start justify-between'>
          <div>
            <CardTitle className='text-lg font-semibold flex items-center gap-2'>
              <Sparkles className='size-4 text-amber-500' />
              Upgrade your plan
            </CardTitle>
            <CardDescription className='text-xs mt-1 leading-relaxed'>
              To fully enjoy all the amazing features and benefits of our premium plan.
            </CardDescription>
          </div>
          <Button variant='ghost' size='icon' className='size-8 text-muted-foreground'>
            <MoreVertical className='size-4' />
          </Button>
        </div>
      </CardHeader>

      <CardContent className='space-y-4'>
        {/* Tier Box */}
        <div className='p-4 rounded-xl bg-muted/40 border border-border flex items-center justify-between'>
          <div className='flex flex-col'>
            <span className='text-sm font-bold text-foreground'>Platinum</span>
            <span className='text-xs text-muted-foreground'>Last 6 months</span>
          </div>
          <div className='flex items-baseline gap-1'>
            <span className='text-xl font-bold text-primary'>$5,550</span>
            <span className='text-xs text-muted-foreground'>/Year</span>
          </div>
        </div>

        {/* Payment Methods */}
        <div className='space-y-2'>
          <span className='text-xs font-medium text-muted-foreground'>Payment details</span>
          <div className='p-3 rounded-lg border border-border flex items-center justify-between text-xs'>
            <div className='flex items-center gap-2'>
              <Image src='/images/widgets/master-card.webp' alt='Mastercard' width={24} height={16} className='object-contain' />
              <span className='font-medium'>5688 •••• •••• 2356</span>
            </div>
            <span className='text-muted-foreground text-[11px]'>Credit card</span>
          </div>

          <div className='p-3 rounded-lg border border-border flex items-center justify-between text-xs'>
            <div className='flex items-center gap-2'>
              <Image src='/images/widgets/visa.webp' alt='Visa' width={24} height={16} className='object-contain' />
              <span className='font-medium'>8562 •••• •••• 4563</span>
            </div>
            <span className='text-muted-foreground text-[11px]'>Credit card</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className='flex items-center gap-2 pt-2'>
          <Button variant='outline' size='sm' className='w-full text-xs gap-1'>
            <Plus className='size-3.5' /> Add Card
          </Button>
          <Button size='sm' className='w-full text-xs'>
            Pay now
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
export default SalesUpgradePlan
