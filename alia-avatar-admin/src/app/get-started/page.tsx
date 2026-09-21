'use client'

// Next.js Imports
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

// Shadcn UI Imports
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

// Lucide Icons
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

// Util Imports
import { setStoredRole, getStoredRole, type UserRole } from '@/lib/user-role'

const HomePage = () => {
  const router = useRouter()
  const [activeRole, setActiveRole] = useState<UserRole | null>(null)

  useEffect(() => {
    setActiveRole(getStoredRole())
  }, [])

  const enter = (role: UserRole) => {
    setStoredRole(role)
    router.push(role === 'delegate' ? '/dashboard/training' : '/dashboard/commercial')
  }

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-background p-4 md:p-8">
      {/* Header */}
      <div className="text-center mb-8 mx-auto max-w-2xl">
        <h1 className="text-4xl font-bold tracking-tight mb-2">ALIA Avatar</h1>
        <p className="text-lg text-muted-foreground mb-4">
          VITAL SA — Medical Intelligence Platform
        </p>
        <p className="text-sm text-muted-foreground mb-6">
          Choose your workspace — each role has its own dashboard and navigation.
        </p>
      </div>

      {/* Two User Story Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-5xl mx-auto">
        {/* Medical Delegate — Training */}
        <Card
          className={`border-2 cursor-pointer transition-all hover:shadow-lg hover:-translate-y-1 ${
            activeRole === 'delegate' ? 'border-primary shadow-lg' : 'border-border'
          }`}
          onClick={() => enter('delegate')}
        >
          <CardContent className="p-6 text-center flex flex-col items-center">
            <div className="flex flex-col items-center gap-3 mb-4">
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary/10">
                <GraduationCap className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h2 className="text-xl font-bold">Medical Delegate</h2>
                <p className="text-sm text-muted-foreground">Training Workspace</p>
              </div>
            </div>

            <p className="text-muted-foreground mb-4">
              Practice visiting simulated doctors with AI. Master the 6-step visit process,
              handle objections, and improve your competence level.
            </p>

            <div className="flex flex-wrap justify-center gap-2 mb-4">
              <Badge variant="secondary" className="gap-1">
                <BarChart3 className="w-3 h-3" /> Step Performance
              </Badge>
              <Badge variant="secondary" className="gap-1">
                <Users className="w-3 h-3" /> Doctor Personalities
              </Badge>
              <Badge variant="secondary" className="gap-1">
                <TrendingUp className="w-3 h-3" /> Level Progression
              </Badge>
              <Badge variant="secondary" className="gap-1">
                <BookOpen className="w-3 h-3" /> SONCAS Framework
              </Badge>
            </div>

            <div className="flex justify-center gap-2 mt-auto">
              <Button size="sm" className="gap-1" onClick={e => { e.stopPropagation(); enter('delegate') }}>
                Enter Training Space <ArrowRight className="w-3 h-3" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Doctor / Pharmacist — Commercial */}
        <Card
          className={`border-2 cursor-pointer transition-all hover:shadow-lg hover:-translate-y-1 ${
            activeRole === 'commercial' ? 'border-primary shadow-lg' : 'border-border'
          }`}
          onClick={() => enter('commercial')}
        >
          <CardContent className="p-6 text-center flex flex-col items-center">
            <div className="flex flex-col items-center gap-3 mb-4">
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary/10">
                <Stethoscope className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h2 className="text-xl font-bold">Doctor / Pharmacist</h2>
                <p className="text-sm text-muted-foreground">Commercial Workspace</p>
              </div>
            </div>

            <p className="text-muted-foreground mb-4">
              Receive product presentations from the ALIA Avatar. Explore VITAL SA&apos;s
              pharmaceutical catalog and see what fits your practice.
            </p>

            <div className="flex flex-wrap justify-center gap-2 mb-4">
              <Badge variant="secondary" className="gap-1">
                <Pill className="w-3 h-3" /> 100+ Products
              </Badge>
              <Badge variant="secondary" className="gap-1">
                <MessageSquare className="w-3 h-3" /> CRM Reports
              </Badge>
              <Badge variant="secondary" className="gap-1">
                <BarChart3 className="w-3 h-3" /> Product Reach
              </Badge>
              <Badge variant="secondary" className="gap-1">
                <TrendingUp className="w-3 h-3" /> Engagement
              </Badge>
            </div>

            <div className="flex justify-center gap-2 mt-auto">
              <Button size="sm" className="gap-1" onClick={e => { e.stopPropagation(); enter('commercial') }}>
                Enter Commercial Space <ArrowRight className="w-3 h-3" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Footer */}
      <p className="mt-8 text-sm text-muted-foreground">
        Powered by VITAL SA • ALIA Avatar v1.0
      </p>
    </div>
  )
}

export default HomePage
