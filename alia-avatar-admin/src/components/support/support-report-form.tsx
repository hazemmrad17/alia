'use client'

import { useState } from 'react'
import { AlertCircle, Bug, CheckCircle2, Lightbulb, Loader2, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Rating } from '@/components/ui/rating'
import { Textarea } from '@/components/ui/textarea'
import { createSupportReport } from '@/lib/alia-api'
import type { SupportReportInput, SupportReportKind } from '@/lib/alia-api'
import { cn } from '@/lib/utils'

/** What the reporter was doing — attached to the report automatically. */
export interface SupportContext {
  session_id?: string
  level?: string
  visit_format?: string
  doctor_style?: string
  product_focus?: string
  step?: string
  page?: string
}

const KINDS: { id: SupportReportKind; label: string; hint: string; icon: typeof Bug }[] = [
  { id: 'problem', label: 'Signaler un problème', hint: "Quelque chose ne fonctionne pas.", icon: Bug },
  { id: 'suggestion', label: 'Suggestion', hint: 'Une amélioration à proposer.', icon: Lightbulb }
]

/** Reasons a session goes wrong, so the team can triage without asking. */
const PROBLEM_CATEGORIES = [
  'Voix / audio',
  "ALIA ne répond pas",
  'Réponse inadaptée',
  'Micro / transcription',
  'Produit ou donnée erronée',
  'Autre'
]

const SUGGESTION_CATEGORIES = [
  'Déroulé de la visite',
  'Scénario / médecin',
  'Formulation d’ALIA',
  'Tableau de bord',
  'Autre'
]

