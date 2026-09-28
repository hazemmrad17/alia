import type { Metadata } from 'next'

// Component Imports
import LoginForm from '@/components/auth/login-form'

export const metadata: Metadata = {
  title: 'Connexion | ALIA Avatar',
  description: 'Connectez-vous à votre espace de formation ou de suivi ALIA Avatar.'
}

interface LoginPageProps {
  /** Next.js 16 hands page params to the server component as a promise. */
  searchParams: Promise<{ next?: string }>
}

const LoginPage = async ({ searchParams }: LoginPageProps) => {
  const { next } = await searchParams

  // Read on the server so the form needs no useSearchParams Suspense boundary.
  return <LoginForm nextPath={next} />
}

export default LoginPage
