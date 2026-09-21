import type { Metadata } from 'next'

import SessionHistory from '@/views/ala/training/session-history'

export const metadata: Metadata = {
  title: 'Mes sessions | ALIA Avatar',
  description: 'Historique de vos sessions d\'entraînement ALIA — dates, configurations et vos retours.'
}

const TrainingSessionsPage = () => {
  return (
    <div className='grid grid-cols-6 gap-6'>
      <SessionHistory />
    </div>
  )
}

export default TrainingSessionsPage
