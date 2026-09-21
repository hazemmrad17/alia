import type { Metadata } from 'next'

import GeneralOverview from '@/views/ala/general-overview'

export const metadata: Metadata = {
  title: 'Dashboard | ALIA Avatar',
  description: "Vue d'ensemble ALIA — entraînement, produits VITAL SA et accès rapides."
}

const TrainingDashboardPage = () => {
  return (
    <div className='grid grid-cols-6 gap-6'>
      <GeneralOverview />
    </div>
  )
}

export default TrainingDashboardPage
