import type { Metadata } from 'next'

import SessionReview from '@/views/ala/training/session-review'

export const metadata: Metadata = {
  title: 'Détail de la session | ALIA Avatar',
  description:
    "Revue complète d'une simulation ALIA — score global, six étapes évaluées, points forts, axes d'amélioration, fiche de visite et transcription."
}

type PageProps = {
  params: Promise<{ id: string }>
}

const SessionReviewPage = async ({ params }: PageProps) => {
  const { id } = await params

  // The session itself is only readable by its owner (or an admin of the
  // tenant), so the id is resolved against the API rather than the URL alone.
  return <SessionReview sessionId={id} />
}

export default SessionReviewPage
