'use client'

import React, { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
import { Search, Plus, Eye, MoreHorizontal, Megaphone } from 'lucide-react'

export type CampaignItem = {
  id: string
  name: string
  channel: string
  clicks: number
  impressions: number
  budget: number
  conversionRate: string
  status: 'active' | 'completed' | 'paused'
}

const campaignData: CampaignItem[] = [
  {
    id: 'CMP-101',
    name: 'Summer Black Friday Sale',
    channel: 'Google Search Ads',
    clicks: 14250,
    impressions: 185000,
    budget: 3200,
    conversionRate: '4.8%',
    status: 'active'
  },
  {
    id: 'CMP-102',
    name: 'Instagram Influencer Blast',
    channel: 'Meta Social Ads',
    clicks: 28400,
    impressions: 420000,
    budget: 5400,
    conversionRate: '6.2%',
    status: 'active'
  },
  {
    id: 'CMP-103',
    name: 'Customer Re-engagement V2',
    channel: 'Email Newsletter',
    clicks: 8120,
    impressions: 45000,
    budget: 650,
    conversionRate: '8.4%',
    status: 'completed'
  },
  {
    id: 'CMP-104',
    name: 'B2B Enterprise Lead Gen',
    channel: 'LinkedIn Ads',
    clicks: 3450,
    impressions: 38000,
    budget: 2800,
    conversionRate: '3.1%',
    status: 'paused'
  },
  {
    id: 'CMP-105',
    name: 'YouTube Video Discovery',
    channel: 'YouTube Video',
    clicks: 19800,
    impressions: 310000,
    budget: 4100,
    conversionRate: '5.2%',
    status: 'active'
  }
]

export const CampaignPerformanceTable = () => {
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  const filteredData = campaignData.filter(item => {
    const matchesSearch =
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.channel.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.id.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesStatus = statusFilter === 'all' || item.status === statusFilter

    return matchesSearch && matchesStatus
  })

  const getStatusBadge = (status: CampaignItem['status']) => {
    switch (status) {
      case 'active':
        return <Badge className='bg-emerald-500/10 text-emerald-600 border-emerald-500/20'>Active</Badge>
      case 'completed':
        return <Badge className='bg-primary/10 text-primary border-primary/20'>Completed</Badge>
      case 'paused':
        return <Badge className='bg-amber-500/10 text-amber-600 border-amber-500/20'>Paused</Badge>
      default:
        return <Badge variant='outline'>{status}</Badge>
    }
  }

  return (
    <Card className='col-span-full p-0 overflow-hidden'>
      <div className='p-6 flex flex-col lg:flex-row gap-4 lg:items-center lg:justify-between border-b border-border'>
        <div className='flex items-center gap-4'>
          <h3 className='text-lg font-semibold flex items-center gap-2'>
            <Megaphone className='size-5 text-primary' /> Active Campaigns
          </h3>
          <Button size='sm' className='h-9 gap-1.5'>
            <Plus className='size-4' /> New Campaign
          </Button>
        </div>

        <div className='flex flex-wrap items-center gap-3'>
          <div className='relative w-full sm:w-64'>
            <Search className='absolute left-2.5 top-2.5 size-4 text-muted-foreground' />
            <Input
              placeholder='Search campaigns...'
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
              <SelectItem value='active'>Active</SelectItem>
              <SelectItem value='completed'>Completed</SelectItem>
              <SelectItem value='paused'>Paused</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className='overflow-x-auto'>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className='w-28'>ID</TableHead>
              <TableHead>Campaign Name</TableHead>
              <TableHead>Channel</TableHead>
              <TableHead>Clicks</TableHead>
              <TableHead>Impressions</TableHead>
              <TableHead>Budget</TableHead>
              <TableHead>Conv. Rate</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className='text-right'>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredData.map(item => (
              <TableRow key={item.id} className='hover:bg-muted/50'>
                <TableCell className='font-medium text-primary'>{item.id}</TableCell>
                <TableCell className='font-semibold text-foreground'>{item.name}</TableCell>
                <TableCell className='text-muted-foreground text-sm'>{item.channel}</TableCell>
                <TableCell className='font-medium'>{item.clicks.toLocaleString()}</TableCell>
                <TableCell className='text-muted-foreground text-sm'>{item.impressions.toLocaleString()}</TableCell>
                <TableCell className='font-bold text-foreground'>${item.budget.toLocaleString()}</TableCell>
                <TableCell className='text-emerald-500 font-semibold'>{item.conversionRate}</TableCell>
                <TableCell>{getStatusBadge(item.status)}</TableCell>
                <TableCell className='text-right'>
                  <Button variant='ghost' size='icon' className='size-8 text-muted-foreground'>
                    <Eye className='size-4' />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className='p-4 border-t border-border flex items-center justify-between text-xs text-muted-foreground'>
        <span>Showing 1 to {filteredData.length} of {filteredData.length} campaigns</span>
        <div className='flex gap-1'>
          <Button variant='outline' size='sm' className='h-8 px-2' disabled>Previous</Button>
          <Button variant='outline' size='sm' className='h-8 px-2 bg-primary text-primary-foreground'>1</Button>
          <Button variant='outline' size='sm' className='h-8 px-2' disabled>Next</Button>
        </div>
      </div>
    </Card>
  )
}
export default CampaignPerformanceTable
