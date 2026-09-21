'use client'

import { useState, useEffect } from 'react'
import { FileText, Package, Users, Clock, Stethoscope, TrendingUp } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import {
  Bar, BarChart, XAxis, YAxis, CartesianGrid,
  PieChart, Pie, Cell
} from 'recharts'

import { StatCard } from '@/components/shared/stat-card'
import { getDashboardStats, listProducts } from '@/lib/alia-api'
import type { SessionStats, Product } from '@/types/alia'

// ── Demo data ──────────────────────────────────────────────────────────────────
const DEMO_STATS: SessionStats = {
  total_sessions: 18,
  average_score: 7.8,
  level_distribution: {},
  top_products: [
    { name: 'LV Fersang', count: 12 },
    { name: 'Oligovit Vitamine C', count: 9 },
    { name: 'CALMOSS', count: 7 },
    { name: 'VITONIC', count: 5 },
    { name: 'Magné B6', count: 4 },
  ],
  recent_sessions: [
    { id: 'com-001', mode: 'commercial', level: 'junior', product: 'LV Fersang', score: 8.2, started_at: '2026-09-01T10:00:00' },
    { id: 'com-002', mode: 'commercial', level: 'junior', product: 'Oligovit', score: 7.5, started_at: '2026-09-01T14:30:00' },
    { id: 'com-003', mode: 'commercial', level: 'confirme', product: 'CALMOSS', score: 8.9, started_at: '2026-09-01T16:00:00' },
    { id: 'com-004', mode: 'commercial', level: 'junior', product: 'VITONIC', score: 6.8, started_at: '2026-08-31T09:00:00' },
    { id: 'com-005', mode: 'commercial', level: 'confirme', product: 'LV Fersang', score: 9.1, started_at: '2026-08-30T11:00:00' },
  ],
}

const VISIT_FORMAT_DATA = [
  { format: 'Flash', count: 8, pct: 44, color: 'var(--chart-1)' },
  { format: 'Standard', count: 7, pct: 39, color: 'var(--chart-2)' },
  { format: 'Approfondie', count: 3, pct: 17, color: 'var(--chart-3)' },
]

const ENGAGEMENT_DATA = [
  { level: 'High', count: 6, color: 'var(--chart-1)' },
  { level: 'Moderate', count: 8, color: 'var(--chart-4)' },
  { level: 'Low', count: 4, color: 'var(--chart-5)' },
]

const DEMO_DOCTORS = [
  { name: 'Dr. Khalid Mansouri', specialty: 'Cardiologist', style: 'Analysant', sessions: 4 },
  { name: 'Dr. Amina Bouazza', specialty: 'Generalist', style: 'Facilitant', sessions: 3 },
  { name: 'Dr. Youssef El Haddad', specialty: 'Pediatrician', style: 'Promouvant', sessions: 3 },
  { name: 'Dr. Sara Khelil', specialty: 'Pharmacist', style: 'Controlant', sessions: 2 },
]

// ── Chart config ───────────────────────────────────────────────────────────────
const PRODUCT_CHART_CONFIG = {
  count: { label: 'Presentations', color: 'var(--primary)' },
}

