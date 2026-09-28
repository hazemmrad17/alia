import type { Metadata } from 'next'
import CommercialOverview from '@/views/ala/commercial/commercial-overview'

export const metadata: Metadata = {
  title: 'Overview | ALIA Avatar',
  description: "Vue d'ensemble de l'activité de formation ALIA — sessions, scores, couverture du catalogue et rapports."
}

const CommercialDashboardPage = () => {
  return (
    <div className='grid grid-cols-6 gap-6'>
      <CommercialOverview />
    </div>
  )
}

export default CommercialDashboardPage
