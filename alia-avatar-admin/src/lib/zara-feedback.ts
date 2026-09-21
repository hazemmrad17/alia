// ─────────────────────────────────────────────────────────────────────────────
// Zara-inspired feedback & query-resolution engine for the ALIA training flow.
//
// Mirrors micro1's open-sourced candidate-support framework
// (Zara: An LLM-based Candidate Interview Feedback System — arXiv:2507.02869):
//
//   Phase 3 — Structured post-interview feedback via chain-of-thought:
//     • analyze the transcript and per-step performance
//     • identify 2-3 strengths and 2-3 areas for improvement
//     • each item is { title, detail }, specific, constructive, encouraging,
//       phrased in the past tense ("vous avez bien…" / "vous auriez pu…")
//     • never assume a lack of experience; no harsh ratings
//
//   Phase 4 — Candidate query resolution via high-confidence matching:
//     • queries are matched against a FAQ database (the ALIA docs act as the
//       corpus); only matches above a similarity threshold produce an answer,
//       the rest are routed to human support (here: the Support page).
//
// The engine is deterministic so the demo flow works without the LLM backend,
// but the data contract matches what a GPT-4o/chain-of-thought call would
// return, so it can be swapped for the real model later (the paper's prompts
// are reproduced in the comments below for that wiring).
// ─────────────────────────────────────────────────────────────────────────────

export type VisitStep = 'introduction' | 'sondage' | 'synthese' | 'objections' | 'argumentation' | 'conclusion'

export const VISIT_STEPS: VisitStep[] = [
  'introduction',
  'sondage',
  'synthese',
  'objections',
  'argumentation',
  'conclusion'
]

export const STEP_META: Record<VisitStep, { label: string }> = {
  introduction: { label: 'Introduction' },
  sondage: { label: 'Sondage' },
  synthese: { label: 'Synthèse' },
  objections: { label: 'Objections' },
  argumentation: { label: 'Argumentation' },
  conclusion: { label: 'Conclusion' }
}

export interface ZaraFeedbackItem {
  title: string
  detail: string
}

export interface ZaraFeedback {
  overall: number
  strengths: ZaraFeedbackItem[]
  areas_for_improvement: ZaraFeedbackItem[]
  step_scores: { step: VisitStep; label: string; score: number }[]
}

export interface FeedbackSource {
  role: 'user' | 'assistant'
  content: string
  step?: VisitStep
}

// ── Phase 3 : structured feedback ──────────────────────────────────────────
// The paper's user prompt (condensed) that this engine emulates:
//   1. Read and analyze the interview report.
//   2. Identify 2-3 key strengths of the candidate.
//   3. Identify 2-3 areas where the candidate could improve.
//   4. For each, formulate 1-2 sentences that are specific and backed by
//      examples, constructive and forward-looking, encouraging and supportive.
//      Phrase suggestions in the past tense ("could have explained better").
//   5. Output JSON with two keys: "strengths" and "areas_for_improvement",
//      each item having a "title" and a "detail" key.

const STEP_BASE: Record<VisitStep, number> = {
  introduction: 8.2,
  sondage: 6.8,
  synthese: 7.5,
  objections: 5.9,
  argumentation: 7.1,
  conclusion: 8.0
}

const STRENGTHS: Record<VisitStep, { title: string; detail: string }> = {
  introduction: {
    title: 'Ouverture de la visite maîtrisée',
    detail:
      'Vous avez su capter l’attention du médecin dès les premières secondes et installer un climat de confiance, comme on le voit dans votre prise de contact. Continuez à personnaliser vos premières phrases selon le profil du praticien.'
  },
  sondage: {
    title: 'Sondage des besoins efficace',
    detail:
      'Vous avez posé les bonnes questions pour découvrir les attentes réelles du praticien, ce qui vous a permis d’adapter votre discours. Poursuivez en reformulant systématiquement les besoins exprimés avant d’argumenter.'
  },
  synthese: {
    title: 'Synthèse claire des besoins',
    detail:
      'Votre reformulation des besoins du médecin a montré une écoute attentive et a rendu la transition vers l’argumentation naturelle. Gardez cette structure, elle sécurise l’échange.'
  },
  objections: {
    title: 'Traitement des objections solide',
    detail:
      'Vous avez répondu aux objections avec des arguments concrets et factuels, en restant calme et constructif. Continuez à préparer vos réponses aux objections les plus fréquentes pour gagner encore en fluidité.'
  },
  argumentation: {
    title: 'Argumentation convaincante',
    detail:
      'Votre argumentation s’est appuyée sur des bénéfices clairs pour le patient et des données crédibles, ce qui renforce la portée de votre message auprès du praticien.'
  },
  conclusion: {
    title: 'Conclusion et prise de congé réussies',
    detail:
      'Vous avez conclu la visite avec une proposition claire et une prise de congé professionnelle, laissant une impression positive et un engagement net du médecin.'
  }
}

