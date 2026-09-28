'use client'

// Next.js Imports
import { useEffect, useState } from 'react'

import { useRouter } from 'next/navigation'

// Shadcn UI Imports
import {
  GraduationCap,
  Stethoscope,
  BarChart3,
  MessageSquare,
  Users,
  Pill,
  TrendingUp,
  BookOpen,
  ArrowRight
} from 'lucide-react'

import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

// Lucide Icons

// Util Imports
import { setStoredRole, getStoredRole, type UserRole } from '@/lib/user-role'
import { landingPathFor } from '@/lib/auth'
import { isAuthenticated } from '@/lib/auth'

const HomePage = () => {
  const router = useRouter()
  const [activeRole, setActiveRole] = useState<UserRole | null>(null)

  useEffect(() => {
    // Picking a workspace only makes sense once you have an account, so a
    // signed-out visitor goes to the login page and comes back here after.
    if (!isAuthenticated()) {
      router.replace('/login?next=/get-started')

      return
    }

    setActiveRole(getStoredRole())
  }, [router])

  // landingPathFor is the same mapping the sign-in flow uses, so choosing a
  // persona here and signing in land on the same page for the same role.
  const enter = (role: UserRole) => {
    setStoredRole(role)
    router.push(landingPathFor(role))
  }

  return (
    <div className='bg-background flex min-h-screen w-full flex-col items-center justify-center p-4 md:p-8'>
      {/* Header */}
      <div className='mx-auto mb-8 max-w-2xl text-center'>
        <h1 className='mb-2 text-4xl font-bold tracking-tight'>ALIA Avatar</h1>
        <p className='text-muted-foreground mb-4 text-lg'>VITAL SA — Medical Intelligence Platform</p>
        <p className='text-muted-foreground mb-6 text-sm'>
          Choose your workspace — each role has its own dashboard and navigation.
        </p>
      </div>

      {/* Two User Story Cards */}
      <div className='mx-auto grid w-full max-w-5xl grid-cols-1 gap-6 md:grid-cols-2'>
        {/* Medical Delegate — Training */}
        <Card
          className={`cursor-pointer border-2 transition-all hover:-translate-y-1 hover:shadow-lg ${
            activeRole === 'delegate' ? 'border-primary shadow-lg' : 'border-border'
          }`}
          onClick={() => enter('delegate')}
        >
          <CardContent className='flex flex-col items-center p-6 text-center'>
            <div className='mb-4 flex flex-col items-center gap-3'>
              <div className='bg-primary/10 flex h-12 w-12 items-center justify-center rounded-full'>
                <GraduationCap className='text-primary h-6 w-6' />
              </div>
              <div>
                <h2 className='text-xl font-bold'>Medical Delegate</h2>
                <p className='text-muted-foreground text-sm'>Training Workspace</p>
              </div>
            </div>

            <p className='text-muted-foreground mb-4'>
              Practice visiting simulated doctors with AI. Master the 6-step visit process, handle objections, and
              improve your competence level.
            </p>

            <div className='mb-4 flex flex-wrap justify-center gap-2'>
              <Badge variant='secondary' className='gap-1'>
                <BarChart3 className='h-3 w-3' /> Step Performance
              </Badge>
              <Badge variant='secondary' className='gap-1'>
                <Users className='h-3 w-3' /> Doctor Personalities
              </Badge>
              <Badge variant='secondary' className='gap-1'>
                <TrendingUp className='h-3 w-3' /> Level Progression
              </Badge>
              <Badge variant='secondary' className='gap-1'>
                <BookOpen className='h-3 w-3' /> SONCAS Framework
              </Badge>
            </div>

            <div className='mt-auto flex justify-center gap-2'>
              <Button
                size='sm'
                className='gap-1'
                onClick={e => {
                  e.stopPropagation()
                  enter('delegate')
                }}
              >
                Enter Training Space <ArrowRight className='h-3 w-3' />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Doctor / Pharmacist — Commercial */}
        <Card
          className={`cursor-pointer border-2 transition-all hover:-translate-y-1 hover:shadow-lg ${
            activeRole === 'doctor' ? 'border-primary shadow-lg' : 'border-border'
          }`}
          onClick={() => enter('doctor')}
        >
          <CardContent className='flex flex-col items-center p-6 text-center'>
            <div className='mb-4 flex flex-col items-center gap-3'>
              <div className='bg-primary/10 flex h-12 w-12 items-center justify-center rounded-full'>
                <Stethoscope className='text-primary h-6 w-6' />
              </div>
              <div>
                <h2 className='text-xl font-bold'>Doctor / Pharmacist</h2>
                <p className='text-muted-foreground text-sm'>Commercial Workspace</p>
              </div>
            </div>

            <p className='text-muted-foreground mb-4'>
              Receive product presentations from the ALIA Avatar. Explore VITAL SA&apos;s pharmaceutical catalog and see
              what fits your practice.
            </p>

            <div className='mb-4 flex flex-wrap justify-center gap-2'>
              <Badge variant='secondary' className='gap-1'>
                <Pill className='h-3 w-3' /> 100+ Products
              </Badge>
              <Badge variant='secondary' className='gap-1'>
                <MessageSquare className='h-3 w-3' /> CRM Reports
              </Badge>
              <Badge variant='secondary' className='gap-1'>
                <BarChart3 className='h-3 w-3' /> Product Reach
              </Badge>
              <Badge variant='secondary' className='gap-1'>
                <TrendingUp className='h-3 w-3' /> Engagement
              </Badge>
            </div>

            <div className='mt-auto flex justify-center gap-2'>
              <Button
                size='sm'
                className='gap-1'
                onClick={e => {
                  e.stopPropagation()
                  enter('doctor')
                }}
              >
                Enter Commercial Space <ArrowRight className='h-3 w-3' />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Footer */}
      <p className='text-muted-foreground mt-8 text-sm'>Powered by VITAL SA • ALIA Avatar v1.0</p>
    </div>
  )
}

export default HomePage
