import type { Metadata } from 'next'

import { RouteEditor } from '@/views/ala/logistics/plan-route'

export const metadata: Metadata = {
  title: 'Tournée | ALIA Avatar',
  description: 'Ouverture d’une tournée VITAL SA dans le planificateur — arrêts, séquence, véhicule et chauffeur.'
}

type PageProps = {
  params: Promise<{ id: string }>
}

const RouteDetailPage = async ({ params }: PageProps) => {
  const { id } = await params

  // Which tournées exist is only half known on the server: tournées saved from the
  // composer live in this browser alone, so the editor resolves the id again once
  // it is mounted.
  return <RouteEditor id={id} />
}

export default RouteDetailPage
