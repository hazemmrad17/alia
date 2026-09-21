import type { Metadata } from 'next'
import Link from 'next/link'
import {
  BookOpen,
  CalendarDays,
  Contact,
  FileText,
  GraduationCap,
  LayoutDashboard,
  LifeBuoy,
  MessageSquare,
  Pill,
  Settings,
  Stethoscope,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export const metadata: Metadata = {
  title: 'Documentation | ALIA Avatar',
  description: 'Guides for the ALIA Avatar workspaces — delegates, doctors, products, chat, and calendar.'
}

const GUIDES = [
  { icon: GraduationCap, href: '/simulation', title: 'Delegate Training', desc: 'Live Simulator, doctor personas, visit steps and scoring.', tag: 'Delegate' },
  { icon: Stethoscope, href: '/commercial', title: 'Doctor Presentations', desc: 'Commercial pitches, product focus and visit formats.', tag: 'Doctor' },
  { icon: Pill, href: '/products/catalog', title: 'VITAL Products', desc: 'Browse the full 191-product catalog with detail sheets.', tag: 'Shared' },
  { icon: MessageSquare, href: '/chat', title: 'Chat', desc: 'Role-aware conversations with AI doctors or VITAL delegates.', tag: 'Shared' },
  { icon: Contact, href: '/contacts', title: 'Contacts', desc: 'Directories, labels, favourites and quick actions.', tag: 'Shared' },
  { icon: CalendarDays, href: '/sessions/calendar', title: 'Consultation Calendar', desc: 'Book and join ALIA sales-pitch appointments.', tag: 'Doctor' },
  { icon: LayoutDashboard, href: '/dashboard/training', title: 'Training Overview', desc: 'Gamified progress: XP, streaks, missions and achievements.', tag: 'Delegate' },
  { icon: Settings, href: '/settings', title: 'Settings', desc: 'Session history, score trends and backend status.', tag: 'Shared' },
]

const REFERENCES = [
  { file: '01-scripts-top-sellers.md', desc: 'Flash + Standard visit scripts, objections (A-C-R-V), closing and CRM follow-up for top sellers.' },
  { file: '02-manuel-alia-avatar.md', desc: 'ALIA Avatar user manual.' },
  { file: '03-referentiel-niveaux-competence.md', desc: 'Competence levels reference (Débutant → Expert).' },
  { file: '04-matrice-progression.md', desc: 'Progression matrix between levels.' },
  { file: '05-techniques-de-vente.md', desc: 'Sales techniques for medical visits.' },
  { file: '06-crm-database.md', desc: 'CRM database model for visits and products.' },
  { file: '10-user-story-medical-delegate.md', desc: 'Medical delegate user story.' },
  { file: '11-user-story-doctor.md', desc: 'Doctor / pharmacist user story.' },
]

const DocumentationPage = () => {
  return (
    <div className='grid grid-cols-6 gap-6'>
      <div className='col-span-full'>
        <div className='flex items-center gap-2 mb-2'>
          <BookOpen className='size-6 text-primary' />
          <h1 className='text-2xl font-bold'>Documentation</h1>
        </div>
        <p className='text-sm text-muted-foreground'>
          Guides for both workspaces, and the full reference specifications shipped in the repository.
        </p>
      </div>

      {/* Guides */}
      <div className='col-span-full grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4'>
        {GUIDES.map(g => {
          const Icon = g.icon
          return (
            <Link key={g.title} href={g.href} className='group'>
              <Card className='h-full transition-shadow hover:shadow-lg'>
                <CardHeader className='flex-row items-center gap-3'>
                  <span className='flex size-10 items-center justify-center rounded-lg bg-primary/10 transition-colors group-hover:bg-primary/20'>
                    <Icon className='size-5 text-primary' />
                  </span>
                  <div className='min-w-0'>
                    <CardTitle className='text-sm'>{g.title}</CardTitle>
                    <CardDescription className='mt-1'>{g.desc}</CardDescription>
                  </div>
                </CardHeader>
                <CardContent>
                  <Badge variant='secondary' className='text-[11px] font-normal'>{g.tag}</Badge>
                </CardContent>
              </Card>
            </Link>
          )
        })}
      </div>

      {/* Reference docs */}
      <div className='col-span-full'>
        <Card>
          <CardHeader className='flex-row items-center gap-3'>
            <span className='flex size-10 items-center justify-center rounded-lg bg-primary/10'>
              <FileText className='size-5 text-primary' />
            </span>
            <div>
              <CardTitle className='text-base'>Reference documents</CardTitle>
              <CardDescription>
                Full specifications live in the repository under <code className='rounded bg-muted px-1.5 py-0.5 text-xs'>docs/</code>
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className='grid grid-cols-1 gap-3 md:grid-cols-2'>
            {REFERENCES.map(r => (
              <div key={r.file} className='rounded-lg border border-border/60 p-4'>
                <p className='font-mono text-xs font-semibold'>{r.file}</p>
                <p className='mt-1 text-sm text-muted-foreground'>{r.desc}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Help */}
      <div className='col-span-full'>
        <Card className='border-dashed'>
          <CardContent className='flex flex-col items-center justify-between gap-3 py-5 text-center sm:flex-row sm:text-left'>
            <div className='flex items-center gap-3'>
              <LifeBuoy className='size-6 text-primary' />
              <div>
                <p className='text-sm font-semibold'>Still need help?</p>
                <p className='text-sm text-muted-foreground'>Contact the ALIA team from the Support page.</p>
              </div>
            </div>
            <Link href='/support' className='text-sm font-medium text-primary hover:underline'>
              Open Support →
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default DocumentationPage