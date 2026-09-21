import type { Metadata } from 'next'
import { Users } from 'lucide-react'
import DoctorStylesView from '@/views/ala/training/doctor-styles-analysis'

export const metadata: Metadata = {
  title: 'Doctor Styles Analysis | ALIA Avatar',
  description: 'How delegates perform with different doctor personalities and SONCAS frameworks.'
}

const DoctorStylesPage = () => {
  return (
    <div className='grid grid-cols-6 gap-6'>
      <div className='col-span-full'>
        <div className='flex items-center gap-2 mb-2'>
          <Users className='size-6 text-primary' />
          <h1 className='text-2xl font-bold'>Doctor Styles Analysis</h1>
        </div>
        <p className='text-sm text-muted-foreground'>
          How delegates perform with different doctor personalities — which styles are hardest to handle.
        </p>
      </div>

      <div className='col-span-full'>
        <DoctorStylesView />
      </div>
    </div>
  )
}

export default DoctorStylesPage
