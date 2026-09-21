// ──────────────────────────────────────────────
// ALIA Avatar — Types (mirrors backend Pydantic schemas)
// ──────────────────────────────────────────────

export type VisitFormat = "flash" | "standard" | "approfondie";

export type VisitStep =
  | "introduction"
  | "sondage"
  | "synthese"
  | "objections"
  | "argumentation"
  | "conclusion"
  | "completed";

export type DoctorStyle = "analysant" | "controlant" | "facilitant" | "promouvant";

export type CompetenceLevel = "debutant" | "junior" | "confirme" | "expert";

export type ConversationMode = "training" | "commercial";

export type IntentType =
  | "greeting"
  | "answer"
  | "question"
  | "objection"
  | "challenge"
  | "request_info"
  | "request_sample"
  | "refusal"
  | "agreement"
  | "end_conversation";

export type SentimentType =
  | "positive"
  | "neutral"
  | "negative"
  | "hostile"
  | "receptive"
  | "hesitant";

// ── Doctor Profile ──

export interface DoctorProfile {
  name?: string;
  specialty?: string;
  style: DoctorStyle;
  soncas?: string[];
  mood?: SentimentType;
  time_available?: VisitFormat;
  custom_notes?: string;
}

// ── Product ──

export interface Product {
  name: string;
  gamme?: string;
  presentation?: string;
  packaging?: string;
  indications?: string[];
  age_range?: string | null;
  composition?: { quantity?: string; ingredient?: string }[];
  posologie?: { note?: string | null; table?: unknown } | null;
  /** Optional product photo, served from /images/products/<slug> */
  image?: string;
}

// ── Session ──

export interface StartSessionRequest {
  mode: ConversationMode;
  product_focus?: string;
  doctor_profile?: DoctorProfile;
  level: CompetenceLevel;
  visit_format: VisitFormat;
  user_id?: string;
}

export interface StartSessionResponse {
  session_id: string;
  greeting: string;
  doctor_profile: DoctorProfile;
  current_step: VisitStep;
  level: CompetenceLevel;
}

export interface ConversationRequest {
  session_id: string;
  message: string;
  mode?: ConversationMode;
  product_focus?: string;
  doctor_profile?: Partial<DoctorProfile>;
  level?: CompetenceLevel;
  visit_format?: VisitFormat;
}

export interface ConversationResponse {
  session_id: string;
  message: string;
  current_step: VisitStep;
  avatar_url?: string;
  audio_url?: string;
  metadata: Record<string, unknown>;
  score_update?: Record<string, number>;
}

// ── Visit Session (full history) ──

export interface VisitSession {
  id: string;
  user_id?: string;
  mode: ConversationMode;
  level: CompetenceLevel;
  product_focus?: string;
  doctor_profile: DoctorProfile;
  visit_format: VisitFormat;
  messages: Array<{
    id?: string;
    role: string;
    content: string;
    timestamp: string;
    step?: VisitStep;
    intent?: IntentType;
    sentiment?: SentimentType;
    metadata?: Record<string, unknown>;
  }>;
  current_step: VisitStep;
  started_at: string;
  ended_at?: string;
  scores: Record<string, number>;
  level_progression: Record<string, unknown>;
}

// ── CRM Report ──

export interface CRMReport {
  session_id: string;
  duration_seconds: number;
  context: string;
  visit_format: VisitFormat;
  doctor_specialty: string;
  doctor_style: DoctorStyle;
  soncas_detected: string[];
  need_identified: string;
  message_delivered: string;
  objections_encountered: Array<{ type: string; response: string }>;
  engagement_level: string;
  material_left: string[];
  next_step: string;
  next_step_date?: string;
  level_at_session: CompetenceLevel;
  score: number;
  raw_transcript: Array<{ role: string; content: string }>;
}

// ── Scoring ──

export interface ScoringResult {
  session_id: string;
  overall_score: number;
  step_scores: Record<string, number>;
  level: CompetenceLevel;
  strengths: string[];
  areas_for_improvement: string[];
  level_progression?: Record<string, unknown>;
}

// ── Dashboard ──

