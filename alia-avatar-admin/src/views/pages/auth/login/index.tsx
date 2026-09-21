'use client'

import { useState } from 'react'
import Link from 'next/link'
import { GraduationCap, Pill, Sparkles, Shield, ArrowRight } from 'lucide-react'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import LoginForm, { UserRole } from '@/views/pages/auth/login/login-form'

export default function Login() {
  const [role, setRole] = useState<UserRole>('delegate')

  return (
    <div className='relative flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-background to-muted/30 px-4 py-10 sm:px-6 lg:px-8'>
      <Card className='z-10 w-full max-w-lg shadow-xl border-border/80'>
        <CardHeader className='gap-4 pb-4 text-center items-center'>
          {/* Brand Logo */}
          <div className='flex items-center gap-3'>
            <div className='size-11 bg-primary rounded-xl flex items-center justify-center shadow-sm'>
              <span className='text-primary-foreground font-bold text-xl'>A</span>
            </div>
            <div className='text-left'>
              <h1 className='text-xl font-bold tracking-tight'>ALIA Avatar</h1>
              <p className='text-xs text-muted-foreground font-medium'>VITAL SA Pharmaceutical Intelligence</p>
            </div>
          </div>

          <div>
            <CardTitle className='text-2xl font-bold'>Welcome Back</CardTitle>
            <CardDescription className='text-sm mt-1'>
              Select your role to access your personalized workspace
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className='px-6 pb-6 space-y-6'>
          {/* Dual-role login form */}
          <LoginForm role={role} onRoleChange={setRole} />

          {/* Quick Direct Access Links */}
          <div className='rounded-xl bg-muted/40 p-3.5 border text-xs space-y-2.5'>
            <div className='flex items-center justify-between font-semibold text-muted-foreground'>
              <span>Direct Dashboard Shortcuts</span>
              <Badge variant='outline' className='text-[10px] uppercase font-mono'>Instant Demo</Badge>
            </div>

            <div className='grid grid-cols-2 gap-2 pt-1'>
              <Link
                href='/dashboard/training'
                className='flex items-center gap-2 p-2 rounded-lg bg-card border hover:border-purple-400 hover:text-purple-600 transition-colors'
              >
                <GraduationCap className='size-4 text-purple-600 dark:text-purple-400 shrink-0' />
                <div className='truncate'>
                  <p className='font-medium truncate'>Training</p>
                  <p className='text-[10px] text-muted-foreground truncate'>Delegate View</p>
                </div>
              </Link>

              <Link
                href='/dashboard/commercial'
                className='flex items-center gap-2 p-2 rounded-lg bg-card border hover:border-primary hover:text-primary transition-colors'
              >
                <Pill className='size-4 text-primary shrink-0' />
                <div className='truncate'>
                  <p className='font-medium truncate'>Commercial</p>
                  <p className='text-[10px] text-muted-foreground truncate'>Doctor View</p>
                </div>
              </Link>
            </div>
          </div>

          <div className='flex items-center justify-center gap-2 text-xs text-muted-foreground pt-1'>
            <Shield className='size-3.5 text-primary' />
            <span>Secure role-based authentication · VITAL SA</span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