const IMPROVEMENTS: Record<VisitStep, { title: string; detail: string }> = {
  introduction: {
    title: 'Renforcer l’ouverture de la visite',
    detail:
      'Vous auriez pu personnaliser davantage l’introduction en fonction du profil du praticien — par exemple en citant un cas clinique ou une actualité du laboratoire dès les premières phrases, pour accrocher immédiatement.'
  },
  sondage: {
    title: 'Approfondir le sondage des besoins',
    detail:
      'Vous auriez pu creuser davantage avec des questions ouvertes complémentaires (fréquence de prescription, profil de patients, contraintes) afin de mieux cibler vos arguments et vos preuves.'
  },
  synthese: {
    title: 'Annoncer clairement la structure de la visite',
    detail:
      'Vous auriez pu énoncer explicitement les points que vous alliez aborder après la synthèse, pour guider plus fermement l’échange et rassurer un médecin pressé.'
  },
  objections: {
    title: 'Anticiper les objections',
    detail:
      'Vous auriez pu préparer des réponses chiffrées aux objections les plus courantes (prix, concurrence, habitudes de prescription) afin de lever les freins plus rapidement et avec plus d’assurance.'
  },
  argumentation: {
    title: 'Étayer l’argumentation par des preuves',
    detail:
      'Vous auriez pu citer davantage d’études cliniques ou de données d’efficacité pour consolider vos arguments, en particulier face à un médecin de type Analysant qui exige des chiffres.'
  },
  conclusion: {
    title: 'Sécuriser l’engagement du médecin',
    detail:
      'Vous auriez pu proposer une prochaine action concrète — échantillon, documentation ou rendez-vous — pour transformer l’intérêt manifesté en engagement explicite avant de prendre congé.'
  }
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}

function scoreStep(step: VisitStep, texts: string[]): number {
  let s = STEP_BASE[step]
  if (texts.length === 0) s -= 1.5 // step was skipped or barely addressed
  s += Math.min(1.2, texts.length * 0.4)
  const joined = texts.join(' ').toLowerCase()
  if (joined.includes('?')) s += 0.6
  if (/(étude|etude|clinique|preuve|efficacité|efficacite|posologie|contre-indication|sécurité|securite|bénéfice|benefice)/.test(joined)) s += 0.7
  if (/(prix|cher|concurrent|habitude)/.test(joined)) s += 0.4
  return clamp(round1(s), 0, 10)
}

export function generateFeedbackReport(msgs: FeedbackSource[], config: { level: string; style: string }): ZaraFeedback {
  // 1. Attribute each user message to the visit step it was sent during.
  const byStep: Record<VisitStep, string[]> = {
    introduction: [],
    sondage: [],
    synthese: [],
    objections: [],
    argumentation: [],
    conclusion: []
  }
  for (const m of msgs) {
    if (m.role === 'user' && m.step && byStep[m.step]) byStep[m.step].push(m.content)
  }

  // 2. Score each step.
  const stepScores = VISIT_STEPS.map(step => ({
    step,
    label: STEP_META[step].label,
    score: scoreStep(step, byStep[step])
  }))

  const overall = round1(stepScores.reduce((a, s) => a + s.score, 0) / stepScores.length)

  // 3. Pick 2-3 strengths (highest) and 2-3 improvement areas (lowest).
  const byScoreDesc = [...stepScores].sort((a, b) => b.score - a.score)
  const byScoreAsc = [...stepScores].sort((a, b) => a.score - b.score)

  const strengths: ZaraFeedbackItem[] = byScoreDesc
    .filter(s => s.score >= 7)
    .slice(0, 3)
    .map(s => STRENGTHS[s.step])

  // Always keep at least 2 strengths, from the best steps.
  while (strengths.length < 2) {
    const next = byScoreDesc[strengths.length]
    if (!next) break
    strengths.push(STRENGTHS[next.step])
  }

  const areas: ZaraFeedbackItem[] = byScoreAsc
    .filter(s => s.score < 7)
    .slice(0, 3)
    .map(s => IMPROVEMENTS[s.step])

  // Always keep at least 2 improvement areas, from the weakest steps.
  while (areas.length < 2) {
    const next = byScoreAsc[areas.length]
    if (!next) break
    areas.push(IMPROVEMENTS[next.step])
  }

  return { overall, strengths, areas_for_improvement: areas, step_scores: stepScores }
}

