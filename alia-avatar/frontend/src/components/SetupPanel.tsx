"use client";

import { useState } from "react";

type SessionConfig = {
  mode: string;
  level: string;
  format: string;
  product: string;
  doctorStyle: string;
};

const PRODUCTS = [
  "LV Fersang", "LV Tétra B", "PULMAX antitussif", "Oligovit Vitamine C",
  "Vitonic Allaitement", "Pédiakids Crème Change", "CALMOSS", "OMEVIE",
  "MINCILIGNE", "HYDRA", "VITONIC", "PHYTOTHERA",
];

const LEVELS = [
  { id: "debutant", name: "Débutant", desc: "Scripted, basic knowledge" },
  { id: "junior", name: "Junior", desc: "Interactive, 2-4 questions" },
  { id: "confirme", name: "Confirmé", desc: "Autonomous, adapts to style" },
  { id: "expert", name: "Expert", desc: "Top performer, coaching" },
];

const FORMATS = [
  { id: "flash", name: "Flash", duration: "20-60s", desc: "Quick visit" },
  { id: "standard", name: "Standard", duration: "2-4 min", desc: "Full visit" },
  { id: "approfondie", name: "Approfondie", duration: "5-8 min", desc: "Deep visit" },
];

const STYLES = [
  { id: "analysant", name: "Analysant", desc: "Needs proof & data", icon: "🔬" },
  { id: "controlant", name: "Controlant", desc: "Needs structure", icon: "📋" },
  { id: "facilitant", name: "Facilitant", desc: "Values relationship", icon: "🤝" },
  { id: "promouvant", name: "Promouvant", desc: "Likes innovation", icon: "💡" },
];

export default function SetupPanel({
  config,
  onChange,
  onStart,
}: {
  config: SessionConfig;
  onChange: (c: SessionConfig) => void;
  onStart: (c: SessionConfig) => void;
}) {
  return (
    <div className="bg-white rounded-3xl shadow-lg border border-gray-100 p-8 max-w-4xl mx-auto">
      <h3 className="text-xl font-bold text-gray-900 mb-6">Configure Your Session</h3>

      {/* Mode */}
      <div className="mb-8">
        <label className="block text-sm font-medium text-gray-700 mb-3">Mode</label>
        <div className="grid grid-cols-2 gap-4">
          {["training", "commercial"].map((m) => (
            <button
              key={m}
              onClick={() => onChange({ ...config, mode: m })}
              className={`p-4 rounded-xl border-2 text-left transition-all ${
                config.mode === m
                  ? "border-vital-blue bg-blue-50"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <span className="text-2xl">{m === "training" ? "🎓" : "💼"}</span>
              <p className="font-semibold mt-1 capitalize">{m}</p>
              <p className="text-sm text-gray-500">
                {m === "training" ? "Practice with simulated doctor" : "Present products"}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Level */}
      <div className="mb-8">
        <label className="block text-sm font-medium text-gray-700 mb-3">Competence Level</label>
        <div className="grid grid-cols-4 gap-3">
          {LEVELS.map((l) => (
            <button
              key={l.id}
              onClick={() => onChange({ ...config, level: l.id })}
              className={`p-3 rounded-xl border-2 text-center transition-all ${
                config.level === l.id
                  ? "border-vital-blue bg-blue-50"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <p className="font-semibold text-sm">{l.name}</p>
              <p className="text-xs text-gray-500 mt-1">{l.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Visit Format */}
      <div className="mb-8">
        <label className="block text-sm font-medium text-gray-700 mb-3">Visit Format</label>
        <div className="grid grid-cols-3 gap-4">
          {FORMATS.map((f) => (
            <button
              key={f.id}
              onClick={() => onChange({ ...config, format: f.id })}
              className={`p-4 rounded-xl border-2 text-center transition-all ${
                config.format === f.id
                  ? "border-vital-blue bg-blue-50"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <p className="font-semibold">{f.name}</p>
              <p className="text-sm text-vital-blue font-medium">{f.duration}</p>
              <p className="text-xs text-gray-500 mt-1">{f.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Product */}
      <div className="mb-8">
        <label className="block text-sm font-medium text-gray-700 mb-3">Product Focus</label>
        <select
          value={config.product}
          onChange={(e) => onChange({ ...config, product: e.target.value })}
          className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-vital-blue focus:outline-none"
        >
          <option value="">Select a product...</option>
          {PRODUCTS.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
      </div>

      {/* Doctor Style */}
      <div className="mb-8">
        <label className="block text-sm font-medium text-gray-700 mb-3">Doctor Style</label>
        <div className="grid grid-cols-4 gap-3">
          {STYLES.map((s) => (
            <button
              key={s.id}
              onClick={() => onChange({ ...config, doctorStyle: s.id })}
              className={`p-3 rounded-xl border-2 text-center transition-all ${
                config.doctorStyle === s.id
                  ? "border-vital-blue bg-blue-50"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <span className="text-2xl">{s.icon}</span>
              <p className="font-semibold text-sm mt-1">{s.name}</p>
              <p className="text-xs text-gray-500">{s.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Start Button */}
      <button
        onClick={() => onStart(config)}
        className="w-full bg-vital-blue text-white py-4 rounded-xl font-semibold text-lg hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200"
      >
        Start Session →
      </button>
    </div>
  );
}
