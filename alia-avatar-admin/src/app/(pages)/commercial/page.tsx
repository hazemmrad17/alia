'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  BarChart3,
  Pill,
  Package,
  FileText,
  TrendingUp,
  Send,
  Sparkles,
  Bot,
  User,
  CheckCircle2,
  Activity,
  ShoppingCart
} from 'lucide-react'
import { authHeaders, notifySessionExpired, tokenQueryParam } from '@/lib/auth'

// ── Types ──
type Step = 'introduction' | 'sondage' | 'synthese' | 'objections' | 'argumentation' | 'conclusion' | 'completed'
type Format = 'flash' | 'standard' | 'approfondie'
type View = 'setup' | 'chat' | 'dashboard'

interface Config {
  product: string
  format: Format
}

interface Msg {
  role: 'user' | 'assistant'
  content: string
  time: Date
  step?: Step
}

const STEPS: Step[] = ['introduction', 'sondage', 'synthese', 'objections', 'argumentation', 'conclusion']

const STEP_LABELS: Record<Step, { label: string; icon: string; color: string }> = {
  introduction: { label: 'Introduction', icon: '', color: '#3b82f6' },
  sondage: { label: 'Sondage', icon: '', color: '#a855f7' },
  synthese: { label: 'Synthese', icon: '', color: '#22c55e' },
  objections: { label: 'Objections', icon: '', color: '#f97316' },
  argumentation: { label: 'Argumentation', icon: '', color: '#ef4444' },
  conclusion: { label: 'Conclusion', icon: '', color: '#14b8a6' },
  completed: { label: 'Termine', icon: '', color: '#6b7280' }
}

const DEFAULT_PRODUCTS = [
  'LV Fersang',
  'Oligovit Vitamine C',
  'CALMOSS',
  'VITONIC',
  'Magné B6',
  'Calyvit',
  'Lactibiane',
  'OMEVIE',
  'MINCILIGNE',
  'FERBIOTIC'
]

const FORMATS: { id: Format; name: string; dur: string; desc: string }[] = [
  {
    id: 'flash',
    name: 'Flash Pitch',
    dur: '20-60 sec',
    desc: 'Accroche percutante et proposition de valeur immediate'
  },
  {
    id: 'standard',
    name: 'Presentation Standard',
    dur: '2-4 min',
    desc: 'Presentation detaillee avec posologie et tolerance'
  },
  {
    id: 'approfondie',
    name: 'Visite Approfondie',
    dur: '5-8 min',
    desc: 'Dossier clinique complet et gestion des cas patients'
  }
]

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

async function apiFetch<T>(path: string, opts?: RequestInit): Promise<T> {
  const r = await fetch(`${API}${path}`, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...authHeaders(opts?.headers) }
  })
  if (r.status === 401) notifySessionExpired()
  if (!r.ok) throw new Error(`${r.status}`)
  return r.json()
}

function wsURL(sid: string) {
  // The socket is authenticated: the handshake carries the token because a
  // browser cannot set an Authorization header on it.
  return API.replace(/^http/, 'ws') + `/api/v1/conversation/ws/${sid}` + tokenQueryParam()
}

function demoGreeting(product: string) {
  return `Bonjour ! Je suis ALIA, representant les laboratoires VITAL SA.\n\nAujourd'hui, je souhaite vous presenter **${product}**.\n\nAvez-vous 2 minutes pour decouvrir les benefices therapeutiques majeurs pour vos patients ?`
}

function demoReply(msg: string, product: string) {
  const m = msg.toLowerCase()
  if (m.includes('?') || m.includes('prix') || m.includes('posologie')) {
    return `Concernant **${product}** :\n\n1. **Indications cibles :** Traitement de première intention avec forte biodisponibilité\n2. **Formulation :** Complexe optimisé pour une tolérance digestive maximale\n3. **Schéma posologique :** 1 prise quotidienne facilitant l'observance\n\nSouhaitez-vous recevoir des échantillons médicaux ou la documentation scientifique ?`
  }
  return `Merci pour votre retour. **${product}** est plébiscité par les praticiens pour son efficacité clinique constante et son excellent profil de sécurité.\n\nPuis-je vous transmettre la fiche posologique récapitulative ?`
}

