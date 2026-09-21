'use client'

import { useState, useEffect, useRef, useCallback, useMemo, Fragment } from 'react'
import type { ReactNode } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  BarChart3,
  GraduationCap,
  Trophy,
  Target,
  Users,
  Send,
  RotateCcw,
  Sparkles,
  Bot,
  User,
  CheckCircle2,
  Activity,
  FileText,
  MessageCircleQuestion,
  Lightbulb,
  HelpCircle,
  BookOpen,
  Star,
  Mic,
  MicOff,
  Video,
  VideoOff,
  ChevronDown,
  Volume2,
  VolumeX,
  Loader2,
  Square,
  AlertCircle,
  Clock,
  Search,
  Pill,
  Check,
  Flag,
  X
} from 'lucide-react'
import { generateFeedbackReport, faqSearch, faqTopics, STEP_META, VISIT_STEPS } from '@/lib/zara-feedback'
import type { ZaraFeedback, VisitStep } from '@/lib/zara-feedback'
import { useVoice } from '@/lib/useVoice'
import { loadCatalog } from '@/lib/catalog-data'
import type { Product } from '@/types/alia'
import SupportReportForm from '@/components/support/support-report-form'
import Splash from './Splash'
import SetupLoader from './SetupLoader'

// ── Types ──
type Step = VisitStep | 'completed'
type Level = 'debutant' | 'junior' | 'confirme' | 'expert'
type Style = 'analysant' | 'controlant' | 'facilitant' | 'promouvant'
type Format = 'flash' | 'standard' | 'approfondie'
type View = 'setup' | 'chat' | 'thanks' | 'feedback' | 'qa' | 'dashboard'

interface Config {
  level: Level
  style: Style
  format: Format
  /** VITAL SA product the whole visit is built around (chosen first). */
  product: string
}

interface Msg {
  role: 'user' | 'assistant'
  content: string
  time: Date
  step?: Step
  /** Message was spoken / transcribed rather than typed. */
  via?: 'voice'
}

const STEPS: Step[] = ['introduction', 'sondage', 'synthese', 'objections', 'argumentation', 'conclusion']

const STEP_LABELS: Record<Step, { label: string; color: string }> = {
  introduction: { label: 'Introduction', color: '#3b82f6' },
  sondage: { label: 'Sondage', color: '#a855f7' },
  synthese: { label: 'Synthèse', color: '#22c55e' },
  objections: { label: 'Objections', color: '#f97316' },
  argumentation: { label: 'Argumentation', color: '#ef4444' },
  conclusion: { label: 'Conclusion', color: '#14b8a6' },
  completed: { label: 'Terminé', color: '#6b7280' }
}

const LEVELS: { id: Level; name: string; desc: string }[] = [
  { id: 'debutant', name: 'Débutant', desc: 'Script guidé, questions de base' },
  { id: 'junior', name: 'Junior', desc: 'Interactif, 2 à 4 relances ciblées' },
  { id: 'confirme', name: 'Confirmé', desc: 'Autonome, forte adaptation' },
  { id: 'expert', name: 'Expert', desc: 'Situations complexes et objections aiguës' }
]

const STYLES: { id: Style; name: string; desc: string; soncas: string }[] = [
  { id: 'analysant', name: 'Analysant', desc: 'Exige des preuves cliniques et des chiffres', soncas: 'Sécurité' },
  { id: 'controlant', name: 'Controlant', desc: 'Direct, axé sur l\'efficacité et le temps', soncas: 'Organisation' },
  { id: 'facilitant', name: 'Facilitant', desc: 'Privilégie l\'écoute et la relation humaine', soncas: 'Relation' },
  { id: 'promouvant', name: 'Promouvant', desc: 'Enthousiaste pour les innovations et nouveautés', soncas: 'Innovation' }
]

