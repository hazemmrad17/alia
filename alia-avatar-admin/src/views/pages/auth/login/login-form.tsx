'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { EyeIcon, EyeOffIcon, GraduationCap, Pill, ArrowRight, CheckCircle2, ShieldCheck } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group'
import { Badge } from '@/components/ui/badge'

export type UserRole = 'delegate' | 'doctor'

interface LoginFormProps {
  role: UserRole
  onRoleChange: (role: UserRole) => void
}

const ROLE_PRESETS = {
  delegate: {
    email: 'delegate.karim@vital.sa',
    password: 'password123',
    roleLabel: 'Medical Delegate',
    badgeClass: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
    targetDashboard: '/dashboard/training',
    description: 'Training Simulation & Performance Analytics',
  },
  doctor: {
    email: 'dr.mansouri@vital.sa',
    password: 'password123',
    roleLabel: 'Doctor / Pharmacist',
    badgeClass: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
    targetDashboard: '/dashboard/commercial',
    description: 'Product Catalog & Commercial Presentations',
  },
}

export default function LoginForm({ role, onRoleChange }: LoginFormProps) {
  const router = useRouter()
  const preset = ROLE_PRESETS[role]

  const [email, setEmail] = useState(preset.email)
  const [password, setPassword] = useState(preset.password)
  const [isVisible, setIsVisible] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const handleSelectRole = (newRole: UserRole) => {
    onRoleChange(newRole)
    setEmail(ROLE_PRESETS[newRole].email)
    setPassword(ROLE_PRESETS[newRole].password)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    // Store auth session
    localStorage.setItem(
      'alia-user',
      JSON.stringify({
        email,
        role,
        name: role === 'delegate' ? 'Karim Benali' : 'Dr. Khalid Mansouri',
      })
    )

    setTimeout(() => {
      router.push(preset.targetDashboard)
    }, 400)
  }

  return (
    <div className='space-y-5'>
      {/* ── Role Selector ── */}
      <div className='grid grid-cols-2 gap-3'>
        {/* Medical Delegate Option */}
        <button
          type='button'
          onClick={() => handleSelectRole('delegate')}
          className={`flex flex-col items-start p-3.5 rounded-xl border-2 text-left transition-all ${
            role === 'delegate'
              ? 'border-purple-500 bg-purple-500/10 shadow-sm'
              : 'border-border hover:border-purple-300 dark:hover:border-purple-700 bg-card'
          }`}
        >
          <div className='flex items-center justify-between w-full mb-1.5'>
            <div className='flex items-center gap-1.5'>
              <GraduationCap className='size-4 text-purple-600 dark:text-purple-400' />
              <span className='font-semibold text-xs text-purple-700 dark:text-purple-300'>Delegate</span>
            </div>
            {role === 'delegate' && <CheckCircle2 className='size-3.5 text-purple-600 dark:text-purple-400' />}
          </div>
          <span className='text-xs text-muted-foreground line-clamp-1'>Training Mode</span>
        </button>

        {/* Doctor Option */}
        <button
          type='button'
          onClick={() => handleSelectRole('doctor')}
          className={`flex flex-col items-start p-3.5 rounded-xl border-2 text-left transition-all ${
            role === 'doctor'
              ? 'border-primary bg-primary/10 shadow-sm'
              : 'border-border hover:border-primary/50 bg-card'
          }`}
        >
          <div className='flex items-center justify-between w-full mb-1.5'>
            <div className='flex items-center gap-1.5'>
              <Pill className='size-4 text-primary' />
              <span className='font-semibold text-xs text-emerald-700 dark:text-emerald-300'>Doctor / HCP</span>
            </div>
            {role === 'doctor' && <CheckCircle2 className='size-3.5 text-primary' />}
          </div>
          <span className='text-xs text-muted-foreground line-clamp-1'>Commercial Mode</span>
        </button>
      </div>

      {/* ── Form ── */}
      <form onSubmit={handleSubmit}>
        <FieldGroup className='gap-4'>
          {/* Email */}
          <Field className='gap-1.5'>
            <FieldLabel htmlFor='userEmail' className='text-xs font-medium'>
              Account Email
            </FieldLabel>
            <Input
              type='email'
              id='userEmail'
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder='your.email@vital.sa'
              required
            />
          </Field>

          {/* Password */}
          <Field className='w-full gap-1.5'>
            <FieldLabel htmlFor='password' className='text-xs font-medium'>
              Password
            </FieldLabel>
            <InputGroup>
              <InputGroupInput
                id='password'
                type={isVisible ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder='••••••••••••'
                required
              />
              <InputGroupAddon align='inline-end' className='pr-1.5'>
                <Button
                  type='button'
                  variant='ghost'
                  size='icon'
                  onClick={() => setIsVisible(prev => !prev)}
                  className='text-muted-foreground rounded-l-none hover:bg-transparent size-8'
                >
                  {isVisible ? <EyeOffIcon className='size-4' /> : <EyeIcon className='size-4' />}
                  <span className='sr-only'>{isVisible ? 'Hide password' : 'Show password'}</span>
                </Button>
              </InputGroupAddon>
            </InputGroup>
          </Field>

          {/* Remember Me and Target Note */}
          <div className='flex items-center justify-between gap-y-2 text-xs'>
            <Field orientation='horizontal' className='flex items-center gap-2'>
              <Checkbox id='rememberMe' defaultChecked />
              <FieldLabel htmlFor='rememberMe' className='text-muted-foreground cursor-pointer'>
                Remember me
              </FieldLabel>
            </Field>
            <span className='text-muted-foreground'>
              Redirects to <span className='font-medium text-foreground'>{role === 'delegate' ? 'Training' : 'Commercial'}</span>
            </span>
          </div>

          {/* Submit button */}
          <Field>
            <Button
              className={`w-full gap-2 font-medium ${
                role === 'delegate'
                  ? 'bg-purple-600 hover:bg-purple-700 text-white'
                  : 'bg-primary hover:bg-primary/90 text-primary-foreground'
              }`}
              type='submit'
              disabled={isLoading}
            >
              {isLoading ? (
                'Signing in...'
              ) : (
                <>
                  Access {preset.roleLabel} Portal <ArrowRight className='size-4' />
                </>
              )}
            </Button>
          </Field>
        </FieldGroup>
      </form>
    </div>
  )
}
