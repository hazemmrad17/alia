import type { Metadata } from 'next'

// Component Imports
import AuthGuard from '@/components/auth/auth-guard'
import TrainingSimulation from '@/components/training/TrainingSimulation'

export const metadata: Metadata = {
  title: 'Simulation d\'Entretien — ALIA Avatar'
}

// Fullscreen training simulation — rendered inside the (blank) layout,
// so no navbar / sidebar / footer is shown. It sits outside the dashboard
// group, so it carries its own guard: a setup screen that cannot start a
// session is worse than a login page.
const SimulationPage = () => {
  return (
    <AuthGuard>
      <TrainingSimulation />
    </AuthGuard>
  )
}

export default SimulationPage
