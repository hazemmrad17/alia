import type { Metadata } from 'next'

import { DelegateHome } from '@/views/ala/training/delegate-home'

export const metadata: Metadata = {
  title: 'Mon espace | ALIA Avatar',
  description: "Vue d'ensemble et détail de votre formation ALIA."
}

const TrainingDashboardPage = () => {
  return <DelegateHome />
}

export default TrainingDashboardPage
