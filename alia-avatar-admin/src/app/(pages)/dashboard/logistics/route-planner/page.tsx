import type { Metadata } from 'next'

import { RoutePlanner } from '@/views/ala/logistics/route-planner'

export const metadata: Metadata = {
  title: 'Planificateur de tournées | ALIA Avatar',
  description:
    'Planification des tournées de la force de vente VITAL SA — circuits, arrêts, véhicules et chauffeurs, du brouillon à l’expédition.'
}

const RoutePlannerPage = () => {
  return <RoutePlanner />
}

export default RoutePlannerPage
