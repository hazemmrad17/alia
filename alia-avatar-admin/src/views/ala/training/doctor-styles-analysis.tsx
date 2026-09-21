'use client'

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { PieChart, Pie, Cell } from 'recharts'

import { DOCTOR_STYLE_META } from '@/types/alia'
import type { DoctorStyle } from '@/types/alia'

const DEMO_STYLES = [
  { style: 'analysant' as DoctorStyle, count: 7, typical_soncas: ['Sécurité', 'Objectivité'] },
  { style: 'controlant' as DoctorStyle, count: 5, typical_soncas: ['Organisation', 'Contrôle'] },
  { style: 'facilitant' as DoctorStyle, count: 8, typical_soncas: ['Relation', 'Confiance'] },
  { style: 'promouvant' as DoctorStyle, count: 4, typical_soncas: ['Innovation', 'Nouveauté'] },
]

const PIE_COLORS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)']

const PIE_CONFIG = {
  analysant:  { label: 'Analysant',  color: 'var(--chart-1)' },
  controlant: { label: 'Controlant', color: 'var(--chart-2)' },
  facilitant: { label: 'Facilitant', color: 'var(--chart-3)' },
  promouvant: { label: 'Promouvant', color: 'var(--chart-4)' },
}

export default function DoctorStylesAnalysis() {
  const total = DEMO_STYLES.reduce((a, b) => a + b.count, 0)
  const pieData = DEMO_STYLES.map(s => ({
    name: DOCTOR_STYLE_META[s.style].label,
    value: s.count,
  }))

  return (
    <div className='grid grid-cols-6 gap-4'>
      {/* Summary Cards */}
      {DEMO_STYLES.map((item, i) => {
        const meta = DOCTOR_STYLE_META[item.style]
        return (
          <Card key={item.style} className='col-span-6 sm:col-span-3 lg:col-span-3'>
            <CardHeader className='flex-row items-start gap-3 pb-2'>
              <span className='text-3xl'>{meta.icon}</span>
              <div className='flex-1 min-w-0'>
                <CardTitle className='text-sm'>{meta.label}</CardTitle>
                <CardDescription className='text-xs'>{meta.description}</CardDescription>
              </div>
              <span className='text-2xl font-bold tabular-nums text-primary'>{item.count}</span>
            </CardHeader>
            <CardContent className='space-y-2'>
              <div className='flex flex-wrap gap-1.5'>
                {item.typical_soncas.map(s => (
                  <Badge key={s} variant='secondary' className='text-xs'>{s}</Badge>
                ))}
              </div>
              <p className='text-xs text-muted-foreground tabular-nums'>
                {((item.count / total) * 100).toFixed(0)}% of encounters
              </p>
            </CardContent>
          </Card>
        )
      })}

      {/* Pie Chart */}
      <Card className='col-span-6 lg:col-span-3'>
        <CardHeader>
          <CardTitle className='text-base'>Style Distribution</CardTitle>
          <CardDescription>Proportion of doctor personality types encountered</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={PIE_CONFIG} className='h-52 w-full'>
            <PieChart>
              <Pie
                data={pieData}
                dataKey='value'
                nameKey='name'
                cx='50%'
                cy='50%'
                outerRadius={80}
                innerRadius={40}
                strokeWidth={2}
              >
                {pieData.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <ChartTooltip content={<ChartTooltipContent />} />
            </PieChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Detail Table */}
      <Card className='col-span-6 lg:col-span-3'>
        <CardHeader>
          <CardTitle className='text-base'>SONCAS Analysis</CardTitle>
          <CardDescription>Key motivators per doctor style</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Style</TableHead>
                <TableHead>Key SONCAS</TableHead>
                <TableHead className='text-center'>Sessions</TableHead>
                <TableHead className='text-center'>%</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {DEMO_STYLES.map(item => {
                const meta = DOCTOR_STYLE_META[item.style]
                return (
                  <TableRow key={item.style}>
                    <TableCell>
                      <div className='flex items-center gap-2'>
                        <span>{meta.icon}</span>
                        <span className='font-medium text-sm'>{meta.label}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className='flex gap-1 flex-wrap'>
                        {item.typical_soncas.map(s => (
                          <Badge key={s} variant='outline' className='text-xs'>{s}</Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className='text-center tabular-nums'>{item.count}</TableCell>
                    <TableCell className='text-center text-muted-foreground tabular-nums text-sm'>
                      {((item.count / total) * 100).toFixed(0)}%
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
