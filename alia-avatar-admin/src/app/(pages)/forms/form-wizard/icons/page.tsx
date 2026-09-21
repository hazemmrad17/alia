'use client'

import React, { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { User, Shield, Share2, Check, ArrowRight, ArrowLeft } from 'lucide-react'

export default function IconWizardPage() {
  const [step, setStep] = useState(1)

  const steps = [
    { number: 1, title: 'Account', icon: Shield },
    { number: 2, title: 'Personal', icon: User },
    { number: 3, title: 'Social', icon: Share2 },
    { number: 4, title: 'Complete', icon: Check }
  ]

  return (
    <div className='max-w-3xl mx-auto space-y-8 py-6'>
      <div>
        <h1 className='text-2xl font-bold tracking-tight'>Icon Form Wizard</h1>
        <p className='text-sm text-muted-foreground'>Multi-step form wizard with contextual icon indicators.</p>
      </div>

      {/* Stepper Header with Icons */}
      <div className='grid grid-cols-4 gap-4'>
        {steps.map(s => {
          const Icon = s.icon
          const isCompleted = step > s.number
          const isActive = step === s.number
          return (
            <div
              key={s.number}
              onClick={() => setStep(s.number)}
              className={`p-4 rounded-xl border flex flex-col items-center text-center gap-2 cursor-pointer transition-colors ${
                isActive
                  ? 'border-primary bg-primary/5'
                  : isCompleted
                  ? 'border-emerald-500/50 bg-emerald-500/5'
                  : 'border-border bg-card'
              }`}
            >
              <div
                className={`size-10 rounded-xl flex items-center justify-center ${
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : isCompleted
                    ? 'bg-emerald-500 text-white'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                <Icon className='size-5' />
              </div>
              <span className='font-semibold text-xs text-foreground'>{s.title}</span>
            </div>
          )
        })}
      </div>

      {/* Form Content */}
      <Card className='p-6 space-y-6'>
        {step === 1 && (
          <div className='space-y-4'>
            <h3 className='text-lg font-bold text-foreground'>Security & Credentials</h3>
            <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
              <div className='space-y-1.5'>
                <Label htmlFor='email'>Work Email</Label>
                <Input id='email' type='email' defaultValue='hazem@alia.ai' />
              </div>
              <div className='space-y-1.5'>
                <Label htmlFor='role'>Primary Role</Label>
                <Input id='role' defaultValue='Super Administrator' />
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className='space-y-4'>
            <h3 className='text-lg font-bold text-foreground'>Personal Information</h3>
            <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
              <div className='space-y-1.5'>
                <Label htmlFor='fullname'>Full Name</Label>
                <Input id='fullname' defaultValue='Hazem Mrad' />
              </div>
              <div className='space-y-1.5'>
                <Label htmlFor='phone'>Phone Number</Label>
                <Input id='phone' defaultValue='+216 98 000 000' />
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className='space-y-4'>
            <h3 className='text-lg font-bold text-foreground'>Social Networks</h3>
            <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
              <div className='space-y-1.5'>
                <Label htmlFor='github'>GitHub</Label>
                <Input id='github' defaultValue='https://github.com/hazemmrad17' />
              </div>
              <div className='space-y-1.5'>
                <Label htmlFor='x'>Twitter / X</Label>
                <Input id='x' defaultValue='@hazem' />
              </div>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className='space-y-4 text-center py-6'>
            <div className='size-14 rounded-full bg-emerald-500/10 text-emerald-500 mx-auto flex items-center justify-center mb-2'>
              <Check className='size-7' />
            </div>
            <h3 className='text-xl font-bold text-foreground'>Account Ready!</h3>
            <p className='text-xs text-muted-foreground max-w-sm mx-auto'>
              Your profile has been saved. All admin privileges and integrations are active.
            </p>
          </div>
        )}

        <div className='flex items-center justify-between pt-4 border-t border-border'>
          <Button
            variant='outline'
            size='sm'
            disabled={step === 1}
            onClick={() => setStep(prev => Math.max(1, prev - 1))}
            className='gap-1.5 text-xs'
          >
            <ArrowLeft className='size-3.5' /> Previous
          </Button>

          {step < 4 ? (
            <Button
              size='sm'
              onClick={() => setStep(prev => Math.min(4, prev + 1))}
              className='gap-1.5 text-xs'
            >
              Next <ArrowRight className='size-3.5' />
            </Button>
          ) : (
            <Button size='sm' className='text-xs bg-emerald-600 hover:bg-emerald-700'>
              Finish
            </Button>
          )}
        </div>
      </Card>
    </div>
  )
}
