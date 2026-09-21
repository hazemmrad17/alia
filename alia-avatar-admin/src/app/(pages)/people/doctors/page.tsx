import type { Metadata } from 'next'
import { Stethoscope } from 'lucide-react'
import DoctorDirectory from '@/views/ala/commercial/doctor-directory'

export const metadata: Metadata = {
  title: 'Doctor Directory | ALIA Avatar',
  description: 'All doctors who have received product presentations from ALIA.'
}

const DoctorsPage = () => {
  return (
    <div className='grid grid-cols-6 gap-6'>
      <div className='col-span-full'>
        <div className='flex items-center gap-2 mb-2'>
          <Stethoscope className='size-6 text-green-600' />
          <h1 className='text-2xl font-bold'>Doctor Directory</h1>
        </div>
        <p className='text-sm text-muted-foreground'>
          All doctors who have received product presentations from ALIA.
        </p>
      </div>

      <div className='col-span-full'>
        <DoctorDirectory />
      </div>
    </div>
  )
}

export default DoctorsPage
