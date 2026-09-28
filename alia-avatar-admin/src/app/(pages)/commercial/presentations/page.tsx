import type { Metadata } from 'next'

// Component Imports
import MyPresentations from '@/views/ala/commercial/my-presentations'

export const metadata: Metadata = {
  title: 'Mes présentations | ALIA Avatar',
  description: 'Les présentations VITAL que vous avez reçues, avec la suite convenue.'
}

const MyPresentationsPage = () => {
  return <MyPresentations />
}

export default MyPresentationsPage
