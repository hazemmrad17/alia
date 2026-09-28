'use client'

// ALIA Avatar — sign in
//
// The only place in the app that creates a session. Everything else reads the
// token through src/lib/auth.ts, so the sign-in flow stays in one file.

import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'

import { useRouter } from 'next/navigation'
import { AlertCircle, Loader2, LockKeyhole, Mail, ShieldCheck } from 'lucide-react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ApiError, login } from '@/lib/alia-api'
import { getCurrentUser, landingPathFor, setSession } from '@/lib/auth'

const DEMO_ACCOUNTS = [
  { email: 'delegate@vital.tn', label: 'Délégué médical — espace de formation' },
  { email: 'doctor@vital.tn', label: 'Médecin / Pharmacien — reçoit les présentations ALIA' },
  { email: 'admin@vital.tn', label: 'Administrateur — plateforme complète' }
]

interface LoginFormProps {

  /** Deep link to return to after signing in, from the guard. */
  nextPath?: string
}

const LoginForm = ({ nextPath }: LoginFormProps) => {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Someone who already has a live session should never see the form again;
  // send them to the workspace their account belongs to.
  useEffect(() => {
    const user = getCurrentUser()

    if (user) router.replace(nextPath || landingPathFor(user.role))
  }, [router, nextPath])

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setSubmitting(true)

    try {
      const result = await login(email.trim(), password)

      setSession(result.access_token, result.expires_in, result.user)
      router.replace(nextPath && nextPath.startsWith('/') ? nextPath : landingPathFor(result.user.role))
    } catch (err) {
      // The API answers 401 with a French message for both a wrong password and
      // an unknown account, so there is nothing to disambiguate here.
      if (err instanceof ApiError) setError(err.message)
      else setError("Impossible de joindre le serveur ALIA. Vérifiez qu'il est démarré.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className='bg-background flex min-h-screen w-full items-center justify-center p-4'>
      <div className='w-full max-w-md'>
        <div className='mb-6 flex flex-col items-center gap-3 text-center'>
          { }
          <img
            src='/images/brands/vital-logo.png'
            alt='VITAL Laboratoires'
            className='border-border bg-background size-14 rounded-lg border object-contain p-1'
          />
          <div>
            <h1 className='text-2xl font-bold tracking-tight'>ALIA Avatar</h1>
            <p className='text-muted-foreground text-sm'>VITAL SA — Medical Intelligence Platform</p>
          </div>
        </div>

        <Card>
          <CardHeader className='gap-1'>
            <CardTitle className='text-lg'>Connexion</CardTitle>
            <CardDescription>Accédez à votre espace de formation ou de suivi.</CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={onSubmit} className='space-y-4'>
              <div className='space-y-2'>
                <Label htmlFor='email'>E-mail professionnel</Label>
                <div className='relative'>
                  <Mail className='text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2' />
                  <Input
                    id='email'
                    type='email'
                    autoComplete='email'
                    required
                    autoFocus
                    value={email}
                    onChange={event => setEmail(event.target.value)}
                    placeholder='prenom.nom@vital.tn'
                    className='pl-9'
                  />
                </div>
              </div>

              <div className='space-y-2'>
                <Label htmlFor='password'>Mot de passe</Label>
                <div className='relative'>
                  <LockKeyhole className='text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2' />
                  <Input
                    id='password'
                    type='password'
                    autoComplete='current-password'
                    required
                    value={password}
                    onChange={event => setPassword(event.target.value)}
                    placeholder='••••••••'
                    className='pl-9'
                  />
                </div>
              </div>

              {error && (
                <Alert variant='destructive'>
                  <AlertCircle className='size-4' />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Button type='submit' className='w-full gap-2' disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className='size-4 animate-spin' />
                    Connexion…
                  </>
                ) : (
                  'Se connecter'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Demo credentials are a development aid, not a product feature: on a
            deployed instance they would hand over an admin account. */}
        {process.env.NODE_ENV !== 'production' && (
          <div className='border-border mt-4 rounded-lg border border-dashed p-3'>
            <p className='text-muted-foreground mb-2 flex items-center gap-1.5 text-xs font-medium'>
              <ShieldCheck className='size-3.5' />
              Comptes de démonstration — mot de passe <span className='font-mono'>Alia@2026</span>
            </p>
            <ul className='space-y-1'>
              {DEMO_ACCOUNTS.map(account => (
                <li key={account.email}>
                  <button
                    type='button'
                    onClick={() => {
                      setEmail(account.email)
                      setPassword('Alia@2026')
                      setError(null)
                    }}
                    className='hover:bg-accent flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors'
                  >
                    <span className='font-mono'>{account.email}</span>
                    <span className='text-muted-foreground'>{account.label}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <p className='text-muted-foreground mt-6 text-center text-xs'>Powered by VITAL SA • ALIA Avatar v1.0</p>
      </div>
    </div>
  )
}

export default LoginForm
