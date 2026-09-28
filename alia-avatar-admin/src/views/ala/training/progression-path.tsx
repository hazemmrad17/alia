'use client'

// ──────────────────────────────────────────────
// Progression — the delegate's learning path as a pannable skill tree.
//
// Structure, MMO-talent-tree style: four tiers (the four chapters), one aligned
// row of floating node cards each. Consecutive tiers run in opposite directions
// so every link is a short hop — right along the row, then straight down to the
// next — and the whole graph reads as a boustrophedon instead of a scatter.
//
//   · tiers are labelled on the left (name, count, progress),
//   · node cards carry a step number, an icon, the objective and the hint,
//   · link states follow the path: solid accent once the step behind is cleared,
//     dashed while it is still ahead,
//   · bonus challenges hang under their milestone as branch cards.
//
// The canvas pans by drag and recentres on the current milestone. Every state
// comes from the real saved sessions — a milestone unlocks when the best score
// reaches its target (0–10, the backend's scale).
// ──────────────────────────────────────────────

import { useEffect, useMemo, useRef, useState } from 'react'

import {
  Award,
  Boxes,
  Check,
  Compass,
  Crosshair,
  DoorOpen,
  Flame,
  Gem,
  Handshake,
  Lock,
  Medal,
  MessageSquare,
  Presentation,
  Route,
  ShieldQuestion,
  Star,
  Target,
  Timer,
  Trophy,
  Zap
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

import { getSavedSessions, ApiError } from '@/lib/alia-api'
import type { SavedSession } from '@/lib/alia-api'
import { ALL_VISIT_STEPS, STEP_META, type VisitStep } from '@/types/alia'

const LEVEL_LABELS: Record<string, string> = {
  debutant: 'Débutant',
  junior: 'Junior',
  confirme: 'Confirmé',
  expert: 'Expert'
}

// ── Chapter accents. Class strings stay literal so Tailwind keeps them
// (never build class names dynamically).
const ACCENTS = {
  sky: {
    dot: 'bg-sky-500',
    pill: 'bg-sky-500/10 text-sky-600 ring-sky-500/20 dark:text-sky-400',
    line: 'stroke-sky-500',
    filled: 'bg-sky-500 text-white'
  },
  primary: {
    dot: 'bg-primary',
    pill: 'bg-primary/10 text-primary ring-primary/20',
    line: 'stroke-primary',
    filled: 'bg-primary text-primary-foreground'
  },
  amber: {
    dot: 'bg-amber-500',
    pill: 'bg-amber-500/10 text-amber-600 ring-amber-500/20 dark:text-amber-400',
    line: 'stroke-amber-500',
    filled: 'bg-amber-500 text-amber-950'
  },
  violet: {
    dot: 'bg-violet-500',
    pill: 'bg-violet-500/10 text-violet-600 ring-violet-500/20 dark:text-violet-400',
    line: 'stroke-violet-500',
    filled: 'bg-violet-500 text-white'
  }
} as const

type AccentKey = keyof typeof ACCENTS

/** The four tiers of the tree, top to bottom. */
const REGIONS: { id: string; name: string; accent: AccentKey }[] = [
  { id: 'fondations', name: 'Les Fondations', accent: 'sky' },
  { id: 'demonstration', name: 'La Démonstration', accent: 'primary' },
  { id: 'maitrise', name: 'La Maîtrise', accent: 'amber' },
  { id: 'expertise', name: "L'Expertise", accent: 'violet' }
]

// ── Canvas layout ──
const COLS = [340, 640, 940] // the three columns every tier uses
const CARD_W = 260
const CARD_H = 124
const BRANCH_W = 230
const BRANCH_H = 64
const TIER_TOP = 180
const TIER_H = 380 // tier to tier
const HEADER_DY = 105 // tier row up to its divider rule
const BRANCH_DY = 175 // tier row down to its branch row
const CANVAS_W = 1120
const CANVAS_H = TIER_TOP + 3 * TIER_H + BRANCH_DY + BRANCH_H / 2 + 80
const VIEWPORT_H = 620

/**
 * The route, in order. Targets are on the backend's 0–10 evaluation scale
 * ("Score Global: x/10" in the scorer), so a milestone unlocks once the best
 * session score reaches its target.
 */
const MAIN: {
  id: string
  label: string
  hint: string
  target: number
  icon: LucideIcon
  region: number
  rule?: 'score' | 'expert'

  /** The visit steps this milestone is judged on — the evaluator's own breakdown. */
  focus: VisitStep[]

  /** What the delegate actually has to do. Reads in the node's detail card. */
  criteria: string[]
}[] = [
  {
    id: 'contact', label: 'Premier contact', hint: 'Terminer une première visite avec au moins 4,0/10.', target: 4, icon: MessageSquare, region: 0,
    focus: ['introduction', 'conclusion'],
    criteria: [
      'Lancer une simulation et la terminer, du premier bonjour à la sortie.',
      'Obtenir un score global ≥ 4,0/10 sur cette visite.',
      "Une visite Flash suffit : c'est le seuil qui ouvre le parcours, pas la durée."
    ]
  },
  {
    id: 'ouverture', label: "Maîtriser l'ouverture", hint: "Accueil, permission et cadre de la visite soignés.", target: 5, icon: DoorOpen, region: 0,
    focus: ['introduction'],
    criteria: [
      "Saluer, se présenter et demander la permission d'échanger quelques minutes.",
      'Annoncer le cadre : sujet de la visite, durée annoncée, accord du médecin.',
      "Obtenir un score global ≥ 5,0/10 avec une introduction au-dessus de 4,0."
    ]
  },
  {
    id: 'decouverte', label: 'Découvrir le besoin', hint: 'Score ≥ 6,0 sur la phase de découverte.', target: 6, icon: Compass, region: 0,
    focus: ['sondage', 'synthese'],
    criteria: [
      'Poser au moins trois questions ouvertes avant de parler produit.',
      "Reformuler le besoin entendu (synthèse) avant de passer à l'argumentaire.",
      'Obtenir un score global ≥ 6,0/10.'
    ]
  },
  {
    id: 'presentation', label: 'Présenter le produit', hint: "Score ≥ 6,5 sur l'argumentation produit.", target: 6.5, icon: Presentation, region: 1,
    focus: ['argumentation'],
    criteria: [
      'Annoncer le produit et son bénéfice principal en une phrase.',
      "Relier chaque argument au besoin que le médecin vient d'exprimer.",
      "Obtenir un score ≥ 6,5/10 sur la phase d'argumentation."
    ]
  },
  {
    id: 'sondage', label: 'Argumenter (SONDAGE)', hint: "Score ≥ 6,8 sur l'argumentaire SONDAGE.", target: 6.8, icon: Target, region: 1,
    focus: ['argumentation'],
    criteria: [
      "Couvrir au moins trois motivations SONDAGE (sécurité, orgueil, nouveauté, argent, confort, sympathie).",
      'Adapter le vocabulaire au profil du médecin simulé (analysant, contrôlant…).',
      'Obtenir un score ≥ 6,8/10.'
    ]
  },
  {
    id: 'objections', label: 'Gérer les objections', hint: 'Score ≥ 7,0 sur le traitement des objections.', target: 7, icon: ShieldQuestion, region: 1,
    focus: ['objections'],
    criteria: [
      "Laisser le médecin finir son objection avant de répondre.",
      "Reformuler l'objection, puis répondre avec une preuve : étude, chiffre, échantillon.",
      "Obtenir un score ≥ 7,0/10 sur le traitement des objections."
    ]
  },
  {
    id: 'convaincre', label: 'Convaincre', hint: 'Score ≥ 7,5 sur une visite complète.', target: 7.5, icon: Zap, region: 2,
    focus: ['objections', 'argumentation', 'conclusion'],
    criteria: [
      "Tenir l'échange jusqu'à la fin de la visite (aucune étape laissée de côté).",
      'Provoquer un accord explicite du médecin avant de conclure.',
      'Obtenir un score global ≥ 7,5/10.'
    ]
  },
  {
    id: 'engagement', label: "Obtenir l'engagement", hint: 'Score ≥ 8,0 et prochaine étape posée avec le médecin.', target: 8, icon: Handshake, region: 2,
    focus: ['conclusion'],
    criteria: [
      'Demander une décision claire : essai, prescription, présentation à un confrère.',
      'Fixer la prochaine étape avec une date, et la retrouver dans la fiche de visite.',
      'Obtenir un score global ≥ 8,0/10.'
    ]
  },
  {
    id: 'closing', label: 'Conclure la visite', hint: 'Score ≥ 8,5 en global.', target: 8.5, icon: Trophy, region: 2,
    focus: ['conclusion'],
    criteria: [
      "Récapituler les points d'accord avant de partir.",
      'Laisser un support et le mentionner dans la fiche de visite (matériel laissé).',
      'Obtenir un score global ≥ 8,5/10.'
    ]
  },
  {
    id: 'parfaite', label: 'Visite parfaite', hint: 'Score ≥ 9,0 en global.', target: 9, icon: Gem, region: 3,
    focus: ALL_VISIT_STEPS,
    criteria: [
      "Aucune des six étapes en dessous de 7,0/10 dans l'évaluation détaillée.",
      'Obtenir un score global ≥ 9,0/10.',
      "Mener la visite de bout en bout sans que l'avatar ait à relancer le délégué."
    ]
  },
  {
    id: 'expert', label: 'Niveau Expert', hint: 'Niveau expert atteint ou score moyen ≥ 8,5.', target: 9.2, icon: Award, region: 3, rule: 'expert',
    focus: ALL_VISIT_STEPS,
    criteria: [
      "Atteindre le niveau Expert sur votre profil délégué.",
      'Ou tenir un score moyen ≥ 8,5/10 sur vos dernières visites.',
      'Le chapitre entier doit être validé : les jalons précédents comptent aussi.'
    ]
  }
]

/**
 * The milestone targets alone — the condensed preview on the simulator hub and
 * the full tree here must always agree, so this list is the single source.
 */
export const MILESTONES = MAIN.map(({ id, label, target }) => ({ id, label, target }))

/** Optional challenges, branching off the milestone they belong to. */
const CAMPS: {
  id: string
  label: string
  hint: string
  icon: LucideIcon
  parent: string
  region: number
  rule: 'debrief' | 'produits' | 'formats' | 'assiduite' | 'endurance'

  /** What the challenge actually asks for. Reads in the node's detail card. */
  criteria: string[]
}[] = [
  {
    id: 'debrief', label: 'Laisser un retour', hint: 'Noter une visite terminée depuis la fiche de session.', icon: Star, parent: 'ouverture', region: 0, rule: 'debrief',
    criteria: [
      'Terminer une simulation, puis ouvrir sa fiche de session.',
      'Y laisser une note de 1 à 5 étoiles.',
      "Un commentaire est bienvenu — il part avec l'évaluation vers votre responsable."
    ]
  },
  {
    id: 'produits', label: 'Multi-produits', hint: 'Présenter 2 produits différents en simulation.', icon: Boxes, parent: 'presentation', region: 1, rule: 'produits',
    criteria: [
      "Choisir deux produits différents au lancement d'une simulation.",
      "Nommer le produit dans l'argumentaire, pas seulement à l'écran de départ.",
      'Deux produits distincts suffisent, en Flash comme en Standard.'
    ]
  },
  {
    id: 'formats', label: "L'explorateur", hint: 'Tester 2 formats de visite différents.', icon: Route, parent: 'objections', region: 1, rule: 'formats',
    criteria: [
      'Tester deux formats parmi Flash, Standard et Approfondie.',
      "Le format Standard est celui qui ressemble le plus à une vraie visite courte."
    ]
  },
  {
    id: 'assiduite', label: "L'assiduité", hint: "3 jours d'entraînement d'affilée, ou 5 visites au total.", icon: Flame, parent: 'engagement', region: 2, rule: 'assiduite',
    criteria: [
      "Enchaîner trois jours d'entraînement d'affilée,",
      'ou atteindre cinq visites au total — les deux comptent pareil.'
    ]
  },
  {
    id: 'endurance', label: 'Le marathon', hint: '20 minutes cumulées en simulateur.', icon: Timer, parent: 'parfaite', region: 3, rule: 'endurance',
    criteria: [
      'Cumuler 20 minutes de conversation simulée, tous formats confondus.',
      "Les visites Standard et Approfondie y arrivent plus vite qu'une Flash."
    ]
  }
]

// ── Resolve the tree once: tier rows, branch rows, then the links. ──

/** Each tier, with its nodes already in path order. */
const TIERS = REGIONS.map((_, region) => MAIN.filter((n) => n.region === region))

const POSITIONS = new Map<string, { x: number; y: number }>()

TIERS.forEach((nodes, tier) => {
  // Consecutive tiers run in opposite directions, so the drop from one row to
  // the next always lands in the same column.
  const start = tier % 2 === 0 ? 0 : COLS.length - 1
  const step = tier % 2 === 0 ? 1 : -1

  nodes.forEach((node, i) => {
    POSITIONS.set(node.id, { x: COLS[start + step * i], y: TIER_TOP + tier * TIER_H })
  })
})

for (const camp of CAMPS) {
  const parent = POSITIONS.get(camp.parent)

  if (parent) POSITIONS.set(camp.id, { x: parent.x, y: parent.y + BRANCH_DY })
}

/**
 * Every edge of the graph: along a tier, down to the next tier, out to a
 * branch. `from` is the node that opens the link; a link turns solid once that
 * node — or, for a branch, the challenge itself — is cleared.
 */
type Link = { id: string; d: string; from: string; own?: string; region: number }

const LINKS: Link[] = []

TIERS.forEach((nodes, tier) => {
  // Along the tier row, card edge to card edge.
  for (let i = 1; i < nodes.length; i++) {
    const a = POSITIONS.get(nodes[i - 1].id)!
    const b = POSITIONS.get(nodes[i].id)!
    const from = Math.min(a.x, b.x) + CARD_W / 2
    const to = Math.max(a.x, b.x) - CARD_W / 2

    LINKS.push({
      id: `${nodes[i - 1].id}-${nodes[i].id}`,
      d: `M ${from} ${a.y} H ${to}`,
      from: nodes[i - 1].id,
      region: tier
    })
  }


  // Down to the first node of the next tier (same column by construction).
  const next = TIERS[tier + 1]

  if (next) {
    const last = nodes[nodes.length - 1]
    const a = POSITIONS.get(last.id)!
    const b = POSITIONS.get(next[0].id)!

    LINKS.push({
      id: `${last.id}-${next[0].id}`,
      d: `M ${a.x} ${a.y + CARD_H / 2} V ${b.y - CARD_H / 2}`,
      from: last.id,
      region: tier
    })
  }
})

for (const camp of CAMPS) {
  const parent = POSITIONS.get(camp.parent)!
  const self = POSITIONS.get(camp.id)!

  LINKS.push({
    id: `${camp.parent}-${camp.id}`,
    d: `M ${parent.x} ${parent.y + CARD_H / 2} V ${self.y - BRANCH_H / 2}`,
    from: camp.parent,
    own: camp.id,
    region: camp.region
  })
}

/** A target reads as "6,5" in French, not "6.5". */
const fmtTarget = (value: number) => value.toFixed(1).replace('.', ',')

// XP: 1 point of score = 1 XP, floored; unscored sessions give 10 XP.
function sessionXp(s: SavedSession): number {
  return typeof s.overall_score === 'number' ? Math.round(s.overall_score) : 10
}

export default function ProgressionPath({
  sessions: sessionsProp,
  level: levelProp,
  loading: loadingProp
}: {

  /** Optional: when omitted the component fetches its own data (standalone page mode). */
  sessions?: SavedSession[]
  level?: string | null
  loading?: boolean
}) {
  // ── Standalone mode: fetch our own sessions and read the level from storage ──
  const [ownSessions, setOwnSessions] = useState<SavedSession[]>([])
  const [ownLevel, setOwnLevel] = useState<string | null>(null)
  const [ownLoading, setOwnLoading] = useState(true)
  const [ownError, setOwnError] = useState<string | null>(null)

  const standalone = sessionsProp === undefined

  useEffect(() => {
    if (!standalone) return
    let cancelled = false

    getSavedSessions(false)
      .then((data) => {
        if (cancelled) return
        setOwnSessions(data.sessions)

        try {
          const me = localStorage.getItem('alia-user')

          setOwnLevel(me ? (JSON.parse(me).current_level ?? null) : null)
        } catch {
          setOwnLevel(null)
        }
      })
      .catch((e) => {
        if (!cancelled) setOwnError(e instanceof ApiError ? e.message : 'Impossible de charger votre progression.')
      })
      .finally(() => {
        if (!cancelled) setOwnLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [standalone])

  const sessions = sessionsProp ?? ownSessions
  const level = levelProp !== undefined ? levelProp : ownLevel
  const loading = loadingProp ?? ownLoading
  const error = standalone ? ownError : null

  // ── Derived progression data ──
  const stats = useMemo(() => {
    const scored = sessions.filter((s) => typeof s.overall_score === 'number')
    const xp = sessions.reduce((sum, s) => sum + sessionXp(s), 0)
    const best = scored.length ? Math.max(...scored.map((s) => s.overall_score ?? 0)) : null

    const avg = scored.length
      ? Math.round(scored.reduce((a, s) => a + (s.overall_score ?? 0), 0) / scored.length)
      : 0

    // Streak: consecutive days (backwards from today) with at least one session.
    const now = new Date()

    const dayKeys = new Set(
      sessions.filter((s) => s.completed_at).map((s) => new Date(s.completed_at as string).toDateString())
    )

    let streak = 0

    for (let i = 0; i < 60; i++) {
      const d = new Date(now)

      d.setDate(now.getDate() - i)
      if (dayKeys.has(d.toDateString())) streak++
      else if (i > 0) break
    }

    // Milestones: done once the best score reaches the target again.
    const main = MAIN.map((node, index) => {
      const done =
        node.rule === 'expert' ? level === 'expert' || avg >= 8.5 : best !== null && best >= node.target

      // How far the delegate already is, for the node's detail card: the expert
      // milestone measures the average score and reads the level, every other
      // milestone measures the record. Its goal is 8,5 (or the expert level),
      // not the 9,2 its tree position is drawn at.
      const measured = node.rule === 'expert' ? avg : best ?? 0
      const goal = node.rule === 'expert' ? 8.5 : node.target

      return {
        ...node,
        ...POSITIONS.get(node.id)!,
        step: index + 1,
        done,
        goal,
        measured: scored.length ? measured : null,
        pct: done ? 100 : Math.min(99, Math.round((measured / goal) * 100))
      }
    })

    const currentIndex = main.findIndex((n) => !n.done)

    // Bonus challenges, each measured against something real in the history.
    const products = new Set(sessions.map((s) => s.product_focus).filter(Boolean)).size
    const formats = new Set(sessions.map((s) => s.visit_format).filter(Boolean)).size
    const minutes = Math.round(sessions.reduce((a, s) => a + (s.duration_seconds ?? 0), 0) / 60)

    const camps = CAMPS.map((node) => {
      const done =
        node.rule === 'debrief'
          ? sessions.some((s) => s.has_feedback)
          : node.rule === 'produits'
            ? products >= 2
            : node.rule === 'formats'
              ? formats >= 2
              : node.rule === 'assiduite'
                ? streak >= 3 || sessions.length >= 5
                : minutes >= 20

      const detail =
        node.rule === 'debrief'
          ? `${sessions.filter((s) => s.has_feedback).length} retour(s)`
          : node.rule === 'produits'
            ? `${products}/2 produits`
            : node.rule === 'formats'
              ? `${formats}/2 formats`
              : node.rule === 'assiduite'
                ? `${streak}j d'affilée`
                : `${minutes}/20 min`

      const total = node.rule === 'produits' || node.rule === 'formats' ? 2 : node.rule === 'endurance' ? 20 : node.rule === 'assiduite' ? 3 : 1

      const value =
        node.rule === 'debrief'
          ? sessions.filter((s) => s.has_feedback).length
          : node.rule === 'produits'
            ? products
            : node.rule === 'formats'
              ? formats
              : node.rule === 'assiduite'
                ? Math.max(streak, sessions.length)
                : minutes

      // The card is only 230px wide, so it shows `detail`; the detail card spells
      // the same measurement out in full.
      const progressText =
        node.rule === 'debrief'
          ? `${sessions.filter((s) => s.has_feedback).length}/1 retour laissé`
          : node.rule === 'produits'
            ? `${products}/2 produits différents`
            : node.rule === 'formats'
              ? `${formats}/2 formats testés`
              : node.rule === 'assiduite'
                ? `${streak}/3 jours d'affilée · ${sessions.length}/5 visites`
                : `${minutes}/20 minutes cumulées`

      return {
        ...node,
        ...POSITIONS.get(node.id)!,
        done,
        detail,
        progressText,
        pct: done ? 100 : Math.min(99, Math.round((value / total) * 100))
      }
    })

    const doneSet = new Set(main.filter((n) => n.done).map((n) => n.id))
    const campDoneSet = new Set(camps.filter((c) => c.done).map((c) => c.id))


    // A link is walked when what feeds it is cleared: the milestone it leaves,
    // or — for a branch — the challenge itself.
    const links = LINKS.map((link) => ({
      ...link,
      walked: link.own ? campDoneSet.has(link.own) : doneSet.has(link.from)
    }))

    const tiers = REGIONS.map((region, index) => {
      const nodes = main.filter((n) => n.region === index)
      const done = nodes.filter((n) => n.done).length

      return {
        ...region,
        accent: ACCENTS[region.accent],
        nodes,
        done,
        total: nodes.length,
        pct: nodes.length ? Math.round((done / nodes.length) * 100) : 0
      }
    })

    const doneCount = main.filter((n) => n.done).length

    return {
      xp,
      avg,
      best,
      streak,
      main,
      camps,
      links,
      tiers,
      currentIndex,
      doneCount,
      pct: Math.round((doneCount / MAIN.length) * 100),
      campDone: camps.filter((n) => n.done).length,
      campTotal: camps.length,
      league: level ? (LEVEL_LABELS[level] ?? level) : 'Débutant'
    }
  }, [sessions, level])  // ── Canvas interaction (declared before any early return) ──

  const currentIdx = stats.currentIndex === -1 ? stats.main.length - 1 : stats.currentIndex
  const dragRef = useRef<{ startX: number; startY: number; originX: number; originY: number; moved: boolean } | null>(null)
  const viewportRef = useRef<HTMLDivElement | null>(null)
  const userPanned = useRef(false)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [grabbing, setGrabbing] = useState(false)

  // Which node's detail card is open, and whether the last gesture was a drag:
  // a pointerdown clears the flag and any real movement sets it, so releasing a
  // pan over a card never pops its detail card open.
  const [opened, setOpened] = useState<{ kind: 'main' | 'camp'; id: string } | null>(null)
  const dragged = useRef(false)

  const openNode = (kind: 'main' | 'camp', id: string) => {
    if (dragged.current) return
    setOpened({ kind, id })
  }

  // Everything the detail card shows, normalised so one dialog renders a
  // milestone and a bonus challenge. The two kinds differ only in what they
  // measure: a score for a milestone, a count for a challenge.
  const detail = useMemo(() => {
    if (!opened) return null

    if (opened.kind === 'main') {
      const node = stats.main.find((n) => n.id === opened.id)

      if (!node) return null

      const index = MAIN.findIndex((m) => m.id === node.id)
      const isCurrent = index === currentIdx && !node.done
      const missing = node.measured === null ? null : Math.max(0, node.goal - node.measured)

      const progressText =
        node.rule === 'expert'
          ? node.measured === null
            ? "Aucune visite évaluée pour l'instant : terminez une simulation pour mesurer votre moyenne."
            : node.done
              ? `Jalon validé — score moyen ${fmtTarget(node.measured)}/10.`
              : `Score moyen actuel ${fmtTarget(node.measured)}/10 · il faut 8,5/10, ou le niveau Expert.`
          : node.measured === null
            ? "Aucune visite évaluée pour l'instant : terminez une simulation pour mesurer ce jalon."
            : node.done
              ? `Atteint — record actuel ${fmtTarget(node.measured)}/10.`
              : `Record actuel ${fmtTarget(node.measured)}/10 · il manque ${fmtTarget(missing ?? 0)} point${(missing ?? 0) >= 2 ? 's' : ''}.`

      return {
        kind: 'main' as const,
        label: node.label,
        hint: node.hint,
        icon: node.icon,
        accent: ACCENTS[REGIONS[node.region].accent],
        done: node.done,
        criteria: node.criteria,
        focus: node.focus,
        pct: node.pct,
        goalText: node.rule === 'expert' ? 'Niveau Expert ou 8,5/10' : `≥ ${fmtTarget(node.goal)}/10`,
        progressText,
        chapterNote: `Chapitre ${String(node.region + 1)} · ${REGIONS[node.region].name} · jalon ${String(index + 1)} sur ${String(MAIN.length)}`,
        statusLabel: node.done ? 'Réussi' : isCurrent ? 'En cours' : 'À débloquer',
        statusClass: node.done
          ? ACCENTS[REGIONS[node.region].accent].pill
          : isCurrent
            ? 'bg-amber-400/15 text-amber-600 dark:text-amber-400'
            : 'bg-muted text-muted-foreground',
        nextLabel: MAIN[index + 1]?.label ?? null,
        parentNote: null as string | null,
        branches: stats.camps
          .filter((c) => c.parent === node.id)
          .map((c) => ({ id: c.id, label: c.label, done: c.done }))
      }
    }

    const camp = stats.camps.find((c) => c.id === opened.id)

    if (!camp) return null

    const parent = stats.main.find((n) => n.id === camp.parent)
    const accent = ACCENTS[REGIONS[camp.region].accent]

    return {
      kind: 'camp' as const,
      label: camp.label,
      hint: camp.hint,
      icon: camp.icon,
      accent,
      done: camp.done,
      criteria: camp.criteria,
      focus: null as VisitStep[] | null,
      pct: camp.pct,
      goalText: camp.progressText,
      progressText: camp.done
        ? 'Défi validé.'
        : 'Défi optionnel : il ne conditionne pas le jalon qui le porte.',
      chapterNote: `Chapitre ${String(camp.region + 1)} · ${REGIONS[camp.region].name} · défi bonus`,
      statusLabel: camp.done ? 'Réussi' : 'À faire',
      statusClass: camp.done ? accent.pill : 'bg-muted text-muted-foreground',
      nextLabel: null as string | null,
      parentNote: parent ? `l'étape ${String(parent.step)} · ${parent.label}` : null,
      branches: [] as { id: string; label: string; done: boolean }[]
    }
  }, [opened, stats, currentIdx])

  // Centre the graph on the current milestone: the canvas itself when it fits,
  // otherwise the node, always clamped so the tree cannot slide out of frame.
  const centreOn = (x: number, y: number) => {
    const w = viewportRef.current?.clientWidth ?? CANVAS_W
    const h = viewportRef.current?.clientHeight ?? VIEWPORT_H
    const panX = CANVAS_W <= w ? (w - CANVAS_W) / 2 : Math.max(w - CANVAS_W, Math.min(0, w / 2 - x))
    const panY = Math.max(h - CANVAS_H, Math.min(0, h / 2 - y))

    setPan({ x: panX, y: panY })
  }

  // The first paint has no reliable width yet, so the ResizeObserver also does
  // the initial centring — and re-centres when the window or sidebar changes,
  // unless the delegate has taken the map somewhere themselves.
  useEffect(() => {
    const el = viewportRef.current

    if (!el || loading) return

    const apply = () => {
      if (userPanned.current) return
      const node = stats.main[currentIdx] ?? stats.main[0]

      if (node) centreOn(node.x, node.y)
    }

    apply()
    const observer = new ResizeObserver(apply)

    observer.observe(el)

    return () => observer.disconnect()
     
  }, [loading, currentIdx, stats.main])

  if (loading) {
    return (
      <div className='w-full space-y-6'>
        <Skeleton className='h-155 rounded-xl' />
      </div>
    )
  }

  if (error) {
    return (
      <Card className='border-destructive/40'>
        <CardHeader>
          <CardTitle className='text-destructive'>Oups</CardTitle>
          <CardDescription>{error}</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  const onPointerDown = (e: React.PointerEvent) => {
    dragRef.current = { startX: e.clientX, startY: e.clientY, originX: pan.x, originY: pan.y, moved: false }
    dragged.current = false
    setGrabbing(true)
    ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
  }

  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current

    if (!d) return
    const dx = e.clientX - d.startX
    const dy = e.clientY - d.startY

    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
      d.moved = true
      dragged.current = true
      userPanned.current = true
    }

    setPan({ x: d.originX + dx, y: d.originY + dy })
  }

  const onPointerUp = () => {
    dragRef.current = null
    setGrabbing(false)
  }

  return (
    <div className='relative w-full'>
      {/* ── Floating HUD cards over the tree ── */}
      <div className='pointer-events-none absolute inset-x-0 top-0 z-20 flex flex-wrap items-start justify-between gap-3 p-4'>
        <div className='pointer-events-auto flex flex-col gap-2'>
          <div className='bg-card/95 ring-foreground/10 flex items-center gap-2 rounded-full py-1.5 pr-4 pl-1.5 shadow-lg ring-1 backdrop-blur'>
            <span className='bg-amber-400/15 flex size-8 items-center justify-center rounded-full'>
              <Zap className='size-4.5 text-amber-500' />
            </span>
            <div className='flex flex-col leading-tight'>
              <span className='text-sm font-bold'>{stats.xp.toLocaleString('fr-FR')}</span>
              <span className='text-muted-foreground text-[10px] font-medium tracking-wide uppercase'>XP</span>
            </div>
          </div>
          <div className='bg-card/95 ring-foreground/10 flex items-center gap-2 rounded-full py-1.5 pr-4 pl-1.5 shadow-lg ring-1 backdrop-blur'>
            <span className='flex size-8 items-center justify-center rounded-full bg-orange-500/15'>
              <Flame className='size-4.5 text-orange-500' />
            </span>
            <div className='flex flex-col leading-tight'>
              <span className='text-sm font-bold'>{stats.streak}</span>
              <span className='text-muted-foreground text-[10px] font-medium tracking-wide uppercase'>Jours de suite</span>
            </div>
          </div>
        </div>
        <div className='pointer-events-auto flex flex-col items-end gap-2'>
          <div className='bg-card/95 ring-foreground/10 flex items-center gap-2 rounded-full py-1.5 pr-1.5 pl-4 shadow-lg ring-1 backdrop-blur'>
            <div className='flex flex-col items-end leading-tight'>
              <span className='text-sm font-bold'>{stats.league}</span>
              <span className='text-muted-foreground text-[10px] font-medium tracking-wide uppercase'>Ligue</span>
            </div>
            <span className='bg-amber-400/15 flex size-8 items-center justify-center rounded-full'>
              <Trophy className='size-4.5 text-amber-500' />
            </span>
          </div>
          <div className='bg-card/95 ring-foreground/10 flex items-center gap-2 rounded-full py-1.5 pr-1.5 pl-4 shadow-lg ring-1 backdrop-blur'>
            <div className='flex flex-col items-end leading-tight'>
              <span className='text-sm font-bold'>{stats.best !== null ? `${stats.best}/10` : '—'}</span>
              <span className='text-muted-foreground text-[10px] font-medium tracking-wide uppercase'>Record</span>
            </div>
            <span className='bg-primary/10 flex size-8 items-center justify-center rounded-full'>
              <Target className='text-primary size-4.5' />
            </span>
          </div>
          <a
            href='/dashboard/leaderboard'
            className='bg-card/95 ring-foreground/10 flex items-center gap-2 rounded-full py-1.5 pr-1.5 pl-4 shadow-lg ring-1 backdrop-blur transition-colors hover:bg-muted/50'
          >
            <div className='flex flex-col items-end leading-tight'>
              <span className='text-sm font-bold'>Classement</span>
              <span className='text-muted-foreground text-[10px] font-medium tracking-wide uppercase'>Voir le board</span>
            </div>
            <span className='bg-primary flex size-8 items-center justify-center rounded-full text-primary-foreground'>
              <Medal className='size-4.5' />
            </span>
          </a>
        </div>
      </div>

      {/* ── The pannable tree ── */}
      <Card className='overflow-hidden py-0'>
        <div
          ref={viewportRef}
          role='application'
          aria-label='Arbre de progression — faites glisser pour explorer'
          className={cn('relative h-155 w-full touch-none overflow-hidden select-none', grabbing ? 'cursor-grabbing' : 'cursor-grab')}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
        >
          <div
            className='bg-muted/30 pointer-events-none absolute inset-0'
            style={{
              backgroundImage:
                'linear-gradient(to right, color-mix(in oklab, var(--border) 60%, transparent) 1px, transparent 1px), linear-gradient(to bottom, color-mix(in oklab, var(--border) 60%, transparent) 1px, transparent 1px)',
              backgroundSize: '48px 48px'
            }}
          />

          <div className='absolute top-0 left-0 origin-top-left' style={{ transform: `translate(${pan.x}px, ${pan.y}px)`, width: CANVAS_W, height: CANVAS_H }}>
            {/* ── Links, behind every card ── */}
            <svg className='pointer-events-none absolute inset-0' width={CANVAS_W} height={CANVAS_H}>
              {stats.links.map((link) => (
                <path
                  key={link.id}
                  d={link.d}
                  fill='none'
                  strokeWidth={4}
                  strokeLinecap='round'
                  className={cn(link.walked ? ACCENTS[REGIONS[link.region].accent].line : 'stroke-border')}
                  strokeDasharray={link.walked ? undefined : '10 10'}
                />
              ))}
            </svg>

            {/* ── Tier rules: the divider each chapter hangs from ── */}
            {stats.tiers.map((tier, index) => (
              <div key={tier.id}>
                <div
                  className='border-border absolute border-t border-dashed'
                  style={{ left: 30, top: TIER_TOP + index * TIER_H - HEADER_DY, width: CANVAS_W - 60 }}
                />
                <div
                  className='absolute flex items-center gap-2.5'
                  style={{ left: 30, top: TIER_TOP + index * TIER_H - HEADER_DY - 14 }}
                >
                  <span className='bg-card/95 ring-border flex items-center gap-2 rounded-full py-1 pr-2.5 pl-3 shadow-xs ring-1 backdrop-blur'>
                    <span className='text-muted-foreground text-[10px] font-semibold tracking-wide uppercase'>
                      Chapitre {index + 1}
                    </span>
                    <span className={cn('size-2.5 shrink-0 rounded-full', tier.accent.dot)} />
                    <span className='text-sm font-semibold'>{tier.name}</span>
                    <span className={cn('rounded-md px-1.5 text-xs font-semibold tabular-nums', tier.accent.pill)}>
                      {tier.done}/{tier.total}
                    </span>
                  </span>
                  <Progress value={tier.pct} className='h-1.5 w-32' />
                </div>
              </div>
            ))}

            {/* ── Milestone nodes ── */}
            {stats.main.map((node, index) => {
              const Icon = node.icon
              const isDone = node.done
              const isCurrent = index === currentIdx && !isDone
              const isLocked = !isDone && !isCurrent
              const accent = ACCENTS[REGIONS[node.region].accent]

              return (
                <div
                  key={node.id}
                  title={node.hint}
                  className='absolute'
                  style={{ left: node.x - CARD_W / 2, top: node.y - CARD_H / 2, width: CARD_W, height: CARD_H }}
                >
                  <div
                    role='button'
                    tabIndex={0}
                    aria-label={`Jalon ${String(node.step)} : ${node.label} — voir les objectifs`}
                    onClick={() => openNode('main', node.id)}
                    onKeyDown={(e) => {
                      if (e.key !== 'Enter' && e.key !== ' ') return
                      e.preventDefault()
                      openNode('main', node.id)
                    }}
                    className={cn(
                      'flex h-full cursor-pointer flex-col justify-between gap-2 rounded-2xl p-3 shadow-lg ring-1 backdrop-blur transition-all hover:-translate-y-0.5 hover:shadow-xl focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:outline-none',
                      isDone && 'bg-card/95 ring-2',
                      isDone && accent.pill,
                      isCurrent && 'animate-pulse bg-amber-400/10 ring-2 ring-amber-400/60',
                      isLocked && 'bg-card/80 ring-border'
                    )}
                  >
                    <div className='flex items-start gap-3'>
                      <span
                        className={cn(
                          'flex size-11 shrink-0 items-center justify-center rounded-xl',
                          isDone && accent.filled,
                          isCurrent && 'bg-amber-400 text-amber-950',
                          isLocked && 'bg-muted text-muted-foreground/70'
                        )}
                      >
                        {isDone ? <Check className='size-5.5' strokeWidth={3} /> : isLocked ? <Lock className='size-5' /> : <Icon className='size-5.5' />}
                      </span>
                      <div className='flex min-w-0 flex-col gap-1'>
                        <span className='flex items-center gap-1.5'>
                          <span className='bg-muted text-muted-foreground flex size-4.5 shrink-0 items-center justify-center rounded text-[10px] font-bold tabular-nums'>
                            {node.step}
                          </span>
                          <span className={cn('truncate text-sm font-medium', isLocked && 'text-muted-foreground')}>
                            {node.label}
                          </span>
                        </span>
                        {isDone ? (
                          <span className={cn('text-xs font-semibold', accent.pill, 'w-fit rounded-md px-1.5')}>
                            {fmtTarget(node.target)}+ atteint
                          </span>
                        ) : isCurrent ? (
                          <span className='w-fit rounded-md bg-amber-400/15 px-1.5 text-xs font-semibold text-amber-600 dark:text-amber-400'>
                            En cours · objectif {fmtTarget(node.target)}
                          </span>
                        ) : (
                          <span className='text-muted-foreground w-fit rounded-md px-1.5 text-xs font-semibold'>
                            Objectif {fmtTarget(node.target)}/10
                          </span>
                        )}
                      </div>
                    </div>
                    <p className='text-muted-foreground line-clamp-2 text-xs'>{node.hint}</p>
                  </div>
                </div>
              )
            })}

            {/* ── Branch cards: the chapter's bonus challenges ── */}
            {stats.camps.map((camp) => {
              const Icon = camp.icon
              const accent = ACCENTS[REGIONS[camp.region].accent]

              return (
                <div
                  key={camp.id}
                  title={camp.hint}
                  className='absolute'
                  style={{ left: camp.x - BRANCH_W / 2, top: camp.y - BRANCH_H / 2, width: BRANCH_W, height: BRANCH_H }}
                >
                  <div
                    role='button'
                    tabIndex={0}
                    aria-label={`Défi bonus : ${camp.label} — voir les objectifs`}
                    onClick={() => openNode('camp', camp.id)}
                    onKeyDown={(e) => {
                      if (e.key !== 'Enter' && e.key !== ' ') return
                      e.preventDefault()
                      openNode('camp', camp.id)
                    }}
                    className={cn(
                      'flex h-full cursor-pointer items-center gap-2.5 rounded-xl border px-3 shadow-sm backdrop-blur transition-all hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:outline-none',
                      camp.done ? cn('border-transparent', accent.pill) : 'border-border border-dashed bg-card/70'
                    )}
                  >
                    <span className={cn('flex size-8 shrink-0 items-center justify-center rounded-lg', camp.done ? 'bg-background/60' : 'bg-muted text-muted-foreground')}>
                      {camp.done ? <Check className='size-4' strokeWidth={3} /> : <Icon className='size-4' />}
                    </span>
                    <div className='flex min-w-0 flex-col'>
                      <span className='truncate text-xs font-medium'>{camp.label}</span>
                      <span className='text-muted-foreground text-[11px]'>{camp.detail}</span>
                    </div>
                  </div>
                </div>
              )
            })}

            {/* ── Finish banner once every milestone is cleared ── */}
            {stats.currentIndex === -1 ? (
              <div className='absolute flex items-center gap-2' style={{ left: 420, top: CANVAS_H - 70 }}>
                <Trophy className='size-5 text-amber-400' />
                <span className='text-sm font-medium'>Parcours terminé — Expert !</span>
              </div>
            ) : null}
          </div>

          {/* ── Recentre control ── */}
          <div onPointerDown={(e) => e.stopPropagation()} className='absolute right-4 bottom-4 z-20'>
            <Button
              size='sm'
              variant='outline'
              className='bg-card/95 shadow-lg backdrop-blur'              onClick={() => {
                userPanned.current = false
                const node = stats.main[currentIdx] ?? stats.main[0]

                if (node) centreOn(node.x, node.y)
              }}
            >
              <Crosshair /> Me recentrer
            </Button>
          </div>
        </div>

        {/* Footer hint */}
        <div className='text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 border-t px-4 py-2 text-xs'>
          <span>Cliquez un jalon pour voir ses objectifs · faites glisser l’arbre pour explorer</span>
          <span className='text-foreground ml-auto font-medium'>
            {REGIONS.length} chapitres · {stats.doneCount}/{stats.main.length} jalons · {stats.campDone}/{stats.campTotal} défis
          </span>
        </div>
      </Card>

      {/* ── Detail card: what this node asks for, and where the delegate stands ── */}
      {detail ? (
        <Dialog
          open
          onOpenChange={(next) => {
            if (!next) setOpened(null)
          }}
        >
          <DialogContent className='max-h-[85vh] overflow-y-auto sm:max-w-lg'>
            <DialogHeader>
              <div className='flex items-start gap-3'>
                <span
                  className={cn(
                    'flex size-11 shrink-0 items-center justify-center rounded-xl',
                    detail.done ? detail.accent.filled : 'bg-muted text-muted-foreground'
                  )}
                >
                  {detail.done ? <Check className='size-5.5' strokeWidth={3} /> : <detail.icon className='size-5.5' />}
                </span>
                <div className='flex min-w-0 flex-col gap-1.5'>
                  <span className='text-muted-foreground text-[11px] font-semibold tracking-wide uppercase'>
                    {detail.chapterNote}
                  </span>
                  <DialogTitle className='text-base'>{detail.label}</DialogTitle>
                </div>
                <span className={cn('ml-auto shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold', detail.statusClass)}>
                  {detail.statusLabel}
                </span>
              </div>
              <DialogDescription>{detail.hint}</DialogDescription>
            </DialogHeader>

            {/* Objective, and the delegate's distance to it */}
            <div className='rounded-xl border p-4'>
              <div className='flex items-baseline justify-between gap-3'>
                <span className='text-sm font-medium'>{detail.kind === 'main' ? 'Objectif' : 'Progression'}</span>
                <span className='text-sm font-semibold tabular-nums'>{detail.goalText}</span>
              </div>
              <Progress value={detail.pct} className='mt-3 h-2' />
              <p className='text-muted-foreground mt-2 text-xs'>{detail.progressText}</p>
            </div>

            {/* What actually has to happen */}
            <div className='space-y-2'>
              <h3 className='text-sm font-medium'>Comment le valider</h3>
              <ul className='space-y-2'>
                {detail.criteria.map((line) => (
                  <li key={line} className='text-muted-foreground flex gap-2.5 text-sm'>
                    <span
                      className={cn(
                        'mt-1.5 size-1.5 shrink-0 rounded-full',
                        detail.done ? detail.accent.dot : 'bg-muted-foreground/40'
                      )}
                    />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Which visit steps the evaluator scores for this milestone */}
            {detail.focus ? (
              <div className='space-y-2'>
                <h3 className='text-sm font-medium'>Ce que l’évaluateur regarde</h3>
                <div className='flex flex-wrap gap-1.5'>
                  {detail.focus.map((step) => (
                    <span
                      key={step}
                      className='rounded-full px-2.5 py-1 text-[11px] font-medium'
                      style={{ backgroundColor: `${STEP_META[step].color}1f`, color: STEP_META[step].color }}
                    >
                      {STEP_META[step].label}
                    </span>
                  ))}
                </div>
                <p className='text-muted-foreground text-xs'>
                  Chaque étape est notée sur 10 : le détail est sur la fiche de la session, à la fin de la visite.
                </p>
              </div>
            ) : null}

            {/* Where the node sits in the path */}
            <div className='bg-muted/40 rounded-xl p-4 text-xs'>
              {detail.kind === 'main' ? (
                <p>
                  {detail.nextLabel ? (
                    <>
                      Débloque <span className='text-foreground font-medium'>« {detail.nextLabel} »</span>.
                    </>
                  ) : (
                    'Dernier jalon du parcours : il clôt le chapitre Expertise.'
                  )}
                </p>
              ) : (
                <p>
                  Défi bonus rattaché à <span className='text-foreground font-medium'>{detail.parentNote}</span>.
                </p>
              )}
              {detail.branches.length > 0 ? (
                <div className='mt-1.5 flex flex-wrap items-center gap-1.5'>
                  <span>Défis bonus rattachés :</span>
                  {detail.branches.map((branch) => (
                    <span
                      key={branch.id}
                      className={cn(
                        'rounded-full px-2 py-0.5 font-medium',
                        branch.done ? detail.accent.pill : 'bg-background text-muted-foreground'
                      )}
                    >
                      {branch.label}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>

            <DialogFooter>
              <Button variant='outline' onClick={() => setOpened(null)}>
                Fermer
              </Button>
              <Button nativeButton={false} render={<a href='/dashboard/training/simulator' />}>
                Voir mes sessions
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  )
}
