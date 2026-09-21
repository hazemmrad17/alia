'use client'

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { Line, LineChart, XAxis, YAxis, CartesianGrid, Legend } from 'recharts'
import { TrendingUp, Award, GraduationCap, ShoppingBag } from 'lucide-react'

// ── Demo trend data ──
const WEEKLY_DATA = [
  { week: 'W1', training: 6.2, commercial: 7.0 },
  { week: 'W2', training: 6.8, commercial: 7.3 },
  { week: 'W3', training: 7.1, commercial: 7.5 },
  { week: 'W4', training: 7.3, commercial: 7.8 },
  { week: 'W5', training: 7.8, commercial: 8.0 },
  { week: 'W6', training: 7.5, commercial: 7.6 },
  { week: 'W7', training: 8.0, commercial: 8.2 },
  { week: 'W8', training: 8.2, commercial: 7.9 },
]

const TRENDS_CONFIG = {
  training: { label: 'Training Score', color: 'var(--chart-2)' },
  commercial: { label: 'Commercial Score', color: 'var(--chart-1)' },
}

export default function ScoreTrendsView() {
  const lastTraining = WEEKLY_DATA[WEEKLY_DATA.length - 1].training
  const firstTraining = WEEKLY_DATA[0].training
  const trainingChange = lastTraining - firstTraining

  const lastCommercial = WEEKLY_DATA[WEEKLY_DATA.length - 1].commercial
  const firstCommercial = WEEKLY_DATA[0].commercial
  const commercialChange = lastCommercial - firstCommercial

  return (
    <div className='grid grid-cols-6 gap-4'>
      {/* ── Trend Overview Cards ── */}
      <Card className='col-span-6 lg:col-span-2'>
        <CardHeader>
          <CardTitle className='text-base'>8-Week Progression</CardTitle>
          <CardDescription>Comparative score growth by mode</CardDescription>
        </CardHeader>
        <CardContent className='space-y-6'>
          <div className='rounded-lg border bg-card/60 p-3.5 space-y-2'>
            <div className='flex items-center justify-between'>
              <div className='flex items-center gap-1.5'>
                <GraduationCap className='size-4 text-purple-600 dark:text-purple-400' />
                <Badge variant='secondary' className='text-purple-700 bg-purple-100 dark:bg-purple-900/30 dark:text-purple-300'>
                  Training Mode
                </Badge>
              </div>
              <span className='text-xs text-muted-foreground'>8 weeks</span>
            </div>
            <div className='flex items-center justify-between pt-1'>
              <span className='text-3xl font-bold tabular-nums'>{lastTraining.toFixed(1)}</span>
              <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold ${
                trainingChange >= 0
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                  : 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400'
              }`}>
                <TrendingUp className='size-3' />
                {trainingChange >= 0 ? '+' : ''}{trainingChange.toFixed(1)} pts
              </span>
            </div>
          </div>

          <div className='rounded-lg border bg-card/60 p-3.5 space-y-2'>
            <div className='flex items-center justify-between'>
              <div className='flex items-center gap-1.5'>
                <ShoppingBag className='size-4 text-primary' />
                <Badge variant='secondary' className='text-emerald-700 bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-300'>
                  Commercial Mode
                </Badge>
              </div>
              <span className='text-xs text-muted-foreground'>8 weeks</span>
            </div>
            <div className='flex items-center justify-between pt-1'>
              <span className='text-3xl font-bold tabular-nums'>{lastCommercial.toFixed(1)}</span>
              <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold ${
                commercialChange >= 0
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                  : 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400'
              }`}>
                <TrendingUp className='size-3' />
                {commercialChange >= 0 ? '+' : ''}{commercialChange.toFixed(1)} pts
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Line Chart ── */}
      <Card className='col-span-6 lg:col-span-4'>
        <CardHeader>
          <CardTitle className='text-base'>Weekly Score Trends</CardTitle>
          <CardDescription>Average scores by week — Training (Purple) vs Commercial (Green)</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={TRENDS_CONFIG} className='h-64 w-full'>
            <LineChart data={WEEKLY_DATA}>
              <CartesianGrid strokeDasharray='3 3' className='stroke-border' vertical={false} />
              <XAxis dataKey='week' tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis domain={[0, 10]} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Legend />
              <Line type='monotone' dataKey='training' stroke='var(--chart-2)' strokeWidth={2.5} dot={{ r: 4 }} name='Training' />
              <Line type='monotone' dataKey='commercial' stroke='var(--chart-1)' strokeWidth={2.5} dot={{ r: 4 }} name='Commercial' />
            </LineChart>
          </ChartContainer>
        </CardContent>
      </Card>
    </div>
  )
}
