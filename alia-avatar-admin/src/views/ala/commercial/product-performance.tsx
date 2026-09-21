'use client'

import { useState, useEffect } from 'react'
import { Package } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { Bar, BarChart, XAxis, YAxis, CartesianGrid } from 'recharts'

import { getDashboardStats } from '@/lib/alia-api'
import type { SessionStats } from '@/types/alia'

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
    { name: 'Spasfon Lyoc', count: 3 },
  ],
  recent_sessions: [],
}

const CHART_CONFIG = {
  count: { label: 'Sessions', color: 'var(--primary)' },
}

export default function ProductPerformance() {
  const [stats, setStats] = useState<SessionStats>(DEMO_STATS)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getDashboardStats()
      .then(data => setStats(data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const maxCount = stats.top_products[0]?.count ?? 1
  const chartData = stats.top_products.map(p => ({
    product: p.name.length > 12 ? p.name.slice(0, 12) + '…' : p.name,
    count: p.count,
  }))

  return (
    <div className='grid grid-cols-6 gap-4'>
      {/* Bar Chart */}
      <Card className='col-span-full'>
        <CardHeader>
          <CardTitle className='text-base'>Product Presentation Volume</CardTitle>
          <CardDescription>Number of sessions per product</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className='h-52 w-full rounded-md' />
          ) : (
            <ChartContainer config={CHART_CONFIG} className='h-52 w-full'>
              <BarChart data={chartData} barSize={36}>
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

      {/* Table */}
      <Card className='col-span-full'>
        <CardHeader>
          <CardTitle className='text-base'>Product Rankings</CardTitle>
          <CardDescription>All products ranked by presentation count</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className='space-y-3'>
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className='h-10 w-full' />)}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className='w-10'>#</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead className='text-center'>Sessions</TableHead>
                  <TableHead className='text-center'>Share</TableHead>
                  <TableHead>Reach</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.top_products.map((product, i) => {
                  const total = stats.top_products.reduce((a, b) => a + b.count, 0)
                  const share = ((product.count / total) * 100).toFixed(0)
                  return (
                    <TableRow key={product.name}>
                      <TableCell className='text-muted-foreground tabular-nums text-sm'>{i + 1}</TableCell>
                      <TableCell>
                        <div className='flex items-center gap-2'>
                          <Package className='size-3.5 text-primary' />
                          <span className='font-medium text-sm'>{product.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className='text-center tabular-nums'>{product.count}</TableCell>
                      <TableCell className='text-center'>
                        <Badge variant='secondary' className='tabular-nums text-xs'>{share}%</Badge>
                      </TableCell>
                      <TableCell className='min-w-36'>
                        <Progress value={(product.count / maxCount) * 100} className='h-2' />
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
