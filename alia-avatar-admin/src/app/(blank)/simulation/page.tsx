import type { Metadata } from 'next'

// Component Imports
import TrainingSimulation from '@/components/training/TrainingSimulation'

export const metadata: Metadata = {
  title: 'Simulation d\'Entretien — ALIA Avatar'
}

// Fullscreen training simulation — rendered inside the (blank) layout,
// so no navbar / sidebar / footer is shown.
const SimulationPage = () => {
  return <TrainingSimulation />
}

export default SimulationPage
