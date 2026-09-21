'use client'

import React from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Plus, PackageOpen, ArrowRight } from 'lucide-react'
import Image from 'next/image'

export default function EmptyStateV1Page() {
  return (
    <div className='max-w-2xl mx-auto py-12'>
      <Card className='p-10 flex flex-col items-center text-center space-y-6 border border-border bg-card/60'>
        <div className='relative size-48'>
          <Image
            src='/images/misc/flower-1.webp'
            alt='Empty State'
            fill
            className='object-contain'
          />
        </div>

        <div className='space-y-2'>
          <h2 className='text-2xl font-bold text-foreground'>No campaigns found</h2>
          <p className='text-xs text-muted-foreground max-w-sm mx-auto leading-relaxed'>
            You haven&apos;t created any marketing campaigns yet. Launch your first automated social ad or email campaign now.
          </p>
        </div>

        <div className='flex items-center gap-3 pt-2'>
          <Button size='sm' className='h-9 text-xs gap-1.5'>
            <Plus className='size-4' /> Create New Campaign
          </Button>
          <Button variant='outline' size='sm' className='h-9 text-xs gap-1.5'>
            View Documentation <ArrowRight className='size-3.5' />
          </Button>
        </div>
      </Card>
    </div>
  )
}
