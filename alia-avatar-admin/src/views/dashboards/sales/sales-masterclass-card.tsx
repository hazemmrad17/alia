'use client'

import React from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Calendar, Users, MoreVertical, Sparkles } from 'lucide-react'

export const SalesMasterClassCard = () => {
  return (
    <Card className='col-span-full lg:col-span-2 flex flex-col justify-between'>
      <CardHeader>
        <div className='flex items-start justify-between'>
          <div className='flex items-center gap-3'>
            <Avatar className='size-10 border border-border'>
              <AvatarFallback className='bg-primary/10 text-primary font-bold'>JW</AvatarFallback>
            </Avatar>
            <div>
              <CardTitle className='text-base font-semibold'>Design strategy master class</CardTitle>
              <CardDescription className='text-xs flex items-center gap-1.5 mt-0.5'>
                <Calendar className='size-3 text-muted-foreground' /> 07 Jun 2025 at 10:00 PM
              </CardDescription>
            </div>
          </div>
          <Button variant='ghost' size='icon' className='size-8 text-muted-foreground'>
            <MoreVertical className='size-4' />
          </Button>
        </div>
      </CardHeader>

      <CardContent className='space-y-4'>
        <p className='text-xs text-muted-foreground leading-relaxed'>
          How to improve your next design&apos;s strategy that works for users and business goals simultaneously.
        </p>

        {/* Tags */}
        <div className='flex flex-wrap gap-1.5'>
          <Badge variant='secondary' className='text-[11px] font-normal'>Technical</Badge>
          <Badge variant='secondary' className='text-[11px] font-normal'>User research</Badge>
          <Badge variant='secondary' className='text-[11px] font-normal'>Analytics</Badge>
        </div>

        {/* Avatar stack + Join Button */}
        <div className='flex items-center justify-between pt-2 border-t border-border'>
          <div className='flex -space-x-2 overflow-hidden items-center'>
            <Avatar className='inline-block size-7 ring-2 ring-background'>
              <AvatarImage src='/images/avatars/avatar-1.webp' />
              <AvatarFallback>OS</AvatarFallback>
            </Avatar>
            <Avatar className='inline-block size-7 ring-2 ring-background'>
              <AvatarImage src='/images/avatars/avatar-2.webp' />
              <AvatarFallback>HL</AvatarFallback>
            </Avatar>
            <Avatar className='inline-block size-7 ring-2 ring-background'>
              <AvatarImage src='/images/avatars/avatar-3.webp' />
              <AvatarFallback>HR</AvatarFallback>
            </Avatar>
            <div className='size-7 rounded-full bg-muted flex items-center justify-center text-[10px] font-semibold text-muted-foreground ring-2 ring-background'>
              +12
            </div>
          </div>

          <Button size='sm' className='h-8 text-xs font-medium'>
            Join now
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
export default SalesMasterClassCard