// ── Phase 4 : query resolution (RAG-style) ─────────────────────────────────
// The paper's approach: queries are embedded and matched via cosine similarity
// against a precomputed question corpus; only high-confidence matches trigger
// an answer. Here the corpus is the ALIA documentation (docs/), and matching
// is a token-overlap score acting as the similarity threshold.

export interface FaqEntry {
  id: string
  topic: string
  keywords: string[]
  answer: string
  source: string
}

export const faqTopics: { id: string; label: string }[] = [
  { id: 'etapes', label: 'Étapes de la visite' },
  { id: 'objections', label: 'Objections' },
  { id: 'soncas', label: 'Profil SONCAS' },
  { id: 'formats', label: 'Formats de visite' },
  { id: 'argumentation', label: 'Argumentation & preuves' },
  { id: 'conclusion', label: 'Conclusion' },
  { id: 'niveaux', label: 'Niveaux de compétence' },
  { id: 'score', label: 'Scoring' }
]

export const faqEntries: FaqEntry[] = [
  {
    id: 'etapes',
    topic: 'Étapes de la visite',
    keywords: ['visite', 'etape', 'etapes', 'deroulement', 'structure', 'debuter', 'commencer'],
    answer:
      'La visite médicale ALIA suit 6 étapes : Introduction, Sondage des besoins, Synthèse, Traitement des objections, Argumentation et Conclusion. Chaque étape est évaluée sur 10 et contribue au score global de la session — le détail se trouve dans votre feedback structuré.',
    source: 'docs/01-scripts-top-sellers.md'
  },
  {
    id: 'objections',
    topic: 'Objections',
    keywords: ['objection', 'objections', 'refus', 'concurrent', 'concurrence', 'prix', 'habitude', 'frein'],
    answer:
      'Face à une objection : 1) accueillez-la sans vous braquer, 2) reformulez-la pour vérifier votre compréhension, 3) répondez avec un argument factuel (donnée clinique, bénéfice patient, service), 4) vérifiez que l’objection est levée avant de poursuivre. Les objections les plus fréquentes concernent le prix, la concurrence et les habitudes de prescription.',
    source: 'docs/05-techniques-de-vente.md'
  },
  {
    id: 'soncas',
    topic: 'Profil SONCAS',
    keywords: ['soncas', 'profil', 'personnalite', 'style', 'analysant', 'controlant', 'facilitant', 'promouvant', 'type', 'levier'],
    answer:
      'SONCAS désigne 6 leviers d’achat : Sécurité, Orgueil, Nouveauté, Confort, Argent, Sympathie. L’Avatar ALIA incarne 4 profils de médecin : Analysant (exige des preuves cliniques), Controlant (direct, axé efficacité), Facilitant (privilégie la relation) et Promouvant (sensible à l’innovation). Adaptez votre discours au levier dominant du praticien.',
    source: 'docs/05-techniques-de-vente.md'
  },
  {
    id: 'formats',
    topic: 'Formats de visite',
    keywords: ['format', 'formats', 'flash', 'standard', 'approfondie', 'duree', 'temps', 'courte'],
    answer:
      'Trois formats de visite : Flash (20-60 secondes, un seul message clé), Standard (2-4 minutes, l’essentiel de la gamme) et Approfondie (5-8 minutes, argumentation complète avec preuves). Choisissez selon le temps accordé par le médecin et l’objectif de la visite.',
    source: 'docs/02-manuel-alia-avatar.md'
  },
  {
    id: 'argumentation',
    topic: 'Argumentation & preuves',
    keywords: ['argument', 'argumentation', 'preuve', 'preuves', 'etude', 'etudes', 'clinique', 'efficacite', 'efficacité', 'benefice', 'bénéfice'],
    answer:
      'Une argumentation solide repose sur le triplet bénéfice patient / preuve clinique / pratique quotidienne : citez une donnée chiffrée, reliez-la au contexte du praticien, puis proposez un usage concret dans sa patientèle. C’est la clé face aux médecins de type Analysant.',
    source: 'docs/05-techniques-de-vente.md'
  },
  {
    id: 'conclusion',
    topic: 'Conclusion',
    keywords: ['conclusion', 'cloture', 'conge', 'congé', 'engagement', 'rendez-vous', 'prochaine', 'echantillon', 'échantillon'],
    answer:
      'Une bonne conclusion : récapitulez l’accord obtenu, proposez une prochaine action concrète (échantillon, documentation, rendez-vous) et prenez congé proprement. L’engagement du médecin doit être explicite avant de clore la visite.',
    source: 'docs/01-scripts-top-sellers.md'
  },
  {
    id: 'niveaux',
    topic: 'Niveaux de compétence',
    keywords: ['niveau', 'niveaux', 'competence', 'debutant', 'junior', 'confirme', 'expert', 'progression'],
    answer:
      'Le référentiel ALIA définit 4 niveaux : Débutant (script guidé), Junior (interactif, 2 à 4 relances), Confirmé (autonome, forte adaptation) et Expert (situations complexes et objections aiguës). La progression entre niveaux est décrite dans la matrice de progression.',
    source: 'docs/03-referentiel-niveaux-competence.md'
  },
  {
    id: 'score',
    topic: 'Scoring',
    keywords: ['score', 'note', 'moyenne', 'evaluation', 'notation', '10', 'global'],
    answer:
      'Chaque étape de la visite est notée sur 10 ; le score global est la moyenne des six étapes. Les étapes Objections et Argumentation sont souvent les plus discriminantes dans le profil final. Retrouvez le détail chiffré dans le feedback structuré de votre session.',
    source: 'docs/13-dashboard-plan.md'
  }
]

