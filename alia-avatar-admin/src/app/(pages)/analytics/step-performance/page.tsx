import type { Metadata } from 'next'
import { Target } from 'lucide-react'
import StepPerformanceView from '@/views/ala/training/step-performance'

export const metadata: Metadata = {
  title: 'Step Performance | ALIA Avatar',
  description: 'Detailed analysis of delegate performance across each visit step.'
}

const StepPerformancePage = () => {
  return (
    <div className='grid grid-cols-6 gap-6'>
      <div className='col-span-full'>
        <div className='flex items-center gap-2 mb-2'>
          <Target className='size-6 text-primary' />
          <h1 className='text-2xl font-bold'>Step Performance</h1>
        </div>
        <p className='text-sm text-muted-foreground'>
          Detailed analysis of how delegates perform across each of the 6 visit steps.
        </p>
      </div>

      <div className='col-span-full'>
        <StepPerformanceView />
      </div>
    </div>
  )
}

export default StepPerformancePage
