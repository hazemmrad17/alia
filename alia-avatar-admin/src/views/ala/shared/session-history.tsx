'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table'
import type { VisitSession } from '@/types/alia'
import { LEVEL_META, DOCTOR_STYLE_META } from '@/types/alia'

const DEMO_SESSIONS: VisitSession[] = [
  { id: 'sess-001', mode: 'training', level: 'junior', product_focus: 'LV Fersang', doctor_profile: { style: 'analysant', specialty: 'Cardiology' }, visit_format: 'standard', messages: [], current_step: 'completed', started_at: '2026-09-01T10:00:00', ended_at: '2026-09-01T10:05:00', scores: { overall: 7.5 }, level_progression: {} },
  { id: 'sess-002', mode: 'commercial', level: 'junior', product_focus: 'Oligovit', doctor_profile: { style: 'controlant', specialty: 'General Practice' }, visit_format: 'flash', messages: [], current_step: 'completed', started_at: '2026-09-01T14:30:00', ended_at: '2026-09-01T14:33:00', scores: { overall: 7.8 }, level_progression: {} },
  { id: 'sess-003', mode: 'training', level: 'confirme', product_focus: 'CALMOSS', doctor_profile: { style: 'facilitant', specialty: 'Neurology' }, visit_format: 'approfondie', messages: [], current_step: 'completed', started_at: '2026-08-31T09:00:00', ended_at: '2026-08-31T09:10:00', scores: { overall: 8.9 }, level_progression: {} },
  { id: 'sess-004', mode: 'training', level: 'debutant', product_focus: 'VITONIC', doctor_profile: { style: 'promouvant', specialty: 'Pediatrics' }, visit_format: 'standard', messages: [], current_step: 'completed', started_at: '2026-08-30T11:00:00', ended_at: '2026-08-30T11:04:00', scores: { overall: 5.2 }, level_progression: {} },
  { id: 'sess-005', mode: 'commercial', level: 'junior', product_focus: 'Magné B6', doctor_profile: { style: 'analysant', specialty: 'General Practice' }, visit_format: 'standard', messages: [], current_step: 'completed', started_at: '2026-08-29T14:00:00', ended_at: '2026-08-29T14:06:00', scores: { overall: 7.2 }, level_progression: {} },
]

type Filter = 'all' | 'training' | 'commercial'

function ScoreBadge({ score }: { score: number }) {
  const cls =
    score >= 8 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
    score >= 6 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400'
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold tabular-nums ${cls}`}>
      {score.toFixed(1)}
    </span>
  )
}

export default function SessionHistoryView() {
  const [sessions] = useState<VisitSession[]>(DEMO_SESSIONS)
  const [filter, setFilter] = useState<Filter>('all')

  const filtered = filter === 'all' ? sessions : sessions.filter(s => s.mode === filter)

  return (
    <Card className='col-span-full'>
      <CardHeader>
        <div className='flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between'>
          <div>
            <CardTitle className='text-base'>Session History</CardTitle>
            <CardDescription>Comprehensive audit log of all completed avatar visits</CardDescription>
          </div>
          <div className='flex gap-1 bg-muted/60 p-1 rounded-lg w-fit'>
            {(['all', 'training', 'commercial'] as Filter[]).map(f => (
              <Button
                key={f}
                variant={filter === f ? 'default' : 'ghost'}
                size='sm'
                onClick={() => setFilter(f)}
                className='capitalize h-7 px-3 text-xs'
              >
                {f}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Session</TableHead>
              <TableHead>Mode</TableHead>
              <TableHead>Level</TableHead>
              <TableHead>Product Focus</TableHead>
              <TableHead>Doctor Style</TableHead>
              <TableHead>Format</TableHead>
              <TableHead className='text-center'>Score</TableHead>
              <TableHead>Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map(session => {
              const levelMeta = LEVEL_META[session.level]
              const styleMeta = DOCTOR_STYLE_META[session.doctor_profile?.style]
              const score = session.scores?.overall || 0

              return (
                <TableRow key={session.id} className='hover:bg-muted/50'>
                  <TableCell className='font-mono text-xs text-muted-foreground'>{session.id}</TableCell>
                  <TableCell>
                    <Badge variant='secondary' className={
                      session.mode === 'training'
                        ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
                        : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                    }>
                      {session.mode}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant='outline' className={`${levelMeta?.textClass || ''} text-xs`}>
                      {levelMeta?.label || session.level}
                    </Badge>
                  </TableCell>
                  <TableCell className='font-medium text-sm'>{session.product_focus || '—'}</TableCell>
                  <TableCell>
                    {styleMeta ? (
                      <span className='inline-flex items-center gap-1.5 text-xs text-muted-foreground'>
                        <span>{styleMeta.icon}</span>
                        <span>{styleMeta.label}</span>
                      </span>
                    ) : '—'}
                  </TableCell>
                  <TableCell className='capitalize text-xs text-muted-foreground'>{session.visit_format}</TableCell>
                  <TableCell className='text-center'>
                    <ScoreBadge score={score} />
                  </TableCell>
                  <TableCell className='text-sm text-muted-foreground'>
                    {new Date(session.started_at).toLocaleDateString('fr-FR')}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