export default function CommercialPage() {
  const [view, setView] = useState<View>('setup')
  const [config, setConfig] = useState<Config>(() => {
    const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '')
    return {
      product: params.get('product') ?? '',
      format: 'standard'
    }
  })

  return (
    <div className='w-full'>
      {view === 'setup' && <Setup config={config} setConfig={setConfig} onStart={() => setView('chat')} />}
      {view === 'chat' && <Chat config={config} onBack={() => setView('setup')} onDash={() => setView('dashboard')} />}
      {view === 'dashboard' && <Dashboard onBack={() => setView('chat')} />}
    </div>
  )
}

// ── SETUP COMPONENT ──
function Setup({
  config,
  setConfig,
  onStart
}: {
  config: Config
  setConfig: (c: Config) => void
  onStart: () => void
}) {
  const [products, setProducts] = useState(DEFAULT_PRODUCTS)

  useEffect(() => {
    fetch(`${API}/api/v1/products`, { headers: authHeaders() })
      .then(r => r.json())
      .then(d => {
        if (!d.products?.length) return

        // The catalogue holds four names twice (the same brand in two gammes),
        // and this picker answers "which product are you presenting?" — one
        // button per name, or the doctor is offered an identical choice twice.
        const names: string[] = d.products.map((p: any) => p.name || p)

        setProducts(Array.from(new Set(names)))
      })
      .catch(() => {})
  }, [])

  return (
    <div className='mx-auto max-w-5xl space-y-8 py-4'>
      {/* Header */}
      <div className='border-border flex flex-col justify-between gap-4 border-b pb-6 md:flex-row md:items-center'>
        <div className='flex items-center gap-4'>
          <div className='bg-primary/10 text-primary flex size-14 items-center justify-center rounded-2xl shadow-sm'>
            <Pill className='size-7' />
          </div>
          <div>
            <h1 className='text-foreground text-2xl font-bold tracking-tight'>
              Présentation Commerciale & Produits VITAL SA
            </h1>
            <p className='text-muted-foreground text-sm'>
              Simulez ou présentez les produits du catalogue avec l'Avatar ALIA pour médecins et pharmaciens
            </p>
          </div>
        </div>
        <Link
          href='/products/catalog'
          className='border-border bg-card hover:bg-accent text-foreground inline-flex w-fit items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium transition-colors'
        >
          <ShoppingCart className='text-primary size-4' />
          Catalogue Produits
        </Link>
      </div>

      {/* Select Product */}
      <section className='space-y-3'>
        <div className='flex items-center gap-2'>
          <Package className='text-primary size-4' />
          <h2 className='text-muted-foreground text-sm font-semibold tracking-wider uppercase'>
            1. Choix du Produit Pharmaceutique
          </h2>
        </div>
        <div className='grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5'>
          {products.map(p => {
            const isSelected = config.product === p
            return (
              <button
                key={p}
                onClick={() => setConfig({ ...config, product: p })}
                className={`rounded-xl border-2 p-3.5 text-left transition-all ${
                  isSelected
                    ? 'border-primary bg-primary/10 ring-primary/30 shadow-sm ring-1'
                    : 'border-border bg-card hover:border-primary/40 hover:bg-accent/50'
                }`}
              >
                <p className='text-foreground truncate text-xs font-semibold'>{p}</p>
                <span className='text-muted-foreground text-[10px]'>VITAL SA</span>
              </button>
            )
          })}
        </div>
      </section>

      {/* Format Selection */}
      <section className='space-y-3'>
        <div className='flex items-center gap-2'>
          <Activity className='text-primary size-4' />
          <h2 className='text-muted-foreground text-sm font-semibold tracking-wider uppercase'>
            2. Format de la Présentation
          </h2>
        </div>
        <div className='grid grid-cols-1 gap-4 sm:grid-cols-3'>
          {FORMATS.map(f => (
            <button
              key={f.id}
              onClick={() => setConfig({ ...config, format: f.id })}
              className={`rounded-xl border-2 p-4 text-center transition-all ${
                config.format === f.id
                  ? 'border-primary bg-primary/10 ring-primary/30 shadow-sm ring-1'
                  : 'border-border bg-card hover:border-primary/40 hover:bg-accent/50'
              }`}
            >
              <p className='text-foreground text-sm font-semibold'>{f.name}</p>
              <p className='text-primary mt-0.5 text-xs font-semibold'>{f.dur}</p>
              <p className='text-muted-foreground mt-1 text-[11px]'>{f.desc}</p>
            </button>
          ))}
        </div>
      </section>

      {/* Launch Button */}
      <button
        onClick={onStart}
        disabled={!config.product}
        className='bg-primary hover:bg-primary flex w-full cursor-pointer items-center justify-center gap-2.5 rounded-2xl py-4 text-base font-semibold text-white shadow-md transition-all disabled:cursor-not-allowed disabled:opacity-40'
      >
        <Sparkles className='size-5' />
        {config.product
          ? `Démarrer la Présentation : ${config.product}`
          : 'Sélectionnez un produit ci-dessus pour continuer'}
      </button>
    </div>
  )
}

