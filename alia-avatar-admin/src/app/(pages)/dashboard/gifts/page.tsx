import type { Metadata } from 'next'

import { GiftCatalog } from '@/views/ala/doctor/gifts'

export const metadata: Metadata = {
  title: 'Catalogue cadeaux | ALIA Avatar',
  description: 'Échangez vos points Vital contre des récompenses.'
}

const GiftsPage = () => {
  return <GiftCatalog />
}

export default GiftsPage
