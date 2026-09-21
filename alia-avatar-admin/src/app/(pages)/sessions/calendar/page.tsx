import type { Metadata } from 'next'
import { CalendarDays } from 'lucide-react'
import ConsultationCalendarView from '@/views/ala/commercial/consultation-calendar'

export const metadata: Metadata = {
  title: 'Consultation Calendar | ALIA Avatar',
  description: 'Schedule and join ALIA consultation and sales-pitch appointments.'
}

const ConsultationCalendarPage = () => {
  return (
    <div className='grid grid-cols-6 gap-6'>
      <div className='col-span-full'>
        <div className='flex items-center gap-2 mb-2'>
          <CalendarDays className='size-6 text-primary' />
          <h1 className='text-2xl font-bold'>Consultation Calendar</h1>
        </div>
        <p className='text-sm text-muted-foreground'>
          Book and join ALIA consultation &amp; sales-pitch appointments.
        </p>
      </div>

      <div className='col-span-full'>
        <ConsultationCalendarView />
      </div>
    </div>
  )
}

export default ConsultationCalendarPage