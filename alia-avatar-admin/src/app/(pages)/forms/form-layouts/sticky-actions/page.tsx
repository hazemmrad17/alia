'use client'

import React from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Check, X } from 'lucide-react'

export default function StickyActionsFormPage() {
  return (
    <div className='max-w-4xl mx-auto space-y-6 pb-24'>
      <div>
        <h1 className='text-2xl font-bold tracking-tight'>Sticky Actions Form Layout</h1>
        <p className='text-sm text-muted-foreground'>
          Forms with complex configurations and a fixed bottom floating action bar.
        </p>
      </div>

      <Card className='p-6 space-y-6'>
        <div className='border-b border-border pb-4'>
          <h3 className='text-base font-semibold text-foreground'>General Settings</h3>
          <p className='text-xs text-muted-foreground'>Configure company profile and organization details.</p>
        </div>

        <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
          <div className='space-y-1.5'>
            <Label htmlFor='orgName'>Organization Name</Label>
            <Input id='orgName' defaultValue='Alia AI Health Tech' />
          </div>
          <div className='space-y-1.5'>
            <Label htmlFor='orgDomain'>Custom Domain</Label>
            <Input id='orgDomain' defaultValue='admin.alia.ai' />
          </div>
        </div>

        <div className='space-y-1.5'>
          <Label htmlFor='orgDesc'>Organization Description</Label>
          <Textarea
            id='orgDesc'
            rows={3}
            defaultValue='AI-powered clinical avatar consultation platform with real-time conversational agents.'
          />
        </div>
      </Card>

      <Card className='p-6 space-y-6'>
        <div className='border-b border-border pb-4'>
          <h3 className='text-base font-semibold text-foreground'>Notification & Security Policies</h3>
          <p className='text-xs text-muted-foreground'>Manage automated security alerts and compliance triggers.</p>
        </div>

        <div className='space-y-4'>
          <div className='flex items-center justify-between'>
            <div>
              <div className='font-medium text-sm text-foreground'>Two-Factor Authentication Requirement</div>
              <div className='text-xs text-muted-foreground'>Enforce 2FA for all administrative team members.</div>
            </div>
            <Switch defaultChecked />
          </div>

          <div className='flex items-center justify-between'>
            <div>
              <div className='font-medium text-sm text-foreground'>Automated Daily Database Backups</div>
              <div className='text-xs text-muted-foreground'>Store encrypted backups on AWS S3 bucket.</div>
            </div>
            <Switch defaultChecked />
          </div>

          <div className='flex items-center justify-between'>
            <div>
              <div className='font-medium text-sm text-foreground'>API Rate Limiting Alerts</div>
              <div className='text-xs text-muted-foreground'>Notify team via Slack when requests exceed 10k/min.</div>
            </div>
            <Switch defaultChecked />
          </div>
        </div>
      </Card>

      {/* Sticky Bottom Action Bar */}
      <div className='fixed bottom-4 left-4 right-4 md:left-72 md:right-8 z-40'>
        <Card className='p-4 bg-card/90 backdrop-blur-md border border-border shadow-xl flex items-center justify-between'>
          <span className='text-xs text-muted-foreground hidden sm:inline'>
            Unsaved changes will take effect across all active users.
          </span>
          <div className='flex items-center gap-2 ml-auto'>
            <Button variant='outline' size='sm' className='h-9 text-xs'>
              Discard
            </Button>
            <Button size='sm' className='h-9 text-xs gap-1.5'>
              <Check className='size-3.5' /> Save Changes
            </Button>
          </div>
        </Card>
      </div>
    </div>
  )
}
