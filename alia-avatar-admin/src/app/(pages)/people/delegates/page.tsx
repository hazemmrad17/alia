import type { Metadata } from 'next'
import { Trophy } from 'lucide-react'
import DelegateLeaderboard from '@/views/ala/training/delegate-leaderboard'

export const metadata: Metadata = {
  title: 'Delegate Leaderboard | ALIA Avatar',
  description: 'Ranking of medical delegates by training performance and competence level.'
}

const DelegatesPage = () => {
  return (
    <div className='grid grid-cols-6 gap-6'>
      <div className='col-span-full'>
        <div className='flex items-center gap-2 mb-2'>
          <Trophy className='size-6 text-primary' />
          <h1 className='text-2xl font-bold'>Delegate Leaderboard</h1>
        </div>
        <p className='text-sm text-muted-foreground'>
          Ranking of medical delegates by training performance and competence level progression.
        </p>
      </div>

      <div className='col-span-full'>
        <DelegateLeaderboard />
      </div>
    </div>
  )
}

export default DelegatesPage
