'use client'

import React from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Activity, Zap, TrendingUp, MoreVertical } from 'lucide-react'
import { Button } from '@/components/ui/button'

export const CampaignVehiclesCard = () => {
  return (
    <Card className='col-span-full lg:col-span-2 flex flex-col justify-between'>
      <CardHeader>
        <div className='flex items-start justify-between'>
          <div>
            <CardTitle className='text-base font-semibold'>Campaign Condition</CardTitle>
            <CardDescription className='text-xs text-muted-foreground'>
              Overall channel performance
            </CardDescription>
          </div>
          <Button variant='ghost' size='icon' className='size-8 text-muted-foreground'>
            <MoreVertical className='size-4' />
          </Button>
        </div>
      </CardHeader>

      <CardContent className='space-y-5'>
        <div className='flex items-center justify-between'>
          <div className='flex items-center gap-3'>
            <div className='size-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center font-bold text-lg'>
              55%
            </div>
            <div>
              <div className='text-sm font-bold text-foreground'>Excellent</div>
              <div className='text-xs text-emerald-500 flex items-center gap-1'>
                <TrendingUp className='size-3' /> +12% increase
              </div>
            </div>
          </div>
          <div className='text-right'>
            <div className='text-xs text-muted-foreground'>Efficiency</div>
            <div className='text-sm font-bold text-foreground'>+25%</div>
          </div>
        </div>

        <div className='space-y-3 pt-2 border-t border-border'>
          <div className='space-y-1 text-xs'>
            <div className='flex justify-between font-medium'>
              <span className='text-muted-foreground'>Google Ads</span>
              <span>85% Good</span>
            </div>
            <Progress value={85} className='h-1.5' />
          </div>

          <div className='space-y-1 text-xs'>
            <div className='flex justify-between font-medium'>
              <span className='text-muted-foreground'>Meta Ads</span>
              <span>62% Moderate</span>
            </div>
            <Progress value={62} className='h-1.5' />
          </div>

          <div className='space-y-1 text-xs'>
            <div className='flex justify-between font-medium'>
              <span className='text-muted-foreground'>Email Newsletters</span>
              <span>94% Optimal</span>
            </div>
            <Progress value={94} className='h-1.5' />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
export default CampaignVehiclesCard
