import type { Metadata } from 'next'

// Component Imports
import AdminRoles from '@/views/ala/admin/roles'

export const metadata: Metadata = {
  title: 'Rôles & permissions | ALIA Avatar',
  description:
    'Les rôles de la plateforme ALIA Avatar — ce que chacun permet, sur quels modules, et les comptes qui le portent.'
}

const AdminRolesPage = () => {
  return <AdminRoles />
}

export default AdminRolesPage