const FORMATS: { id: Format; name: string; desc: string }[] = [
  { id: 'flash', name: 'Flash', desc: '20-60 sec' },
  { id: 'standard', name: 'Standard', desc: '2-4 min' },
  { id: 'approfondie', name: 'Approfondie', desc: '5-8 min' }
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

function demoGreeting(c: Config) {
  // Backend unreachable : the avatar still introduces itself, briefly.
  const style = STYLES.find(s => s.id === c.style)?.name
  return `Bonjour Docteur, je suis ALIA, représentante virtuelle de VITAL SA. Je vais jouer le rôle d'un médecin ${style?.toLowerCase() ?? ''} pour cette session d'entraînement. Je vous écoute !`
}

function demoReply(msg: string) {
  const m = msg.toLowerCase()
  if (m.includes('?')) {
    return `C'est une bonne question.\n\n1. **Bénéfice patient :** Meilleure tolérance et observance prouvée\n2. **Pratique quotidienne :** Facile à intégrer dans l'ordonnance\n3. **Études :** Données d'efficacité solides\n\nQuels sont vos arguments sur la posologie ?`
  }
  return `Merci pour ces précisions. Dans ma patientèle habituelle, je recherche surtout la rapidité d'action et la sécurité.\n\nComment votre produit se positionne-t-il par rapport aux alternatives actuelles ?`
}

// ── Phase 1 : personalized practice scenario (generated on the fly) ────────
const STEP_OPENERS: Record<Step, string> = {
  introduction: 'Bonjour, installez-vous. Qui êtes-vous et que venez-vous me présenter aujourd\'hui ?',
  sondage: 'Parlez-moi de ma pratique : quels besoins voyez-vous chez mes patients dans ce domaine ?',
  synthese: 'Résumez ce que vous avez compris de ma pratique et de mes attentes.',
  objections: 'Je prescris déjà un concurrent qui me donne satisfaction… pourquoi devrais-je changer ?',
  argumentation: 'Concrètement, quels bénéfices pour mes patients par rapport à l\'existant ?',
  conclusion: 'Très bien. Que me proposez-vous concrètement pour la suite ?',
  completed: ''
}

const STYLE_ANGLE: Record<Style, string> = {
  analysant: 'Appuyez vos réponses sur des preuves cliniques et des chiffres.',
  controlant: 'Restez concis et allez droit à l\'essentiel.',
  facilitant: 'Soignez la relation et montrez de l\'empathie.',
  promouvant: 'Mettez en avant la nouveauté et l\'innovation du produit.'
}

const LEVEL_GUIDE: Record<Level, string> = {
  debutant: 'Question guidée — un indice de réponse vous sera fourni si besoin.',
  junior: 'Question ouverte — 2 à 4 relances ciblées possibles.',
  confirme: 'Adaptation libre — le médecin peut dévier du script.',
  expert: 'Situation complexe — objections aiguës et imprévues possibles.'
}

function practicePreview(c: Config) {
  return STEPS.filter(s => s !== 'completed').map(step => ({
    step,
    question: `${STEP_OPENERS[step]} ${STYLE_ANGLE[c.style]}`,
    hint: LEVEL_GUIDE[c.level]
  }))
}

// ── Phase progress : slim one-line tabs (Zara style) ───────────────────────
const PHASE_ORDER: View[] = ['setup', 'chat', 'thanks', 'feedback', 'qa']
const PHASE_META: Record<View, { num: number; label: string; sub: string }> = {
  setup: { num: 1, label: 'Préparation', sub: 'Configurez votre scénario' },
  chat: { num: 2, label: 'Entretien', sub: 'Visite médicale simulée' },
  thanks: { num: 3, label: 'Merci', sub: 'Session enregistrée' },
  feedback: { num: 4, label: 'Feedback', sub: 'Points forts & axes' },
  qa: { num: 5, label: 'Questions', sub: 'Assistance & FAQ' },
  dashboard: { num: 0, label: '', sub: '' }
}

function PhaseProgress({ current, onNavigate }: { current: View; onNavigate?: (v: View) => void }) {
  const idx = PHASE_ORDER.indexOf(current)
  return (
    <div className='flex items-end gap-1 overflow-x-auto w-full border-b border-border pb-px'>
      {PHASE_ORDER.map((p, i) => {
        const done = i < idx
        const active = i === idx
        return (
          <button
            key={p}
            onClick={done && onNavigate ? () => onNavigate(p) : undefined}
            disabled={!done && !active}
            title={PHASE_META[p].sub}
            className={`flex-1 min-w-24 px-3 py-2 text-left border-b-2 transition-colors ${
              active
                ? 'border-primary bg-primary/5'
                : done
                ? 'border-primary/40 hover:bg-accent cursor-pointer'
                : 'border-transparent'
            }`}
          >
            <span
              className={`block text-[10px] font-bold uppercase tracking-wider ${
                active ? 'text-primary' : done ? 'text-primary/70' : 'text-muted-foreground/50'
              }`}
            >
              {done ? '✓ ' : ''}{PHASE_META[p].num}. {PHASE_META[p].label}
            </span>
          </button>
        )
      })}
    </div>
  )
}

// ── Glowing avatar orb (Zara visual) ───────────────────────────────────────
function AvatarOrb({ size = 'md', label = 'A' }: { size?: 'sm' | 'md' | 'lg'; label?: string }) {
  const sizes = { sm: 'size-14', md: 'size-28', lg: 'size-40' }
  const fonts = { sm: 'text-lg', md: 'text-4xl', lg: 'text-5xl' }
  return (
    <div className='relative'>
      <div
        className={`${sizes[size]} rounded-full bg-gradient-to-br from-blue-500/50 via-purple-500/50 to-blue-600/50 blur-xl absolute inset-0 animate-pulse`}
      />
      <div
        className={`${sizes[size]} rounded-full bg-card border border-border flex items-center justify-center relative shadow-xl ring-1 ring-primary/10`}
      >
        <span className={`${fonts[size]} font-bold text-foreground`}>
          {label}<span className='text-primary'>.</span>
        </span>
      </div>
    </div>
  )
}

export default function TrainingSimulation() {
  const router = useRouter()
  const [booting, setBooting] = useState(true)
  const [view, setView] = useState<View>('setup')
  const [config, setConfig] = useState<Config>({
    level: 'junior',
    style: 'analysant',
    format: 'standard',
    // No default product: the trainee must pick the one they are training on.
    product: ''
  })
  const [report, setReport] = useState<ZaraFeedback | null>(null)
  // Session id lives inside Interview; lifted here so the thank-you screen can
  // save the feedback against it.
  const [sessionId, setSessionId] = useState<string | null>(null)
  const sessionIdRef = useRef<string | null>(null)
  // Wall-clock start of the visit + a guard so a session is only ever sent to
  // the dashboard once (completing twice would double it in the history).
  const startedAtRef = useRef<number | null>(null)
  const savedRef = useRef(false)

  /**
   * Persist the finished visit so it lands in the training dashboard.
   *
   * The config and duration travel with the request: if the backend restarted
   * during the visit and no longer holds the session in memory, it can still
   * store the row instead of losing the whole training.
   */
  const saveSession = useCallback(() => {
    const sid = sessionIdRef.current
    if (!sid || savedRef.current) return
    savedRef.current = true
    const elapsed = startedAtRef.current
      ? Math.round((Date.now() - startedAtRef.current) / 1000)
      : 0
    void apiFetch('/api/v1/session/' + sid + '/complete', {
      method: 'POST',
      body: JSON.stringify({
        duration_seconds: elapsed,
        level: config.level,
        visit_format: config.format,
        doctor_style: config.style,
        product_focus: config.product || undefined
      })
    }).catch(() => {
      // Let a later exit retry instead of losing the session.
      savedRef.current = false
    })
  }, [config.level, config.format, config.style, config.product])

  return (
    <div className='w-full'>
      <ExitButton
        onExit={() => {
          saveSession()
          router.push('/dashboard/training')
        }}
      />
      {booting && <SetupLoader onDone={() => setBooting(false)} />}
      {!booting && view === 'setup' && <Setup config={config} setConfig={setConfig} onStart={() => setView('chat')} onExitSetup={() => router.push('/dashboard/training')} />}
      {view === 'chat' && (
        <Interview
          config={config}
          onSession={id => {
            sessionIdRef.current = id
            savedRef.current = false
            startedAtRef.current = Date.now()
            setSessionId(id)
          }}
          onBack={() => setView('setup')}
          onDash={() => setView('dashboard')}
          onComplete={r => {
            setReport(r)
            // The report is for the admin only: it goes to the server, is never
            // rendered for the delegate. He only sees the thank-you screen.
            saveSession()
            setView('thanks')
          }}
        />
      )}
      {/* End of the delegate's session: thank-you + optional rating only.
          The structured scoring stays admin-side (never rendered here). */}
      {view === 'thanks' && (
        <ThanksView
          config={config}
          sessionId={sessionId}
          onDash={() => router.push('/dashboard/training')}
          onRestart={() => {
            setReport(null)
            setSessionId(null)
            sessionIdRef.current = null
            savedRef.current = false
            startedAtRef.current = null
            setView('setup')
          }}
        />
      )}
      {view === 'dashboard' && <Dashboard onBack={() => setView('chat')} />}
    </div>
  )
}

// ── PHASE 1 : one-page configuration screen ────────────────────────────────
const SECTION_META = {
  level: { icon: Target, title: 'Niveau de Compétence', sub: 'Choisissez le niveau cible de la session' },
  style: { icon: Users, title: 'Profil du Médecin', sub: 'Quel type de praticien allez-vous rencontrer ?' },
  format: { icon: Activity, title: 'Format de la Visite', sub: 'Quelle durée pour cette visite ?' }
} as const

function OptionCard({
  selected,
  onClick,
  children,
  className = ''
}: {
  selected: boolean
  onClick: () => void
  children: React.ReactNode
  className?: string
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={selected}
      className={`group relative w-full rounded-2xl border-2 p-4 text-left transition-all duration-200 ${
        selected
          ? 'border-primary bg-primary/10 shadow-md shadow-primary/10 ring-1 ring-primary/30 scale-[1.01]'
          : 'border-border bg-card hover:border-primary/40 hover:bg-accent/40 hover:-translate-y-0.5'
      } ${className}`}
    >
      {children}
      <span
        className={`absolute top-3 right-3 flex size-5 items-center justify-center rounded-full border-2 transition-all ${
          selected ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-transparent group-hover:border-primary/40'
        }`}
      >
        {selected && <CheckCircle2 className='size-3.5' />}
      </span>
    </button>
  )
}

/**
 * Full-screen split panels — one per option, micro1-hero style.
 *
 * The row spans the whole viewport; every panel is a tall vertical slice.
 * Each option can carry an `accent` color (easy → hard gradient across the
 * Niveau group) and a background `image`: the photo is greyscale + dimmed on
 * inactive panels and blooms into full color when the panel is hovered or
 * preselected. The active panel expands while the others shrink.
 */
function StripGroup<T extends string>({
  options,
  value,
  onChange,
  renderSub
}: {
  options: {
    id: T
    name: string
    desc: string
    tag?: string
    accent?: string
    image?: string
  }[]
  value: T
  onChange: (v: T) => void
  renderSub?: (o: { id: T; desc: string; tag?: string; accent?: string }) => ReactNode
}) {
  const [hovered, setHovered] = useState<T | null>(null)
  const active = hovered ?? value

  return (
    <div className='flex h-full w-full'>
      {options.map(o => {
        const selected = o.id === value
        const isActive = o.id === active
        const accent = o.accent || 'var(--primary)'
        return (
          <button
            key={o.id}
            type='button'
            onClick={() => onChange(o.id)}
            onMouseEnter={() => setHovered(o.id)}
            onMouseLeave={() => setHovered(null)}
            aria-pressed={selected}
            className={`relative h-full overflow-hidden border-r border-border last:border-r-0 transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] cursor-pointer ${
              isActive ? 'flex-[2.2]' : 'flex-[1]'
            }`}
          >
            {/* ── background photo layer ── */}
            {o.image && (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={o.image}
                  alt=''
                  aria-hidden
                  className={`absolute inset-0 h-full w-full object-cover transition-all duration-700 ${
                    selected
                      ? '!opacity-100 grayscale-0 blur-0 scale-105'
                      : isActive
                        ? 'opacity-80 grayscale-[0.2] blur-[2px] scale-100'
                        : 'opacity-60 grayscale blur-md scale-100'
                  }`}
                />
                {/* readability scrim: strong at the vertical center where the
                    text sits, tinted with the panel accent at the base */}
                <span
                  className='absolute inset-0 transition-opacity duration-500'
                  style={{
                    background: `linear-gradient(to top, ${accent}55 0%, transparent 30%), radial-gradient(ellipse 120% 60% at 50% 50%, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.45) 55%, rgba(0,0,0,0.15) 100%)`
                  }}
                />
              </>
            )}

            {/* dim veil on inactive panels (no image) */}
            {!o.image && (
              <span
                className='absolute inset-0 transition-opacity duration-500'
                style={{
                  background: selected
                    ? `linear-gradient(to top, ${accent}33 0%, transparent 60%)`
                    : isActive
                      ? 'rgba(0,0,0,0.35)'
                      : 'rgba(0,0,0,0.7)'
                }}
              />
            )}

            {/* accent edge line at the bottom of every panel */}
            <span
              className='absolute bottom-0 left-0 right-0 h-1 transition-opacity duration-500'
              style={{ backgroundColor: accent, opacity: selected ? 1 : isActive ? 0.7 : 0.25 }}
            />            {/* content */}
            <span className='absolute inset-0 flex flex-col items-center justify-center gap-3 px-2 text-center'>
              <span
                className={`font-extrabold tracking-tight transition-all duration-500 ${
                  isActive ? 'text-3xl lg:text-5xl' : 'text-lg lg:text-xl'
                }`}
                style={{
                  color: selected ? accent : isActive ? '#ffffff' : 'rgba(255,255,255,0.75)',
                  textShadow: '0 2px 4px rgba(0,0,0,0.9), 0 0 24px rgba(0,0,0,0.65), 0 1px 2px rgba(0,0,0,1)'
                }}
              >
                {o.name}
              </span>

              {isActive && (
                <>
                  {renderSub ? (
                    renderSub(o)
                  ) : (
                    <span
                      className='text-sm max-w-xs text-center leading-snug text-white/85'
                      style={{ textShadow: '0 1px 3px rgba(0,0,0,0.95), 0 0 12px rgba(0,0,0,0.7)' }}
                    >
                      {o.desc}
                    </span>
                  )}
                  {o.tag && (
                    <span
                      className='text-[10px] font-semibold px-2.5 py-1 rounded-full whitespace-nowrap'
                      style={{ backgroundColor: 'rgba(0,0,0,0.55)', color: accent }}
                    >
                      {o.tag}
                    </span>
                  )}
                  <span
                    className={`mt-2 text-[11px] font-semibold uppercase tracking-wider px-4 py-2 rounded-full backdrop-blur-sm transition-colors ${
                      selected
                        ? 'text-primary-foreground'
                        : 'border hover:text-primary-foreground'
                    }`}
                    style={
                      selected
                        ? { backgroundColor: accent, borderColor: accent, boxShadow: '0 2px 10px rgba(0,0,0,0.5)' }
                        : { borderColor: `${accent}88`, color: accent, backgroundColor: 'rgba(0,0,0,0.45)' }
                    }
                  >
                    {selected ? '✓ Choisi' : 'Choisir'}
                  </span>
                </>
              )}
            </span>
          </button>
        )
      })}
    </div>
  )
}

// ── Product picker : step 1 of the setup ───────────────────────────────────
// The VITAL SA catalog holds ~190 references, so this step is a searchable grid
// rather than the split-panel photo strips used for the three short questions.
// The choice anchors the entire scenario: the doctor's objections, the RAG
// context and the evaluation all revolve around this product.
function ProductPicker({
  products,
  loading,
  value,
  onChange
}: {
  products: Product[]
  loading: boolean
  value: string
  onChange: (name: string) => void
}) {
  const [query, setQuery] = useState('')
  const [gamme, setGamme] = useState('')

  // The exported catalog holds a few refs under the same name — keep the first
  // of each so the grid never shows one product twice (and keys stay unique).
  const catalog = useMemo(() => {
    const seen = new Set<string>()
    return products.filter(p => {
      const k = p.name.trim().toLowerCase()
      if (seen.has(k)) return false
      seen.add(k)
      return true
    })
  }, [products])

  // Gammes present in the catalog — used as quick filter chips.
  const gammes = useMemo(() => {
    const set = new Set<string>()
    catalog.forEach(p => {
      if (p.gamme) set.add(p.gamme)
    })
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [catalog])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return catalog.filter(p => {
      if (gamme && p.gamme !== gamme) return false
      if (!q) return true
      return (
        p.name.toLowerCase().includes(q) ||
        (p.gamme ?? '').toLowerCase().includes(q) ||
        (p.indications ?? []).some(i => i.toLowerCase().includes(q))
      )
    })
  }, [catalog, query, gamme])

  return (
    <div className='pointer-events-auto flex-1 min-h-0 flex flex-col gap-3 px-4 lg:px-10 pb-2 w-full'>
      {/* ── Search + gamme chips ── */}
      <div className='flex flex-col gap-2.5 shrink-0 max-w-6xl w-full mx-auto'>
        <div className='flex items-center gap-2.5 rounded-2xl bg-background/85 backdrop-blur border border-border px-4 py-2.5 shadow-lg'>
          <Search className='size-4 text-muted-foreground shrink-0' />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder='Rechercher un produit ou une gamme…'
            className='flex-1 min-w-0 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground/70'
          />
          <span className='text-xs text-muted-foreground tabular-nums whitespace-nowrap'>
            {filtered.length} produit{filtered.length > 1 ? 's' : ''}
          </span>
        </div>

        {gammes.length > 0 && (
          <div className='flex items-center gap-2 overflow-x-auto pb-1 -mb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'>
            <button
              type='button'
              onClick={() => setGamme('')}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors cursor-pointer ${
                gamme === ''
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background/85 backdrop-blur border-border text-muted-foreground hover:text-foreground'
              }`}
            >
              Toutes les gammes
            </button>
            {gammes.map(g => (
              <button
                key={g}
                type='button'
                onClick={() => setGamme(g)}
                className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border whitespace-nowrap transition-colors cursor-pointer ${
                  gamme === g
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-background/85 backdrop-blur border-border text-muted-foreground hover:text-foreground'
                }`}
              >
                {g}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Catalog grid ── */}
      <div className='flex-1 min-h-0 overflow-y-auto max-w-6xl w-full mx-auto pb-3 [scrollbar-width:thin]'>
        {loading ? (
          <div className='h-full flex items-center justify-center gap-2 text-sm text-muted-foreground'>
            <Loader2 className='size-4 animate-spin' /> Chargement du catalogue…
          </div>
        ) : filtered.length === 0 ? (
          <div className='h-full flex flex-col items-center justify-center gap-2 text-sm text-muted-foreground'>
            <Pill className='size-6 opacity-40' />
            Aucun produit ne correspond à cette recherche.
          </div>
        ) : (
          <div className='grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2.5'>
            {filtered.map((p, i) => {
              const selected = p.name === value
              return (
                <button
                  key={`${p.name}-${i}`}
                  type='button'
                  onClick={() => onChange(p.name)}
                  aria-pressed={selected}
                  className={`h-full text-left rounded-xl border p-3 flex flex-col transition-all cursor-pointer ${
                    selected
                      ? 'border-primary bg-primary/10 ring-1 ring-primary'
                      : 'border-border bg-background/85 backdrop-blur hover:border-primary/50'
                  }`}
                >
                  <span className='flex items-start justify-between gap-2'>
                    <span className='text-sm font-semibold leading-snug'>{p.name}</span>
                    {selected && <Check className='size-4 text-primary shrink-0' />}
                  </span>
                  {p.gamme && (
                    <span className='mt-1 block text-[11px] uppercase tracking-wider text-muted-foreground'>
                      {p.gamme}
                    </span>
                  )}
                  {p.indications && p.indications.length > 0 && (
                    <span className='mt-1.5 block text-xs text-muted-foreground leading-snug'>
                      {p.indications.slice(0, 3).join(' · ')}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function Setup({
  config,
  setConfig,
  onStart,
  onExitSetup
}: {
  config: Config
  setConfig: (c: Config) => void
  onStart: () => void
  onExitSetup: () => void
}) {
  const [stepIdx, setStepIdx] = useState(0)

  // Catalog for the mandatory first step (live API → local mirror → samples).
  const [products, setProducts] = useState<Product[]>([])
  const [loadingProducts, setLoadingProducts] = useState(true)
  useEffect(() => {
    let alive = true
    loadCatalog()
      .then(c => {
        if (alive) setProducts(c.products)
      })
      .catch(() => {})
      .finally(() => {
        if (alive) setLoadingProducts(false)
      })
    return () => {
      alive = false
    }
  }, [])

  // One question per page; each option is a full-screen split panel or, for the
  // product step, the searchable catalog grid.
  // `accent` gives each Niveau its own color, easy → hard (green → red);
  // images live in /public/images/panels/ and grey out when deselected.
  const questions: {
    key: 'product' | 'level' | 'style' | 'format'
    icon: ReactNode
    label: string
    title: string
    options: { id: string; name: string; desc: string; tag?: string; accent?: string; image?: string }[]
    value: string
    onChange: (v: string) => void
  }[] = [
    {
      // The product comes FIRST: it is the thread the whole visit follows.
      key: 'product',
      icon: <Pill className='size-4 text-primary' />,
      label: 'Produit',
      title: 'Sur quel produit allez-vous vous entraîner ?',
      options: [],
      value: config.product,
      onChange: v => setConfig({ ...config, product: v })
    },
    {
      key: 'level',
      icon: <Target className='size-4 text-primary' />,
      label: 'Niveau',
      title: "Quel niveau d'entretien souhaitez-vous entraîner ?",
      options: LEVELS.map((l, i) => ({
        ...l,
        // easy → hard : vert → jaune → orange → rouge
        accent: ['#22c55e', '#eab308', '#f97316', '#ef4444'][i],
        image: `/images/panels/level-${l.id}.jpg`
      })),
      value: config.level,
      onChange: v => setConfig({ ...config, level: v as Level })
    },
    {
      key: 'style',
      icon: <Users className='size-4 text-primary' />,
      label: 'Profil médecin',
      title: 'Quel type de praticien allez-vous rencontrer ?',
      options: STYLES.map(s => ({
        ...s,
        accent: '#38bdf8',
        image: `/images/panels/style-${s.id}.jpg`
      })),
      value: config.style,
      onChange: v => setConfig({ ...config, style: v as Style })
    },
    {
      key: 'format',
      icon: <Activity className='size-4 text-primary' />,
      label: 'Format',
      title: 'Combien de temps durera la visite ?',
      options: FORMATS.map((f, i) => ({
        ...f,
        // court → long : bleu clair → bleu → indigo
        accent: ['#7dd3fc', '#60a5fa', '#818cf8'][i],
        image: `/images/panels/format-${f.id}.jpg`
      })),
      value: config.format,
      onChange: v => setConfig({ ...config, format: v as Format })
    }
  ]
  const q = questions[stepIdx]
  const isLast = stepIdx === questions.length - 1

  return (
    <div className='fixed inset-0 z-40 bg-background overflow-hidden'>
      {/* ── Panels as the full-screen background layer ── */}
      <div className='absolute inset-0'>
        {q.key === 'product' ? (
          /* Catalog step: no photo strips — a soft tinted backdrop keeps the
             floating controls readable over the scrollable picker. */
          <div className='absolute inset-0 bg-gradient-to-b from-primary/10 via-background to-primary/5' />
        ) : (
        <StripGroup
          options={q.options}
          value={q.value}
          onChange={v => {
            q.onChange(v)
            // No auto-advance — the user confirms with « Continuer ».
          }}
          renderSub={o =>
            q.key === 'style' ? (
              <>
                <span
                  className='text-sm max-w-xs text-center leading-snug text-white/85'
                  style={{ textShadow: '0 1px 3px rgba(0,0,0,0.95), 0 0 12px rgba(0,0,0,0.7)' }}
                >
                  {o.desc}
                </span>
                {o.tag && (
                  <span
                    className='text-[10px] font-semibold px-2.5 py-1 rounded-full text-primary whitespace-nowrap'
                    style={{ backgroundColor: 'rgba(0,0,0,0.55)' }}
                  >
                    {o.tag}
                  </span>
                )}
              </>
            ) : q.key === 'format' ? (
              <span
                className='text-sm font-medium text-white/90'
                style={{ textShadow: '0 1px 3px rgba(0,0,0,0.95), 0 0 12px rgba(0,0,0,0.7)' }}
              >
                {o.desc}
              </span>
            ) : (
              <span
                className='text-sm max-w-xs text-center leading-snug text-white/85'
                style={{ textShadow: '0 1px 3px rgba(0,0,0,0.95), 0 0 12px rgba(0,0,0,0.7)' }}
              >
                {o.desc}
              </span>
            )
          }
        />
        )}
      </div>

      {/* ── Floating UI — pointer-events pass through except on controls ── */}
      <div className='absolute inset-0 z-10 flex flex-col pointer-events-none'>
      {/* ── Top bar : back · progress dots · step label ── */}
      <div className='relative flex items-center justify-between gap-4 px-5 py-4 shrink-0'>
        <button
          onClick={() => (stepIdx === 0 ? onExitSetup() : setStepIdx(i => i - 1))}
          className='pointer-events-auto inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-background/80 backdrop-blur border border-border text-xs font-medium text-foreground hover:bg-accent transition-colors cursor-pointer shadow-lg'
        >
          <ArrowLeft className='size-3.5' />
          {stepIdx === 0 ? 'Quitter' : 'Précédent'}
        </button>

        {/* Progress dots — absolutely centered so they never drift */}
        <div className='absolute left-1/2 -translate-x-1/2 flex items-center gap-2 rounded-full bg-background/80 backdrop-blur px-3.5 py-2 border border-border shadow-lg'>
          {questions.map((qq, i) => (
            <span
              key={qq.key}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === stepIdx ? 'w-8 bg-primary' : i < stepIdx ? 'w-1.5 bg-primary/50' : 'w-1.5 bg-border'
              }`}
            />
          ))}
        </div>

        <span className='text-xs font-semibold text-muted-foreground tabular-nums rounded-full bg-background/80 backdrop-blur px-3 py-2 border border-border shadow-lg'>
          {stepIdx + 1} / {questions.length}
        </span>
      </div>

      {/* ── Question — floats over the panels ── */}
      <div className='text-center px-4 pt-4 shrink-0'>
        <div className='flex justify-center'>
          <div className='inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-background/80 backdrop-blur border border-border mb-4 shadow-lg'>
            {q.icon}
            <span className='text-xs font-bold uppercase tracking-widest text-muted-foreground'>{q.label}</span>
          </div>
        </div>
        <h1
          className='text-2xl lg:text-4xl font-bold tracking-tight text-white'
          style={{ textShadow: '0 2px 6px rgba(0,0,0,0.9), 0 0 30px rgba(0,0,0,0.6)' }}
        >
          {q.title}
        </h1>
      </div>

      {/* middle — the picker on the product step, otherwise the panels show through */}
      {q.key === 'product' ? (
        <ProductPicker
          products={products}
          loading={loadingProducts}
          value={config.product}
          onChange={v => q.onChange(v)}
        />
      ) : (
        <div className='flex-1' />
      )}

      {/* ── Bottom : skip / launch ── */}
      <div className='shrink-0 flex items-center justify-between gap-3 px-5 py-4'>
        <p className='text-xs text-muted-foreground hidden sm:block rounded-full bg-background/80 backdrop-blur px-3.5 py-2 border border-border shadow-lg'>
          {isLast
            ? 'Dernière étape — tout est prêt.'
            : q.key === 'product'
              ? 'Le produit choisi sert de fil rouge à toute la visite.'
              : 'Votre choix est enregistré automatiquement.'}
        </p>
        <div className='flex items-center gap-2.5 ml-auto'>
          {!isLast && q.key !== 'product' && (
            <button
              onClick={() => setStepIdx(i => Math.min(i + 1, questions.length - 1))}
              className='pointer-events-auto inline-flex items-center justify-center gap-1.5 px-7 py-3 rounded-xl bg-background/80 backdrop-blur border border-border text-sm font-medium text-foreground hover:bg-accent transition-colors cursor-pointer shadow-lg'
            >
              Passer
            </button>
          )}
          <button
            onClick={() => (isLast ? onStart() : setStepIdx(i => i + 1))}
            disabled={q.key === 'product' && !config.product}
            title={q.key === 'product' && !config.product ? 'Choisissez d’abord un produit' : undefined}
            className='pointer-events-auto inline-flex items-center justify-center gap-2 px-7 py-3 rounded-xl border border-transparent bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-all shadow-xl shadow-primary/30 hover:scale-[1.02] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100'
          >
            {isLast ? (
              <>
                <Sparkles className='size-4' /> Démarrer l&apos;entretien
              </>
            ) : (
              'Continuer'
            )}
          </button>
        </div>
      </div>
      </div>
    </div>
  )
}

// ── Splash : "Starting interview" (Zara) ───────────────────────────────────
// ── Floating exit button (fullscreen route has no navbar) ─────────────────
function ExitButton({ onExit }: { onExit: () => void }) {
  return (
    <div className='fixed top-4 left-4 z-40 flex items-center gap-2'>
      <button
        onClick={onExit}
        title='Quitter la simulation'
        className='inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-card/90 backdrop-blur border border-border text-xs font-medium text-foreground hover:bg-accent shadow-sm transition-colors cursor-pointer'
      >
        <ArrowLeft className='size-3.5 text-primary' /> Retour au tableau de bord
      </button>
    </div>
  )
}

// ── PHASE 2 : Zara-style interview ─────────────────────────────────────────
function Interview({
  config,
  onSession,
  onBack,
  onDash,
  onComplete
}: {
  config: Config
  onSession?: (sid: string) => void
  onBack: () => void
  onDash: () => void
  onComplete: (r: ZaraFeedback) => void
}) {
  const [splash, setSplash] = useState(true)
  const micStreamRef = useRef<MediaStream | null>(null)
  const [camOn, setCamOn] = useState(false)
  const [camError, setCamError] = useState<string | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const camStreamRef = useRef<MediaStream | null>(null)
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [typing, setTyping] = useState(false)
  const [step, setStep] = useState<Step>('introduction')
  const [sid, setSid] = useState<string | null>(null)
  const [score, setScore] = useState(0)
  const [started, setStarted] = useState(false)
  const [demo, setDemo] = useState(false)
  const [wsStatus, setWsStatus] = useState<string>('disconnected')
  /** Guards the one-shot session start against React's double-invoked effects. */
  const startedOnceRef = useRef(false)
  // Countdown budget per visit format (from the manuel §5: Flash 20-60 s,
  // Standard 2-4 min, Approfondie 5-8 min — take the upper bound).
  const FORMAT_BUDGET: Record<Format, number> = { flash: 60, standard: 240, approfondie: 480 }
  const [elapsed, setElapsed] = useState(0)
  /** The candidate introduces himself before the visit proper begins: while he
      has not spoken, the clock stays still and the visit stays on
      Introduction — so the first question can never arrive before his
      introduction. */
  const [hasIntroduced, setHasIntroduced] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  /** Problem report / feedback about ALIA, opened from the help panel. */
  const [showReport, setShowReport] = useState(false)
  /** A problem was filed in this dialog — the escape actions may show now. */
  const [reported, setReported] = useState(false)
  /** Text of the assistant bubble currently being streamed in (live typing). */
  const streamingDraft = useRef('')
  // Set once `finish` exists; lets effects declared earlier end the session
  // (e.g. when the doctor wraps up at 00:00).
  const onCompleteRef = useRef<() => void>(() => {})
  const wsRef = useRef<WebSocket | null>(null)

  /** Start / stop the webcam preview shown in the camera panel. */
  const toggleCamera = useCallback(async () => {
    if (camStreamRef.current) {
      camStreamRef.current.getTracks().forEach(t => t.stop())
      camStreamRef.current = null
      setCamOn(false)
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 }, audio: false })
      camStreamRef.current = stream
      setCamOn(true)
      setCamError(null)
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.play().catch(() => {})
      }
    } catch {
      setCamError('Caméra indisponible — autorisez l\'accès dans le navigateur.')
    }
  }, [])

  // Stop the camera when the interview unmounts.
  useEffect(() => () => { camStreamRef.current?.getTracks().forEach(t => t.stop()) }, [])

  /** Send a JSON frame on the session socket; false when it is not open. */
  const sendFrame = useCallback((frame: Record<string, unknown>) => {
    const ws = wsRef.current
    if (!ws || ws.readyState !== WebSocket.OPEN) return false
    ws.send(JSON.stringify(frame))
    return true
  }, [])

  // Spoken turns: mic → Whisper → orchestrator → streamed ElevenLabs audio.
  const voice = useVoice({
    sessionId: demo ? null : sid,
    stream: micStreamRef.current,
    send: sendFrame,
    meta: {
      mode: 'training',
      level: config.level,
      visit_format: config.format,
      style: config.style,
      language: 'fr'
    },
    onTranscript: text => {
      setTyping(false)
      // A spoken introduction counts exactly like a typed one.
      setHasIntroduced(true)
      setMsgs(p => [...p, { role: 'user', content: text, time: new Date(), step, via: 'voice' }])
    },
    onReply: (text, m) => {
      setTyping(false)
      const nextStep = m.current_step as Step | undefined
      if (nextStep) setStep(nextStep)
      const overall = (m.score_update as { overall?: number } | undefined)?.overall
      if (overall) setScore(overall)
      // Replace the streaming placeholder (added below via onToken) with the
      // final text exactly once.
      setMsgs(p => {
        const withoutDraft = p.filter(m => m.role !== 'assistant' || m.content !== streamingDraft.current)
        return [...withoutDraft, { role: 'assistant', content: text, time: new Date(), step: nextStep, via: 'voice' }]
      })
      streamingDraft.current = ''
    },
    onToken: accumulated => {
      // Live-typing effect: keep a single draft bubble and grow its content.
      setTyping(false)
      streamingDraft.current = accumulated
      setMsgs(p => {
        const last = p[p.length - 1]
        if (last?.role === 'assistant' && last.content === accumulated.slice(0, last.content.length)) {
          // same draft bubble - grow it in place
          const copy = [...p]
          copy[copy.length - 1] = { ...last, content: accumulated }
          return copy
        }
        if (last?.role === 'assistant' && streamingDraft.current.startsWith(last.content)) {
          const copy = [...p]
          copy[copy.length - 1] = { ...last, content: accumulated }
          return copy
        }
        return [...p, { role: 'assistant', content: accumulated, time: new Date(), step, via: 'voice' }]
      })
    }
  })

  const showTyping = typing || voice.busy

  // The CURRENT statement only (micro1/Zara-style): the newest assistant
  // utterance replaces the previous one — no transcript history on screen.
  // The full history stays in `msgs` for scoring/feedback.
  const currentReply = [...msgs].reverse().find(m => m.role === 'assistant')?.content ?? null

  // Countdown (mm:ss) while the interview runs; hits 00:00 at the format's
  // max duration. The doctor ends the visit when time is up.
  useEffect(() => {
    if (splash || step === 'completed') return
    // Warm-up: the introduction is not billed against the visit budget. The
    // countdown starts with the visit, once the candidate has introduced
    // himself — otherwise a slow introduction would eat the first question's
    // share of the time and the doctor would skip straight past it.
    if (step === 'introduction' && !hasIntroduced) return
    const t = setInterval(() => setElapsed(e => e + 1), 1000)
    return () => clearInterval(t)
  }, [splash, step, hasIntroduced])

  const budget = FORMAT_BUDGET[config.format] ?? 240
  const remaining = Math.max(0, budget - elapsed)
  const timeUp = remaining === 0 && elapsed > 0
  const timeWarning = remaining > 0 && remaining <= 30

  // ── Time-driven step bars ────────────────────────────────────────────
  // Each of the 6 steps owns a slice of the visit budget (weights mirror the
  // manuel's emphasis). The bars fill continuously with the countdown: the
  // Introduction bar starts empty and fills as time passes, through to
  // Conclusion at 100% when the budget is used up.
  const STEP_TIME_WEIGHTS = [0.1, 0.2, 0.15, 0.2, 0.25, 0.1]
  const stepWindows = (() => {
    const out: { start: number; end: number }[] = []
    let cursor = 0
    STEP_TIME_WEIGHTS.forEach(w => {
      const span = budget * w
      out.push({ start: cursor, end: cursor + span })
      cursor += span
    })
    return out
  })()
  const stepFill = (i: number) => {
    const w = stepWindows[i]
    if (!w || budget <= 0) return 0
    return Math.max(0, Math.min(1, (elapsed - w.start) / (w.end - w.start)))
  }
  // Which slice of the visit the timer is currently in (time, not clicks).
  const timeStepIndex = (() => {
    for (let i = stepWindows.length - 1; i >= 0; i -= 1) {
      if (elapsed >= stepWindows[i].start) return i
    }
    return 0
  })()

  // The visit step follows the timer: when the countdown crosses into the
  // next step's slice, the doctor moves on with it (no manual button).
  useEffect(() => {
    if (demo || !sid || step === 'completed' || splash) return
    // The visit opens with the candidate's introduction: nothing moves on to
    // the first question until he has spoken.
    if (step === 'introduction' && !hasIntroduced) return
    const target = STEPS[timeStepIndex]
    if (!target || target === step) return
    if (STEPS.indexOf(step) < timeStepIndex) {
      void apiFetch<{ current_step: Step }>(`/api/v1/session/${sid}/advance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target,
          time_elapsed: elapsed,
          time_budget: budget
        })
      })
        .then(r => setStep(r.current_step))
        .catch(() => {})
    }
  }, [timeStepIndex, step, sid, demo, splash, elapsed, budget, hasIntroduced])


  // At 00:00 : the simulated doctor politely wraps up (one last message),
  // exactly like a real visit that runs out of time.
  const timeUpFiredRef = useRef(false)
  useEffect(() => {
    if (!timeUp || timeUpFiredRef.current || demo) return
    timeUpFiredRef.current = true
    if (!sid) return
    ;(async () => {
      setTyping(true)
      try {
        const res = await fetch(`${API}/api/v1/chat/stream`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            session_id: sid,
            message: '(Le temps imparti pour cette visite est écoulé.)',
            mode: 'training',
            level: config.level,
            visit_format: config.format,
            product_focus: config.product || undefined,
            doctor_profile: { style: config.style }
          })
        })
        if (!res.ok || !res.body) throw new Error(String(res.status))
        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buf = ''
        let full = ''
        for (;;) {
          const { done, value } = await reader.read()
          if (done) break
          buf += decoder.decode(value, { stream: true })
          const lines = buf.split('\n')
          buf = lines.pop() || ''
          for (const line of lines) {
            if (!line.trim()) continue
            try {
              const frame = JSON.parse(line)
              if (frame.type === 'token' && frame.value) {
                full += frame.value
                queueStreamText(full)
              } else if (frame.type === 'reply_end') {
                setTyping(false)
                // Voice first, then the reveal follows it word by word.
                if (!voice.muted) void voice.speak(full)
                finishStream(() => {
                  commitStreamDraft(full)
                  revealedRef.current = ''
                  fullRef.current = ''
                  streamDoneRef.current = false
                  // The doctor has wrapped up: hand over to the thank-you screen.
                  setTimeout(onCompleteRef.current, 3200)
                })
                return
              }
            } catch { /* skip malformed frame */ }
          }
        }
      } catch {
        setTyping(false)
      }
    })()
  }, [timeUp, demo, sid, config.level, config.format, config.style, step])

  useEffect(() => {
    // A session must only ever be opened once per mount. React's dev-mode
    // double-invoked effects started two sessions here — two greetings, and so
    // two voices speaking at the same time. The ref survives the extra pass
    // (the closure's `started` does not, it is still false at that point).
    if (started || startedOnceRef.current) return
    startedOnceRef.current = true
    ;(async () => {
      try {
        // Streaming start: the greeting arrives word by word (NDJSON),
        // exactly like the chat replies.
        const res = await fetch(`${API}/api/v1/session/start/stream`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mode: 'training',
            level: config.level,
            visit_format: config.format,
            product_focus: config.product || undefined,
            doctor_profile: { style: config.style, specialty: 'Médecine Générale' }
          })
        })
        if (!res.ok || !res.body) throw new Error('start failed')

        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buf = ''
        let acc = ''
        for (;;) {
          const { done, value } = await reader.read()
          if (done) break
          buf += decoder.decode(value, { stream: true })
          const lines = buf.split('\n')
          buf = lines.pop() ?? ''
          for (const line of lines) {
            if (!line.trim()) continue
            let frame: any
            try { frame = JSON.parse(line) } catch { continue }
            if (frame.type === 'session') {
              setSid(frame.session_id)
              onSession?.(frame.session_id)
              setStep(frame.current_step)
              setMsgs([{ role: 'assistant', content: '', time: new Date(), step: frame.current_step }])
              setStarted(true)
            } else if (frame.type === 'token') {
              acc += frame.value
              // Same word-by-word reveal as the chat replies.
              queueStreamText(acc)
            } else if (frame.type === 'error') {
              throw new Error(frame.message)
            }
          }
        }
        // Start the voice FIRST, then let the reveal pace itself on the audio
        // so the greeting appears as it is spoken.
        if (!voice.muted) void voice.speak(acc)
        finishStream(() => {
          commitStreamDraft(acc)
          revealedRef.current = ''
          fullRef.current = ''
          streamDoneRef.current = false
        })
      } catch {
        setDemo(true)
        setMsgs([{ role: 'assistant', content: demoGreeting(config), time: new Date(), step: 'introduction' }])
        setStarted(true)
      }
    })()
  }, []) // eslint-disable-line

  useEffect(() => {
    if (!sid || demo) return
    const ws = new WebSocket(wsURL(sid))
    wsRef.current = ws
    ws.onopen = () => setWsStatus('connected')
    ws.onmessage = e => {
      try {
        const d = JSON.parse(e.data)
        // Voice frames (status / transcript / reply / audio / audio_end / error)
        // belong to the mic pipeline. Any typed frame is consumed here so an
        // unrecognised one (e.g. `pong`) can never fall through and be mistaken
        // for a chat reply; only untyped frames are legacy ConversationResponse.
        if (d && typeof d.type === 'string') {
          voice.handleFrame(d)
          return
        }
        if (!d?.message) return
        setTyping(false)
        setStep(d.current_step)
        if (d.score_update?.overall) setScore(d.score_update.overall)
        setMsgs(p => [...p, { role: 'assistant', content: d.message, time: new Date(), step: d.current_step }])
      } catch {}
    }
    ws.onclose = () => {
      wsRef.current = null
      setWsStatus('disconnected')
    }
    return () => {
      ws.close()
      wsRef.current = null
    }
  }, [sid, demo, voice.handleFrame])

  /** Grow the streaming draft bubble in place while tokens arrive. */
  const applyStreamDraft = (accumulated: string) => {
    setTyping(false)
    streamingDraft.current = accumulated
    setMsgs(p => {
      const last = p[p.length - 1]
      if (last?.role === 'assistant' && accumulated.startsWith(last.content)) {
        const copy = [...p]
        copy[copy.length - 1] = { ...last, content: accumulated }
        return copy
      }
      return [...p, { role: 'assistant', content: accumulated, time: new Date(), step }]
    })
  }

  // ── Word-by-word reveal ──────────────────────────────────────────────
  // Groq returns the whole answer in a couple of bursts, so rendering raw
  // tokens makes the subtitle snap into place. Instead the incoming text is
  // buffered and revealed word by word at a readable pace, no matter how
  // fast the network delivered it.
  const fullRef = useRef('')
  const revealedRef = useRef('')
  const streamDoneRef = useRef(false)
  const revealTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const onRevealDoneRef = useRef<() => void>(() => {})
  /** When the reply finished streaming — used to stop waiting for a voice that
      never started (muted, TTS unavailable, demo mode). */
  const finishAtRef = useRef(0)

  const stopReveal = () => {
    if (revealTimerRef.current) {
      clearInterval(revealTimerRef.current)
      revealTimerRef.current = null
    }
  }

  /** Reveal `target` characters of the buffer, stopping on a word boundary. */
  const revealUpTo = (target: number) => {
    const full = fullRef.current
    const shown = revealedRef.current
    if (target <= shown.length || shown.length >= full.length) return
    // Cut on a word boundary so words never appear half-typed.
    const upTo = Math.min(target, full.length)
    const boundary = full.slice(0, upTo).lastIndexOf(' ') + 1
    const next = full.slice(0, boundary > shown.length ? boundary : upTo)
    revealedRef.current = next
    applyStreamDraft(next)
  }

  /**
   * Reveal paced by the SPOKEN audio, so the subtitle keeps up with the voice
   * instead of running on its own clock:
   *   - while speaking: characters follow the playback position / duration
   *   - with duration unknown (fresh stream): estimate from a French speech rate
   *   - not speaking (muted / TTS down): fall back to a readable fixed drip
   */
  const ensureRevealTimer = () => {
    if (revealTimerRef.current) return
    const CHARS_PER_SECOND = 13 // ≈ neutral French neural-voice pace
    let fallbackClock = 0

    revealTimerRef.current = setInterval(() => {
      const full = fullRef.current
      const shown = revealedRef.current

      if (shown.length < full.length) {
        const pb = voice.getPlayback()
        let target: number

        // Follow the voice only with a trustworthy duration; a streamed blob
        // can briefly report a bogus one and would jump the text ahead.
        if ((pb.active || pb.time > 0) && pb.duration > 1) {
          target = Math.floor((pb.time / pb.duration) * full.length)
        } else if (pb.active) {
          // Playing but duration unknown yet: estimate from the speech rate.
          target = Math.floor(pb.time * CHARS_PER_SECOND)
        } else {
          // Not speaking (muted / TTS down / demo): readable fixed drip.
          fallbackClock += 1
          target = Math.floor(fallbackClock * (CHARS_PER_SECOND / 10))
        }

        // Smooth it: never reveal more than a short burst per tick, so the text
        // flows with the voice instead of snapping to the end.
        target = Math.min(target, shown.length + 6)
        revealUpTo(Math.max(target, shown.length + 1))
        return
      }

      // Nothing left to show: stop once the stream finished AND the voice
      // finished too (or never started — muted, TTS down, demo mode).
      if (streamDoneRef.current) {
        const pb = voice.getPlayback()
        const voiceDone = !pb.active && (pb.time > 0 || Date.now() - finishAtRef.current > 2000)
        if (voiceDone) {
          stopReveal()
          onRevealDoneRef.current()
        }
      }
    }, 100)
  }

  /** Buffer incoming text for the revealer instead of rendering it at once. */
  const queueStreamText = (accumulated: string) => {
    setTyping(false)
    fullRef.current = accumulated
    ensureRevealTimer()
  }

  /** The stream ended: speak the finished line, then commit once the reveal
      has caught up with the voice. */
  const finishStream = (onDone?: () => void) => {
    streamDoneRef.current = true
    finishAtRef.current = Date.now()
    onRevealDoneRef.current = () => {
      onRevealDoneRef.current = () => {}
      onDone?.()
    }
    ensureRevealTimer()
  }

  /** Replace the draft bubble with the final reply. */
  const commitStreamDraft = (full: string) => {
    setMsgs(p => {
      const last = p[p.length - 1]
      if (last?.role === 'assistant' && last.content === streamingDraft.current) {
        const copy = [...p]
        copy[copy.length - 1] = { ...last, content: full }
        return copy
      }
      return [...p, { role: 'assistant', content: full, time: new Date(), step }]
    })
    streamingDraft.current = ''
  }

  const finish = () => {
    onComplete(
      generateFeedbackReport(
        msgs.map(m => ({ role: m.role, content: m.content, step: m.step as VisitStep | undefined })),
        config
      )
    )
  }

  // Expose the end-of-visit hand-off to the earlier effects (timer wrap-up).
  onCompleteRef.current = () => {
    if (step === 'completed') return
    setStep('completed')
    finish()
  }

  const send = async () => {
    if (!input.trim() || typing || step === 'completed') return
    const m = input.trim()
    setMsgs(p => [...p, { role: 'user', content: m, time: new Date(), step }])
    // The candidate has introduced himself: the visit clock starts now.
    setHasIntroduced(true)
    setInput('')
    setTyping(true)

    if (!demo && sid) {
      try {
        // Streamed REST turn: NDJSON frames {token} … {reply_end}.
        const res = await fetch(`${API}/api/v1/chat/stream`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            session_id: sid,
            message: m,
            mode: 'training',
            level: config.level,
            visit_format: config.format,
            product_focus: config.product || undefined,
            doctor_profile: { style: config.style },
            time_elapsed: elapsed,
            time_budget: FORMAT_BUDGET[config.format] ?? 240
          })
        })
        if (!res.ok || !res.body) throw new Error(String(res.status))

        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buf = ''
        let full = ''
        for (;;) {
          const { done, value } = await reader.read()
          if (done) break
          buf += decoder.decode(value, { stream: true })
          const lines = buf.split('\n')
          buf = lines.pop() || ''
          for (const line of lines) {
            if (!line.trim()) continue
            try {
              const frame = JSON.parse(line)
              if (frame.type === 'token' && frame.value) {
                full += frame.value
                // Buffer it: the revealer drips it out word by word.
                queueStreamText(full)
              } else if (frame.type === 'reply_end') {
                if (frame.current_step) setStep(frame.current_step)
                if (frame.interrupted) break
              } else if (frame.type === 'error') {
                throw new Error(frame.message || 'chat_failed')
              }
            } catch {
              /* malformed line - skip */
            }
          }
        }

        setTyping(false)
        // The voice starts now; the subtitle reveals itself following the
        // playback position, then the line is committed when both are done.
        if (!voice.muted) void voice.speak(full)
        finishStream(() => {
          commitStreamDraft(full)
          revealedRef.current = ''
          fullRef.current = ''
          streamDoneRef.current = false
        })
        return
      } catch {}
    }

    // Demo fallback simulation
    setTimeout(() => {
      setTyping(false)
      setMsgs(p => [...p, { role: 'assistant', content: demoReply(m), time: new Date() }])
      const i = STEPS.indexOf(step)
      if (i < STEPS.length - 1) {
        setStep(STEPS[i + 1])
        setScore(s => Math.min(10, s + 1.2))
      } else if (step === 'conclusion') {
        setStep('completed')
        setMsgs(p => [
          ...p,
          {
            role: 'assistant',
            content: 'Session terminée avec succès !\n\nCliquez sur « Voir mon feedback structuré » pour découvrir vos points forts et vos axes d\'amélioration.',
            time: new Date(),
            step: 'completed'
          }
        ])
      }
    }, 800)
  }

  if (splash) {
    return <Splash onDone={() => setSplash(false)} onMicReady={s => { micStreamRef.current = s }} />
  }

  const mins = String(Math.floor(remaining / 60)).padStart(2, '0')
  const secs = String(remaining % 60).padStart(2, '0')
  const stepIndex = STEPS.indexOf(step)

  /** Manual step advance — the ONLY way a step changes now. */
  /** Time-driven progression: the visit step follows the header bars, which
      fill with the countdown. No manual button — the timer decides.
      Plain function on purpose: this lives after the splash early-return, so
      it must not be a hook. */
  const syncStepToTimer = async (target: Step) => {
    if (!sid || demo) return
    try {
      const r = await apiFetch<{ current_step: Step }>(`/api/v1/session/${sid}/advance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target,
          time_elapsed: elapsed,
          time_budget: FORMAT_BUDGET[config.format] ?? 240
        })
      })
      setStep(r.current_step)
    } catch {}
  }


  return (
    <div className='fixed inset-0 z-40 bg-background overflow-hidden flex flex-col'>
      {/* ── Top bar : brand · visit steps · timer (floating on the canvas) ── */}
      <header className='pl-8 pr-6 pt-5 flex items-center justify-between gap-4 shrink-0 relative'>
        <button
          onClick={onBack}
          className='flex items-center gap-2 shrink-0 group'
          title='Retour à la configuration'
        >
          <span className='text-2xl font-extrabold tracking-tight text-foreground group-hover:text-primary transition-colors'>
            ALIA<span className='text-primary'>.</span>
          </span>
        </button>

        {/* Visit step tabs — micro1-style centered labels with progress bars */}
        <nav className='hidden md:flex items-start gap-4 absolute left-1/2 -translate-x-1/2'>
          {STEPS.map((s, i) => {
            const isActive = s === step
            const fill = step === 'completed' ? 1 : stepFill(i)
            const isTimeStep = timeStepIndex === i
            return (
              <div key={s} className='flex flex-col items-center gap-1 w-20 min-w-0' title={STEP_LABELS[s].label}>
                <span
                  className={`block text-[13px] truncate ${
                    isActive ? 'text-foreground font-semibold' : isTimeStep ? 'text-foreground/80' : 'text-muted-foreground/50'
                  }`}
                >
                  {STEP_LABELS[s].label}
                </span>
                {/* Bar fills with the countdown — Introduction starts empty. */}
                <span className='relative block h-1.5 w-full rounded-full bg-border overflow-hidden'>
                  <span
                    className={`absolute inset-y-0 left-0 rounded-full ${isActive ? 'bg-primary' : 'bg-primary/50'}`}
                    style={{ width: `${fill * 100}%`, transition: 'width 1s linear' }}
                  />
                </span>
              </div>
            )
          })}
        </nav>

        <div className='flex items-center gap-2.5 shrink-0'>
          <span
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-card text-base font-semibold tabular-nums ${
              timeUp ? 'text-destructive' : timeWarning ? 'text-amber-500 animate-pulse' : 'text-foreground'
            }`}
            style={{ boxShadow: 'rgba(0, 0, 0, 0.08) 0px 2px 10px 0px' }}
            title={`Budget : ${budget / 60} min (${config.format})`}
          >
            <Clock className={`size-4 ${timeUp ? 'text-destructive' : timeWarning ? 'text-amber-500' : 'text-primary'}`} />
            {mins}:{secs}
          </span>
        </div>
      </header>

      {/* ── Connection status pill (micro1-style, under the brand) ── */}
      <div className='w-full pl-8 fixed top-[76px] z-50 flex justify-start items-center'>
        <div className='group relative'>
          <div
            data-testid='connection-status'
            className='hover:bg-accent flex items-center gap-[5px] text-[13px] text-foreground py-1 px-1.5 rounded cursor-pointer'
          >
            <span
              className='w-2 h-2 rounded-full'
              style={{ background: demo ? 'rgb(245, 158, 11)' : wsStatus === 'connected' ? 'rgb(0, 156, 32)' : 'rgb(156, 163, 175)' }}
            />
          </div>
          <div
            className='absolute w-[189px] bg-popover rounded-lg px-2.5 py-2 text-[13px] text-popover-foreground top-[35px] left-0 translate-x-[15%] opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none z-50'
            style={{ boxShadow: 'rgba(0, 0, 0, 0.15) 0px 2px 14px 0px' }}
          >
            {demo
              ? "Mode démo — le serveur d'entretien n'est pas joignable."
              : wsStatus === 'connected'
                ? "Vous êtes connecté au serveur d'entretien parfaitement ;)"
                : "Connexion au serveur d'entretien…"}
          </div>
        </div>

        {/* Product the visit is built around — the trainee's own choice. */}
        {config.product && (
          <span className='ml-3 inline-flex items-center gap-1.5 rounded-full bg-card/80 backdrop-blur border border-border px-3 py-1 text-[12px] text-muted-foreground'>
            <Pill className='size-3.5 text-primary' />
            {config.product}
          </span>
        )}
      </div>

      {/* ── Canvas : orb · reply ── */}
      <div className='flex-1 grid grid-cols-12 min-h-0 relative pt-10'>
        <aside className='hidden md:flex col-span-4 flex-col pl-8 pr-2 pb-6 min-h-0'></aside>

        {/* Bottom-left cluster : text input + mic row + camera rectangle */}
        <div className='fixed bottom-6 left-8 z-40 w-72 flex flex-col gap-2'>
          <form
            onSubmit={e => { e.preventDefault(); send() }}
            className='rounded-2xl border border-white bg-card/70 px-3 py-2 flex items-center gap-2 shrink-0'
          >
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder='Écrivez au médecin…'
              disabled={demo || typing || step === 'completed'}
              className='flex-1 min-w-0 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/60 outline-none disabled:opacity-50'
            />
            <button
              type='submit'
              disabled={!input.trim() || demo || typing || step === 'completed'}
              title='Envoyer'
              className='size-7 rounded-lg flex items-center justify-center bg-primary text-primary-foreground hover:bg-primary/90 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shrink-0'
            >
              <Send className='size-3.5' />
            </button>
          </form>

          <div className='rounded-2xl border border-white bg-card/70 px-4 py-3.5 flex items-center gap-2 shrink-0'>
            <span className='text-[15px] text-foreground'>Mic:</span>
            <button
              type='button'
              onClick={voice.toggleRecording}
              disabled={!voice.sttAvailable || demo || voice.busy}
              title={voice.sttAvailable ? 'Parler à ALIA' : `Dictée indisponible (${voice.providers?.stt.env ?? 'clé STT manquante'})`}
              className='flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed'
            >
              {voice.recording ? <MicOff className='size-4 text-destructive' /> : <Mic className='size-4' />}
              <span className='text-xs tracking-widest'>{voice.recording ? '●●●' : '- - - - -'}</span>
            </button>
            <button
              type='button'
              onClick={voice.toggleMuted}
              disabled={!voice.ttsAvailable}
              title={voice.muted ? "Réactiver la voix d'ALIA" : "Couper la voix d'ALIA"}
              className='ml-auto size-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed'
            >
              {voice.muted ? <VolumeX className='size-4' /> : <Volume2 className='size-4' />}
            </button>
            <ChevronDown className='size-4 text-muted-foreground' />
          </div>

          {/* Camera panel — 16:9 */}
          <div className='w-72 aspect-[16/11] rounded-2xl border border-white bg-card/40 overflow-hidden shadow-2xl relative'>
            {camError && (
              <div className='absolute top-3 left-3 right-3 z-10 flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-foreground'>
                <AlertCircle className='size-3.5 text-destructive shrink-0 mt-0.5' />
                <span className='flex-1 leading-snug'>{camError}</span>
                <button
                  type='button'
                  onClick={() => setCamError(null)}
                  className='shrink-0 text-muted-foreground hover:text-foreground cursor-pointer'
                >
                  ✕
                </button>
              </div>
            )}
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={`absolute inset-0 size-full object-cover ${camOn ? 'opacity-100' : 'opacity-0'}`}
            />
            {!camOn && (
              <button
                type='button'
                onClick={toggleCamera}
                className='absolute inset-0 flex flex-col items-center justify-center gap-3 text-muted-foreground hover:text-foreground transition-colors cursor-pointer group'
              >
                <span className='size-16 rounded-full border border-border bg-background/60 flex items-center justify-center group-hover:border-primary/50 group-hover:scale-105 transition-all'>
                  <Video className='size-7' />
                </span>
                <span className='text-sm font-medium'>Activer la caméra</span>
                <span className='text-xs text-muted-foreground/70'>Votre analyse non verbale sera évaluée</span>
              </button>
            )}
            {camOn && (
              <button
                type='button'
                onClick={toggleCamera}
                title='Couper la caméra'
                className='absolute bottom-3 right-3 size-9 rounded-full bg-background/70 backdrop-blur flex items-center justify-center text-foreground hover:text-destructive transition-colors cursor-pointer'
              >
                <VideoOff className='size-4' />
              </button>
            )}
          </div>
        </div>

        {/* Center : the orb */}
        <div className='hidden md:flex col-span-4 items-center justify-center'>
          <AvatarOrb size='lg' />
        </div>

        {/* Right : the CURRENT spoken statement (Zara-style subtitle).
            Fixed height, scrolls internally if a statement is long — the page
            itself never scrolls. */}
        <div className='hidden md:flex col-span-4 items-center justify-center pr-10 pl-2 min-h-0'>
          <div className='max-h-[46vh] overflow-y-auto px-2'>
            <p className='text-xl text-foreground text-center leading-relaxed whitespace-pre-wrap max-w-md'>
              {currentReply || 'Je vous écoute.'}
            </p>
          </div>
        </div>
      </div>

      {/* Having trouble ? — bottom right, micro1-style (raised on narrow screens so it clears the composer) */}
      <div className='fixed bottom-24 md:bottom-6 right-6 z-50 flex flex-col items-end gap-2'>
        {showHelp && (
          <div className='rounded-xl bg-popover p-4 w-72 space-y-2 text-sm' style={{ boxShadow: 'rgba(0, 0, 0, 0.15) 0px 2px 14px 0px' }}>
            <p className='font-semibold text-foreground'>Besoin d'aide ?</p>
            <p className='text-xs text-muted-foreground leading-relaxed'>
              Voici quelques ressources pour vous accompagner pendant l'entretien.
            </p>
            {/* Troubleshooting: the trainee can tell us what ALIA got wrong,
                with the whole session context attached. */}
            <button
              onClick={() => {
                setShowHelp(false)
                setShowReport(true)
              }}
              className='flex items-center gap-2 w-full px-3 py-2 rounded-lg border border-primary/40 bg-primary/10 text-xs font-medium text-foreground hover:bg-primary/20 transition-colors cursor-pointer'
            >
              <Flag className='size-3.5 text-primary' /> Signaler un problème / Feedback
            </button>
            {/* Help resources open in a new tab: leaving this page would
                abandon the visit running behind it. */}
            <Link
              href='/documentation'
              target='_blank'
              rel='noopener noreferrer'
              className='flex items-center gap-2 w-full px-3 py-2 rounded-lg border border-border text-xs font-medium text-foreground hover:bg-accent transition-colors'
            >
              <BookOpen className='size-3.5 text-primary' /> Consulter la documentation
            </Link>
            <Link
              href='/support'
              target='_blank'
              rel='noopener noreferrer'
              className='flex items-center gap-2 w-full px-3 py-2 rounded-lg border border-border text-xs font-medium text-foreground hover:bg-accent transition-colors'
            >
              <MessageCircleQuestion className='size-3.5 text-primary' /> Contacter le support
            </Link>
            {/* Ending / restarting the visit is deliberately NOT offered here:
                it only shows up after a problem has actually been reported (in
                the dialog below), so a trainee cannot drop the session on a
                whim. The visit still completes on its own at 00:00. */}
          </div>
        )}
        <button
          onClick={() => setShowHelp(h => !h)}
          className='inline-flex items-center gap-2 px-4 py-2 rounded-full bg-card text-[13px] font-medium text-foreground transition-colors cursor-pointer'
          style={{ boxShadow: 'rgba(0, 0, 0, 0.15) 0px 2px 14px 0px' }}
        >
          <HelpCircle className='size-4 text-primary' /> Having trouble?
        </button>
      </div>

      {/* ── Problem report / feedback dialog ── */}
      {showReport && (
        <div
          className='fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4'
          onClick={() => setShowReport(false)}
          role='presentation'
        >
          <div
            role='dialog'
            aria-modal='true'
            aria-label='Signaler un problème'
            className='w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-xl border border-border bg-card shadow-2xl'
            onClick={e => e.stopPropagation()}
          >
            <div className='flex items-start justify-between gap-4 border-b border-border px-5 py-4'>
              <div>
                <p className='text-sm font-semibold'>Aider ALIA à s’améliorer</p>
                <p className='text-xs text-muted-foreground'>
                  Signalez un problème rencontré pendant l’entretien, ou proposez une amélioration.
                </p>
              </div>
              <button
                onClick={() => setShowReport(false)}
                aria-label='Fermer'
                className='shrink-0 rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors cursor-pointer'
              >
                <X className='size-4' />
              </button>
            </div>
            <div className='px-5 py-4'>
              <SupportReportForm
                compact
                context={{
                  session_id: sid ?? undefined,
                  level: config.level,
                  visit_format: config.format,
                  doctor_style: config.style,
                  product_focus: config.product || undefined,
                  step
                }}
                onSubmitted={() => setReported(true)}
              />

              {/* Only once a problem has been reported does the way out
                  appear — the app is broken, so the trainee must not be
                  trapped in it. */}
              {reported && (
                <div className='mt-4 space-y-2 border-t border-border pt-4'>
                  <p className='text-xs text-muted-foreground'>
                    Le problème vous empêche de continuer ? Vous pouvez repartir de zéro :
                  </p>
                  <button
                    onClick={() => {
                      setShowReport(false)
                      onBack()
                    }}
                    className='flex items-center gap-2 w-full px-3 py-2 rounded-lg border border-border text-xs font-medium text-foreground hover:bg-accent transition-colors cursor-pointer'
                  >
                    <RotateCcw className='size-3.5 text-primary' /> Recommencer la configuration
                  </button>
                  <button
                    onClick={() => {
                      setShowReport(false)
                      finish()
                    }}
                    className='flex items-center gap-2 w-full px-3 py-2 rounded-lg border border-border text-xs font-medium text-foreground hover:bg-accent transition-colors cursor-pointer'
                  >
                    <CheckCircle2 className='size-3.5 text-primary' /> Terminer la visite
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── PHASE 3 : structured feedback ──────────────────────────────────────────
// ── PHASE 2.5 : thank-you screen (rating + optional feedback form) ────────
function ThanksView({
  config,
  sessionId,
  onDash,
  onRestart
}: {
  config: Config
  sessionId: string | null
  onDash: () => void
  onRestart: () => void
}) {
  const [rating, setRating] = useState(0)
  const [hovered, setHovered] = useState(0)
  const [comment, setComment] = useState('')
  const [recommand, setRecommand] = useState<boolean | null>(null)
  const [saved, setSaved] = useState(false)
  const [sending, setSending] = useState(false)

  const levelName = LEVELS.find(l => l.id === config.level)?.name ?? config.level
  const styleName = STYLES.find(s => s.id === config.style)?.name ?? config.style

  /** Save the feedback (optional — the delegate may skip straight out). */
  const save = async (goToDash: boolean) => {
    setSending(true)
    const payload = {
      rating,
      comment,
      would_recommend: recommand,
      level: config.level,
      visit_format: config.format
    }
    try {
      if (sessionId) {
        await fetch(`${API}/api/v1/session/${sessionId}/feedback`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        })
      }
    } catch {
      // Offline / demo: keep it locally so nothing the trainee wrote is lost.
      try {
        const key = 'alia-session-feedback'
        const prev = JSON.parse(localStorage.getItem(key) || '[]')
        prev.push({ ...payload, session_id: sessionId, saved_at: new Date().toISOString() })
        localStorage.setItem(key, JSON.stringify(prev))
      } catch { /* storage unavailable */ }
    }
    setSending(false)
    setSaved(true)
    if (goToDash) setTimeout(onDash, 900)
  }

  return (
    <div className='fixed inset-0 z-40 bg-background overflow-y-auto'>
      <div className='max-w-2xl mx-auto px-6 py-16 flex flex-col items-center text-center'>
        {/* Celebration mark */}
        <div className='relative mb-6'>
          <span
            className='absolute inset-0 rounded-full blur-xl animate-ping'
            style={{ background: 'oklch(0.60 0.16 160)', opacity: 0.25, animationDuration: '2.6s' }}
          />
          <div className='relative size-20 rounded-full bg-primary/15 border border-primary/40 flex items-center justify-center'>
            <CheckCircle2 className='size-10 text-primary' />
          </div>
        </div>

        <h1 className='text-3xl font-bold text-foreground'>Merci !</h1>
        <p className='mt-3 text-muted-foreground leading-relaxed'>
          Votre simulation <span className='text-foreground font-medium'>{levelName} · {styleName}</span> a bien été
          enregistrée.
        </p>
        <p className='mt-2 text-sm text-muted-foreground/80 leading-relaxed max-w-lg'>
          Votre évaluation détaillée sera analysée par votre responsable — elle n'est pas affichée ici. Si vous le
          souhaitez, laissez-nous votre ressenti sur la session, c'est facultatif.
        </p>

        {/* ── Rating ── */}
        <div className='mt-10 w-full rounded-2xl border border-border bg-card/60 backdrop-blur p-6'>
          <p className='text-sm font-semibold text-foreground'>Comment évaluez-vous cette session ?</p>
          <div className='mt-4 flex items-center justify-center gap-2' onMouseLeave={() => setHovered(0)}>
            {[1, 2, 3, 4, 5].map(n => {
              const filled = n <= (hovered || rating)
              return (
                <button
                  key={n}
                  type='button'
                  onMouseEnter={() => setHovered(n)}
                  onClick={() => setRating(n)}
                  title={`${n} / 5`}
                  className='p-1 cursor-pointer transition-transform hover:scale-110'
                >
                  <Star
                    className={`size-9 ${filled ? 'text-amber-400 fill-amber-400' : 'text-muted-foreground/40'}`}
                  />
                </button>
              )
            })}
          </div>
          <p className='mt-2 text-xs text-muted-foreground'>
            {rating === 0 ? 'Facultatif — cliquez sur les étoiles pour noter' : `${rating} / 5`}
          </p>

          {rating > 0 && (
            <div className='mt-6 space-y-4 text-left'>
              <div>
                <label className='text-xs font-medium text-foreground'>Recommandriez-vous ALIA à un collègue ?</label>
                <div className='mt-2 flex gap-2'>
                  {[
                    { v: true, label: 'Oui' },
                    { v: false, label: 'Pas encore' }
                  ].map(o => (
                    <button
                      key={String(o.v)}
                      type='button'
                      onClick={() => setRecommand(o.v)}
                      className={`px-4 py-2 rounded-xl border text-xs font-medium transition-colors cursor-pointer ${
                        recommand === o.v
                          ? 'border-primary bg-primary/15 text-foreground'
                          : 'border-border text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className='text-xs font-medium text-foreground'>Un commentaire ? (facultatif)</label>
                <textarea
                  value={comment}
                  onChange={e => setComment(e.target.value)}
                  rows={3}
                  placeholder='Ce qui vous a aidé, ce qui manque…'
                  className='mt-2 w-full rounded-xl border border-border bg-background/60 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 outline-none resize-none focus:border-primary/60'
                />
              </div>
            </div>
          )}

          {saved && (
            <p className='mt-4 text-xs text-primary flex items-center justify-center gap-1.5'>
              <CheckCircle2 className='size-3.5' /> Merci, votre retour a été enregistré.
            </p>
          )}
        </div>

        {/* ── Actions ── */}
        <div className='mt-8 flex flex-col sm:flex-row items-center gap-3'>
          {rating > 0 && !saved ? (
            <button
              onClick={() => void save(true)}
              disabled={sending}
              className='px-6 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors cursor-pointer disabled:opacity-50'
            >
              {sending ? 'Envoi…' : 'Envoyer mon retour'}
            </button>
          ) : null}
          <button
            onClick={() => (rating > 0 && !saved ? void save(true) : onDash())}
            className={`px-6 py-3 rounded-xl text-sm font-semibold transition-colors cursor-pointer ${
              rating > 0 && !saved
                ? 'border border-border text-foreground hover:bg-accent'
                : 'bg-primary text-primary-foreground hover:bg-primary/90'
            }`}
          >
            {rating > 0 && !saved ? 'Passer' : 'Terminer'}
          </button>
          <button
            onClick={onRestart}
            className='px-4 py-3 rounded-xl text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer'
          >
            Nouvelle simulation
          </button>
        </div>

        <p className='mt-6 text-xs text-muted-foreground/70'>
          Merci pour votre participation. À bientôt pour une prochaine session !
        </p>
      </div>
    </div>
  )
}

function FeedbackView({
  report,
  config,
  onBack,
  onQA,
  onRestart,
  onDash
}: {
  report: ZaraFeedback
  config: Config
  onBack: () => void
  onQA: () => void
  onRestart: () => void
  onDash: () => void
}) {
  const styleName = STYLES.find(s => s.id === config.style)?.name
  const levelName = LEVELS.find(l => l.id === config.level)?.name

  return (
    <div className='w-full max-w-6xl mx-auto py-16 space-y-6'>
      <PhaseProgress current='feedback' onNavigate={v => (v === 'chat' ? onBack() : v === 'qa' ? onQA() : v === 'setup' ? onRestart() : undefined)} />

      {/* Header */}
      <div className='flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-6'>
        <div className='flex items-center gap-4'>
          <div className='size-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shadow-sm'>
            <FileText className='size-7' />
          </div>
          <div>
            <h1 className='text-2xl font-bold tracking-tight text-foreground'>Feedback Structuré de la Session</h1>
            <p className='text-sm text-muted-foreground'>
              Généré en chaîne de raisonnement — points forts et axes d'amélioration spécifiques à votre visite
            </p>
          </div>
        </div>
        <div className='flex flex-wrap gap-2'>
          <span className='text-xs font-semibold px-2.5 py-1 rounded-full bg-primary/10 text-primary'>{styleName}</span>
          <span className='text-xs font-semibold px-2.5 py-1 rounded-full bg-muted text-muted-foreground'>Niveau {levelName}</span>
          <span className='text-xs font-semibold px-2.5 py-1 rounded-full bg-muted text-muted-foreground'>Format {config.format}</span>
        </div>
      </div>

      {/* Overall score */}
      <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
        <div className='bg-card rounded-2xl p-6 border border-border shadow-sm flex flex-col justify-center'>
          <p className='text-xs uppercase font-semibold text-muted-foreground'>Score Global</p>
          <p className='text-5xl font-bold text-primary mt-2'>{report.overall.toFixed(1)}<span className='text-xl text-muted-foreground font-medium'>/10</span></p>
          <p className='text-xs text-muted-foreground mt-2'>
            {report.overall >= 8 ? 'Excellent niveau — continuez ainsi.' : report.overall >= 6.5 ? 'Bon niveau — quelques axes à travailler.' : 'Base solide — concentrez-vous sur les axes ci-dessous.'}
          </p>
        </div>

        <div className='md:col-span-2 bg-card rounded-2xl p-6 border border-border shadow-sm'>
          <p className='text-xs uppercase font-semibold text-muted-foreground mb-4'>Performance par Étape de la Visite</p>
          <div className='space-y-3.5'>
            {report.step_scores.map(s => (
              <div key={s.step}>
                <div className='flex justify-between text-xs font-medium mb-1'>
                  <span className='text-foreground'>{s.label}</span>
                  <span className={`font-bold ${s.score >= 8 ? 'text-primary' : s.score >= 6 ? 'text-amber-500' : 'text-destructive'}`}>
                    {s.score.toFixed(1)}/10
                  </span>
                </div>
                <div className='w-full h-2 bg-muted rounded-full overflow-hidden'>
                  <div
                    className='h-full rounded-full transition-all'
                    style={{ width: `${(s.score / 10) * 100}%`, backgroundColor: STEP_LABELS[s.step].color }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Strengths & improvement areas (Zara JSON structure) */}
      <div className='grid grid-cols-1 lg:grid-cols-2 gap-4'>
        <section className='bg-card rounded-2xl p-6 border border-border shadow-sm space-y-4'>
          <div className='flex items-center gap-2'>
            <div className='size-9 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center'>
              <CheckCircle2 className='size-5' />
            </div>
            <div>
              <h2 className='text-base font-semibold text-foreground'>Points forts</h2>
              <p className='text-xs text-muted-foreground'>{report.strengths.length} forces identifiées dans votre visite</p>
            </div>
          </div>
          {report.strengths.map((s, i) => (
            <div key={i} className='rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 space-y-1'>
              <p className='text-sm font-semibold text-foreground flex items-center gap-2'>
                <span className='size-5 rounded-full bg-emerald-500/15 text-emerald-500 flex items-center justify-center text-[10px] font-bold shrink-0'>{i + 1}</span>
                {s.title}
              </p>
              <p className='text-sm text-muted-foreground leading-relaxed'>{s.detail}</p>
            </div>
          ))}
        </section>

        <section className='bg-card rounded-2xl p-6 border border-border shadow-sm space-y-4'>
          <div className='flex items-center gap-2'>
            <div className='size-9 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center'>
              <Lightbulb className='size-5' />
            </div>
            <div>
              <h2 className='text-base font-semibold text-foreground'>Axes d'amélioration</h2>
              <p className='text-xs text-muted-foreground'>Conseils constructifs et actionnables</p>
            </div>
          </div>
          {report.areas_for_improvement.map((s, i) => (
            <div key={i} className='rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 space-y-1'>
              <p className='text-sm font-semibold text-foreground flex items-center gap-2'>
                <span className='size-5 rounded-full bg-amber-500/15 text-amber-500 flex items-center justify-center text-[10px] font-bold shrink-0'>{i + 1}</span>
                {s.title}
              </p>
              <p className='text-sm text-muted-foreground leading-relaxed'>{s.detail}</p>
            </div>
          ))}
        </section>
      </div>

      <p className='text-xs text-muted-foreground border-l-2 border-primary/30 pl-3'>
        Approche inspirée de <span className='font-medium text-foreground'>Zara (micro1)</span> — « Zara: An LLM-based Candidate Interview Feedback System » (arXiv:2507.02869) : feedback généré en chaîne de raisonnement, 2-3 forces et 2-3 axes, chacun avec titre et conseil spécifique.
      </p>

      {/* Actions */}
      <div className='flex flex-wrap items-center gap-3'>
        <button
          onClick={onQA}
          className='inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-colors cursor-pointer'
        >
          <MessageCircleQuestion className='size-4' /> Poser une question
        </button>
        <button
          onClick={onRestart}
          className='inline-flex items-center gap-2 px-5 py-3 rounded-xl border border-border bg-card text-foreground font-medium text-sm hover:bg-accent transition-colors cursor-pointer'
        >
          <RotateCcw className='size-4' /> Nouvelle session
        </button>
        <button
          onClick={onDash}
          className='inline-flex items-center gap-2 px-5 py-3 rounded-xl border border-border bg-card text-foreground font-medium text-sm hover:bg-accent transition-colors cursor-pointer'
        >
          <BarChart3 className='size-4' /> Tableau de bord
        </button>
      </div>
    </div>
  )
}

// ── PHASE 4 : query resolution (RAG-style) ─────────────────────────────────
function QAView({
  config,
  onBack,
  onRestart
}: {
  config: Config
  onBack: () => void
  onRestart: () => void
}) {
  const [q, setQ] = useState('')
  const [history, setHistory] = useState<{ q: string; topic: string | null; answer: string; source: string | null; confidence: number | null }[]>([])

  const ask = (text: string) => {
    const t = text.trim()
    if (!t) return
    const res = faqSearch(t)
    setHistory(p => [
      ...p,
      res
        ? { q: t, topic: res.topic, answer: res.answer, source: res.source, confidence: res.confidence }
        : {
            q: t,
            topic: null,
            answer:
              'Je n\'ai pas trouvé de réponse fiable dans la base documentaire pour cette question. Consultez la page Support pour contacter l\'équipe ALIA, ou parcourez la Documentation (scripts de visite, techniques de vente, référentiel de compétences).',
            source: null,
            confidence: null
          }
    ])
    setQ('')
  }

  return (
    <div className='w-full max-w-5xl mx-auto py-16 space-y-6'>
      <PhaseProgress current='qa' onNavigate={v => (v === 'feedback' ? onBack() : v === 'setup' ? onRestart() : undefined)} />

      {/* Header */}
      <div className='flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-6'>
        <div className='flex items-center gap-4'>
          <div className='size-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shadow-sm'>
            <MessageCircleQuestion className='size-7' />
          </div>
          <div>
            <h1 className='text-2xl font-bold tracking-tight text-foreground'>Questions & Assistance</h1>
            <p className='text-sm text-muted-foreground'>
              Réponses automatiques issues de la base documentaire ALIA — seules les correspondances fiables déclenchent une réponse (approche RAG de Zara)
            </p>
          </div>
        </div>
        <div className='flex gap-2'>
          <button
            onClick={onBack}
            className='inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-xl border border-border bg-card hover:bg-accent text-foreground transition-colors cursor-pointer'
          >
            <ArrowLeft className='size-3.5' /> Feedback
          </button>
          <button
            onClick={onRestart}
            className='inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-xl border border-border bg-card hover:bg-accent text-foreground transition-colors cursor-pointer'
          >
            <RotateCcw className='size-3.5' /> Nouvelle session
          </button>
        </div>
      </div>

      {/* Search */}
      <div className='bg-card rounded-2xl p-5 border border-border shadow-sm space-y-4'>
        <form
          onSubmit={e => {
            e.preventDefault()
            ask(q)
          }}
          className='flex items-center gap-3'
        >
          <div className='relative flex-1'>
            <HelpCircle className='size-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground' />
            <input
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder='Ex : comment gérer les objections sur le prix ?'
              className='w-full pl-10 pr-4 py-3 rounded-xl bg-background border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm'
            />
          </div>
          <button
            type='submit'
            disabled={!q.trim()}
            className='px-5 py-3 rounded-xl bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center gap-2 cursor-pointer'
          >
            <Send className='size-4' /> Poser
          </button>
        </form>

        <div className='flex flex-wrap items-center gap-2'>
          <span className='text-xs font-semibold uppercase tracking-wider text-muted-foreground'>Sujets :</span>
          {faqTopics.map(t => (
            <button
              key={t.id}
              onClick={() => ask(t.label)}
              className='text-xs font-medium px-3 py-1.5 rounded-full border border-border bg-muted/40 text-foreground hover:bg-primary/10 hover:border-primary/30 transition-colors cursor-pointer'
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Q&A history */}
      <div className='space-y-4'>
        {history.length === 0 && (
          <div className='rounded-2xl border border-dashed border-border p-10 text-center'>
            <BookOpen className='size-8 mx-auto text-muted-foreground/50' />
            <p className='text-sm text-muted-foreground mt-3'>Posez une question sur la visite médicale, les techniques de vente ou le scoring.</p>
          </div>
        )}
        {history.map((h, i) => (
          <div key={i} className='space-y-2.5'>
            <div className='flex justify-end'>
              <div className='max-w-[80%] bg-primary text-primary-foreground rounded-2xl rounded-br-none px-4 py-2.5 text-sm shadow-sm'>
                {h.q}
              </div>
            </div>
            <div className='bg-card rounded-2xl rounded-bl-none border border-border px-5 py-4 shadow-sm space-y-2'>
              <div className='flex items-center gap-2 flex-wrap'>
                {h.topic && (
                  <span className='text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-primary/10 text-primary'>{h.topic}</span>
                )}
                {h.confidence !== null ? (
                  <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${h.confidence >= 50 ? 'bg-emerald-500/10 text-emerald-600' : 'bg-amber-500/10 text-amber-600'}`}>
                    Confiance {h.confidence}%
                  </span>
                ) : (
                  <span className='text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-muted text-muted-foreground'>Aucune correspondance fiable</span>
                )}
                {h.source && (
                  <span className='text-[11px] text-muted-foreground ml-auto'>Source : {h.source}</span>
                )}
              </div>
              <p className='text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap'>{h.answer}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── DASHBOARD COMPONENT ────────────────────────────────────────────────────
function Dashboard({ onBack }: { onBack: () => void }) {
  const [stats, setStats] = useState<any>(null)
  const [steps, setSteps] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.allSettled([
      fetch(`${API}/api/v1/dashboard/stats`).then(r => r.json()),
      fetch(`${API}/api/v1/dashboard/scores/step-analysis`).then(r => r.json())
    ])
      .then(([s, st]) => {
        if (s.status === 'fulfilled') setStats(s.value)
        if (st.status === 'fulfilled') setSteps(st.value)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const demoStats = {
    total_sessions: 24,
    average_score: 7.3,
    level_distribution: { debutant: 8, junior: 10, confirme: 5, expert: 1 }
  }

  const demoSteps: Record<string, { avg_score: number; count: number }> = {
    introduction: { avg_score: 8.2, count: 24 },
    sondage: { avg_score: 6.8, count: 22 },
    synthese: { avg_score: 7.5, count: 20 },
    objections: { avg_score: 5.9, count: 18 },
    argumentation: { avg_score: 7.1, count: 16 },
    conclusion: { avg_score: 8.0, count: 15 }
  }

  const s = stats || demoStats
  const st = steps || demoSteps

  return (
    <div className='max-w-6xl mx-auto py-4 space-y-6'>
      <div className='flex items-center justify-between'>
        <button
          onClick={onBack}
          className='inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-xl border border-border bg-card hover:bg-accent text-foreground transition-colors cursor-pointer'
        >
          <ArrowLeft className='size-4' /> Retour à la session
        </button>
        <h1 className='text-xl font-bold text-foreground'>Tableau de bord de formation</h1>
      </div>

      <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4'>
        {[
          { icon: <BarChart3 className='size-5' />, label: 'Sessions Réalisées', value: s.total_sessions },
          { icon: <Target className='size-5' />, label: 'Score Moyen', value: `${s.average_score}/10` },
          { icon: <Users className='size-5' />, label: 'Délégués Actifs', value: '24' },
          { icon: <Trophy className='size-5' />, label: 'Produits Entraînés', value: '4' }
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
        <h2 className='text-base font-semibold text-foreground'>Performance par Étape de la Visite</h2>
        <div className='space-y-4'>
          {VISIT_STEPS.map(stepKey => {
            const d = st[stepKey] || { avg_score: 0, count: 0 }
            return (
              <div key={stepKey}>
                <div className='flex justify-between text-xs font-medium mb-1.5'>
                  <span className='flex items-center gap-1.5 text-foreground'>{STEP_META[stepKey].label}</span>
                  <span
                    className={`font-bold ${
                      d.avg_score >= 8 ? 'text-primary' : d.avg_score >= 6 ? 'text-amber-500' : 'text-destructive'
                    }`}
                  >
                    {d.avg_score.toFixed(1)}/10
                  </span>
                </div>
                <div className='w-full h-2.5 bg-muted rounded-full overflow-hidden'>
                  <div
                    className='h-full rounded-full transition-all'
                    style={{ width: `${(d.avg_score / 10) * 100}%`, backgroundColor: STEP_LABELS[stepKey].color }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}