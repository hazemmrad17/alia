'use client'

import React, { useState } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import { ShieldCheck, Plus, Search, Edit, Trash2, Key } from 'lucide-react'

export type PermissionItem = {
  id: string
  name: string
  assignedTo: string[]
  createdDate: string
}

const permissionList: PermissionItem[] = [
  { id: 'perm-1', name: 'Management / Users: Read & Write', assignedTo: ['Administrator'], createdDate: '14 Apr 2024' },
  { id: 'perm-2', name: 'Management / Users: Read Only', assignedTo: ['Administrator', 'Editor', 'Maintainer'], createdDate: '14 Apr 2024' },
  { id: 'perm-3', name: 'Billing / Invoices: Create & Refund', assignedTo: ['Administrator'], createdDate: '18 Apr 2024' },
  { id: 'perm-4', name: 'Content / Blog: Publish & Delete', assignedTo: ['Administrator', 'Editor', 'Author'], createdDate: '22 Apr 2024' },
  { id: 'perm-5', name: 'Analytics / Export CSV & PDF', assignedTo: ['Administrator', 'Editor'], createdDate: '01 May 2024' },
  { id: 'perm-6', name: 'Settings / API Keys & Webhooks', assignedTo: ['Administrator'], createdDate: '10 May 2024' }
]

export const PermissionsApp = () => {
  const [searchTerm, setSearchTerm] = useState('')

  const filtered = permissionList.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.assignedTo.some(a => a.toLowerCase().includes(searchTerm.toLowerCase()))
  )

  return (
    <div className='space-y-6'>
      <div className='flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4'>
        <div>
          <h1 className='text-2xl font-bold tracking-tight'>Permissions List</h1>
          <p className='text-sm text-muted-foreground'>
            Granular access controls assigned across roles.
          </p>
        </div>
        <Button size='sm' className='h-9 gap-1.5'>
          <Plus className='size-4' /> Add Permission
        </Button>
      </div>

      <Card className='p-0 overflow-hidden border border-border'>
        <div className='p-4 border-b border-border flex items-center justify-between'>
          <div className='relative w-full max-w-sm'>
            <Search className='absolute left-3 top-2.5 size-4 text-muted-foreground' />
            <Input
              placeholder='Search permissions...'
              className='pl-9 h-9 text-xs'
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className='pl-6'>Name</TableHead>
              <TableHead>Assigned To</TableHead>
              <TableHead>Created Date</TableHead>
              <TableHead className='text-right pr-6'>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map(item => (
              <TableRow key={item.id} className='hover:bg-muted/50'>
                <TableCell className='pl-6 font-medium text-foreground flex items-center gap-2'>
                  <Key className='size-4 text-primary' /> {item.name}
                </TableCell>
                <TableCell>
                  <div className='flex flex-wrap gap-1'>
                    {item.assignedTo.map((role, idx) => (
                      <Badge key={idx} variant='secondary' className='text-[11px] font-normal'>
                        {role}
                      </Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell className='text-xs text-muted-foreground'>{item.createdDate}</TableCell>
                <TableCell className='text-right pr-6'>
                  <div className='flex items-center justify-end gap-1'>
                    <Button variant='ghost' size='icon' className='size-8 text-muted-foreground'>
                      <Edit className='size-3.5' />
                    </Button>
                    <Button variant='ghost' size='icon' className='size-8 text-destructive'>
                      <Trash2 className='size-3.5' />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  )
}
export default PermissionsApp
