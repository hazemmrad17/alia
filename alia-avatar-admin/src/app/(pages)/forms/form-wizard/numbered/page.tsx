'use client'

import React, { useState } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Check, ArrowRight, ArrowLeft } from 'lucide-react'

export default function NumberedWizardPage() {
  const [step, setStep] = useState(1)

  const steps = [
    { number: 1, title: 'Account Details', desc: 'Setup login credentials' },
    { number: 2, title: 'Personal Info', desc: 'Add profile details' },
    { number: 3, title: 'Social Links', desc: 'Connect channels' },
    { number: 4, title: 'Review & Submit', desc: 'Finalize configuration' }
  ]

  return (
    <div className='max-w-3xl mx-auto space-y-8 py-6'>
      <div>
        <h1 className='text-2xl font-bold tracking-tight'>Numbered Form Wizard</h1>
        <p className='text-sm text-muted-foreground'>Step-by-step multi-stage onboarding and validation flow.</p>
      </div>

      {/* Stepper Header */}
      <div className='grid grid-cols-2 sm:grid-cols-4 gap-4'>
        {steps.map(s => {
          const isCompleted = step > s.number
          const isActive = step === s.number
          return (
            <div
              key={s.number}
              onClick={() => setStep(s.number)}
              className={`p-3 rounded-xl border flex items-center gap-3 cursor-pointer transition-colors ${
                isActive
                  ? 'border-primary bg-primary/5'
                  : isCompleted
                  ? 'border-emerald-500/50 bg-emerald-500/5'
                  : 'border-border bg-card'
              }`}
            >
              <div
                className={`size-8 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : isCompleted
                    ? 'bg-emerald-500 text-white'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {isCompleted ? <Check className='size-4' /> : s.number}
              </div>
              <div className='flex flex-col min-w-0'>
                <span className='font-semibold text-xs text-foreground truncate'>{s.title}</span>
                <span className='text-[10px] text-muted-foreground truncate'>{s.desc}</span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Form Content */}
      <Card className='p-6 space-y-6'>
        {step === 1 && (
          <div className='space-y-4'>
            <h3 className='text-lg font-bold text-foreground'>Account Information</h3>
            <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
              <div className='space-y-1.5'>
                <Label htmlFor='username'>Username</Label>
                <Input id='username' placeholder='hazem.admin' defaultValue='hazem.admin' />
              </div>
              <div className='space-y-1.5'>
                <Label htmlFor='email'>Email Address</Label>
                <Input id='email' type='email' placeholder='hazem@alia.ai' defaultValue='hazem@alia.ai' />
              </div>
              <div className='space-y-1.5'>
                <Label htmlFor='password'>Password</Label>
                <Input id='password' type='password' placeholder='••••••••' defaultValue='password123' />
              </div>
              <div className='space-y-1.5'>
                <Label htmlFor='confirm'>Confirm Password</Label>
                <Input id='confirm' type='password' placeholder='••••••••' defaultValue='password123' />
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className='space-y-4'>
            <h3 className='text-lg font-bold text-foreground'>Personal Details</h3>
            <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
              <div className='space-y-1.5'>
                <Label htmlFor='fname'>First Name</Label>
                <Input id='fname' placeholder='Hazem' defaultValue='Hazem' />
              </div>
              <div className='space-y-1.5'>
                <Label htmlFor='lname'>Last Name</Label>
                <Input id='lname' placeholder='Mrad' defaultValue='Mrad' />
              </div>
              <div className='space-y-1.5'>
                <Label htmlFor='country'>Country</Label>
                <Input id='country' placeholder='United States' defaultValue='Tunisia' />
              </div>
              <div className='space-y-1.5'>
                <Label htmlFor='city'>City</Label>
                <Input id='city' placeholder='Tunis' defaultValue='Tunis' />
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className='space-y-4'>
            <h3 className='text-lg font-bold text-foreground'>Social Profiles</h3>
            <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
              <div className='space-y-1.5'>
                <Label htmlFor='github'>GitHub Profile</Label>
                <Input id='github' placeholder='https://github.com/...' defaultValue='https://github.com/hazemmrad17' />
              </div>
              <div className='space-y-1.5'>
                <Label htmlFor='twitter'>Twitter / X</Label>
                <Input id='twitter' placeholder='https://x.com/...' defaultValue='https://x.com/hazem' />
              </div>
              <div className='space-y-1.5'>
                <Label htmlFor='linkedin'>LinkedIn</Label>
                <Input id='linkedin' placeholder='https://linkedin.com/in/...' defaultValue='https://linkedin.com/in/hazem' />
              </div>
              <div className='space-y-1.5'>
                <Label htmlFor='website'>Portfolio Website</Label>
                <Input id='website' placeholder='https://...' defaultValue='https://alia.ai' />
              </div>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className='space-y-4'>
            <h3 className='text-lg font-bold text-foreground'>Review & Confirm</h3>
            <p className='text-xs text-muted-foreground'>Please confirm your account credentials before activating your administrator profile.</p>
            <div className='p-4 rounded-xl bg-muted/40 border border-border space-y-2 text-xs'>
              <div className='flex justify-between'>
                <span className='text-muted-foreground'>Username:</span>
                <span className='font-semibold text-foreground'>hazem.admin</span>
              </div>
              <div className='flex justify-between'>
                <span className='text-muted-foreground'>Email:</span>
                <span className='font-semibold text-foreground'>hazem@alia.ai</span>
              </div>
              <div className='flex justify-between'>
                <span className='text-muted-foreground'>Full Name:</span>
                <span className='font-semibold text-foreground'>Hazem Mrad</span>
              </div>
              <div className='flex justify-between'>
                <span className='text-muted-foreground'>Location:</span>
                <span className='font-semibold text-foreground'>Tunis, Tunisia</span>
              </div>
            </div>
          </div>
        )}

        {/* Action Controls */}
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
            <Button
              size='sm'
              className='gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700'
              onClick={() => alert('Account verified & configuration saved!')}
            >
              <Check className='size-3.5' /> Submit
            </Button>
          )}
        </div>
      </Card>
    </div>
  )
}
