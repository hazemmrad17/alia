'use client'

import React from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Mail, Globe, Share2, MousePointerClick, MoreVertical } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'

const channelStats = [
  {
    name: 'Emails',
    icon: Mail,
    count: '14,250',
    rate: '0.3%',
    progress: 68,
    color: 'text-primary bg-primary/10'
  },
  {
    name: 'Website Traffic',
    icon: Globe,
    count: '28,400',
    rate: '2.1%',
    progress: 84,
    color: 'text-chart-2 bg-chart-2/10'
  },
  {
    name: 'Social Media',
    icon: Share2,
    count: '45,120',
    rate: '5.4%',
    progress: 92,
    color: 'text-chart-4 bg-chart-4/10'
  },
  {
    name: 'Direct Clicks',
    icon: MousePointerClick,
    count: '9,830',
    rate: '1.2%',
    progress: 45,
    color: 'text-amber-500 bg-amber-500/10'
  }
]

export const CampaignMonthlyState = () => {
  return (
    <Card className='col-span-full lg:col-span-2 flex flex-col justify-between'>
      <CardHeader>
        <div className='flex items-start justify-between'>
          <div>
            <CardTitle className='text-base font-semibold'>Monthly campaign state</CardTitle>
            <CardDescription className='text-xs font-medium text-emerald-500 mt-1'>
              7.58k Social Visitors (+18.4%)
            </CardDescription>
          </div>
          <Button variant='ghost' size='icon' className='size-8 text-muted-foreground'>
            <MoreVertical className='size-4' />
          </Button>
        </div>
      </CardHeader>

      <CardContent className='space-y-4'>
        {channelStats.map((item, index) => {
          const Icon = item.icon
          return (
            <div key={index} className='space-y-1.5'>
              <div className='flex items-center justify-between text-xs'>
                <div className='flex items-center gap-2'>
                  <div className={`size-6 rounded flex items-center justify-center ${item.color}`}>
                    <Icon className='size-3.5' />
                  </div>
                  <span className='font-medium text-foreground'>{item.name}</span>
                </div>
                <div className='flex items-center gap-2'>
                  <span className='font-bold text-foreground'>{item.count}</span>
                  <span className='text-muted-foreground text-[11px]'>({item.rate})</span>
                </div>
              </div>
              <Progress value={item.progress} className='h-1.5' />
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
export default CampaignMonthlyState
