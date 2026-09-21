'use client'

import { useEffect, useState } from 'react'
import { Settings, History, LineChart, Activity, Server, Cpu, CheckCircle2, XCircle, UserCog, IdCard, Link2 } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import SessionHistoryView from './session-history'
import ScoreTrendsView from './score-trends'
import UserGeneral from '@/views/pages/user-settings/general'
import Profile from '@/views/pages/user-profile/profile'
import ConnectionsCard from '@/views/pages/user-profile/connections'

// ── Tab registry ────────────────────────────────────────────────────────────────
// VITAL Products lives as its own navbar page (shared by both roles) — not here.
const TABS = [
  { id: 'general', label: 'General', icon: Settings },
  { id: 'account', label: 'Account Settings', icon: UserCog },
  { id: 'profile', label: 'Profile', icon: IdCard },
  { id: 'connections', label: 'Connections', icon: Link2 },
  { id: 'history', label: 'Session History', icon: History },
  { id: 'trends', label: 'Score Trends', icon: LineChart },
  { id: 'status', label: 'Backend Status', icon: Activity },
] as const

type TabId = (typeof TABS)[number]['id']

// ── General tab bits ─────────────────────────────────────────────────────────────
function SettingRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className='flex items-center justify-between border-b border-border/60 py-2.5 last:border-0'>
      <span className='text-sm text-muted-foreground'>{label}</span>
      <span className={`text-sm font-medium ${mono ? 'font-mono' : ''}`}>{value}</span>
    </div>
  )
}

// ── Backend status tab bits ──────────────────────────────────────────────────────
const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

function useHealthCheck() {
  const [state, setState] = useState<'checking' | 'online' | 'offline'>('checking')

  useEffect(() => {
    let cancelled = false

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 4000)

    fetch(`${API}/health`, { signal: controller.signal })
      .then(res => { if (!cancelled) setState(res.ok ? 'online' : 'offline') })
      .catch(() => { if (!cancelled) setState('offline') })
      .finally(() => clearTimeout(timer))

    return () => { cancelled = true; clearTimeout(timer); controller.abort() }
  }, [])

  return state
}

const ENDPOINTS = [
  'GET /health',
  'POST /api/v1/session/start',
  'POST /api/v1/chat',
  'GET /api/v1/products',
  'GET /api/v1/dashboard/stats',
  'GET /api/v1/dashboard/scores/step-analysis',
  'GET /api/v1/dashboard/scores/level-distribution',
  'WS /api/v1/conversation/ws/{session_id}',
]

