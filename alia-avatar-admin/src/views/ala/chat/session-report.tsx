'use client'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import type { ScoringResult, CRMReport } from '@/types/alia'

export default function SessionReport({
  scoring, report, onClose, onDashboard,
}: {
  scoring: ScoringResult; report?: CRMReport | null; onClose: () => void; onDashboard: () => void
}) {
  const scoreColor = (s: number) => s >= 8 ? 'text-green-500' : s >= 6 ? 'text-amber-500' : 'text-red-500'
  const scoreBg = (s: number) => s >= 8 ? 'bg-green-500' : s >= 6 ? 'bg-amber-500' : 'bg-red-500'

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4'>
      <Card className='max-w-2xl w-full max-h-[90vh] overflow-y-auto p-8'>
        <div className='flex items-center justify-between mb-6'>
          <div>
            <h2 className='text-2xl font-bold'>Session Complete</h2>
            <p className='text-sm text-muted-foreground mt-1'>Performance breakdown</p>
          </div>
          <Button variant='ghost' size='sm' onClick={onClose}>✕</Button>
        </div>

        {/* Overall Score */}
        <div className='flex items-center gap-6 mb-6'>
          <div className='relative size-24'>
            <svg className='size-24 -rotate-90' viewBox='0 0 100 100'>
              <circle cx='50' cy='50' r='42' fill='none' stroke='hsl(var(--muted))' strokeWidth='8' />
              <circle cx='50' cy='50' r='42' fill='none' className={scoreBg(scoring.overall_score)} strokeWidth='8' strokeLinecap='round' strokeDasharray={`${(scoring.overall_score / 10) * 264} 264`} />
            </svg>
            <div className='absolute inset-0 flex items-center justify-center'>
              <span className={`text-2xl font-bold ${scoreColor(scoring.overall_score)}`}>{scoring.overall_score.toFixed(1)}</span>
            </div>
          </div>
          <div>
            <p className='text-sm text-muted-foreground'>Overall Score</p>
            <p className='text-lg font-semibold'>Level: <span className='capitalize'>{scoring.level}</span></p>
          </div>
        </div>

        {/* Step Scores */}
        <div className='mb-6'>
          <h3 className='text-sm font-semibold mb-3 uppercase tracking-wide text-muted-foreground'>Scores by Step</h3>
          <div className='space-y-3'>
            {Object.entries(scoring.step_scores).map(([step, s]) => (
              <div key={step}>
                <div className='flex justify-between text-sm mb-1'>
                  <span className='capitalize font-medium'>{step.replace('_', ' ')}</span>
                  <span className={`font-bold ${scoreColor(s)}`}>{s.toFixed(1)}/10</span>
                </div>
                <div className='w-full h-2.5 bg-muted rounded-full overflow-hidden'>
                  <div className={`h-full rounded-full ${scoreBg(s)} transition-all duration-700`} style={{ width: `${(s / 10) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Strengths & Improvements */}
        <div className='grid grid-cols-2 gap-6 mb-6'>
          {scoring.strengths.length > 0 && (
            <div>
              <h3 className='text-sm font-semibold mb-2 uppercase tracking-wide text-muted-foreground'>Strengths</h3>
              <ul className='space-y-1.5'>
                {scoring.strengths.map((s, i) => (
                  <li key={i} className='text-sm flex items-start gap-2'><span className='text-green-500'>•</span>{s}</li>
                ))}
              </ul>
            </div>
          )}
          {scoring.areas_for_improvement.length > 0 && (
            <div>
              <h3 className='text-sm font-semibold mb-2 uppercase tracking-wide text-muted-foreground'>Areas for Improvement</h3>
              <ul className='space-y-1.5'>
                {scoring.areas_for_improvement.map((s, i) => (
                  <li key={i} className='text-sm flex items-start gap-2'><span className='text-amber-500'>•</span>{s}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* CRM Report */}
        {report && !('error' in report) && (
          <div className='mb-6'>
            <h3 className='text-sm font-semibold mb-3 uppercase tracking-wide text-muted-foreground'>CRM Report</h3>
            <div className='bg-muted rounded-xl p-4 space-y-2 text-sm'>
              <div className='grid grid-cols-2 gap-3'>
                <div><span className='text-muted-foreground'>Duration:</span> <span className='font-medium'>{report.duration_seconds}s</span></div>
                <div><span className='text-muted-foreground'>Format:</span> <span className='font-medium capitalize'>{report.visit_format}</span></div>
                <div><span className='text-muted-foreground'>Doctor Style:</span> <span className='font-medium capitalize'>{report.doctor_style}</span></div>
                <div><span className='text-muted-foreground'>Engagement:</span> <span className='font-medium capitalize'>{report.engagement_level}</span></div>
              </div>
              {report.need_identified && <div><span className='text-muted-foreground'>Need:</span> <span className='font-medium'>{report.need_identified}</span></div>}
              {report.next_step && <div><span className='text-muted-foreground'>Next Step:</span> <span className='font-medium'>{report.next_step}</span></div>}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className='flex gap-3'>
          <Button variant='outline' className='flex-1' onClick={onClose}>New Session</Button>
          <Button className='flex-1' onClick={onDashboard}>View Dashboard →</Button>
        </div>
      </Card>
    </div>
  )
}
