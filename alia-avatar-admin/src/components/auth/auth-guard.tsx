'use client'

// ALIA Avatar — session guard
//
// Wraps the dashboard layout so no page renders without a session. It is
// client-side by necessity: the token lives in localStorage, which the server
// cannot read. That means the guard's job is to show nothing (never the app)
// while it checks, so a signed-out visitor never sees a flash of real data.

import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'

import { fetchCurrentUser } from '@/lib/alia-api'
import { AUTH_EXPIRED_EVENT, isAuthenticated, updateStoredUser } from '@/lib/auth'

const AuthGuard = ({ children }: { children: ReactNode }) => {
  const router = useRouter()
  const pathname = usePathname()
  const [ready, setReady] = useState(false)

  // Check the stored session, then confirm it with the server once — a token
  // can be revoked or simply be from a database that no longer has that user.
  useEffect(() => {
    if (!isAuthenticated()) {
      setReady(false)
      router.replace(`/login?next=${encodeURIComponent(pathname)}`)
      return
    }

    setReady(true)

    let cancelled = false
    fetchCurrentUser()
      .then(user => {
        if (!cancelled) updateStoredUser(user)
      })
      .catch(() => {
        // A 401 already cleared the session and fired the expiry event below.
      })

    return () => {
      cancelled = true
    }
  }, [router, pathname])

  // Any request that comes back 401 sends the user here, so an expired token
  // ends the session once instead of each call site inventing a redirect.
  useEffect(() => {
    const onExpired = () => router.replace('/login')

    window.addEventListener(AUTH_EXPIRED_EVENT, onExpired)

    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, onExpired)
  }, [router])

  if (!ready) {
    return (
      <div className='bg-background flex min-h-screen w-full items-center justify-center'>
        <Loader2 className='text-muted-foreground size-6 animate-spin' />
      </div>
    )
  }

  return <>{children}</>
}

export default AuthGuard
