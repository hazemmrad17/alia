import type { Metadata } from 'next'

// Component Imports
import AdminPermissions from '@/views/ala/admin/permissions'

export const metadata: Metadata = {
  title: 'Permissions | ALIA Avatar',
  description:
    'La matrice des permissions ALIA Avatar — chaque module, chaque rôle, et les quatre actions qui les relient.'
}

const AdminPermissionsPage = () => {
  return <AdminPermissions />
}

export default AdminPermissionsPage
