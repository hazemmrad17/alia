'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { MessageSquare, Search, Send, PlugZap } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { resolveRole, type UserRole } from '@/lib/user-role'
import { cn } from '@/lib/utils'

type Message = { id: string; role: 'user' | 'assistant'; content: string; time: string }

interface Persona {
  id: string
  name: string
  subtitle: string
  status: 'online' | 'away' | 'offline'
  initial: string
}

interface Conversation {
  id: string
  personaId: string
  messages: Message[]
  lastSeen: string
}

// ── Role-aware data ─────────────────────────────────────────────────────────────

const DELEGATE_PERSONAS: Persona[] = [
  { id: 'p1', name: 'Dr. Martin', subtitle: 'Cardiologie · Analysant', status: 'online', initial: 'DM' },
  { id: 'p2', name: 'Dr. Ben Salah', subtitle: 'Pédiatrie · Facilitant', status: 'away', initial: 'BS' },
  { id: 'p3', name: 'Dr. Khelifi', subtitle: 'Dermatologie · Promouvant', status: 'offline', initial: 'DK' },
  { id: 'p4', name: 'Dr. Trabelsi', subtitle: 'Médecine Générale · Controlant', status: 'online', initial: 'DT' },
  { id: 'p5', name: 'Dr. Mansouri', subtitle: 'Cardiologie · Analysant', status: 'away', initial: 'KM' },
]

const COMMERCIAL_PERSONAS: Persona[] = [
  { id: 'p1', name: 'Karim Benali', subtitle: 'Délégué médical · LV Fersang', status: 'online', initial: 'KB' },
  { id: 'p2', name: 'Amira Zouari', subtitle: 'Déléguée médicale · CALMOSS', status: 'online', initial: 'AZ' },
  { id: 'p3', name: 'Yacine Hadj', subtitle: 'Délégué médical · VITONIC', status: 'away', initial: 'YH' },
  { id: 'p4', name: 'Rania Boudali', subtitle: 'Déléguée médicale · Magné B6', status: 'offline', initial: 'RB' },
  { id: 'p5', name: 'Sami Djabri', subtitle: 'Délégué médical · Doliprane 1000', status: 'online', initial: 'SD' },
]

const now = () => new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })

const seedConversations = (role: UserRole): Conversation[] => {
  if (role === 'delegate') {
    return [
      {
        id: 'd1', personaId: 'p1', lastSeen: '5 min',
        messages: [
          { id: 'm1', role: 'assistant', content: 'Bonjour ! Je suis Dr. Martin, cardiologue. En quoi puis-je vous aider aujourd\'hui ?', time: '09:00' },
          { id: 'm2', role: 'user', content: 'Bonjour Docteur, je voudrais vous présenter CALMOSS pour vos patients anxieux.', time: '09:02' },
          { id: 'm3', role: 'assistant', content: 'Intéressant. Pouvez-vous me parler de la tolérance digestive chez le sujet âgé ?', time: '09:05' },
        ],
      },
      {
        id: 'd2', personaId: 'p2', lastSeen: '1 h',
        messages: [
          { id: 'm1', role: 'assistant', content: 'Bonjour ! Dr. Ben Salah à l\'appareil. Comment puis-je vous aider ?', time: '08:00' },
          { id: 'm2', role: 'user', content: 'Je prépare une visite sur VITONIC, puis-je avoir votre avis sur le positionnement pédiatrique ?', time: '08:10' },
          { id: 'm3', role: 'assistant', content: 'Très bonne question. Parlez-moi d\'abord des situations de convalescence que vous rencontrez.', time: '08:12' },
        ],
      },
      {
        id: 'd3', personaId: 'p3', lastSeen: '1 j',
        messages: [
          { id: 'm1', role: 'assistant', content: 'Bonjour ! Dr. Khelifi. Merci pour votre visite d\'hier.', time: '16:00' },
          { id: 'm2', role: 'user', content: 'Merci Docteur. N\'hésitez pas si vous avez des questions sur Magné B6.', time: '16:05' },
          { id: 'm3', role: 'assistant', content: 'Très bien, je suis convaincu. À la semaine prochaine !', time: '16:10' },
        ],
      },
    ]
  }

  return [
    {
      id: 'c1', personaId: 'p1', lastSeen: '5 min',
      messages: [
        { id: 'm1', role: 'assistant', content: 'Bonjour Docteur ! Karim Benali, délégué médical VITAL. Puis-je vous présenter **LV Fersang** en 2 minutes ?', time: '10:00' },
        { id: 'm2', role: 'user', content: 'Bonjour Karim, oui allez-y.', time: '10:01' },
        { id: 'm3', role: 'assistant', content: 'LV Fersang offre une supplémentation en fer douce, avec une meilleure tolérance digestive. Souhaitez-vous une fiche produit ?', time: '10:05' },
      ],
    },
    {
      id: 'c2', personaId: 'p2', lastSeen: '30 min',
      messages: [
        { id: 'm1', role: 'assistant', content: 'Bonjour Docteur ! Amira Zouari. Merci pour votre temps la semaine dernière.', time: '09:30' },
        { id: 'm2', role: 'user', content: 'Bonjour Amira, avez-vous des données sur CALMOSS et le sommeil ?', time: '09:32' },
        { id: 'm3', role: 'assistant', content: 'Je vous envoie la synthèse par mail et je repasse la semaine prochaine. Bonne journée Docteur !', time: '09:35' },
      ],
    },
    {
      id: 'c3', personaId: 'p3', lastSeen: '1 j',
      messages: [
        { id: 'm1', role: 'assistant', content: 'Bonjour Docteur ! Yacine Hadj. Avez-vous eu l\'occasion de tester l\'échantillon VITONIC ?', time: '14:00' },
        { id: 'm2', role: 'user', content: 'Pas encore, je vous ferai un retour la semaine prochaine.', time: '14:10' },
        { id: 'm3', role: 'assistant', content: 'Parfait, je repasse jeudi. Bonne journée !', time: '14:12' },
      ],
    },
  ]
}