export interface SessionStats {
  total_sessions: number;
  average_score: number;
  level_distribution: Record<string, number>;
  top_products: Array<{ name: string; count: number }>;
  recent_sessions: Array<{
    id: string;
    mode: string;
    level: string;
    product: string;
    score: number;
    started_at: string;
  }>;
}

export interface LevelDistribution {
  [level: string]: {
    count: number;
    avg_score: number;
    min_score: number;
    max_score: number;
  };
}

export interface StepAnalysis {
  [step: string]: {
    avg_score: number;
    count: number;
  };
}

// ── Levels & Formats ──

export interface LevelInfo {
  id: string;
  name: string;
  description: string;
  min_score: number;
  requirements: string[];
}

export interface FormatInfo {
  id: string;
  name: string;
  duration: string;
  description: string;
  steps: VisitStep[];
}

// ── Step metadata ──

export const STEP_META: Record<VisitStep, { label: string; color: string; bgClass: string; textClass: string; icon: string }> = {
  introduction: { label: "Introduction", color: "#3b82f6", bgClass: "bg-blue-500", textClass: "text-blue-500", icon: "" },
  sondage: { label: "Sondage", color: "#a855f7", bgClass: "bg-purple-500", textClass: "text-purple-500", icon: "" },
  synthese: { label: "Synthese", color: "#22c55e", bgClass: "bg-green-500", textClass: "text-green-500", icon: "" },
  objections: { label: "Objections", color: "#f97316", bgClass: "bg-orange-500", textClass: "text-orange-500", icon: "" },
  argumentation: { label: "Argumentation", color: "#ef4444", bgClass: "bg-red-500", textClass: "text-red-500", icon: "" },
  conclusion: { label: "Conclusion", color: "#14b8a6", bgClass: "bg-teal-500", textClass: "text-teal-500", icon: "" },
  completed: { label: "Completed", color: "#6b7280", bgClass: "bg-gray-500", textClass: "text-gray-500", icon: "" },
};

export const ALL_VISIT_STEPS: VisitStep[] = [
  "introduction",
  "sondage",
  "synthese",
  "objections",
  "argumentation",
  "conclusion",
];

// ── Doctor Style metadata ──

export const DOCTOR_STYLE_META: Record<DoctorStyle, { label: string; description: string; soncas: string[]; icon: string; color: string }> = {
  analysant: {
    label: "Analysant",
    description: "Asks detailed questions, challenges claims, wants numbers and studies",
    soncas: ["Securite", "Objectivite"],
    icon: "",
    color: "blue",
  },
  controlant: {
    label: "Controlant",
    description: "Wants clear process, structured data, step-by-step approach",
    soncas: ["Organisation", "Controle"],
    icon: "",
    color: "purple",
  },
  facilitant: {
    label: "Facilitant",
    description: "Values trust, relationships, peer recommendations, simplicity",
    soncas: ["Relation", "Confiance"],
    icon: "",
    color: "green",
  },
  promouvant: {
    label: "Promouvant",
    description: "Early adopter, innovation-oriented, likes new solutions",
    soncas: ["Innovation", "Nouveaute"],
    icon: "",
    color: "amber",
  },
};

// ── Level metadata ──

// ── UI Config ──

export interface SessionConfig {
  mode: ConversationMode;
  level: CompetenceLevel;
  format: VisitFormat;
  product: string;
  doctorStyle: DoctorStyle;
}

// ── Conversation Message (internal UI type) ──

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  step?: VisitStep;
  intent?: IntentType;
  sentiment?: SentimentType;
}

export const LEVEL_META: Record<CompetenceLevel, { label: string; color: string; bgClass: string; textClass: string; description: string }> = {
  debutant: { label: "Débutant", color: "#6b7280", bgClass: "bg-gray-100", textClass: "text-gray-700", description: "Just starting — learning the basics" },
  junior: { label: "Junior", color: "#3b82f6", bgClass: "bg-blue-100", textClass: "text-blue-700", description: "Building confidence — handling simple scenarios" },
  confirme: { label: "Confirmé", color: "#a855f7", bgClass: "bg-purple-100", textClass: "text-purple-700", description: "Solid skills — handling objections well" },
  expert: { label: "Expert", color: "#f59e0b", bgClass: "bg-amber-100", textClass: "text-amber-700", description: "Mastery — adaptable to any situation" },
};