// ── CHAT COMPONENT ──
function Chat({ config, onBack, onDash }: { config: Config; onBack: () => void; onDash: () => void }) {
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [typing, setTyping] = useState(false)
  const [step, setStep] = useState<Step>('introduction')
  const [sid, setSid] = useState<string | null>(null)
  const [score, setScore] = useState(0)
  const [started, setStarted] = useState(false)
  const [demo, setDemo] = useState(false)
  const [wsStatus, setWsStatus] = useState('disconnected')
  const endRef = useRef<HTMLDivElement>(null)
  const startedAtRef = useRef<number | null>(null)
  const completedRef = useRef(false)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [msgs, typing])

  useEffect(() => {
    if (started) return
    ;(async () => {
      try {
        const r = await apiFetch<any>('/api/v1/session/start', {
          method: 'POST',
          body: JSON.stringify({
            mode: 'commercial',
            level: 'junior',
            visit_format: config.format,
            product_focus: config.product
          })
        })
        setSid(r.session_id)
        setStep(r.current_step)
        setMsgs([{ role: 'assistant', content: r.greeting, time: new Date(), step: r.current_step }])
        startedAtRef.current = Date.now()
        setStarted(true)
      } catch {
        setDemo(true)
        setMsgs([{ role: 'assistant', content: demoGreeting(config.product), time: new Date(), step: 'introduction' }])
        startedAtRef.current = Date.now()
        setStarted(true)
      }
    })()
  }, []) // eslint-disable-line

  useEffect(() => {
    if (!sid || demo) return
    const ws = new WebSocket(wsURL(sid))
    ws.onopen = () => setWsStatus('connected')
    ws.onmessage = e => {
      try {
        const d = JSON.parse(e.data)
        setTyping(false)
        setStep(d.current_step)
        if (d.score_update?.overall) setScore(d.score_update.overall)
        setMsgs(p => [...p, { role: 'assistant', content: d.message, time: new Date(), step: d.current_step }])
      } catch {}
    }
    ws.onclose = () => setWsStatus('disconnected')
    return () => ws.close()
  }, [sid, demo])

  // The visit report only exists once the server records it. Until now a
  // finished presentation just flipped a local step and reached nobody, which
  // is why the admin side had nothing to show: POST the completion so the
  // report reaches disk, the manager and the doctor's own history. Fired once,
  // when the flow reaches its last step, and never in demo mode (no session).
  useEffect(() => {
    if (step !== 'completed' || !sid || demo || completedRef.current) return
    completedRef.current = true

    const duration = startedAtRef.current ? (Date.now() - startedAtRef.current) / 1000 : 0

    void apiFetch(`/api/v1/session/${sid}/complete`, {
      method: 'POST',
      body: JSON.stringify({
        duration_seconds: duration,
        level: 'junior',
        visit_format: config.format,
        product_focus: config.product,
        messages: msgs.length,
        mode: 'commercial'
      })
    }).catch(() => {})
  }, [step, sid, demo, config.format, config.product, msgs.length])

  const send = async () => {
    if (!input.trim() || typing || step === 'completed') return
    const m = input.trim()
    setMsgs(p => [...p, { role: 'user', content: m, time: new Date() }])
    setInput('')
    setTyping(true)

    if (!demo && sid) {
      try {
        const r = await apiFetch<any>('/api/v1/chat', {
          method: 'POST',
          body: JSON.stringify({
            session_id: sid,
            message: m,
            mode: 'commercial',
            product_focus: config.product,
            level: 'junior',
            visit_format: config.format
          })
        })
        setTyping(false)
        setStep(r.current_step)
        if (r.score_update?.overall) setScore(r.score_update.overall)
        setMsgs(p => [...p, { role: 'assistant', content: r.message, time: new Date(), step: r.current_step }])
        return
      } catch {}
    }

    setTimeout(() => {
      setTyping(false)
      setMsgs(p => [...p, { role: 'assistant', content: demoReply(m, config.product), time: new Date() }])
      const i = STEPS.indexOf(step)
      if (i < STEPS.length - 1) {
        setStep(STEPS[i + 1])
        setScore(s => Math.min(10, s + 1.1))
      } else if (step === 'conclusion') {
        setStep('completed')
        setMsgs(p => [
          ...p,
          {
            role: 'assistant',
            content: `Presentation terminee avec succes !\n\nProduit : ${config.product}\nScore d'interet medecin : 8.8/10\nRapport CRM automatiquement genere et archive.`,
            time: new Date(),
            step: 'completed'
          }
        ])
      }
    }, 800)
  }

  return (
    <div className='bg-card border-border flex h-[calc(100vh-12rem)] min-h-[550px] flex-col overflow-hidden rounded-2xl border shadow-sm'>
      <div className='border-border bg-card/60 flex flex-wrap items-center justify-between gap-3 border-b px-5 py-3.5 backdrop-blur'>
        <div className='flex items-center gap-3'>
          <button
            onClick={onBack}
            className='text-muted-foreground hover:text-foreground border-border bg-background inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium'
          >
            <ArrowLeft className='size-3.5' /> Configuration
          </button>
          <div className='border-border border-l pl-3'>
            <h2 className='text-foreground flex items-center gap-1.5 text-sm font-semibold'>
              Présentation Commerciale ALIA
            </h2>
            <p className='text-muted-foreground text-xs'>
              {config.product} - Format {config.format}
            </p>
          </div>
          <div className='ml-2 flex items-center gap-1.5'>
            <span
              className={`size-2 rounded-full ${
                demo ? 'bg-amber-500' : wsStatus === 'connected' ? 'bg-primary' : 'bg-muted-foreground'
              }`}
            />
            <span className='text-muted-foreground text-xs'>
              {demo ? 'Mode Démo' : wsStatus === 'connected' ? 'En Direct' : wsStatus}
            </span>
          </div>
        </div>

        <div className='flex items-center gap-4'>
          <div className='hidden items-center gap-1.5 sm:flex'>
            {STEPS.map((s, i) => {
              const isDone = STEPS.indexOf(step) > i || step === 'completed'
              const isActive = s === step
              return (
                <div
                  key={s}
                  className={`flex size-7 items-center justify-center rounded-full text-xs font-semibold transition-all ${
                    isDone
                      ? 'bg-primary text-white'
                      : isActive
                        ? 'bg-primary ring-primary/30 scale-105 text-white ring-2'
                        : 'bg-muted text-muted-foreground'
                  }`}
                  title={STEP_LABELS[s].label}
                >
                  {isDone ? '✓' : i + 1}
                </div>
              )
            })}
          </div>

          <div className='border-border border-l pl-4 text-right'>
            <p className='text-muted-foreground text-[10px] font-semibold uppercase'>Engagement</p>
            <p className='text-primary text-base font-bold'>{score.toFixed(1)}/10</p>
          </div>

          <button
            onClick={onDash}
            className='hover:bg-accent text-muted-foreground hover:text-foreground border-border rounded-xl border p-2'
            title='Voir les analyses'
          >
            <BarChart3 className='size-4' />
          </button>
        </div>
      </div>

      <div className='bg-background/50 flex-1 space-y-4 overflow-y-auto p-5'>
        {msgs.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] rounded-2xl px-5 py-3.5 text-sm shadow-sm md:max-w-[70%] ${
                m.role === 'user'
                  ? 'bg-primary rounded-br-none text-white'
                  : 'bg-card border-border text-card-foreground rounded-bl-none border'
              }`}
            >
              {m.role === 'assistant' && (
                <div className='mb-1.5 flex items-center gap-2'>
                  <Bot className='text-primary size-3.5' />
                  <span className='text-primary text-xs font-semibold'>ALIA Présentateur</span>
                  {m.step && STEP_LABELS[m.step] && (
                    <span className='py-0.2 bg-muted text-muted-foreground rounded-full px-2 text-[11px] font-medium'>
                      {STEP_LABELS[m.step].label}
                    </span>
                  )}
                </div>
              )}
              {m.role === 'user' && (
                <div className='text-primary-foreground/60 mb-1.5 flex items-center justify-end gap-2'>
                  <span className='text-xs font-semibold'>Médecin / Pharmacien</span>
                  <User className='size-3.5' />
                </div>
              )}
              <div className='leading-relaxed whitespace-pre-wrap'>{m.content}</div>
              <div
                className={`mt-2 text-[10px] ${
                  m.role === 'user' ? 'text-primary-foreground/80 text-right' : 'text-muted-foreground'
                }`}
              >
                {m.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </div>
        ))}
        {typing && (
          <div className='flex justify-start'>
            <div className='bg-card border-border rounded-2xl rounded-bl-none border px-4 py-3'>
              <div className='flex items-center gap-1.5'>
                <div className='bg-primary size-2 animate-bounce rounded-full' />
                <div className='bg-primary size-2 animate-bounce rounded-full [animation-delay:0.2s]' />
                <div className='bg-primary size-2 animate-bounce rounded-full [animation-delay:0.4s]' />
              </div>
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div className='border-border bg-card border-t p-4'>
        <form
          onSubmit={e => {
            e.preventDefault()
            send()
          }}
          className='mx-auto flex max-w-4xl items-center gap-3'
        >
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder={
              step === 'completed'
                ? 'Présentation terminée !'
                : 'Posez une question sur le produit, le prix ou la posologie...'
            }
            disabled={step === 'completed' || typing}
            className='bg-background border-border text-foreground placeholder:text-muted-foreground focus:ring-primary/30 flex-1 rounded-xl border px-4 py-3 text-sm focus:ring-2 focus:outline-none disabled:opacity-50'
            autoFocus
          />
          <button
            type='submit'
            disabled={!input.trim() || typing || step === 'completed'}
            className='bg-primary hover:bg-primary flex cursor-pointer items-center gap-2 rounded-xl px-5 py-3 text-sm font-medium text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50'
          >
            <Send className='size-4' />
            Envoyer
          </button>
        </form>
      </div>
    </div>
  )
}

// ── DASHBOARD COMPONENT ──
function Dashboard({ onBack }: { onBack: () => void }) {
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`${API}/api/v1/dashboard/stats`, { headers: authHeaders() })
      .then(r => r.json())
      .then(setStats)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const demoStats = {
    total_sessions: 18,
    average_score: 7.8,
    top_products: [
      { name: 'LV Fersang', count: 12 },
      { name: 'Oligovit Vitamine C', count: 9 },
      { name: 'CALMOSS', count: 7 },
      { name: 'VITONIC', count: 5 }
    ]
  }

  const s = stats || demoStats

  return (
    <div className='mx-auto max-w-6xl space-y-6 py-4'>
      <div className='flex items-center justify-between'>
        <button
          onClick={onBack}
          className='border-border bg-card hover:bg-accent text-foreground inline-flex items-center gap-2 rounded-xl border px-3 py-1.5 text-sm font-medium transition-colors'
        >
          <ArrowLeft className='size-4' /> Retour à la présentation
        </button>
        <h1 className='text-foreground text-xl font-bold'>Tableau de bord commercial</h1>
      </div>

      <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4'>
        {[
          { icon: <Package className='size-5' />, label: 'Présentations Totales', value: s.total_sessions },
          { icon: <TrendingUp className='size-5' />, label: 'Engagement Moyen', value: `${s.average_score}/10` },
          { icon: <Pill className='size-5' />, label: 'Produits Couverts', value: s.top_products?.length || 0 },
          { icon: <FileText className='size-5' />, label: 'Rapports CRM Générés', value: '18' }
        ].map((c, i) => (
          <div key={i} className='bg-card border-border rounded-2xl border p-5 shadow-sm'>
            <div className='bg-primary/10 text-primary mb-3 flex size-10 items-center justify-center rounded-xl'>
              {c.icon}
            </div>
            <p className='text-foreground text-2xl font-bold'>{c.value}</p>
            <p className='text-muted-foreground mt-0.5 text-xs'>{c.label}</p>
          </div>
        ))}
      </div>

      <div className='bg-card border-border space-y-4 rounded-2xl border p-6 shadow-sm'>
        <h2 className='text-foreground text-base font-semibold'>Produits les Plus Présentés</h2>
        <div className='space-y-3'>
          {s.top_products?.map((p: any, i: number) => (
            <div key={i} className='bg-muted/40 flex items-center justify-between rounded-xl p-3'>
              <div className='flex items-center gap-3'>
                <span className='bg-primary/10 text-primary flex size-8 items-center justify-center rounded-lg text-sm font-bold'>
                  {i + 1}
                </span>
                <span className='text-foreground text-sm font-medium'>{p.name}</span>
              </div>
              <span className='text-muted-foreground text-xs font-medium'>{p.count} sessions</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
