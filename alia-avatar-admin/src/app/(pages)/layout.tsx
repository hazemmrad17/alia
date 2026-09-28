'use client'

// React Imports
import dynamic from 'next/dynamic'
import { Suspense } from 'react'
import type { ReactNode } from 'react'

// Component Imports
import AuthGuard from '@/components/auth/auth-guard'
import Footer from '@/components/layout/Footer'
import Header from '@/components/layout/Header'
import { SidebarInset } from '@/components/ui/sidebar'
import { Toaster } from '@/components/ui/sonner'

const Sidebar = dynamic(() => import('@/components/layout/Sidebar'), { ssr: false })

// Every dashboard route needs a session. The guard wraps the sidebar and header
// too, so a signed-out visitor never sees the app shell before being redirected.
const PagesLayout = ({ children }: Readonly<{ children: ReactNode }>) => {
  return (
    <AuthGuard>
      <div className='flex h-full w-full min-w-0'>
        <Suspense>
          <Sidebar />
        </Suspense>
        <SidebarInset className='flex flex-1 flex-col'>
          <Header />
          <main className='mx-auto size-full max-w-360 flex-1 px-4 py-6 sm:px-6'>{children}</main>
          <Toaster />
          <Footer />
        </SidebarInset>
      </div>
    </AuthGuard>
  )
}

export default PagesLayout
