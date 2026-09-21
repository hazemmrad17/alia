'use client'

import React from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Sparkles, Check, MoreVertical } from 'lucide-react'

export const CampaignBusinessCard = () => {
  return (
    <Card className='col-span-full lg:col-span-2 flex flex-col justify-between relative overflow-hidden bg-gradient-to-br from-card via-card to-primary/5'>
      <CardHeader>
        <div className='flex items-start justify-between'>
          <div>
            <div className='flex items-center gap-1.5 text-xs font-semibold text-primary mb-1'>
              <Sparkles className='size-3.5' /> PRO ENTERPRISE
            </div>
            <CardTitle className='text-lg font-bold'>For Business Shark</CardTitle>
            <CardDescription className='text-xs mt-1 leading-relaxed'>
              Focus on high-ROI marketing strategies and automated campaign optimization.
            </CardDescription>
          </div>
          <Button variant='ghost' size='icon' className='size-8 text-muted-foreground'>
            <MoreVertical className='size-4' />
          </Button>
        </div>
      </CardHeader>

      <CardContent className='space-y-4'>
        <div className='p-4 rounded-xl bg-card border border-border flex items-baseline justify-between shadow-xs'>
          <div>
            <div className='text-sm font-semibold text-foreground'>Branding Plan</div>
            <div className='text-xs text-muted-foreground'>Unlimited campaigns</div>
          </div>
          <div className='flex items-baseline gap-0.5'>
            <span className='text-2xl font-black text-foreground'>$99</span>
            <span className='text-xs text-muted-foreground'>/mo</span>
          </div>
        </div>

        <div className='space-y-2 text-xs text-muted-foreground'>
          <div className='flex items-center gap-2'>
            <Check className='size-3.5 text-emerald-500 shrink-0' />
            <span>Multi-channel ad attribution</span>
          </div>
          <div className='flex items-center gap-2'>
            <Check className='size-3.5 text-emerald-500 shrink-0' />
            <span>AI creative optimization</span>
          </div>
          <div className='flex items-center gap-2'>
            <Check className='size-3.5 text-emerald-500 shrink-0' />
            <span>Real-time visitor tracking</span>
          </div>
        </div>

        <Button className='w-full text-xs font-semibold h-9 mt-2'>
          Choose a plan to get started
        </Button>
      </CardContent>
    </Card>
  )
}
export default CampaignBusinessCard
