'use client'

import React, { useState } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import { Search, Plus, Eye, Download, MoreHorizontal, ArrowUpDown } from 'lucide-react'

export type InvoiceItem = {
  id: string
  client: {
    name: string
    email: string
    avatar: string
    fallback: string
  }
  total: number
  issuedDate: string
  balance: string
  status: 'paid' | 'downloaded' | 'pending' | 'sent' | 'draft'
}

const invoiceData: InvoiceItem[] = [
  {
    id: '#5001',
    client: {
      name: 'Jack Alfredo',
      email: 'jack@shadcnstudio.com',
      avatar: '/images/avatars/avatar-1.webp',
      fallback: 'JA'
    },
    total: 316.0,
    issuedDate: '15 Mar 2025',
    balance: '$0',
    status: 'paid'
  },
  {
    id: '#5002',
    client: {
      name: 'Maria Gonzalez',
      email: 'maria.g@shadcnstudio.com',
      avatar: '/images/avatars/avatar-2.webp',
      fallback: 'MG'
    },
    total: 253.4,
    issuedDate: '18 Mar 2025',
    balance: '$120.00',
    status: 'pending'
  },
  {
    id: '#5003',
    client: {
      name: 'John Doe',
      email: 'john.doe@shadcnstudio.com',
      avatar: '/images/avatars/avatar-3.webp',
      fallback: 'JD'
    },
    total: 852.0,
    issuedDate: '22 Mar 2025',
    balance: '$0',
    status: 'paid'
  },
  {
    id: '#5004',
    client: {
      name: 'Emily Carter',
      email: 'emily.carter@shadcnstudio.com',
      avatar: '/images/avatars/avatar-4.webp',
      fallback: 'EC'
    },
    total: 889.0,
    issuedDate: '24 Mar 2025',
    balance: '$0',
    status: 'downloaded'
  },
  {
    id: '#5005',
    client: {
      name: 'David Lee',
      email: 'david.lee@shadcnstudio.com',
      avatar: '/images/avatars/avatar-5.webp',
      fallback: 'DL'
    },
    total: 723.16,
    issuedDate: '28 Mar 2025',
    balance: '$0',
    status: 'paid'
  },
  {
    id: '#5006',
    client: {
      name: 'Sophia Patel',
      email: 'sophia.patel@shadcnstudio.com',
      avatar: '/images/avatars/avatar-6.webp',
      fallback: 'SP'
    },
    total: 612.0,
    issuedDate: '01 Apr 2025',
    balance: '$612.00',
    status: 'sent'
  }
]

export const SalesInvoiceDatatable = () => {
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [pageSize, setPageSize] = useState('5')

  const filteredData = invoiceData.filter(item => {
    const matchesSearch =
      item.client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.client.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.id.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesStatus = statusFilter === 'all' || item.status === statusFilter

    return matchesSearch && matchesStatus
  })

  const getStatusBadge = (status: InvoiceItem['status']) => {
    switch (status) {
      case 'paid':
        return <Badge className='bg-emerald-500/10 text-emerald-600 border-emerald-500/20'>Paid</Badge>
      case 'pending':
        return <Badge className='bg-amber-500/10 text-amber-600 border-amber-500/20'>Pending</Badge>
      case 'downloaded':
        return <Badge className='bg-primary/10 text-primary border-primary/20'>Downloaded</Badge>
      case 'sent':
        return <Badge className='bg-purple-500/10 text-purple-600 border-purple-500/20'>Sent</Badge>
      default:
        return <Badge variant='outline'>{status}</Badge>
    }
  }

  return (
    <Card className='col-span-full p-0 overflow-hidden'>
      {/* Header controls */}
      <div className='p-6 flex flex-col lg:flex-row gap-4 lg:items-center lg:justify-between border-b border-border'>
        <div className='flex items-center gap-4'>
          <div className='flex items-center gap-2 text-sm text-muted-foreground'>
            <span>Show</span>
            <Select value={pageSize} onValueChange={val => { if (val) setPageSize(val) }}>
              <SelectTrigger className='w-18 h-9'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='5'>5</SelectItem>
                <SelectItem value='10'>10</SelectItem>
                <SelectItem value='20'>20</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button size='sm' className='h-9 gap-1.5'>
            <Plus className='size-4' /> Create Invoice
          </Button>
        </div>

        <div className='flex flex-wrap items-center gap-3'>
          <div className='relative w-full sm:w-64'>
            <Search className='absolute left-2.5 top-2.5 size-4 text-muted-foreground' />
            <Input
              placeholder='Search client...'
              className='pl-8 h-9'
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>

          <Select value={statusFilter} onValueChange={val => { if (val) setStatusFilter(val) }}>
            <SelectTrigger className='w-32 h-9'>
              <SelectValue placeholder='Status' />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='all'>All Status</SelectItem>
              <SelectItem value='paid'>Paid</SelectItem>
              <SelectItem value='pending'>Pending</SelectItem>
              <SelectItem value='downloaded'>Downloaded</SelectItem>
              <SelectItem value='sent'>Sent</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Table */}
      <div className='overflow-x-auto'>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className='w-24'># ID</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Issued Date</TableHead>
              <TableHead>Balance</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className='text-right'>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredData.slice(0, parseInt(pageSize)).map(invoice => (
              <TableRow key={invoice.id} className='hover:bg-muted/50'>
                <TableCell className='font-medium text-primary cursor-pointer hover:underline'>
                  {invoice.id}
                </TableCell>
                <TableCell>
                  <div className='flex items-center gap-3'>
                    <Avatar className='size-8'>
                      <AvatarImage src={invoice.client.avatar} />
                      <AvatarFallback>{invoice.client.fallback}</AvatarFallback>
                    </Avatar>
                    <div className='flex flex-col'>
                      <span className='font-medium text-sm text-foreground'>{invoice.client.name}</span>
                      <span className='text-xs text-muted-foreground'>{invoice.client.email}</span>
                    </div>
                  </div>
                </TableCell>
                <TableCell className='font-semibold'>${invoice.total.toFixed(2)}</TableCell>
                <TableCell className='text-muted-foreground text-sm'>{invoice.issuedDate}</TableCell>
                <TableCell className='text-sm'>{invoice.balance}</TableCell>
                <TableCell>{getStatusBadge(invoice.status)}</TableCell>
                <TableCell className='text-right'>
                  <div className='flex items-center justify-end gap-1'>
                    <Button variant='ghost' size='icon' className='size-8 text-muted-foreground'>
                      <Eye className='size-4' />
                    </Button>
                    <Button variant='ghost' size='icon' className='size-8 text-muted-foreground'>
                      <Download className='size-4' />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Footer / Pagination */}
      <div className='p-4 border-t border-border flex items-center justify-between text-xs text-muted-foreground'>
        <span>Showing 1 to {Math.min(filteredData.length, parseInt(pageSize))} of {filteredData.length} entries</span>
        <div className='flex gap-1'>
          <Button variant='outline' size='sm' className='h-8 px-2' disabled>Previous</Button>
          <Button variant='outline' size='sm' className='h-8 px-2 bg-primary text-primary-foreground'>1</Button>
          <Button variant='outline' size='sm' className='h-8 px-2'>Next</Button>
        </div>
      </div>
    </Card>
  )
}
export default SalesInvoiceDatatable
