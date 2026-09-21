import { redirect } from 'next/navigation'

// Account settings were merged into /settings (Account Settings tab).
const UserSettingsPage = () => {
  redirect('/settings?tab=account')
}

export default UserSettingsPage
