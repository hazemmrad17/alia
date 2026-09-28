import type { Metadata } from 'next'

import OperationsOverview from '@/views/ala/logistics/operations-overview'

export const metadata: Metadata = {
  title: 'Opérations | ALIA Avatar',
  description:
    'Vue d’ensemble des opérations VITAL SA — répartition de la flotte, pipeline des visites, ponctualité des tournées et préparation des unités.'
}

const OperationsOverviewPage = () => {
  return (
    <div className='grid grid-cols-6 gap-6'>
      <OperationsOverview />
    </div>
  )
}

export default OperationsOverviewPage
