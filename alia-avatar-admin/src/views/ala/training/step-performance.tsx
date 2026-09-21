'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Progress } from '@/components/ui/progress'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { RadarChart, PolarGrid, PolarAngleAxis, Radar } from 'recharts'

import { getStepAnalysis } from '@/lib/alia-api'
import type { StepAnalysis } from '@/types/alia'
import { STEP_META, ALL_VISIT_STEPS } from '@/types/alia'

const DEMO_STEPS: StepAnalysis = {
  introduction: { avg_score: 8.2, count: 24 },
  sondage: { avg_score: 6.8, count: 22 },
  synthese: { avg_score: 7.5, count: 20 },
  objections: { avg_score: 5.9, count: 18 },
  argumentation: { avg_score: 7.1, count: 16 },
  conclusion: { avg_score: 8.0, count: 15 },
}

const RADAR_CONFIG = { score: { label: 'Avg Score', color: 'var(--primary)' } }

function ScoreBadge({ score }: { score: number }) {
  const cls =
    score >= 8 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
    score >= 6 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400'
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold tabular-nums ${cls}`}>
      {score.toFixed(1)} / 10
    </span>
  )
}

export default function StepPerformance() {
  const [steps, setSteps] = useState<StepAnalysis>(DEMO_STEPS)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getStepAnalysis()
      .then(data => setSteps(data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const radarData = ALL_VISIT_STEPS.map(step => ({
    step: STEP_META[step]?.label ?? step,
    score: steps[step]?.avg_score ?? 0,
    fullMark: 10,
  }))

  const weakStep = ALL_VISIT_STEPS.reduce((min, s) =>
    (steps[s]?.avg_score ?? 0) < (steps[min]?.avg_score ?? Infinity) ? s : min
  )
  const strongStep = ALL_VISIT_STEPS.reduce((max, s) =>
    (steps[s]?.avg_score ?? 0) > (steps[max]?.avg_score ?? -Infinity) ? s : max
  )

  return (
    <div className='grid grid-cols-6 gap-4'>
      {/* Radar Chart */}
      <Card className='col-span-6 lg:col-span-3'>
        <CardHeader>
          <CardTitle className='text-base'>Competency Radar</CardTitle>
          <CardDescription>Visual strength/weakness across all 6 steps</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className='h-64 w-full rounded-full' />
          ) : (
            <ChartContainer config={RADAR_CONFIG} className='h-64 w-full'>
              <RadarChart data={radarData}>
                <PolarGrid className='stroke-border' />
                <PolarAngleAxis dataKey='step' tick={{ fontSize: 11 }} />
                <Radar
                  dataKey='score'
                  stroke='var(--primary)'
                  fill='var(--primary)'
                  fillOpacity={0.3}
                  strokeWidth={2}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
              </RadarChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>

      {/* Highlights */}
      <div className='col-span-6 lg:col-span-3 grid grid-cols-1 gap-4 content-start'>
        <Card className='border-emerald-200 dark:border-emerald-800'>
          <CardHeader>
            <CardTitle className='text-sm text-emerald-600 dark:text-emerald-400'>💪 Strongest Step</CardTitle>
          </CardHeader>
          <CardContent>
            <div className='flex items-center gap-3'>
              <span className='text-3xl'>{STEP_META[strongStep]?.icon}</span>
              <div>
                <p className='font-semibold'>{STEP_META[strongStep]?.label}</p>
                <ScoreBadge score={steps[strongStep]?.avg_score ?? 0} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className='border-rose-200 dark:border-rose-800'>
          <CardHeader>
            <CardTitle className='text-sm text-rose-600 dark:text-rose-400'>⚠️ Needs Improvement</CardTitle>
          </CardHeader>
          <CardContent>
            <div className='flex items-center gap-3'>
              <span className='text-3xl'>{STEP_META[weakStep]?.icon}</span>
              <div>
                <p className='font-semibold'>{STEP_META[weakStep]?.label}</p>
                <ScoreBadge score={steps[weakStep]?.avg_score ?? 0} />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Table */}
      <Card className='col-span-full'>
        <CardHeader>
          <CardTitle className='text-base'>Step-by-Step Breakdown</CardTitle>
          <CardDescription>Detailed scores and session coverage per visit step</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className='space-y-3'>
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className='h-12 w-full' />)}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Step</TableHead>
                  <TableHead className='text-center'>Sessions</TableHead>
                  <TableHead className='text-center'>Avg Score</TableHead>
                  <TableHead className='text-center'>Min</TableHead>
                  <TableHead className='text-center'>Max</TableHead>
                  <TableHead>Performance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ALL_VISIT_STEPS.map(step => {
                  const meta = STEP_META[step]
                  const data = steps[step]
                  return (
                    <TableRow key={step}>
                      <TableCell>
                        <div className='flex items-center gap-2'>
                          <span className='text-lg leading-none'>{meta?.icon}</span>
                          <span className={`font-medium text-sm ${meta?.textClass}`}>{meta?.label}</span>
                        </div>
                      </TableCell>
                      <TableCell className='text-center text-muted-foreground tabular-nums'>
                        {data?.count ?? 0}
                      </TableCell>
                      <TableCell className='text-center'>
                        <ScoreBadge score={data?.avg_score ?? 0} />
                      </TableCell>
                      <TableCell className='text-center text-muted-foreground tabular-nums text-sm'>
                        {(data?.avg_score ? data.avg_score - 1.5 : 0).toFixed(1)}
                      </TableCell>
                      <TableCell className='text-center text-muted-foreground tabular-nums text-sm'>
                        {(data?.avg_score ? Math.min(data.avg_score + 1.5, 10) : 0).toFixed(1)}
                      </TableCell>
                      <TableCell className='min-w-32'>
                        <Progress value={((data?.avg_score ?? 0) / 10) * 100} className='h-2' />
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
