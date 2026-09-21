'use client'

// ──────────────────────────────────────────────
// Pre-setup loading screen — shown briefly when the user opens the training
// simulation, before the configuration panels appear. Purely cosmetic:
// a calm branded beat (orb + "Préparation de votre session…") that
// auto-dismisses once the setup UI is ready to mount.
// ──────────────────────────────────────────────

import { useEffect, useState } from 'react'

import { Sparkles } from 'lucide-react'

const TIPS = [
  'Préparation de votre session…',
  'Chargement des profils de médecins…',
  'Calibrage des scénarios de visite…'
]

export default function SetupLoader({ onDone }: { onDone: () => void }) {
  const [tipIdx, setTipIdx] = useState(0)

  // Cycle through the loading tips, then hand over to the setup wizard.
  useEffect(() => {
    const cycle = setInterval(() => setTipIdx(i => Math.min(i + 1, TIPS.length - 1)), 550)
    const finish = setTimeout(onDone, 1700)
    return () => {
      clearInterval(cycle)
      clearTimeout(finish)
    }
  }, [onDone])

  return (
    <div className='fixed inset-0 z-50 flex flex-col items-center justify-center bg-background overflow-hidden'>
      {/* soft radial wash */}
      <div
        className='pointer-events-none absolute inset-0'
        style={{
          background:
            'radial-gradient(circle at 50% 45%, rgba(0,0,0,0.10) 0%, rgba(0,0,0,0.04) 35%, transparent 65%)'
        }}
      />

      {/* ── Glowing orb (same identity as the interview splash) ── */}
      <div className='relative'>
        <div
          className='size-56 rounded-full blur-2xl animate-pulse absolute -inset-6'
          style={{
            background:
              'conic-gradient(from 120deg, oklch(0.60 0.16 160), oklch(0.45 0.13 165), oklch(0.60 0.16 160))',
            opacity: 0.55
          }}
        />
        <div className='relative size-44 rounded-full bg-white shadow-2xl flex items-center justify-center ring-1 ring-border'>
          <div className='size-36 rounded-full bg-gradient-to-b from-card to-background shadow-inner flex items-center justify-center'>
            <span className='text-5xl font-extrabold text-foreground tracking-tight select-none'>
              A<span className='text-primary'>.</span>
            </span>
          </div>
        </div>
      </div>

      {/* ── Progress bar + rotating tips ── */}
      <div className='mt-10 w-56 h-1 rounded-full bg-border overflow-hidden'>
        <div
          className='h-full bg-primary rounded-full transition-all duration-500 ease-out'
          style={{ width: `${((tipIdx + 1) / TIPS.length) * 100}%` }}
        />
      </div>
      <p className='mt-4 text-lg font-medium text-foreground flex items-center gap-2'>
        <Sparkles className='size-4 text-primary' />
        {TIPS[tipIdx]}
      </p>
    </div>
  )
}
