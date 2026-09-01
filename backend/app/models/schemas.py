"""Core schemas for ALIA Avatar system."""
from enum import Enum
from typing import List, Optional, Dict, Any
from datetime import datetime
from pydantic import BaseModel, Field


# ──────────────────────────────────────────────
# Enums
# ──────────────────────────────────────────────

class VisitFormat(str, Enum):
    FLASH = "flash"
    STANDARD = "standard"
    APPROFONDIE = "approfondie"


class VisitStep(str, Enum):
    """The 6 steps of a VITAL SA medical visit."""
    INTRODUCTION = "introduction"       # Instant Zero
    SONDAGE = "sondage"                 # Questions + active listening
    SYNTHESE = "synthese"              # Reformulation / QARE
    OBJECTIONS = "objections"          # A-C-R-V method
    ARGUMENTATION = "argumentation"    # Need → benefits → proof → usage
    CONCLUSION = "conclusion"          # Engagement (BIP)
    COMPLETED = "completed"


class DoctorStyle(str, Enum):
    """4 relational styles of doctors."""
    ANALYSANT = "analysant"       # Proof-oriented
    CONTROLANT = "controlant"     # Structure-oriented
    FACILITANT = "facilitant"     # Relationship-oriented
    PROMOUVANT = "promouvant"     # Innovation-oriented


class SONCASFactor(str, Enum):
    """SONCAS persuasion framework."""
    SECURITE = "securite"
    ORGUEIL = "orgueil"
    NOTORIETE = "notoriete"
    CONFORT = "confort"
    ARGENT = "argent"
    SYMPATHIE = "sympathie"


class CompetenceLevel(str, Enum):
    """ALIA's 4 competence levels."""
    DEBUTANT = "debutant"
    JUNIOR = "junior"
    CONFIRME = "confirme"
    EXPERT = "expert"


class ConversationMode(str, Enum):
    """Operating modes of the avatar."""
    TRAINING = "training"
    COMMERCIAL = "commercial"


class IntentType(str, Enum):
    """Detected intents from user input."""
    GREETING = "greeting"
    ANSWER = "answer"
    QUESTION = "question"
    OBJECTION = "objection"
    CHALLENGE = "challenge"
    REQUEST_INFO = "request_info"
    REQUEST_SAMPLE = "request_sample"
    REFUSAL = "refusal"
    AGREEMENT = "agreement"
    END_CONVERSATION = "end_conversation"


class SentimentType(str, Enum):
    POSITIVE = "positive"
    NEUTRAL = "neutral"
    NEGATIVE = "negative"
    HOSTILE = "hostile"
    RECEPTIVE = "receptive"
    HESITANT = "hesitant"


# ──────────────────────────────────────────────
# User & Authentication
# ──────────────────────────────────────────────

class UserBase(BaseModel):
    email: str
    full_name: str


class UserCreate(UserBase):
    password: str


class UserResponse(UserBase):
    id: str
    created_at: datetime
    role: str = "user"

    class Config:
        from_attributes = True


# ──────────────────────────────────────────────
# Product Knowledge
# ──────────────────────────────────────────────

class ProductKnowledge(BaseModel):
    """Structured product knowledge extracted from gamme files."""
    name: str
    category: str
    therapeutic_area: Optional[str] = None
    specialties: List[str] = []
    target_profiles: List[str] = []
    key_benefits: List[str] = []
    dosage: Optional[str] = None
    precautions: List[str] = []
    composition: Optional[str] = None
    evidence: List[str] = []
    competitive_positioning: Optional[str] = None


class Product(BaseModel):
    id: Optional[str] = None
    code_article: Optional[str] = None
    name: str
    gamme: Optional[str] = None
    category: Optional[str] = None
    therapeutic_area: Optional[str] = None


# ──────────────────────────────────────────────
# Scripts & Library
# ──────────────────────────────────────────────

class Script(BaseModel):
    """A conversation script for a specific product and format."""
    product_name: str
    format: VisitFormat
    intro_script: Optional[str] = None
    discovery_questions: List[str] = []
    argumentation_points: List[str] = []
    objections: Dict[str, str] = {}
    closing_template: Optional[str] = None
    crm_template: Optional[str] = None


# ──────────────────────────────────────────────
# Doctor Profile
# ──────────────────────────────────────────────

class DoctorProfile(BaseModel):
    """Profile of the simulated doctor/pharmacist."""
    name: Optional[str] = "Docteur"
    specialty: Optional[str] = "Médecine Générale"
    style: DoctorStyle = DoctorStyle.ANALYSANT
    soncas: List[SONCASFactor] = [SONCASFactor.SECURITE]
    mood: SentimentType = SentimentType.NEUTRAL
    time_available: VisitFormat = VisitFormat.STANDARD
    custom_notes: Optional[str] = None


