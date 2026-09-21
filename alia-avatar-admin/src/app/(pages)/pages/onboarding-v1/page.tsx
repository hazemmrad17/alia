'use client'

import React, { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { CheckCircle2, Sparkles, ArrowRight, ArrowLeft } from 'lucide-react'
import Image from 'next/image'

export default function OnboardingV1Page() {
  const [step, setStep] = useState(1)

  const steps = [
    {
      img: '/images/misc/dashboard-shell-01.webp',
      title: 'Welcome to AdminCN Studio',
      desc: 'An enterprise-grade admin template built with Next.js, Shadcn UI, and modern aesthetic tokens.'
    },
    {
      img: '/images/misc/dashboard-shell-02.webp',
      title: 'Real-time Telemetry & Analytics',
      desc: 'Seamlessly monitor cash flow, sales channels, and clinical avatar interactions in real-time.'
    },
    {
      img: '/images/misc/dashboard-shell-03.webp',
      title: 'Granular Role-Based Permissions',
      desc: 'Manage roles, security webhooks, and team collaboration with automated access control.'
    }
  ]

  const current = steps[step - 1]

  return (
    <div className='max-w-3xl mx-auto py-8'>
      <Card className='p-8 flex flex-col items-center text-center space-y-6 border border-border bg-card/80'>
        <div className='flex items-center gap-2'>
          <Badge variant='secondary' className='text-xs px-3 py-0.5 bg-primary/10 text-primary'>
            <Sparkles className='size-3 mr-1.5' /> Onboarding Walkthrough
          </Badge>
          <span className='text-xs text-muted-foreground'>Step {step} of 3</span>
        </div>

        <div className='relative w-full max-w-lg h-64 rounded-xl overflow-hidden border border-border bg-muted/30'>
          <Image
            src={current.img}
            alt={current.title}
            fill
            className='object-contain p-4'
          />
        </div>

        <div className='space-y-2 max-w-md'>
          <h2 className='text-2xl font-bold text-foreground'>{current.title}</h2>
          <p className='text-xs text-muted-foreground leading-relaxed'>{current.desc}</p>
        </div>

        {/* Step dots */}
        <div className='flex items-center gap-2 py-2'>
          {[1, 2, 3].map(i => (
            <div
              key={i}
              onClick={() => setStep(i)}
              className={`size-2.5 rounded-full cursor-pointer transition-all ${
                step === i ? 'w-8 bg-primary' : 'bg-muted-foreground/30 hover:bg-muted-foreground/50'
              }`}
            />
          ))}
        </div>

        <div className='flex items-center justify-between w-full pt-4 border-t border-border'>
          <Button
            variant='outline'
            size='sm'
            disabled={step === 1}
            onClick={() => setStep(prev => Math.max(1, prev - 1))}
            className='gap-1.5 text-xs'
          >
            <ArrowLeft className='size-3.5' /> Previous
          </Button>

          {step < 3 ? (
            <Button
              size='sm'
              onClick={() => setStep(prev => Math.min(3, prev + 1))}
              className='gap-1.5 text-xs'
            >
              Next <ArrowRight className='size-3.5' />
            </Button>
          ) : (
            <Button size='sm' className='gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700'>
              <CheckCircle2 className='size-3.5' /> Get Started
            </Button>
          )}
        </div>
      </Card>
    </div>
  )
}
