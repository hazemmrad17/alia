import type { Metadata } from 'next'
import { FileText } from 'lucide-react'
import CRMReportsView from '@/views/ala/commercial/crm-reports'

export const metadata: Metadata = {
  title: 'CRM Reports | ALIA Avatar',
  description: 'Post-session CRM reports with transcripts, objections, and follow-up actions.'
}

const CRMReportsPage = () => {
  return (
    <div className='grid grid-cols-6 gap-6'>
      <div className='col-span-full'>
        <div className='flex items-center gap-2 mb-2'>
          <FileText className='size-6 text-green-600' />
          <h1 className='text-2xl font-bold'>CRM Reports</h1>
        </div>
        <p className='text-sm text-muted-foreground'>
          Post-session CRM reports with transcripts, objections, and follow-up actions.
        </p>
      </div>

      <div className='col-span-full'>
        <CRMReportsView />
      </div>
    </div>
  )
}

export default CRMReportsPage