const STOP_WORDS = new Set([
  'le', 'la', 'les', 'de', 'des', 'du', 'un', 'une', 'en', 'et', 'que', 'qui', 'quoi', 'comment',
  'pour', 'avec', 'dans', 'sur', 'au', 'aux', 'ce', 'cette', 'ces', 'mon', 'ma', 'mes', 'ton',
  'ta', 'tes', 'son', 'sa', 'ses', 'notre', 'nos', 'votre', 'vos', 'leur', 'leurs', 'est', 'sont',
  'faire', 'faut', 'doit', 'peut', 'on', 'je', 'il', 'elle', 'nous', 'vous', 'ils', 'elles', 'a',
  'à', 'ou', 'mais', 'si', 'pas', 'plus', 'ne', 'moins', 'bien', 'tres', 'très', 'estce', 'ceque'
])

function tokens(s: string): string[] {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .split(/[^a-z0-9]+/)
    .filter(t => t.length > 1 && !STOP_WORDS.has(t))
}

export interface FaqResult {
  topic: string
  answer: string
  source: string
  confidence: number
}

export function faqSearch(query: string): FaqResult | null {
  const qTokens = tokens(query)
  if (qTokens.length === 0) return null

  let best: { entry: FaqEntry; score: number } | null = null
  for (const entry of faqEntries) {
    const common = entry.keywords.filter(k => qTokens.includes(k)).length
    // Overlap relative to the query: how much of the question is covered.
    const score = common / qTokens.length
    if (!best || score > best.score) best = { entry, score }
  }

  // Similarity threshold — below this, route to human support (like Zara).
  if (!best || best.score < 0.3) return null
  return {
    topic: best.entry.topic,
    answer: best.entry.answer,
    source: best.entry.source,
    confidence: Math.round(best.score * 100)
  }
}