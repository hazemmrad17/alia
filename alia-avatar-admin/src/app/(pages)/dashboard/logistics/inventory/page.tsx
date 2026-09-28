import type { Metadata } from 'next'

import InventoryOverview from '@/views/ala/logistics/inventory-overview'

export const metadata: Metadata = {
  title: 'Stock & dépôts | ALIA Avatar',
  description:
    'Vue d’ensemble du stock VITAL SA — santé des gammes, alertes de réapprovisionnement, rotation et occupation des dépôts.'
}

const InventoryOverviewPage = () => {
  return (
    <div className='grid grid-cols-6 gap-6'>
      <InventoryOverview />
    </div>
  )
}

export default InventoryOverviewPage