export default function SupportReportForm({
  context,
  defaultKind = 'problem',
  compact = false,
  onSubmitted
}: {
  /** Scenario context captured at the moment the form opens. */
  context?: SupportContext
  defaultKind?: SupportReportKind
  /** Tighter spacing for the in-session dialog. */
  compact?: boolean
  onSubmitted?: () => void
}) {
  const [kind, setKind] = useState<SupportReportKind>(defaultKind)
  const [category, setCategory] = useState('')
  const [message, setMessage] = useState('')
  const [rating, setRating] = useState(0)
  const [contact, setContact] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const categories = kind === 'problem' ? PROBLEM_CATEGORIES : SUGGESTION_CATEGORIES
  const canSend = message.trim().length >= 3 && !sending

  const submit = async () => {
    if (!canSend) return
    setSending(true)
    setError(null)

    const payload: SupportReportInput = {
      kind,
      message: message.trim(),
      // The page is always known; the rest only exists inside a session.
      page: context?.page ?? (typeof window !== 'undefined' ? window.location.pathname : undefined),
      session_id: context?.session_id,
      level: context?.level,
      visit_format: context?.visit_format,
      doctor_style: context?.doctor_style,
      product_focus: context?.product_focus,
      step: context?.step,
      category: category || undefined,
      contact: contact.trim() || undefined,
      rating: kind === 'problem' ? undefined : rating || undefined
    }

    try {
      await createSupportReport(payload)
      setSent(true)
      onSubmitted?.()
    } catch (e) {
      setError(
        e instanceof Error && e.message.includes('422')
          ? 'Merci de décrire le problème en quelques mots.'
          : "L'envoi a échoué. Vérifiez la connexion et réessayez."
      )
    } finally {
      setSending(false)
    }
  }

  if (sent) {
    return (
      <div className={cn('flex flex-col items-center gap-2 text-center', compact ? 'py-6' : 'py-10')}>
        <span className='flex size-11 items-center justify-center rounded-full bg-primary/10'>
          <CheckCircle2 className='size-5 text-primary' />
        </span>
        <p className='text-sm font-semibold'>Merci, votre signalement est envoyé.</p>
        <p className='text-xs text-muted-foreground max-w-sm'>
          L’équipe ALIA le consulte et revient vers vous si vous avez laissé un contact.
        </p>
        <Button
          variant='outline'
          size='sm'
          className='mt-1'
          onClick={() => {
            setSent(false)
            setMessage('')
            setCategory('')
            setRating(0)
          }}
        >
          Envoyer un autre signalement
        </Button>
      </div>
    )
  }

  return (
    <div className={cn('flex flex-col', compact ? 'gap-3' : 'gap-4')}>
      {/* ── What kind of report is it? ── */}
      <div className='grid grid-cols-2 gap-2'>
        {KINDS.map(k => {
          const Icon = k.icon
          const active = kind === k.id
          return (
            <button
              key={k.id}
              type='button'
              onClick={() => {
                setKind(k.id)
                setCategory('')
              }}
              aria-pressed={active}
              className={cn(
                'flex items-start gap-2 rounded-lg border p-2.5 text-left transition-colors cursor-pointer',
                active ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50'
              )}
            >
              <Icon className={cn('size-4 shrink-0 mt-0.5', active ? 'text-primary' : 'text-muted-foreground')} />
              <span className='flex flex-col gap-0.5 min-w-0'>
                <span className='text-xs font-semibold leading-tight'>{k.label}</span>
                <span className='text-[11px] text-muted-foreground leading-tight'>{k.hint}</span>
              </span>
            </button>
          )
        })}
      </div>

      {/* ── Where exactly? ── */}
      <div className='flex flex-col gap-1.5'>
        <Label className='text-xs text-muted-foreground'>
          {kind === 'problem' ? 'De quoi s’agit-il ?' : 'Sur quoi porte la suggestion ?'}
        </Label>
        <div className='flex flex-wrap gap-1.5'>
          {categories.map(c => (
            <button
              key={c}
              type='button'
              onClick={() => setCategory(category === c ? '' : c)}
              aria-pressed={category === c}
              className={cn(
                'px-2.5 py-1 rounded-full border text-[11px] font-medium transition-colors cursor-pointer',
                category === c
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border text-muted-foreground hover:text-foreground'
              )}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* ── The report itself ── */}
      <div className='flex flex-col gap-1.5'>
        <Label htmlFor='support-message' className='text-xs text-muted-foreground'>
          {kind === 'problem' ? 'Décrivez le problème' : 'Votre suggestion'}
        </Label>
        <Textarea
          id='support-message'
          value={message}
          onChange={e => setMessage(e.target.value)}
          rows={compact ? 3 : 4}
          placeholder={
            kind === 'problem'
              ? 'Ex. ALIA s’est arrêtée au milieu d’une phrase et le micro est resté bloqué…'
              : 'Ex. pouvoir reprendre une visite interrompue là où on l’avait laissée…'
          }
        />
      </div>

      {/* ── Optional rating (feedback only) ── */}
      {kind !== 'problem' && (
        <div className='flex items-center gap-3'>
          <Label className='text-xs text-muted-foreground'>Votre note</Label>
          <Rating value={rating} onValueChange={setRating} variant='yellow' size={18} />
        </div>
      )}

      {/* ── Optional contact ── */}
      <div className='flex flex-col gap-1.5'>
        <Label htmlFor='support-contact' className='text-xs text-muted-foreground'>
          Votre email (facultatif — pour vous répondre)
        </Label>
        <Input
          id='support-contact'
          type='email'
          value={contact}
          onChange={e => setContact(e.target.value)}
          placeholder='vous@vital-sa.tn'
        />
      </div>

      {error && (
        <p className='flex items-center gap-1.5 text-xs text-destructive'>
          <AlertCircle className='size-3.5 shrink-0' />
          {error}
        </p>
      )}

      <div className='flex items-center justify-between gap-3'>
        <p className='text-[11px] text-muted-foreground'>
          {context?.session_id
            ? 'Le contexte de la session est joint automatiquement.'
            : 'Aucune session en cours — le signalement est envoyé tel quel.'}
        </p>
        <Button onClick={submit} disabled={!canSend} size={compact ? 'sm' : 'default'}>
          {sending ? <Loader2 className='size-4 animate-spin' /> : <Send className='size-4' />}
          Envoyer
        </Button>
      </div>
    </div>
  )
}
