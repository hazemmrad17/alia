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
  { id: 'flash', name: 'Flash Pitch', dur: '20-60 sec', desc: 'Accroche percutante et proposition de valeur immediate' },
  { id: 'standard', name: 'Presentation Standard', dur: '2-4 min', desc: 'Presentation detaillee avec posologie et tolerance' },
  { id: 'approfondie', name: 'Visite Approfondie', dur: '5-8 min', desc: 'Dossier clinique complet et gestion des cas patients' }
]

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

async function apiFetch<T>(path: string, opts?: RequestInit): Promise<T> {
  const r = await fetch(`${API}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...opts
  })
  if (!r.ok) throw new Error(`${r.status}`)
  return r.json()
}

function wsURL(sid: string) {
  return API.replace(/^http/, 'ws') + `/api/v1/conversation/ws/${sid}`
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
      {view === 'chat' && (
        <Chat config={config} onBack={() => setView('setup')} onDash={() => setView('dashboard')} />
      )}
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
    fetch(`${API}/api/v1/products`)
      .then(r => r.json())
      .then(d => {
        if (d.products?.length) setProducts(d.products.map((p: any) => p.name || p))
      })
      .catch(() => {})
  }, [])

  return (
    <div className='max-w-5xl mx-auto py-4 space-y-8'>
      {/* Header */}
      <div className='flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-6'>
        <div className='flex items-center gap-4'>
          <div className='size-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shadow-sm'>
            <Pill className='size-7' />
          </div>
          <div>
            <h1 className='text-2xl font-bold tracking-tight text-foreground'>Présentation Commerciale & Produits VITAL SA</h1>
            <p className='text-sm text-muted-foreground'>
              Simulez ou présentez les produits du catalogue avec l'Avatar ALIA pour médecins et pharmaciens
            </p>
          </div>
        </div>
        <Link
          href='/products/catalog'
          className='inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl border border-border bg-card hover:bg-accent text-foreground transition-colors w-fit'
        >
          <ShoppingCart className='size-4 text-primary' />
          Catalogue Produits
        </Link>
      </div>

      {/* Select Product */}
      <section className='space-y-3'>
        <div className='flex items-center gap-2'>
          <Package className='size-4 text-primary' />
          <h2 className='text-sm font-semibold uppercase tracking-wider text-muted-foreground'>1. Choix du Produit Pharmaceutique</h2>
        </div>
        <div className='grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3'>
          {products.map(p => {
            const isSelected = config.product === p
            return (
              <button
                key={p}
                onClick={() => setConfig({ ...config, product: p })}
                className={`p-3.5 rounded-xl border-2 text-left transition-all ${
                  isSelected
                    ? 'border-primary bg-primary/10 shadow-sm ring-1 ring-primary/30'
                    : 'border-border bg-card hover:border-primary/40 hover:bg-accent/50'
                }`}
              >
                <p className='font-semibold text-xs text-foreground truncate'>{p}</p>
                <span className='text-[10px] text-muted-foreground'>VITAL SA</span>
              </button>
            )
          })}
        </div>
      </section>

      {/* Format Selection */}
      <section className='space-y-3'>
        <div className='flex items-center gap-2'>
          <Activity className='size-4 text-primary' />
          <h2 className='text-sm font-semibold uppercase tracking-wider text-muted-foreground'>2. Format de la Présentation</h2>
        </div>
        <div className='grid grid-cols-1 sm:grid-cols-3 gap-4'>
          {FORMATS.map(f => (
            <button
              key={f.id}
              onClick={() => setConfig({ ...config, format: f.id })}
              className={`p-4 rounded-xl border-2 text-center transition-all ${
                config.format === f.id
                  ? 'border-primary bg-primary/10 shadow-sm ring-1 ring-primary/30'
                  : 'border-border bg-card hover:border-primary/40 hover:bg-accent/50'
              }`}
            >
              <p className='font-semibold text-foreground text-sm'>{f.name}</p>
              <p className='text-xs font-semibold text-primary mt-0.5'>{f.dur}</p>
              <p className='text-[11px] text-muted-foreground mt-1'>{f.desc}</p>
            </button>
          ))}
        </div>
      </section>

      {/* Launch Button */}
      <button
        onClick={onStart}
        disabled={!config.product}
        className='w-full py-4 rounded-2xl font-semibold text-base bg-primary text-white hover:bg-primary disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-md flex items-center justify-center gap-2.5 cursor-pointer'
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
function Chat({
  config,
  onBack,
  onDash
}: {
  config: Config
  onBack: () => void
  onDash: () => void
}) {
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
        setStarted(true)
      } catch {
        setDemo(true)
        setMsgs([{ role: 'assistant', content: demoGreeting(config.product), time: new Date(), step: 'introduction' }])
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
    <div className='flex flex-col h-[calc(100vh-12rem)] min-h-[550px] bg-card border border-border rounded-2xl overflow-hidden shadow-sm'>
      <div className='border-b border-border px-5 py-3.5 flex flex-wrap items-center justify-between gap-3 bg-card/60 backdrop-blur'>
        <div className='flex items-center gap-3'>
          <button
            onClick={onBack}
            className='inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground px-2.5 py-1.5 rounded-lg border border-border bg-background'
          >
            <ArrowLeft className='size-3.5' /> Configuration
          </button>
          <div className='border-l border-border pl-3'>
            <h2 className='font-semibold text-sm text-foreground flex items-center gap-1.5'>
              Présentation Commerciale ALIA
            </h2>
            <p className='text-xs text-muted-foreground'>
              {config.product} - Format {config.format}
            </p>
          </div>
          <div className='flex items-center gap-1.5 ml-2'>
            <span
              className={`size-2 rounded-full ${
                demo ? 'bg-amber-500' : wsStatus === 'connected' ? 'bg-primary' : 'bg-muted-foreground'
              }`}
            />
            <span className='text-xs text-muted-foreground'>
              {demo ? 'Mode Démo' : wsStatus === 'connected' ? 'En Direct' : wsStatus}
            </span>
          </div>
        </div>

        <div className='flex items-center gap-4'>
          <div className='hidden sm:flex items-center gap-1.5'>
            {STEPS.map((s, i) => {
              const isDone = STEPS.indexOf(step) > i || step === 'completed'
              const isActive = s === step
              return (
                <div
                  key={s}
                  className={`size-7 rounded-full flex items-center justify-center text-xs font-semibold transition-all ${
                    isDone
                      ? 'bg-primary text-white'
                      : isActive
                      ? 'bg-primary text-white ring-2 ring-primary/30 scale-105'
                      : 'bg-muted text-muted-foreground'
                  }`}
                  title={STEP_LABELS[s].label}
                >
                  {isDone ? '✓' : i + 1}
                </div>
              )
            })}
          </div>

          <div className='text-right border-l border-border pl-4'>
            <p className='text-[10px] uppercase font-semibold text-muted-foreground'>Engagement</p>
            <p className='text-base font-bold text-primary'>{score.toFixed(1)}/10</p>
          </div>

          <button
            onClick={onDash}
            className='p-2 hover:bg-accent rounded-xl text-muted-foreground hover:text-foreground border border-border'
            title='Voir les analyses'
          >
            <BarChart3 className='size-4' />
          </button>
        </div>
      </div>

      <div className='flex-1 overflow-y-auto p-5 space-y-4 bg-background/50'>
        {msgs.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] md:max-w-[70%] rounded-2xl px-5 py-3.5 shadow-sm text-sm ${
                m.role === 'user'
                  ? 'bg-primary text-white rounded-br-none'
                  : 'bg-card border border-border text-card-foreground rounded-bl-none'
              }`}
            >
              {m.role === 'assistant' && (
                <div className='flex items-center gap-2 mb-1.5'>
                  <Bot className='size-3.5 text-primary' />
                  <span className='text-xs font-semibold text-primary'>ALIA Présentateur</span>
                  {m.step && STEP_LABELS[m.step] && (
                    <span className='text-[11px] px-2 py-0.2 rounded-full bg-muted text-muted-foreground font-medium'>
                      {STEP_LABELS[m.step].label}
                    </span>
                  )}
                </div>
              )}
              {m.role === 'user' && (
                <div className='flex items-center gap-2 mb-1.5 justify-end text-primary-foreground/60'>
                  <span className='text-xs font-semibold'>Médecin / Pharmacien</span>
                  <User className='size-3.5' />
                </div>
              )}
              <div className='whitespace-pre-wrap leading-relaxed'>{m.content}</div>
              <div
                className={`text-[10px] mt-2 ${
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
            <div className='bg-card border border-border rounded-2xl rounded-bl-none px-4 py-3'>
              <div className='flex items-center gap-1.5'>
                <div className='size-2 bg-primary rounded-full animate-bounce' />
                <div className='size-2 bg-primary rounded-full animate-bounce [animation-delay:0.2s]' />
                <div className='size-2 bg-primary rounded-full animate-bounce [animation-delay:0.4s]' />
              </div>
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div className='border-t border-border p-4 bg-card'>
        <form
          onSubmit={e => {
            e.preventDefault()
            send()
          }}
          className='flex items-center gap-3 max-w-4xl mx-auto'
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
            className='flex-1 px-4 py-3 rounded-xl bg-background border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm disabled:opacity-50'
            autoFocus
          />
          <button
            type='submit'
            disabled={!input.trim() || typing || step === 'completed'}
            className='px-5 py-3 rounded-xl bg-primary text-white font-medium text-sm hover:bg-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2 cursor-pointer'
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
    fetch(`${API}/api/v1/dashboard/stats`)
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
    <div className='max-w-6xl mx-auto py-4 space-y-6'>
      <div className='flex items-center justify-between'>
        <button
          onClick={onBack}
          className='inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-xl border border-border bg-card hover:bg-accent text-foreground transition-colors'
        >
          <ArrowLeft className='size-4' /> Retour à la présentation
        </button>
        <h1 className='text-xl font-bold text-foreground'>Tableau de bord commercial</h1>
      </div>

      <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4'>
        {[
          { icon: <Package className='size-5' />, label: 'Présentations Totales', value: s.total_sessions },
          { icon: <TrendingUp className='size-5' />, label: 'Engagement Moyen', value: `${s.average_score}/10` },
          { icon: <Pill className='size-5' />, label: 'Produits Couverts', value: s.top_products?.length || 0 },
          { icon: <FileText className='size-5' />, label: 'Rapports CRM Générés', value: '18' }
        ].map((c, i) => (
          <div key={i} className='bg-card rounded-2xl p-5 border border-border shadow-sm'>
            <div className='size-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-3'>
              {c.icon}
            </div>
            <p className='text-2xl font-bold text-foreground'>{c.value}</p>
            <p className='text-xs text-muted-foreground mt-0.5'>{c.label}</p>
          </div>
        ))}
      </div>

      <div className='bg-card rounded-2xl p-6 border border-border shadow-sm space-y-4'>
        <h2 className='text-base font-semibold text-foreground'>Produits les Plus Présentés</h2>
        <div className='space-y-3'>
          {s.top_products?.map((p: any, i: number) => (
            <div key={i} className='flex items-center justify-between p-3 rounded-xl bg-muted/40'>
              <div className='flex items-center gap-3'>
                <span className='size-8 bg-primary/10 text-primary rounded-lg flex items-center justify-center text-sm font-bold'>
                  {i + 1}
                </span>
                <span className='font-medium text-sm text-foreground'>{p.name}</span>
              </div>
              <span className='text-xs text-muted-foreground font-medium'>{p.count} sessions</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
