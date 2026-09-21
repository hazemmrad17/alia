import type { Metadata } from 'next'
import Login from '@/views/pages/auth/login'

export const metadata: Metadata = {
  title: 'Login | ALIA Avatar',
  description: 'Sign in to ALIA Avatar training or commercial portals.',
}

export default function DirectLoginPage() {
  return <Login />
}
