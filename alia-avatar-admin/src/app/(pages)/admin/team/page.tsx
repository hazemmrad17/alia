import type { Metadata } from 'next'

// Component Imports
import MyTeam from '@/views/ala/admin/my-team'

export const metadata: Metadata = {
  title: 'Mon équipe | ALIA Avatar',
  description: 'Les délégués médicaux sous votre aile — leur dernière session, leur progression.'
}

const MyTeamPage = () => {
  return <MyTeam />
}

export default MyTeamPage
