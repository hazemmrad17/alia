import type { Metadata } from 'next'

import { LoyaltyDashboard } from '@/views/ala/doctor/loyalty-dashboard'

export const metadata: Metadata = {
  title: 'Mon espace fidélité | ALIA Avatar',
  description: 'Vos points Vital, votre niveau et vos cadeaux.'
}

const LoyaltyPage = () => {
  return <LoyaltyDashboard />
}

export default LoyaltyPage