const DELEGATE_REPLIES = [
  'Compris. Pouvez-vous me détailler la posologie recommandée pour ce profil de patient ?',
  'Quel est le principal frein que vous rencontrez avec mes confrères sur ce produit ?',
  'L\'observance est souvent un point clé. Comment gérez-vous les retours sur la tolérance digestive ?',
  'Intéressant. Sur quelles indications utilisez-vous ce produit en pratique ?',
  'Merci pour ces précisions. Je reviens vers vous si j\'ai d\'autres questions.',
]

const COMMERCIAL_REPLIES = [
  'Merci Docteur. Ce produit est conçu pour ce profil de patient, avec une efficacité démontrée et un bon profil de sécurité.',
  'Souhaitez-vous une fiche produit ou un échantillon pour vos patients ?',
  'Je peux repasser la semaine prochaine pour recueillir vos retours d\'expérience.',
  'Bien reçu. Je vous prépare la synthèse clinique et vous l\'envoie par mail.',
  'Merci pour votre confiance Docteur. Je reste à votre disposition.',
]

// ── Small helpers ───────────────────────────────────────────────────────────────

const AVATAR_COLORS = [
  'bg-primary/15 text-primary',
  'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300',
  'bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-900/40 dark:text-fuchsia-300',
]

const colorFor = (name: string) => {
  const hash = [...name].reduce((acc, ch) => acc + ch.charCodeAt(0), 0)
  return AVATAR_COLORS[hash % AVATAR_COLORS.length]
}

const renderInline = (content: string) => {
  const parts = content.split(/\*\*(.+?)\*\*/g)
  return parts.map((part, i) => (i % 2 === 1 ? <strong key={i}>{part}</strong> : <span key={i}>{part}</span>))
}

// ── Component ───────────────────────────────────────────────────────────────────

