"use client";

import { useState, useEffect } from "react";

type SessionStats = {
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
};

export default function Dashboard({ onBack }: { onBack: () => void }) {
  const [stats, setStats] = useState<SessionStats | null>(null);
  const [loading, setLoading] = useState(true);

  const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/v1/dashboard/stats`);
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch {
      // Demo data
      setStats({
        total_sessions: 24,
        average_score: 7.3,
        level_distribution: { debutant: 8, junior: 10, confirme: 5, expert: 1 },
        top_products: [
          { name: "LV Fersang", count: 8 },
          { name: "Oligovit Vitamine C", count: 6 },
          { name: "CALMOSS", count: 4 },
          { name: "VITONIC", count: 3 },
        ],
        recent_sessions: [
          { id: "1", mode: "training", level: "junior", product: "LV Fersang", score: 7.5, started_at: "2026-03-01T10:00:00" },
          { id: "2", mode: "training", level: "confirme", product: "CALMOSS", score: 8.2, started_at: "2026-03-01T14:30:00" },
          { id: "3", mode: "commercial", level: "junior", product: "Oligovit", score: 6.8, started_at: "2026-03-01T16:00:00" },
        ],
      });
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">Loading dashboard...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="text-gray-500 hover:text-gray-700">
            ← Back
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900">ALIA Dashboard</h1>
            <p className="text-sm text-gray-500">Analytics & Performance Overview</p>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-4 gap-6 mb-8">
          <StatCard label="Total Sessions" value={stats?.total_sessions || 0} icon="📊" />
          <StatCard label="Average Score" value={`${stats?.average_score || 0}/10`} icon="⭐" />
          <StatCard label="Active Levels" value={Object.keys(stats?.level_distribution || {}).length} icon="🎯" />
          <StatCard label="Products Used" value={stats?.top_products?.length || 0} icon="💊" />
        </div>

        <div className="grid grid-cols-2 gap-8">
          {/* Level Distribution */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Level Distribution</h3>
            <div className="space-y-3">
              {Object.entries(stats?.level_distribution || {}).map(([level, count]) => {
                const total = stats?.total_sessions || 1;
                const pct = ((count as number) / total) * 100;
                return (
                  <div key={level}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="capitalize font-medium">{level}</span>
                      <span className="text-gray-500">{count} sessions</span>
                    </div>
                    <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-vital-blue rounded-full step-progress"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Top Products */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Products</h3>
            <div className="space-y-3">
              {stats?.top_products?.map((product, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="w-8 h-8 bg-blue-100 text-blue-700 rounded-lg flex items-center justify-center text-sm font-bold">
                      {i + 1}
                    </span>
                    <span className="font-medium">{product.name}</span>
                  </div>
                  <span className="text-sm text-gray-500">{product.count} sessions</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Recent Sessions */}
        <div className="mt-8 bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Sessions</h3>
          <table className="w-full">
            <thead>
              <tr className="text-left text-sm text-gray-500 border-b border-gray-100">
                <th className="pb-3 font-medium">Session</th>
                <th className="pb-3 font-medium">Mode</th>
                <th className="pb-3 font-medium">Level</th>
                <th className="pb-3 font-medium">Product</th>
                <th className="pb-3 font-medium">Score</th>
                <th className="pb-3 font-medium">Date</th>
              </tr>
            </thead>
            <tbody>
              {stats?.recent_sessions?.map((session) => (
                <tr key={session.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="py-3 font-mono text-sm text-gray-600">{session.id.slice(0, 8)}...</td>
                  <td className="py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      session.mode === "training" ? "bg-blue-100 text-blue-700" : "bg-green-100 text-green-700"
                    }`}>
                      {session.mode}
                    </span>
                  </td>
                  <td className="py-3 capitalize">{session.level}</td>
                  <td className="py-3">{session.product}</td>
                  <td className="py-3">
                    <span className={`font-bold ${
                      session.score >= 8 ? "text-green-600" : session.score >= 6 ? "text-orange-500" : "text-red-500"
                    }`}>
                      {session.score.toFixed(1)}
                    </span>
                  </td>
                  <td className="py-3 text-sm text-gray-500">
                    {new Date(session.started_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string; value: string | number; icon: string }) {
  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
      <div className="flex items-center justify-between mb-2">
        <span className="text-2xl">{icon}</span>
      </div>
      <p className="text-3xl font-bold text-gray-900">{value}</p>
      <p className="text-sm text-gray-500 mt-1">{label}</p>
    </div>
  );
}
