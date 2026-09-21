import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  basePath: process.env.BASEPATH ?? '',
  reactStrictMode: true,
  pageExtensions: ['js', 'jsx', 'ts', 'tsx'],

  // The dev server is often opened on 127.0.0.1 rather than localhost; without
  // this, Next blocks its own dev resources from that origin and the app never
  // hydrates (clicks stop working).
  allowedDevOrigins: ['127.0.0.1', 'localhost'],

  // The landing page at "/" is the mirrored marketing site kept in
  // public/landing (a self-contained static snapshot). Its asset URLs are
  // absolute, so they need mapping onto the folder it lives in.
  rewrites: async () => {
    return [
      { source: '/', destination: '/landing/index.html' },
      { source: '/assets/:path*', destination: '/landing/assets/:path*' },
      { source: '/manifest.webmanifest', destination: '/landing/assets/manifest.webmanifest' }
    ]
  },
  redirects: async () => {
    return [
      // Landing page CTAs ("Try for free") point at /register; the app's
      // entry point is the role picker that used to live at "/".
      {
        source: '/register',
        destination: '/get-started',
        permanent: false
      },
      {
        source: '/settings/general',
        destination: '/settings?tab=general',
        permanent: true
      },
      {
        source: '/settings/status',
        destination: '/settings?tab=status',
        permanent: true
      },
      {
        source: '/sessions/history',
        destination: '/settings?tab=history',
        permanent: true
      },
      {
        source: '/analytics/score-trends',
        destination: '/settings?tab=trends',
        permanent: true
      }
    ]
  }
}

export default nextConfig
