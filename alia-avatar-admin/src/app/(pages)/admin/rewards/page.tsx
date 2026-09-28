import type { Metadata } from 'next'

import { RewardsAdmin } from '@/views/ala/admin/rewards-admin'

export const metadata: Metadata = {
  title: 'Récompenses & fidélité | ALIA Avatar',
  description: 'Le catalogue de cadeaux et les demandes des médecins.'
}

const RewardsAdminPage = () => {
  return <RewardsAdmin />
}

export default RewardsAdminPage
