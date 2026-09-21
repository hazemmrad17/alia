import type { Metadata } from 'next'
import { GraduationCap } from 'lucide-react'

import TrainingDashboardHub from '@/views/ala/training/training-dashboard-hub'

export const metadata: Metadata = {
  title: 'Training Dashboard | ALIA Avatar',
  description: "Hub d'entraînement ALIA — lancez des simulations, suivez vos sessions et vos KPIs détaillés."
}

const TrainingSimulatorPage = () => {
  return <TrainingDashboardHub />
}

export default TrainingSimulatorPage
