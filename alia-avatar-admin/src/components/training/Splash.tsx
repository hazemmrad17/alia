'use client'

// ──────────────────────────────────────────────
// Pre-interview loading screen (micro1-style)
//
// Full-screen glow orb + "Starting interview…". The browser mic permission
// prompt is triggered here, before the interview UI mounts, so the whole
// permission exchange happens on a calm screen instead of mid-conversation.
// ──────────────────────────────────────────────

import { useEffect, useRef, useState } from 'react'

import { AlertCircle, Globe, Mic, X } from 'lucide-react'

type MicState = 'prompting' | 'granted' | 'denied' | 'unsupported'

interface SplashProps {
  onDone: () => void

  /** Called with the live mic stream once permission is granted, so the
      interview can reuse it instead of prompting a second time. */
  onMicReady?: (stream: MediaStream) => void

  /** Continue even without a mic (user blocked it / no device). */
  onSkip?: () => void
}

export default function Splash({ onDone, onMicReady, onSkip }: SplashProps) {
  const [micState, setMicState] = useState<MicState>('prompting')


  // Only browsers that are not Chrome/Chromium see the "use Chrome" tip.
  const [showChromeTip, setShowChromeTip] = useState(
    () => typeof navigator !== 'undefined' && !/chrome|crios/i.test(navigator.userAgent)
  )

  const requestedRef = useRef(false)

  // ── Ask for the microphone as soon as the screen appears ──
  useEffect(() => {
    if (requestedRef.current) return
    requestedRef.current = true

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      // Keep this branch async like the others so the effect body itself
      // never sets state synchronously.
      Promise.resolve().then(() => {
        setMicState('unsupported')
        onSkip?.()
      })

      return
    }

    navigator.mediaDevices
      .getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } })
      .then(stream => {
        setMicState('granted')
        onMicReady?.(stream)

        // Give the "granted" beat a moment to register, then move on.
        setTimeout(onDone, 600)
      })
      .catch((err: DOMException) => {
        // NotAllowedError = user clicked Block (or the browser auto-denied).
        // NotFoundError = there is no microphone at all.
        setMicState(err?.name === 'NotFoundError' ? 'unsupported' : 'denied')
      })
  }, [onDone, onMicReady, onSkip])

  const micLabel
    = micState === 'granted'
      ? 'Microphone prêt'
      : micState === 'denied'
        ? "Microphone bloqué — l'entretien démarrera en mode texte"
        : micState === 'unsupported'
          ? 'Aucun microphone détecté — mode texte'
          : 'Autorisez le microphone pour parler à ALIA'

  return (
    <div className='fixed inset-0 z-50 flex flex-col items-center justify-center bg-background overflow-hidden'>
      {/* soft radial wash behind the orb */}
      <div
        className='pointer-events-none absolute inset-0'
        style={{
          background:
            'radial-gradient(circle at 50% 45%, rgba(0,0,0,0.10) 0%, rgba(0,0,0,0.04) 35%, transparent 65%)'
        }}
      />

      {/* ── Glowing ALIA chip — floats above the orb ── */}
      <div className='relative mb-8 flex items-center justify-center'>
        {/* pulsing glow halo */}
        <span
          className='absolute inset-0 rounded-full blur-xl animate-ping'
          style={{ background: 'oklch(0.60 0.16 160)', opacity: 0.25, animationDuration: '2.2s' }}
        />
        <div
          className='relative inline-flex items-center gap-2.5 rounded-full border border-primary/40 bg-card/90 backdrop-blur px-6 py-2.5 shadow-lg'
          style={{ boxShadow: '0 0 28px oklch(0.60 0.16 160 / 0.45), 0 0 60px oklch(0.60 0.16 160 / 0.2)' }}
        >
          <span className='relative flex size-2.5'>
            <span className='absolute inline-flex size-full rounded-full bg-primary opacity-60 animate-ping' />
            <span className='relative inline-flex size-2.5 rounded-full bg-primary' />
          </span>
          <span className='text-lg font-bold tracking-tight text-foreground'>
            ALIA<span className='text-primary'>.</span>
          </span>
        </div>
      </div>

      {/* ── Glowing orb ── */}
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

      {/* ── Status line ── */}
      <p className='mt-10 text-xl font-medium text-foreground'>
        {micState === 'granted' ? "L'entretien démarre…" : "Démarrage de l'entretien…"}
      </p>
      <p className='mt-2 text-sm text-muted-foreground flex items-center gap-1.5'>
        <Mic className='size-3.5' />
        {micLabel}
      </p>

      {/* ── Blocked / unsupported actions ── */}
      {(micState === 'denied' || micState === 'unsupported') && (
        <div className='mt-8 flex items-center gap-3'>
          <button
            type='button'
            onClick={onDone}
            className='px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors cursor-pointer shadow-sm'
          >
            Continuer en mode texte
          </button>
          {micState === 'denied' && (
            <span className='text-xs text-muted-foreground flex items-center gap-1'>
              <AlertCircle className='size-3.5' />
              Réautorisez le micro dans les réglages du navigateur pour parler.
            </span>
          )}
        </div>
      )}

      {/* ── "Use Chrome" toast, micro1-style ── */}
      {showChromeTip && (
        <div className='fixed bottom-6 right-6 z-10 flex items-center gap-2.5 rounded-xl bg-popover/95 backdrop-blur border border-border px-4 py-3 shadow-lg'>
          <AlertCircle className='size-4 text-primary shrink-0' />
          <span className='text-sm text-popover-foreground'>
            Pour une meilleure expérience, utilisez Google Chrome
          </span>
          <Globe className='size-4 shrink-0' />
          <button
            type='button'
            onClick={() => setShowChromeTip(false)}
            title='Fermer'
            className='ml-1 text-muted-foreground hover:text-foreground cursor-pointer'
          >
            <X className='size-4' />
          </button>
        </div>
      )}
    </div>
  )
}
