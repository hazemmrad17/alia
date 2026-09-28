import type { Metadata } from 'next'

// Component Imports
import MyDoctors from '@/views/ala/admin/my-doctors'

export const metadata: Metadata = {
  title: 'Mes médecins | ALIA Avatar',
  description: 'Les médecins et pharmaciens que vous suivez — leurs présentations et la suite convenue.'
}

const MyDoctorsPage = () => {
  return <MyDoctors />
}

export default MyDoctorsPage
