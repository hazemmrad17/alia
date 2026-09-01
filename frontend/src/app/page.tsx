"use client";

import { useState } from "react";
import ChatInterface from "@/components/ChatInterface";
import SetupPanel from "@/components/SetupPanel";
import Dashboard from "@/components/Dashboard";

type View = "home" | "chat" | "dashboard";

export default function Home() {
  const [view, setView] = useState<View>("home");
  const [sessionConfig, setSessionConfig] = useState({
    mode: "training",
    level: "junior",
    format: "standard",
    product: "",
    doctorStyle: "analysant",
  });

  const handleStartSession = (config: typeof sessionConfig) => {
    setSessionConfig(config);
    setView("chat");
  };

  if (view === "chat") {
    return (
      <ChatInterface
        config={sessionConfig}
        onBack={() => setView("home")}
        onDashboard={() => setView("dashboard")}
      />
    );
  }

  if (view === "dashboard") {
    return <Dashboard onBack={() => setView("home")} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-vital-blue rounded-xl flex items-center justify-center">
              <span className="text-white font-bold text-lg">A</span>
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">ALIA Avatar</h1>
              <p className="text-sm text-gray-500">VITAL SA - Intelligent Medical Representative</p>
            </div>
          </div>
          <button
            onClick={() => setView("dashboard")}
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-vital-blue transition-colors"
          >
            Dashboard
          </button>
        </div>
      </header>

      {/* Hero */}
      <main className="max-w-7xl mx-auto px-6 py-16">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 bg-blue-100 text-blue-700 px-4 py-1.5 rounded-full text-sm font-medium mb-6">
            🤖 AI-Powered Training & Sales
          </div>
          <h2 className="text-5xl font-bold text-gray-900 mb-6">
            Train Smarter.<br />
            <span className="text-vital-blue">Sell Better.</span>
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            ALIA is your intelligent conversational avatar for pharmaceutical sales training.
            Practice medical visits, master objections, and perfect your technique.
          </p>
        </div>

        {/* Setup Panel */}
        <SetupPanel config={sessionConfig} onChange={setSessionConfig} onStart={handleStartSession} />

        {/* Features */}
        <div className="grid md:grid-cols-3 gap-8 mt-20">
          {[
            {
              icon: "🎓",
              title: "Training Mode",
              desc: "Practice with a simulated doctor that reacts realistically based on 4 doctor styles and SONCAS factors.",
            },
            {
              icon: "💼",
              title: "Commercial Mode",
              desc: "Present VITAL SA products to healthcare professionals with real-time feedback and scoring.",
            },
            {
              icon: "📊",
              title: "Progression System",
              desc: "Track your growth from Débutant to Expert with detailed scoring and CRM reports.",
            },
          ].map((feature, i) => (
            <div key={i} className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
              <div className="text-4xl mb-4">{feature.icon}</div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">{feature.title}</h3>
              <p className="text-gray-600">{feature.desc}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
