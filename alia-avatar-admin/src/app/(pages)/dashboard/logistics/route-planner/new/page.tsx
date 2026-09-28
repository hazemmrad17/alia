import type { Metadata } from 'next'

import { PlanRoute } from '@/views/ala/logistics/plan-route'

export const metadata: Metadata = {
  title: 'Planifier une tournée | ALIA Avatar',
  description:
    'Composition d’une tournée VITAL SA — commandes non assignées, séquence des arrêts, véhicule, chauffeur et créneau de départ.'
}

const NewRoutePage = () => {
  return <PlanRoute />
}

export default NewRoutePage
