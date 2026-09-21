'use client'

import React from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { MoreVertical } from 'lucide-react'
import Image from 'next/image'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'

const paymentHistory = [
  {
    icon: '/images/widgets/master-card.webp',
    card: '*5688',
    type: 'Credit Card',
    date: '05/Jan',
    spend: '-$2,820',
    color: 'text-destructive'
  },
  {
    icon: '/images/widgets/visa.webp',
    card: '*8562',
    type: 'Debit Card',
    date: '12/Feb',
    spend: '-$1,450',
    color: 'text-destructive'
  },
  {
    icon: '/images/widgets/american-express.webp',
    card: '*4210',
    type: 'Credit Card',
    date: '28/Feb',
    spend: '-$3,920',
    color: 'text-destructive'
  },
  {
    icon: '/images/widgets/master-card.webp',
    card: '*9941',
    type: 'Virtual Card',
    date: '10/Mar',
    spend: '-$840',
    color: 'text-destructive'
  }
]

export const PaymentHistoryTable = () => {
  return (
    <Card className='col-span-full lg:col-span-3 2xl:col-span-2 flex flex-col justify-between'>
      <CardHeader className='flex flex-row items-center justify-between pb-2'>
        <CardTitle className='text-lg font-semibold'>Payment History</CardTitle>
        <Button variant='ghost' size='icon' className='size-8 text-muted-foreground'>
          <MoreVertical className='size-4' />
        </Button>
      </CardHeader>

      <CardContent className='p-0'>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className='pl-6'>Card</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className='text-right pr-6'>Spend</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paymentHistory.map((item, index) => (
              <TableRow key={index} className='hover:bg-muted/50 border-none'>
                <TableCell className='pl-6 py-3'>
                  <div className='flex items-center gap-3'>
                    <div className='bg-muted/80 flex size-10 items-center justify-center rounded-md p-1'>
                      <Image src={item.icon} alt={item.type} width={28} height={20} className='object-contain' />
                    </div>
                    <div className='flex flex-col'>
                      <span className='font-medium text-sm text-foreground'>{item.card}</span>
                      <span className='text-xs text-muted-foreground'>{item.type}</span>
                    </div>
                  </div>
                </TableCell>
                <TableCell className='text-xs text-muted-foreground'>{item.date}</TableCell>
                <TableCell className={`text-right pr-6 font-semibold text-sm ${item.color}`}>
                  {item.spend}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
export default PaymentHistoryTable
