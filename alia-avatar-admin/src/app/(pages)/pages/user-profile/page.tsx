import { redirect } from 'next/navigation'

// The user-profile page was merged into /settings (Profile & Connections tabs).
// Deep links like /pages/user-profile?view=profile land on the right tab.
const UserSettingsPage = async ({
  searchParams
}: {
  searchParams: Promise<{ view?: string }>
}) => {
  const { view } = await searchParams
  redirect(view === 'connections' ? '/settings?tab=connections' : '/settings?tab=profile')
}

export default UserSettingsPage