export default function ChatAppView() {
  const [role, setRole] = useState<UserRole>('delegate')
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [input, setInput] = useState('')
  const [typing, setTyping] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const r = resolveRole(window.location.pathname)
    setRole(r)
    setConversations(seedConversations(r))
    setActiveId(seedConversations(r)[0]?.id ?? null)
  }, [])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [conversations, activeId, typing])

  const personas = role === 'delegate' ? DELEGATE_PERSONAS : COMMERCIAL_PERSONAS
  const personaById = useMemo(() => new Map(personas.map(p => [p.id, p])), [personas])
  const replyPool = role === 'delegate' ? DELEGATE_REPLIES : COMMERCIAL_REPLIES

  const active = conversations.find(c => c.id === activeId) ?? null
  const activePersona = active ? personaById.get(active.personaId) : null

  const filteredConversations = conversations.filter(c => {
    const p = personaById.get(c.personaId)
    const q = search.trim().toLowerCase()
    if (!q) return true
    return (p?.name ?? '').toLowerCase().includes(q) || (p?.subtitle ?? '').toLowerCase().includes(q)
  })

  const filteredContacts = personas.filter(p => {
    const q = search.trim().toLowerCase()
    if (!q) return true
    return p.name.toLowerCase().includes(q) || p.subtitle.toLowerCase().includes(q)
  })

  const openConversation = (convId: string) => setActiveId(convId)

  const openContact = (personaId: string) => {
    const existing = conversations.find(c => c.personaId === personaId)
    if (existing) {
      setActiveId(existing.id)
      return
    }
    const greeting =
      role === 'delegate'
        ? `Bonjour ! Je suis ${personaById.get(personaId)?.name ?? 'Dr'}, prêt à échanger sur vos produits.`
        : `Bonjour Docteur ! ${personaById.get(personaId)?.name ?? 'Délégué'} de VITAL SA. Puis-je vous présenter nos produits ?`
    const conv: Conversation = {
      id: `new-${personaId}`,
      personaId,
      lastSeen: 'maintenant',
      messages: [{ id: `n-${Date.now()}`, role: 'assistant', content: greeting, time: now() }],
    }
    setConversations(prev => [...prev, conv])
    setActiveId(conv.id)
  }

  const send = () => {
    const text = input.trim()
    if (!text || !active) return
    setInput('')

    const userMsg: Message = { id: `u-${Date.now()}`, role: 'user', content: text, time: now() }
    setConversations(prev =>
      prev.map(c => (c.id === active.id ? { ...c, messages: [...c.messages, userMsg], lastSeen: 'maintenant' } : c))
    )
    setTyping(true)

    const reply = replyPool[Math.floor(Math.random() * replyPool.length)]
    setTimeout(() => {
      const botMsg: Message = { id: `a-${Date.now()}`, role: 'assistant', content: reply, time: now() }
      setConversations(prev =>
        prev.map(c => (c.id === active.id ? { ...c, messages: [...c.messages, botMsg] } : c))
      )
      setTyping(false)
    }, 900 + Math.random() * 800)
  }

  return (
    <Card className='flex min-h-[560px] flex-col overflow-hidden lg:flex-row lg:h-[calc(100vh-220px)]'>
      {/* ── Left panel ── */}
      <div className='flex w-full shrink-0 flex-col border-border/60 lg:w-80 lg:border-r'>
        {/* Profile + search */}
        <div className='space-y-3 border-b border-border/60 p-4'>
          <div className='relative'>
            <Search className='absolute left-2.5 top-2.5 size-4 text-muted-foreground' />
            <Input
              placeholder='Search…'
              className='pl-9'
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className='min-h-0 flex-1 overflow-y-auto'>
          {/* Chats */}
          <p className='px-4 pb-1 pt-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground'>Chats</p>
          {filteredConversations.map(conv => {
            const p = personaById.get(conv.personaId)
            const last = conv.messages[conv.messages.length - 1]
            return (
              <button
                key={conv.id}
                type='button'
                onClick={() => openConversation(conv.id)}
                className={cn(
                  'flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-muted/40',
                  activeId === conv.id && 'bg-primary/10'
                )}
              >
                <span className={cn('relative flex size-10 shrink-0 items-center justify-center rounded-full text-xs font-bold', colorFor(p?.name ?? ''))}>
                  {p?.initial ?? '?'}
                  {p?.status === 'online' && (
                    <span className='absolute bottom-0 right-0 size-2.5 rounded-full border-2 border-background bg-emerald-500' />
                  )}
                </span>
                <span className='min-w-0 flex-1'>
                  <span className='flex items-center justify-between gap-2'>
                    <span className='truncate text-sm font-semibold'>{p?.name}</span>
                    <span className='shrink-0 text-[11px] text-muted-foreground'>{conv.lastSeen}</span>
                  </span>
                  <span className='block truncate text-xs text-muted-foreground'>
                    {last?.role === 'user' ? 'Vous : ' : ''}
                    {last?.content.replace(/\*\*/g, '')}
                  </span>
                </span>
              </button>
            )
          })}

          {/* Contacts */}
          <p className='px-4 pb-1 pt-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground'>Contacts</p>
          {filteredContacts
            .filter(p => !conversations.some(c => c.personaId === p.id))
            .map(p => (
              <button
                key={p.id}
                type='button'
                onClick={() => openContact(p.id)}
                className='flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-muted/40'
              >
                <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-full text-xs font-bold', colorFor(p.name))}>
                  {p.initial}
                </span>
                <span className='min-w-0 flex-1'>
                  <span className='block truncate text-sm font-semibold'>{p.name}</span>
                  <span className='block truncate text-xs text-muted-foreground'>{p.subtitle}</span>
                </span>
              </button>
            ))}
        </div>
      </div>

      {/* ── Right panel ── */}
      {!active ? (
        <div className='flex flex-1 flex-col items-center justify-center gap-4 p-10 text-center'>
          <span className='flex size-20 items-center justify-center rounded-full bg-primary/10'>
            <MessageSquare className='size-9 text-primary' />
          </span>
          <div>
            <p className='text-base font-semibold'>Select a contact to start a conversation.</p>
            <p className='mt-1 text-sm text-muted-foreground'>
              {role === 'delegate'
                ? 'Practise your pitch with AI doctors, or message your coaching contacts.'
                : 'Chat with VITAL medical delegates and review ALIA product pitches.'}
            </p>
          </div>
        </div>
      ) : (
        <div className='flex min-w-0 flex-1 flex-col'>
          {/* Thread header */}
          <div className='flex items-center gap-3 border-b border-border/60 px-4 py-3'>
            <span className={cn('relative flex size-10 shrink-0 items-center justify-center rounded-full text-xs font-bold', colorFor(activePersona?.name ?? ''))}>
              {activePersona?.initial ?? '?'}
              {activePersona?.status === 'online' && (
                <span className='absolute bottom-0 right-0 size-2.5 rounded-full border-2 border-background bg-emerald-500' />
              )}
            </span>
            <div className='min-w-0'>
              <p className='truncate text-sm font-semibold'>{activePersona?.name}</p>
              <p className='truncate text-xs text-muted-foreground'>
                {activePersona?.status === 'online' ? 'En ligne' : activePersona?.subtitle}
              </p>
            </div>
            <div className='ml-auto'>
              <Badge variant='secondary' className='text-[11px] font-normal'>
                {role === 'delegate' ? 'Entraînement' : 'Consultation'}
              </Badge>
            </div>
          </div>

          {/* Messages */}
          <div className='flex-1 space-y-3 overflow-y-auto p-4'>
            {active.messages.map(m => (
              <div key={m.id} className={cn('flex gap-2', m.role === 'user' ? 'justify-end' : 'justify-start')}>
                <div
                  className={cn(
                    'max-w-[75%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed',
                    m.role === 'user'
                      ? 'rounded-br-sm bg-primary text-primary-foreground'
                      : 'rounded-bl-sm bg-muted text-foreground'
                  )}
                >
                  <p className='whitespace-pre-line'>{renderInline(m.content)}</p>
                  <p className={cn('mt-1 text-right text-[10px]', m.role === 'user' ? 'text-primary-foreground/70' : 'text-muted-foreground')}>
                    {m.time}
                  </p>
                </div>
              </div>
            ))}

            {typing && (
              <div className='flex justify-start'>
                <div className='flex items-center gap-1 rounded-2xl rounded-bl-sm bg-muted px-4 py-3'>
                  <span className='size-1.5 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:0ms]' />
                  <span className='size-1.5 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:150ms]' />
                  <span className='size-1.5 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:300ms]' />
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          {/* Input */}
          <div className='border-t border-border/60 p-3'>
            <div className='flex items-center gap-2'>
              <Input
                placeholder='Type a message…'
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') send() }}
                className='flex-1'
              />
              <Button size='icon' onClick={send} disabled={!input.trim()} aria-label='Send message'>
                <Send className='size-4' />
              </Button>
            </div>
            <p className='mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground'>
              <PlugZap className='size-3' />
              Demo conversation — connects to the ALIA backend when it is running.
            </p>
          </div>
        </div>
      )}
    </Card>
  )
}