import type { Metadata } from 'next'

import FleetOverview from '@/views/ala/logistics/fleet-overview'

export const metadata: Metadata = {
  title: 'Flotte & tournées | ALIA Avatar',
  description:
    'Vue d’ensemble de la flotte des délégués médicaux VITAL SA — circuits du jour, état des véhicules, chaîne du froid et progression des tournées.'
}

const LogisticsDashboardPage = () => {
  return (
    <div className='grid grid-cols-6 gap-6'>
      <FleetOverview />
    </div>
  )
}

export default LogisticsDashboardPage
