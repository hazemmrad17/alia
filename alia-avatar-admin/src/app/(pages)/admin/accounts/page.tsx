import type { Metadata } from 'next'

// Component Imports
import AdminAccounts from '@/views/ala/admin/accounts'

export const metadata: Metadata = {
  title: 'Comptes & accès | ALIA Avatar',
  description: 'Gérez les comptes, les rôles et les accès à la plateforme ALIA Avatar.'
}

const AdminAccountsPage = () => {
  return <AdminAccounts />
}

export default AdminAccountsPage