# ──────────────────────────────────────────────
# Conversation
# ──────────────────────────────────────────────

class ConversationMessage(BaseModel):
    """A single message in the conversation."""
    id: Optional[str] = None
    role: str  # "user" or "assistant"
    content: str
    timestamp: datetime = Field(default_factory=datetime.now)
    step: Optional[VisitStep] = None
    intent: Optional[IntentType] = None
    sentiment: Optional[SentimentType] = None
    metadata: Dict[str, Any] = {}


class ConversationRequest(BaseModel):
    """Request to send a message in the conversation."""
    session_id: Optional[str] = None
    message: str
    mode: ConversationMode = ConversationMode.TRAINING
    product_focus: Optional[str] = None
    doctor_profile: Optional[DoctorProfile] = None
    level: CompetenceLevel = CompetenceLevel.JUNIOR
    visit_format: VisitFormat = VisitFormat.STANDARD


class ConversationResponse(BaseModel):
    """Response from ALIA in the conversation."""
    session_id: str
    message: str
    current_step: VisitStep
    avatar_url: Optional[str] = None
    audio_url: Optional[str] = None
    metadata: Dict[str, Any] = {}
    score_update: Optional[Dict[str, float]] = None


class StartSessionRequest(BaseModel):
    """Request to start a new conversation session."""
    mode: ConversationMode = ConversationMode.TRAINING
    product_focus: Optional[str] = None
    doctor_profile: Optional[DoctorProfile] = None
    level: CompetenceLevel = CompetenceLevel.JUNIOR
    visit_format: VisitFormat = VisitFormat.STANDARD
    user_id: Optional[str] = None


class StartSessionResponse(BaseModel):
    """Response when a session is started."""
    session_id: str
    greeting: str
    doctor_profile: DoctorProfile
    current_step: VisitStep
    level: CompetenceLevel


# ──────────────────────────────────────────────
# Visit Session
# ──────────────────────────────────────────────

class VisitSession(BaseModel):
    """A complete visit session tracking."""
    id: str
    user_id: Optional[str] = None
    mode: ConversationMode
    level: CompetenceLevel
    product_focus: Optional[str] = None
    doctor_profile: DoctorProfile
    visit_format: VisitFormat
    messages: List[ConversationMessage] = []
    current_step: VisitStep = VisitStep.INTRODUCTION
    started_at: datetime = Field(default_factory=datetime.now)
    ended_at: Optional[datetime] = None
    scores: Dict[str, float] = {}
    level_progression: Dict[str, Any] = {}


# ──────────────────────────────────────────────
# CRM Report
# ──────────────────────────────────────────────

class VisitReport(BaseModel):
    """Auto-generated CRM visit report."""
    session_id: str
    duration_seconds: int
    context: str
    visit_format: VisitFormat
    doctor_specialty: str
    doctor_style: DoctorStyle
    soncas_detected: List[SONCASFactor]
    need_identified: str
    message_delivered: str
    objections_encountered: List[Dict[str, str]] = []
    engagement_level: str
    material_left: List[str] = []
    next_step: str
    next_step_date: Optional[str] = None
    level_at_session: CompetenceLevel
    score: float
    raw_transcript: List[Dict[str, str]] = []


# ──────────────────────────────────────────────
# Scoring
# ──────────────────────────────────────────────

class ScoringResult(BaseModel):
    """Scoring result for a visit session."""
    session_id: str
    overall_score: float
    step_scores: Dict[str, float] = {}
    level: CompetenceLevel
    strengths: List[str] = []
    areas_for_improvement: List[str] = []
    level_progression: Optional[Dict[str, Any]] = None


# ──────────────────────────────────────────────
# Dashboard
# ──────────────────────────────────────────────

class SessionStats(BaseModel):
    total_sessions: int
    average_score: float
    level_distribution: Dict[str, int]
    top_products: List[Dict[str, Any]]
    recent_sessions: List[Dict[str, Any]]


# ──────────────────────────────────────────────
# Avatar
# ──────────────────────────────────────────────

class AvatarRequest(BaseModel):
    """Request to generate avatar video."""
    text: str
    voice_id: Optional[str] = None
    avatar_id: Optional[str] = None


class AvatarResponse(BaseModel):
    """Response with avatar video/audio URL."""
    video_url: Optional[str] = None
    audio_url: Optional[str] = None
    duration_seconds: float = 0.0
