'use client'

import { MapPin, Stethoscope, Search } from 'lucide-react'
import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table'
import type { DoctorStyle } from '@/types/alia'
import { DOCTOR_STYLE_META } from '@/types/alia'

interface Doctor {
  id: string
  name: string
  specialty: string
  style: DoctorStyle
  city: string
  sessions: number
  last_visit: string
}

const DEMO_DOCTORS: Doctor[] = [
  { id: '1', name: 'Dr. Khalid Mansouri', specialty: 'Cardiologist', style: 'analysant', city: 'Algiers', sessions: 4, last_visit: '2026-09-01' },
  { id: '2', name: 'Dr. Amina Bouazza', specialty: 'Generalist', style: 'facilitant', city: 'Oran', sessions: 3, last_visit: '2026-09-01' },
  { id: '3', name: 'Dr. Youssef El Haddad', specialty: 'Pediatrician', style: 'promouvant', city: 'Constantine', sessions: 3, last_visit: '2026-08-30' },
  { id: '4', name: 'Dr. Sara Khelil', specialty: 'Pharmacist', style: 'controlant', city: 'Algiers', sessions: 2, last_visit: '2026-08-31' },
  { id: '5', name: 'Dr. Mourad Aissaoui', specialty: 'Gastroenterologist', style: 'analysant', city: 'Annaba', sessions: 2, last_visit: '2026-08-28' },
  { id: '6', name: 'Dr. Fatima Zahra Bensaid', specialty: 'Generalist', style: 'facilitant', city: 'Blida', sessions: 1, last_visit: '2026-08-25' },
  { id: '7', name: 'Dr. Rachid Tebboune', specialty: 'Neurologist', style: 'controlant', city: 'Tlemcen', sessions: 1, last_visit: '2026-08-22' },
]

function getInitials(name: string) {
  return name.replace('Dr. ', '').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

export default function DoctorDirectory() {
  const [search, setSearch] = useState('')

  const filtered = DEMO_DOCTORS.filter(d =>
    d.name.toLowerCase().includes(search.toLowerCase()) ||
    d.specialty.toLowerCase().includes(search.toLowerCase()) ||
    d.city.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className='grid grid-cols-6 gap-4'>
      {/* Search */}
      <div className='col-span-full flex items-center gap-3'>
        <div className='relative flex-1 max-w-sm'>
          <Search className='absolute left-2.5 top-2.5 size-4 text-muted-foreground' />
          <Input
            placeholder='Search doctors, specialty, city…'
            className='pl-9'
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <span className='text-sm text-muted-foreground'>{filtered.length} results</span>
      </div>

      {/* Doctor Table */}
      <Card className='col-span-full'>
        <CardHeader>
          <CardTitle className='text-base'>Doctor Directory</CardTitle>
          <CardDescription>Healthcare providers visited by ALIA commercial sessions</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Doctor</TableHead>
                <TableHead>Specialty</TableHead>
                <TableHead>Style</TableHead>
                <TableHead>City</TableHead>
                <TableHead className='text-center'>Sessions</TableHead>
                <TableHead>Last Visit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(doctor => {
                const styleMeta = DOCTOR_STYLE_META[doctor.style]
                return (
                  <TableRow key={doctor.id}>
                    <TableCell>
                      <div className='flex items-center gap-2.5'>
                        <Avatar className='size-8'>
                          <AvatarFallback className='bg-primary/10 text-primary text-xs font-bold'>
                            {getInitials(doctor.name)}
                          </AvatarFallback>
                        </Avatar>
                        <span className='font-medium text-sm'>{doctor.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className='flex items-center gap-1.5'>
                        <Stethoscope className='size-3.5 text-muted-foreground' />
                        <span className='text-sm'>{doctor.specialty}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant='secondary' className='text-xs gap-1'>
                        <span>{styleMeta.icon}</span>
                        {styleMeta.label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className='flex items-center gap-1.5 text-sm text-muted-foreground'>
                        <MapPin className='size-3.5' />
                        {doctor.city}
                      </div>
                    </TableCell>
                    <TableCell className='text-center tabular-nums'>
                      <Badge variant={doctor.sessions >= 3 ? 'default' : 'secondary'} className='text-xs'>
                        {doctor.sessions}
                      </Badge>
                    </TableCell>
                    <TableCell className='text-sm text-muted-foreground'>
                      {new Date(doctor.last_visit).toLocaleDateString('fr-FR')}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
