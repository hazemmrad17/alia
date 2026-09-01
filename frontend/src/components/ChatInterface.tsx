"use client";

import { useState, useEffect, useRef } from "react";

type Message = {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  step?: string;
};

type ChatConfig = {
  mode: string;
  level: string;
  format: string;
  product: string;
  doctorStyle: string;
};

const STEP_LABELS: Record<string, { label: string; color: string }> = {
  introduction: { label: "Introduction", color: "bg-blue-500" },
  sondage: { label: "Sondage", color: "bg-purple-500" },
  synthese: { label: "Synthèse", color: "bg-green-500" },
  objections: { label: "Objections", color: "bg-orange-500" },
  argumentation: { label: "Argumentation", color: "bg-red-500" },
  conclusion: { label: "Conclusion", color: "bg-teal-500" },
  completed: { label: "Completed", color: "bg-gray-500" },
};

const ALL_STEPS = ["introduction", "sondage", "synthese", "objections", "argumentation", "conclusion"];

export default function ChatInterface({
  config,
  onBack,
  onDashboard,
}: {
  config: ChatConfig;
  onBack: () => void;
  onDashboard: () => void;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [currentStep, setCurrentStep] = useState("introduction");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [sessionStarted, setSessionStarted] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Start session on mount
  useEffect(() => {
    if (!sessionStarted) {
      startSession();
    }
  }, []);

  const startSession = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/v1/session/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: config.mode,
          level: config.level,
          visit_format: config.format,
          product_focus: config.product || undefined,
          doctor_profile: {
            style: config.doctorStyle,
            specialty: "Médecine Générale",
          },
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setSessionId(data.session_id);
        setCurrentStep(data.current_step);
        setMessages([{
          role: "assistant",
          content: data.greeting,
          timestamp: new Date(),
          step: data.current_step,
        }]);
        setSessionStarted(true);
      } else {
        // Fallback demo greeting
        setMessages([{
          role: "assistant",
          content: getDemoGreeting(),
          timestamp: new Date(),
          step: "introduction",
        }]);
        setSessionStarted(true);
      }
    } catch {
      // Offline demo mode
      setMessages([{
        role: "assistant",
        content: getDemoGreeting(),
        timestamp: new Date(),
        step: "introduction",
      }]);
      setSessionStarted(true);
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || isTyping) return;

    const userMessage: Message = {
      role: "user",
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsTyping(true);

    try {
      const response = await fetch(`${API_BASE}/api/v1/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId,
          message: input.trim(),
          mode: config.mode,
          product_focus: config.product || undefined,
          level: config.level,
          visit_format: config.format,
          doctor_profile: {
            style: config.doctorStyle,
          },
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setCurrentStep(data.current_step);
        if (data.score_update?.running_score) {
          setScore(data.score_update.running_score);
        }
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: data.message,
            timestamp: new Date(),
            step: data.current_step,
          },
        ]);
      } else {
        // Fallback demo response
        const demoResponse = getDemoResponse(input.trim(), currentStep);
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: demoResponse,
            timestamp: new Date(),
          },
        ]);
        // Advance step in demo mode
        advanceStep();
      }
    } catch {
      // Offline demo mode
      const demoResponse = getDemoResponse(input.trim(), currentStep);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: demoResponse,
          timestamp: new Date(),
        },
      ]);
      advanceStep();
    }

    setIsTyping(false);
  };

  const advanceStep = () => {
    const idx = ALL_STEPS.indexOf(currentStep);
    if (idx < ALL_STEPS.length - 1) {
      setCurrentStep(ALL_STEPS[idx + 1]);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="text-gray-500 hover:text-gray-700">
            ← Back
          </button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-vital-blue rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">A</span>
            </div>
            <div>
              <h1 className="font-semibold text-gray-900">ALIA Avatar</h1>
              <p className="text-xs text-gray-500 capitalize">{config.mode} Mode · {config.level} · {config.format}</p>
            </div>
          </div>
        </div>

        {/* Step Progress */}
        <div className="flex items-center gap-2">
          {ALL_STEPS.map((step, i) => {
            const isActive = step === currentStep;
            const isDone = ALL_STEPS.indexOf(currentStep) > i;
            return (
              <div
                key={step}
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium transition-all ${
                  isActive
                    ? "bg-vital-blue text-white scale-110"
                    : isDone
                    ? "bg-green-500 text-white"
                    : "bg-gray-200 text-gray-500"
                }`}
                title={STEP_LABELS[step]?.label}
              >
                {i + 1}
              </div>
            );
          })}
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-xs text-gray-500">Score</p>
            <p className="text-lg font-bold text-vital-blue">{score.toFixed(1)}</p>
          </div>
          <button
            onClick={onDashboard}
            className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          >
            📊
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`animate-message flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[70%] rounded-2xl px-5 py-3 ${
                msg.role === "user"
                  ? "bg-vital-blue text-white rounded-br-md"
                  : "bg-white text-gray-900 border border-gray-200 rounded-bl-md shadow-sm"
              }`}
            >
              {msg.role === "assistant" && msg.step && (
                <div className="flex items-center gap-2 mb-2">
                  <span className={`w-2 h-2 rounded-full ${STEP_LABELS[msg.step]?.color || "bg-gray-400"}`} />
                  <span className="text-xs font-medium text-gray-500">
                    {STEP_LABELS[msg.step]?.label}
                  </span>
                </div>
              )}
              <div className="whitespace-pre-wrap text-sm leading-relaxed">
                {msg.content}
              </div>
              <div className={`text-xs mt-1 ${msg.role === "user" ? "text-blue-100" : "text-gray-400"}`}>
                {msg.timestamp.toLocaleTimeString()}
              </div>
            </div>
          </div>
        ))}

        {isTyping && (
          <div className="flex justify-start">
            <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-md px-5 py-3 shadow-sm">
              <div className="flex gap-1.5">
                <div className="w-2 h-2 bg-gray-400 rounded-full typing-dot" />
                <div className="w-2 h-2 bg-gray-400 rounded-full typing-dot" />
                <div className="w-2 h-2 bg-gray-400 rounded-full typing-dot" />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="bg-white border-t border-gray-200 px-6 py-4">
        <div className="flex gap-3 max-w-4xl mx-auto">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={currentStep === "completed" ? "Session completed!" : "Type your message..."}
            disabled={currentStep === "completed"}
            className="flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:border-vital-blue focus:ring-2 focus:ring-blue-100 disabled:opacity-50"
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || isTyping || currentStep === "completed"}
            className="px-6 py-3 bg-vital-blue text-white rounded-xl font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

// Demo mode functions
function getDemoGreeting(): string {
  return `🎬 **Session Started**

Bonjour ! I'm Dr. Martin, specialist in General Medicine.

**Doctor Profile:** Analysant (proof-oriented) | Available for Standard visit
**Your Level:** Junior
**Product Focus:** VITAL SA products

Go ahead and start the visit as you would in real life. I'll respond like a real doctor.

When you're ready, say hello!`;
}

function getDemoResponse(userInput: string, step: string): string {
  const input = userInput.toLowerCase();

  // Objection handling
  if (input.includes("habitudes") || input.includes("habits")) {
    return `I understand your concern about habits. That's a common perspective.

**A-C-R-V Response:**
- **Accueillir:** I completely understand — habits are important.
- **Clarifier:** Which patients are you least satisfied with in your current approach?
- **Répondre:** That's exactly where this product could make a difference. It's positioned specifically for those challenging cases.
- **Valider:** Does that address your concern?`;
  }

  if (input.includes("pas le temps") || input.includes("no time")) {
    return `I understand — you're very busy.

**Quick response:** Would 20 seconds work, or should I come back at a better time?

If you have just 20 seconds, I'll leave you one key piece of information about how this helps your patients.`;
  }

  // Question
  if (input.includes("?")) {
    return `That's a great question. Let me address it:

The key evidence shows that this product has demonstrated effectiveness in the target patient population. The benefits are:

1. **Patient benefit:** Improved outcomes in the specific condition
2. **Practice benefit:** Easy integration into your current workflow
3. **Evidence:** Based on clinical data supporting its use

Would you like me to elaborate on any of these points?`;
  }

  // Step-based responses
  switch (step) {
    case "introduction":
      return `Bonjour Docteur, merci de m'accueillir. Je suis ALIA de VITAL SA. 

I'll be very brief — just 2 minutes. I wanted to share something practical about improving patient outcomes in your practice.

Is that OK for you?`;
    case "sondage":
      return `Thank you for sharing that. Let me ask a few more questions to better understand your needs:

1. On this type of patients, what do you see most frequently?
2. What bothers you most: effectiveness, tolerance, or compliance?
3. What's your #1 criterion when choosing a treatment?

I'm listening.`;
    case "synthese":
      return `If I summarize what you've told me:

Your priority is **[need X]** for patients with **[profile Y]**, and your main expectation is **[benefit Z]**.

Is that correct? This will help me give you the most relevant information.`;
    case "objections":
      return `I understand your hesitation. Let me clarify:

When you say that, are you referring to:
- Proof/evidence concerns?
- Tolerance/safety concerns?
- Patient profile concerns?

Based on what you mention, here's what I can share: the product has been designed specifically for this type of concern, with practical support for your patients.

Does this address your point?`;
    case "argumentation":
      return `Based on what you've told me, here are the key points:

**1. Need Reference:** You mentioned [specific need from sondage]

**2. Benefits:**
- Simple routine for your patients
- Practical integration into your practice
- Clear patient profile targeting

**3. Evidence:** Based on clinical observations in similar practices

**4. Usage:** Specifically indicated for [patient profile], with [dosage/form]

How does this align with your practice?`;
    case "conclusion":
      return `So we agree on the 2 key benefits we discussed:

1. **[Benefit 1]** for your patients
2. **[Benefit 2]** for your practice

Would you be open to trying it with 2-3 patients matching the profile we discussed? I'll come back in about a week for your feedback.

**CRM Report generated:** Follow-up scheduled at J+7`;
    default:
      return `Thank you for your response. Let me continue with the visit process.`;
  }
}
