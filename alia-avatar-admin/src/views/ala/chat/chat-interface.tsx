'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, BarChart3 } from 'lucide-react'

import { startSession as apiStartSession, sendMessage as apiSendMessage } from '@/lib/alia-api'
import { useWebSocket, type WSStatus } from '@/lib/useWebSocket'
import type {
  SessionConfig,
  ChatMessage,
  VisitStep,
  ConversationResponse,
  ScoringResult,
  CRMReport,
} from '@/types/alia'
import { STEP_META, ALL_VISIT_STEPS } from '@/types/alia'
import SessionReport from './session-report'

// ── Demo fallbacks ──

const STYLE_LABELS: Record<string, string> = {
  analysant: 'Analysant',
  controlant: 'Controlant',
  facilitant: 'Facilitant',
  promouvant: 'Promouvant',
}

function getDemoGreeting(config: SessionConfig): string {
  if (config.mode === 'commercial') {
    return `Bonjour! Thank you for your time.\n\nI'm ALIA from VITAL SA. Today I'd like to present **${config.product || 'our products'}** to you.\n\nI'll be brief and practical. May I have 2 minutes?\n\nFeel free to ask questions at any time.`
  }
  const styleHint = STYLE_LABELS[config.doctorStyle] || config.doctorStyle
  return `Bonjour! I'm Dr. Martin, specialist in General Medicine.\n\nDoctor Personality: ${styleHint}\nVisit Format: ${config.format}\nYour Level: ${config.level}\n\nGo ahead and start the visit as you would in real life. I'll react like a real doctor.\n\nWhen you're ready, say hello!`
}

function getDemoResponse(userInput: string, _step: VisitStep): string {
  const input = userInput.toLowerCase()

  if (input.includes('habitudes') || input.includes('habits')) {
    return `I understand your concern about habits.\n\n**A-C-R-V Response:**\n- **Accueillir:** I completely understand\n- **Clarifier:** Which patients are you least satisfied with?\n- **Répondre:** That's exactly where this product could help\n- **Valider:** Does that address your concern?`
  }

  if (input.includes('?')) {
    return `That's a great question. Let me address it:\n\n1. **Patient benefit:** Improved outcomes\n2. **Practice benefit:** Easy integration\n3. **Evidence:** Based on clinical data\n\nWould you like me to elaborate?`
  }

  return `Thank you for your response. Based on what you've shared:\n\nThe product has been designed specifically for this patient profile, with demonstrated effectiveness and a favorable safety profile.\n\nHow does this align with your practice?`
}

function getDemoCompletion() {
  return {
    message: '**Visite Terminee!**\n\n**Score Global:** 7.5/10\n\nGreat session! A few areas to improve.',
    scoring: {
      session_id: 'demo',
      overall_score: 7.5,
      step_scores: { introduction: 8.0, sondage: 7.0, synthese: 7.5, objections: 6.5, argumentation: 8.0, conclusion: 7.5 },
      level: 'junior' as const,
      strengths: ['Clear introduction', 'Good product knowledge'],
      areas_for_improvement: ['Ask more discovery questions', 'Handle objections with A-C-R-V'],
    },
    report: {
      session_id: 'demo', duration_seconds: 180, context: 'Training session',
      visit_format: 'standard' as const, doctor_specialty: 'Médecine Générale',
      doctor_style: 'analysant' as const, soncas_detected: ['securite'],
      need_identified: 'Patient efficacy and safety',
      message_delivered: 'Product positioning and clinical evidence',
      objections_encountered: [{ type: 'habit', response: 'Acknowledged and redirected' }],
      engagement_level: 'moderate', material_left: [], next_step: 'Follow-up at J+7',
      level_at_session: 'junior' as const, score: 7.5, raw_transcript: [],
    },
  }
}

// ── Component ──

