import type { Metadata } from 'next'

import LeaderboardView from '@/views/ala/training/leaderboard-view'

export const metadata: Metadata = {
  title: 'Leaderboard | ALIA Avatar',
  description: 'Classement des délégués médicaux de votre entreprise : XP, sessions et scores.'
}

const LeaderboardPage = () => {
  return (
    <main className='mx-auto size-full max-w-360 flex-1 px-4 py-6 sm:px-6'>
      <div className='mb-6'>
        <h1 className='text-2xl font-semibold tracking-tight'>Leaderboard</h1>
        <p className='text-muted-foreground text-sm'>
          Comparez votre activité d'entraînement avec celle de vos collègues délégués.
        </p>
      </div>
      <LeaderboardView />
    </main>
  )
}

export default LeaderboardPage
