import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import SettingsTabs from '@/views/ala/shared/settings-tabs'

export const metadata: Metadata = {
  title: 'Settings | ALIA Avatar',
  description: 'Workspace settings — configuration, session history, score trends, and backend status.'
}

type PageProps = {
  searchParams?: Promise<{ tab?: string }>
}

const SettingsPage = async ({ searchParams }: PageProps) => {
  const params = await searchParams
  const tab = params?.tab

  // VITAL Products moved out of Settings into its own navbar page.
  if (tab === 'products') redirect('/products/catalog')

  return <SettingsTabs initialTab={tab} />
}

export default SettingsPage