// ── Engagement badge ───────────────────────────────────────────────────────────
function EngagementBadge({ level }: { level: string }) {
  const cls =
    level === 'High' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
    level === 'Moderate' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                           'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400'
  return <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold ${cls}`}>{level}</span>
}

function ScoreBadge({ score }: { score: number }) {
  const cls =
    score >= 8 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
    score >= 6 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400'
  return <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold tabular-nums ${cls}`}>{score.toFixed(1)}</span>
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function CommercialOverview() {
  const [stats, setStats] = useState<SessionStats>(DEMO_STATS)
  const [totalProducts, setTotalProducts] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.allSettled([getDashboardStats(), listProducts()])
      .then(([statsRes, productsRes]) => {
        if (statsRes.status === 'fulfilled') setStats(statsRes.value)
        if (productsRes.status === 'fulfilled') setTotalProducts((productsRes.value as { total: number }).total)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const productChartData = stats.top_products.map(p => ({
    product: p.name.length > 14 ? p.name.slice(0, 14) + '…' : p.name,
    count: p.count,
  }))

  const commercialSessions = stats.recent_sessions.filter(s => s.mode === 'commercial')
  const engagementTotal = ENGAGEMENT_DATA.reduce((a, b) => a + b.count, 0)
  const formatTotal = VISIT_FORMAT_DATA.reduce((a, b) => a + b.count, 0)

  return (
    <>
      {/* ── KPI Cards ── */}
      <div className='col-span-full grid grid-cols-2 gap-4 sm:grid-cols-4'>
        <StatCard
          icon={<FileText className='size-4' />}
          value={String(stats.total_sessions)}
          title='Total Presentations'
          change='+22% this week'
          trend='up'
          loading={loading}
          tooltip='Total commercial presentations delivered'
        />
        <StatCard
          icon={<Package className='size-4' />}
          value={String(totalProducts || stats.top_products.length)}
          title='Products Covered'
          change='+5 products'
          trend='up'
          loading={loading}
          iconClass='bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400'
        />
        <StatCard
          icon={<TrendingUp className='size-4' />}
          value='7.8'
          title='Avg Engagement'
          change='+0.3 pts'
          trend='up'
          loading={loading}
          tooltip='Average doctor engagement score'
        />
        <StatCard
          icon={<Clock className='size-4' />}
          value='12'
          title='Follow-ups Scheduled'
          change='+4 this week'
          trend='up'
          loading={loading}
        />
      </div>

      {/* ── Tabbed Content ── */}
      <div className='col-span-full'>
        <Tabs defaultValue='overview'>
          <TabsList className='mb-4'>
            <TabsTrigger value='overview'>Overview</TabsTrigger>
            <TabsTrigger value='products'>Products</TabsTrigger>
            <TabsTrigger value='presentations'>Presentations</TabsTrigger>
          </TabsList>

          {/* ── Tab: Overview ── */}
          <TabsContent value='overview' className='grid grid-cols-6 gap-4'>
            {/* Product Reach Chart */}
            <Card className='col-span-6 lg:col-span-4'>
              <CardHeader>
                <CardTitle className='text-base'>Product Reach</CardTitle>
                <CardDescription>Most presented products by session count</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <Skeleton className='h-52 w-full rounded-md' />
                ) : (
                  <ChartContainer config={PRODUCT_CHART_CONFIG} className='h-52 w-full'>
                    <BarChart data={productChartData} barSize={36}>
                      <CartesianGrid strokeDasharray='3 3' className='stroke-border' vertical={false} />
                      <XAxis dataKey='product' tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey='count' fill='var(--primary)' radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ChartContainer>
                )}
              </CardContent>
            </Card>

            {/* Visit Format Split */}
            <Card className='col-span-6 lg:col-span-2'>
              <CardHeader>
                <CardTitle className='text-base'>Visit Format Split</CardTitle>
                <CardDescription>Flash · Standard · Approfondie</CardDescription>
              </CardHeader>
              <CardContent className='space-y-4'>
                {VISIT_FORMAT_DATA.map(item => (
                  <div key={item.format} className='space-y-1.5'>
                    <div className='flex justify-between text-sm'>
                      <span className='font-medium'>{item.format}</span>
                      <span className='text-muted-foreground tabular-nums'>{item.count} ({item.pct}%)</span>
                    </div>
                    <Progress value={item.pct} className='h-1.5' />
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Engagement Levels */}
            <Card className='col-span-6 lg:col-span-3'>
              <CardHeader>
                <CardTitle className='text-base'>Doctor Engagement Levels</CardTitle>
                <CardDescription>Distribution of engagement quality</CardDescription>
              </CardHeader>
              <CardContent className='space-y-4'>
                {loading
                  ? Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className='h-10 w-full' />)
                  : ENGAGEMENT_DATA.map(item => {
                      const pct = (item.count / engagementTotal) * 100
                      return (
                        <div key={item.level} className='space-y-1.5'>
                          <div className='flex justify-between items-center'>
                            <EngagementBadge level={item.level} />
                            <span className='text-xs text-muted-foreground tabular-nums'>
                              {item.count} sessions ({pct.toFixed(0)}%)
                            </span>
                          </div>
                          <Progress value={pct} className='h-1.5' />
                        </div>
                      )
                    })}
              </CardContent>
            </Card>

            {/* Top Doctors */}
            <Card className='col-span-6 lg:col-span-3'>
              <CardHeader>
                <CardTitle className='text-base'>Top Visited Doctors</CardTitle>
                <CardDescription>Most frequently visited healthcare providers</CardDescription>
              </CardHeader>
              <CardContent>
                <div className='space-y-3'>
                  {DEMO_DOCTORS.map((doctor, i) => (
                    <div key={doctor.name}>
                      <div className='flex items-center justify-between'>
                        <div className='flex items-center gap-3'>
                          <div className='flex size-8 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold'>
                            {doctor.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                          </div>
                          <div>
                            <p className='text-sm font-medium leading-tight'>{doctor.name}</p>
                            <p className='text-xs text-muted-foreground'>{doctor.specialty}</p>
                          </div>
                        </div>
                        <div className='text-right'>
                          <Badge variant='secondary' className='text-xs'>{doctor.style}</Badge>
                          <p className='text-xs text-muted-foreground mt-1 tabular-nums'>{doctor.sessions} visits</p>
                        </div>
                      </div>
                      {i < DEMO_DOCTORS.length - 1 && <Separator className='mt-3' />}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Tab: Products ── */}
          <TabsContent value='products'>
            <Card>
              <CardHeader>
                <CardTitle className='text-base'>Product Performance</CardTitle>
                <CardDescription>All presented products ranked by session volume</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className='w-8'>#</TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead className='text-center'>Sessions</TableHead>
                      <TableHead>Reach</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stats.top_products.map((product, i) => {
                      const max = stats.top_products[0]?.count ?? 1
                      return (
                        <TableRow key={product.name}>
                          <TableCell className='text-muted-foreground text-sm tabular-nums'>{i + 1}</TableCell>
                          <TableCell className='font-medium'>{product.name}</TableCell>
                          <TableCell className='text-center tabular-nums'>{product.count}</TableCell>
                          <TableCell className='min-w-32'>
                            <Progress value={(product.count / max) * 100} className='h-2' />
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Tab: Presentations ── */}
          <TabsContent value='presentations'>
            <Card>
              <CardHeader>
                <CardTitle className='text-base'>Recent Presentations</CardTitle>
                <CardDescription>Latest commercial sessions</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className='space-y-3'>
                    {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className='h-12 w-full' />)}
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Session ID</TableHead>
                        <TableHead>Product</TableHead>
                        <TableHead className='text-center'>Engagement</TableHead>
                        <TableHead>Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {commercialSessions.map(session => (
                        <TableRow key={session.id}>
                          <TableCell className='font-mono text-xs text-muted-foreground'>
                            {session.id.slice(0, 12)}…
                          </TableCell>
                          <TableCell className='font-medium text-sm'>{session.product}</TableCell>
                          <TableCell className='text-center'>
                            <ScoreBadge score={session.score} />
                          </TableCell>
                          <TableCell className='text-sm text-muted-foreground'>
                            {new Date(session.started_at).toLocaleDateString('fr-FR')}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </>
  )
}