export default function ChatInterface({
  config,
  onBack,
  onDashboard,
}: {
  config: SessionConfig
  onBack: () => void
  onDashboard: () => void
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [currentStep, setCurrentStep] = useState<VisitStep>('introduction')
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [score, setScore] = useState(0)
  const [sessionStarted, setSessionStarted] = useState(false)
  const [wsStatus, setWsStatus] = useState<WSStatus>('disconnected')
  const [demoMode, setDemoMode] = useState(false)
  const [useWebSocketFlag, setUseWebSocketFlag] = useState(false)
  const [showReport, setShowReport] = useState(false)
  const [scoringResult, setScoringResult] = useState<ScoringResult | null>(null)
  const [crmReport, setCrmReport] = useState<CRMReport | null>(null)
  const [isCompleting, setIsCompleting] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleWSMessage = useCallback((data: ConversationResponse) => {
    setIsTyping(false)
    setCurrentStep(data.current_step)
    if (data.score_update?.overall) setScore(data.score_update.overall)
    else if (data.score_update) {
      const vals = Object.values(data.score_update)
      if (vals.length > 0) setScore(vals[vals.length - 1])
    }
    setMessages(prev => [...prev, { role: 'assistant', content: data.message, timestamp: new Date(), step: data.current_step }])
    if (data.current_step === 'completed') {
      setIsCompleting(true)
      if (data.metadata?.scoring) setScoringResult(data.metadata.scoring as ScoringResult)
      if (data.metadata?.crm_report) setCrmReport(data.metadata.crm_report as CRMReport)
    }
  }, [])

  const { status: wsConnStatus, sendMessage: wsSend } = useWebSocket({
    sessionId, onMessage: handleWSMessage, onStatusChange: setWsStatus, enabled: useWebSocketFlag && !!sessionId,
  })

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, isTyping])

  useEffect(() => { if (!sessionStarted) startSession() }, []) // eslint-disable-line

  const startSession = async () => {
    try {
      const response = await apiStartSession({
        mode: config.mode, level: config.level, visit_format: config.format,
        product_focus: config.product || undefined,
        doctor_profile: { style: config.doctorStyle, specialty: 'Médecine Générale' },
      })
      setSessionId(response.session_id)
      setCurrentStep(response.current_step)
      setMessages([{ role: 'assistant', content: response.greeting, timestamp: new Date(), step: response.current_step }])
      setSessionStarted(true)
      setUseWebSocketFlag(true)
    } catch {
      setDemoMode(true)
      setMessages([{ role: 'assistant', content: getDemoGreeting(config), timestamp: new Date(), step: 'introduction' }])
      setSessionStarted(true)
    }
  }

  const sendMessage = async () => {
    if (!input.trim() || isTyping || currentStep === 'completed') return
    const userMessage: ChatMessage = { role: 'user', content: input.trim(), timestamp: new Date() }
    setMessages(prev => [...prev, userMessage])
    const msgText = input.trim()
    setInput('')
    setIsTyping(true)

    if (wsConnStatus === 'connected' && sessionId) {
      const sent = wsSend(msgText)
      if (sent) return
    }

    if (!demoMode && sessionId) {
      try {
        const response = await apiSendMessage({
          session_id: sessionId, message: msgText, mode: config.mode,
          product_focus: config.product || undefined, level: config.level,
          visit_format: config.format, doctor_profile: { style: config.doctorStyle },
        })
        setIsTyping(false)
        setCurrentStep(response.current_step)
        if (response.score_update?.overall) setScore(response.score_update.overall)
        setMessages(prev => [...prev, { role: 'assistant', content: response.message, timestamp: new Date(), step: response.current_step }])
        if (response.current_step === 'completed') {
          setIsCompleting(true)
          if (response.metadata?.scoring) setScoringResult(response.metadata.scoring as ScoringResult)
          if (response.metadata?.crm_report) setCrmReport(response.metadata.crm_report as CRMReport)
        }
      } catch { handleDemoResponse(msgText) }
    } else { handleDemoResponse(msgText) }
    setIsTyping(false)
  }

  const handleDemoResponse = (msgText: string) => {
    const response = getDemoResponse(msgText, currentStep)
    setMessages(prev => [...prev, { role: 'assistant', content: response, timestamp: new Date() }])
    const idx = ALL_VISIT_STEPS.indexOf(currentStep)
    if (idx < ALL_VISIT_STEPS.length - 1) {
      setCurrentStep(ALL_VISIT_STEPS[idx + 1])
      setScore(Math.min(10, score + 0.5))
    } else if (currentStep === 'conclusion') {
      setCurrentStep('completed')
      const completion = getDemoCompletion()
      setMessages(prev => [...prev, { role: 'assistant', content: completion.message, timestamp: new Date(), step: 'completed' }])
      setScoringResult(completion.scoring)
      setCrmReport(completion.report)
      setIsCompleting(true)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }

  useEffect(() => {
    if (isCompleting && scoringResult) { const t = setTimeout(() => setShowReport(true), 1500); return () => clearTimeout(t) }
  }, [isCompleting, scoringResult])

  const isTraining = config.mode === 'training'

  return (
    <div className='flex h-[calc(100vh-4rem)] flex-col bg-background'>
      {/* Header */}
      <div className='border-b px-6 py-3 flex items-center justify-between'>
        <div className='flex items-center gap-4'>
          <Button variant='ghost' size='sm' onClick={onBack}><ArrowLeft className='size-4 mr-1' /> Back</Button>
          <div>
            <h1 className='font-semibold'>ALIA Avatar</h1>
            <p className='text-xs text-muted-foreground'>
              {isTraining ? `Training \u00B7 ${config.level} \u00B7 ${STYLE_LABELS[config.doctorStyle]?.split('—')[0]?.trim() || config.doctorStyle}` : `${config.product || 'Product'} \u00B7 ${config.format}`}
            </p>
          </div>
          <div className='flex items-center gap-1.5'>
            <span className={`size-2 rounded-full ${demoMode ? 'bg-amber-400' : wsConnStatus === 'connected' ? 'bg-primary' : wsConnStatus === 'connecting' ? 'bg-yellow-400 animate-pulse' : 'bg-gray-400'}`} />
            <span className='text-xs text-muted-foreground'>{demoMode ? 'Demo' : wsConnStatus === 'connected' ? 'Live (WS)' : wsConnStatus}</span>
          </div>
        </div>

        {/* Step Progress */}
        <div className='flex items-center gap-1.5'>
          {ALL_VISIT_STEPS.map((step, i) => {
            const isDone = ALL_VISIT_STEPS.indexOf(currentStep) > i
            const isCompleted = currentStep === 'completed'
            const isActive = step === currentStep
            return (
              <div key={step} className={`size-7 rounded-full flex items-center justify-center text-xs font-medium transition-all ${isCompleted || isDone ? 'bg-primary text-primary-foreground' : isActive ? 'bg-primary text-primary-foreground scale-110' : 'bg-muted text-muted-foreground'}`} title={STEP_META[step]?.label}>
                {isCompleted || isDone ? '✓' : i + 1}
              </div>
            )
          })}
        </div>

        <div className='flex items-center gap-4'>
          <div className='text-right'>
            <p className='text-xs text-muted-foreground'>Score</p>
            <p className='text-lg font-bold text-primary'>{score.toFixed(1)}</p>
          </div>
          <Button variant='ghost' size='sm' onClick={onDashboard}><BarChart3 className='size-4' /></Button>
        </div>
      </div>

      {/* Messages */}
      <div className='flex-1 overflow-y-auto px-6 py-4 space-y-4'>
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[70%] rounded-2xl px-5 py-3 ${msg.role === 'user' ? 'bg-primary text-primary-foreground rounded-br-md' : 'bg-card text-card-foreground border rounded-bl-md shadow-sm'}`}>
              {msg.role === 'assistant' && msg.step && STEP_META[msg.step] && (
                <div className='flex items-center gap-2 mb-2'>
                  <span className={`size-2 rounded-full ${STEP_META[msg.step].bgClass}`} />
                  <span className='text-xs font-medium text-muted-foreground'>{STEP_META[msg.step].label}</span>
                </div>
              )}
              <div className='whitespace-pre-wrap text-sm leading-relaxed'>{msg.content}</div>
              <div className='text-xs mt-1 opacity-50'>{msg.timestamp.toLocaleTimeString()}</div>
            </div>
          </div>
        ))}
        {isTyping && (
          <div className='flex justify-start'>
            <div className='bg-card border rounded-2xl rounded-bl-md px-5 py-3 shadow-sm'>
              <div className='flex gap-1.5'>
                <div className='size-2 bg-muted-foreground rounded-full animate-bounce' style={{ animationDelay: '0ms' }} />
                <div className='size-2 bg-muted-foreground rounded-full animate-bounce' style={{ animationDelay: '150ms' }} />
                <div className='size-2 bg-muted-foreground rounded-full animate-bounce' style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className='border-t px-6 py-4'>
        <div className='flex gap-3 max-w-4xl mx-auto'>
          <Input ref={inputRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKeyDown}
            placeholder={currentStep === 'completed' ? 'Session completed' : 'Type your message...'}
            disabled={currentStep === 'completed' || isTyping} autoFocus />
          <Button onClick={sendMessage} disabled={!input.trim() || isTyping || currentStep === 'completed'}>
            {isTyping ? '...' : 'Send'}
          </Button>
        </div>
      </div>

      {showReport && scoringResult && (
        <SessionReport scoring={scoringResult} report={crmReport} onClose={() => { setShowReport(false); onBack() }} onDashboard={onDashboard} />
      )}
    </div>
  )
}