// ── Main component ────────────────────────────────────────────────────────────────
export default function SettingsTabs({ initialTab }: { initialTab?: string }) {
  const [tab, setTab] = useState<TabId>((TABS.some(t => t.id === initialTab) ? initialTab : 'general') as TabId)
  const health = useHealthCheck()

  return (
    <div className='grid grid-cols-6 gap-6'>
      {/* Page header */}
      <div className='col-span-full'>
        <div className='flex items-center gap-2 mb-2'>
          <Settings className='size-6 text-primary' />
          <h1 className='text-2xl font-bold'>Settings</h1>
        </div>
        <p className='text-sm text-muted-foreground'>
          Manage your workspace — account configuration, session history, performance trends, and backend status.
        </p>
      </div>

      {/* Tab bar */}
      <Tabs value={tab} onValueChange={v => setTab(v as TabId)} className='col-span-full'>
        <TabsList className='mb-6 w-full justify-start overflow-x-auto sm:w-fit sm:justify-start'>
          {TABS.map(t => {
            const Icon = t.icon
            return (
              <TabsTrigger key={t.id} value={t.id} className='gap-2'>
                <Icon className='size-4' />
                {t.label}
              </TabsTrigger>
            )
          })}
        </TabsList>

        {/* ── General ── */}
        <TabsContent value='general' className='grid grid-cols-6 gap-4'>
          <Card className='col-span-6 lg:col-span-3'>
            <CardHeader className='flex-row items-center gap-3'>
              <Server className='size-5 text-primary' />
              <div>
                <CardTitle className='text-base'>General</CardTitle>
                <CardDescription>Application workspace details</CardDescription>
              </div>
            </CardHeader>
            <CardContent className='space-y-1'>
              <SettingRow label='Application' value='ALIA Avatar' />
              <SettingRow label='Company' value='VITAL SA' />
              <SettingRow label='Version' value='1.0.0' />
              <SettingRow label='Backend URL' value={API} mono />
              <SettingRow label='Active Workspace' value='Role-based (Delegate / Doctor)' />
            </CardContent>
          </Card>

          <Card className='col-span-6 lg:col-span-3'>
            <CardHeader className='flex-row items-center gap-3'>
              <Cpu className='size-5 text-primary' />
              <div>
                <CardTitle className='text-base'>AI Configuration</CardTitle>
                <CardDescription>Avatar model and conversation settings</CardDescription>
              </div>
            </CardHeader>
            <CardContent className='space-y-1'>
              <SettingRow label='Model' value='GPT-4o' />
              <SettingRow label='Temperature' value='0.7' />
              <SettingRow label='Max Tokens' value='2048' />
              <SettingRow label='SONCAS Weights' value='Default' />
              <SettingRow label='Visit Formats' value='Flash · Standard · Approfondie' />
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Account Settings (profile, email/password, connections) ── */}
        <TabsContent value='account'>
          <UserGeneral />
        </TabsContent>

        {/* ── Profile (public profile, activity, teams, projects) ── */}
        <TabsContent value='profile'>
          <Profile />
        </TabsContent>

        {/* ── Connections (linked devices & apps) ── */}
        <TabsContent value='connections'>
          <ConnectionsCard />
        </TabsContent>

        {/* ── Session History ── */}
        <TabsContent value='history'>
          <SessionHistoryView />
        </TabsContent>

        {/* ── Score Trends ── */}
        <TabsContent value='trends'>
          <ScoreTrendsView />
        </TabsContent>

        {/* ── Backend Status ── */}
        <TabsContent value='status' className='grid grid-cols-6 gap-4'>
          <Card className='col-span-6 lg:col-span-3'>
            <CardHeader>
              <CardTitle className='text-base'>API Health</CardTitle>
              <CardDescription>Backend connection status</CardDescription>
            </CardHeader>
            <CardContent className='space-y-1'>
              <SettingRow label='Backend URL' value={API} mono />
              <div className='flex items-center justify-between py-2.5'>
                <span className='text-sm text-muted-foreground'>Status</span>
                {health === 'checking' ? (
                  <Badge variant='secondary'>Checking...</Badge>
                ) : health === 'online' ? (
                  <Badge className='gap-1 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'>
                    <CheckCircle2 className='size-3' /> Online
                  </Badge>
                ) : (
                  <Badge className='gap-1 bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400'>
                    <XCircle className='size-3' /> Offline
                  </Badge>
                )}
              </div>
              <SettingRow label='WebSocket' value={`${API.replace(/^http/, 'ws')}/api/v1/conversation/ws/{session_id}`} mono />
              <div className='flex items-center justify-between pt-1'>
                <span className='text-sm text-muted-foreground'>Demo mode</span>
                <Badge variant='secondary'>Fallback enabled</Badge>
              </div>
            </CardContent>
          </Card>

          <Card className='col-span-6 lg:col-span-3'>
            <CardHeader>
              <CardTitle className='text-base'>Endpoints</CardTitle>
              <CardDescription>Available REST & WebSocket endpoints</CardDescription>
            </CardHeader>
            <CardContent className='space-y-1.5'>
              {ENDPOINTS.map(e => (
                <p key={e} className='rounded-md bg-muted/50 px-3 py-1.5 font-mono text-xs text-muted-foreground'>
                  {e}
                </p>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
