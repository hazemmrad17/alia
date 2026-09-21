'use client'

import React, { useState } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import { ShieldCheck, Users, Plus, Edit, Copy, MoreVertical, Search, CheckCircle2 } from 'lucide-react'

export type RoleCardData = {
  id: string
  title: string
  usersCount: number
  avatars: { src: string; fallback: string }[]
  permissionsCount: number
}

const roleList: RoleCardData[] = [
  {
    id: 'r-1',
    title: 'Administrator',
    usersCount: 4,
    avatars: [
      { src: '/images/avatars/avatar-1.webp', fallback: 'A1' },
      { src: '/images/avatars/avatar-2.webp', fallback: 'A2' },
      { src: '/images/avatars/avatar-3.webp', fallback: 'A3' },
      { src: '/images/avatars/avatar-4.webp', fallback: 'A4' }
    ],
    permissionsCount: 48
  },
  {
    id: 'r-2',
    title: 'Editor',
    usersCount: 7,
    avatars: [
      { src: '/images/avatars/avatar-5.webp', fallback: 'E1' },
      { src: '/images/avatars/avatar-6.webp', fallback: 'E2' },
      { src: '/images/avatars/avatar-7.webp', fallback: 'E3' }
    ],
    permissionsCount: 32
  },
  {
    id: 'r-3',
    title: 'Author',
    usersCount: 5,
    avatars: [
      { src: '/images/avatars/avatar-8.webp', fallback: 'AU1' },
      { src: '/images/avatars/avatar-9.webp', fallback: 'AU2' }
    ],
    permissionsCount: 20
  },
  {
    id: 'r-4',
    title: 'Maintainer',
    usersCount: 3,
    avatars: [
      { src: '/images/avatars/avatar-10.webp', fallback: 'M1' },
      { src: '/images/avatars/avatar-11.webp', fallback: 'M2' }
    ],
    permissionsCount: 26
  },
  {
    id: 'r-5',
    title: 'Subscriber',
    usersCount: 14,
    avatars: [
      { src: '/images/avatars/avatar-12.webp', fallback: 'S1' },
      { src: '/images/avatars/avatar-13.webp', fallback: 'S2' },
      { src: '/images/avatars/avatar-14.webp', fallback: 'S3' }
    ],
    permissionsCount: 8
  },
  {
    id: 'r-6',
    title: 'Restricted User',
    usersCount: 2,
    avatars: [
      { src: '/images/avatars/avatar-15.webp', fallback: 'R1' }
    ],
    permissionsCount: 4
  }
]

export const RolesApp = () => {
  const [searchTerm, setSearchTerm] = useState('')

  return (
    <div className='space-y-8'>
      {/* Header */}
      <div>
        <h1 className='text-2xl font-bold tracking-tight'>Roles & Access Control</h1>
        <p className='text-sm text-muted-foreground mt-1'>
          A role provides access to predefined menus and features so administrators can fine-tune access permissions.
        </p>
      </div>

      {/* Role Cards Grid */}
      <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'>
        {roleList.map(role => (
          <Card key={role.id} className='p-6 flex flex-col justify-between hover:border-primary/50 transition-all'>
            <div className='flex items-start justify-between'>
              <span className='text-xs text-muted-foreground'>Total {role.usersCount} users</span>
              <div className='flex -space-x-2 overflow-hidden'>
                {role.avatars.map((av, idx) => (
                  <Avatar key={idx} className='size-8 ring-2 ring-card border-none'>
                    <AvatarImage src={av.src} />
                    <AvatarFallback className='text-xs'>{av.fallback}</AvatarFallback>
                  </Avatar>
                ))}
              </div>
            </div>

            <div className='my-4'>
              <h3 className='text-lg font-bold text-foreground'>{role.title}</h3>
              <span className='text-xs text-primary font-medium hover:underline cursor-pointer'>
                Edit Role ({role.permissionsCount} permissions)
              </span>
            </div>

            <div className='flex items-center justify-between pt-3 border-t border-border'>
              <Button variant='outline' size='sm' className='h-8 text-xs gap-1.5'>
                <Edit className='size-3.5' /> Edit
              </Button>
              <Button variant='ghost' size='icon' className='size-8 text-muted-foreground'>
                <Copy className='size-3.5' />
              </Button>
            </div>
          </Card>
        ))}

        {/* Add New Role Card */}
        <Card className='p-6 flex flex-col items-center justify-center text-center border-dashed hover:border-primary/80 transition-colors cursor-pointer min-h-[160px] bg-muted/20'>
          <div className='size-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-3'>
            <Plus className='size-6' />
          </div>
          <h3 className='font-bold text-base text-foreground'>Add New Role</h3>
          <p className='text-xs text-muted-foreground mt-1'>Create custom roles and set permissions</p>
        </Card>
      </div>
    </div>
  )
}
export default RolesApp
