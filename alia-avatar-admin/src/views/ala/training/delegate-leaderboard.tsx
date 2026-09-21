'use client'

import { Trophy, Medal, Award } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table'
import { LEVEL_META } from '@/types/alia'
import type { CompetenceLevel } from '@/types/alia'

const DEMO_DELEGATES = [
  { id: '1', name: 'Karim Benali', level: 'expert' as CompetenceLevel, avg_score: 9.2, sessions: 12, best_product: 'LV Fersang' },
  { id: '2', name: 'Amira Zouari', level: 'confirme' as CompetenceLevel, avg_score: 8.6, sessions: 10, best_product: 'Oligovit' },
  { id: '3', name: 'Yacine Hadj', level: 'confirme' as CompetenceLevel, avg_score: 8.1, sessions: 9, best_product: 'CALMOSS' },
  { id: '4', name: 'Rania Boudali', level: 'junior' as CompetenceLevel, avg_score: 7.4, sessions: 8, best_product: 'VITONIC' },
  { id: '5', name: 'Sami Djabri', level: 'junior' as CompetenceLevel, avg_score: 7.1, sessions: 7, best_product: 'LV Fersang' },
  { id: '6', name: 'Leila Ferhat', level: 'junior' as CompetenceLevel, avg_score: 6.8, sessions: 6, best_product: 'Magné B6' },
  { id: '7', name: 'Omar Khaled', level: 'debutant' as CompetenceLevel, avg_score: 5.9, sessions: 5, best_product: 'CALMOSS' },
  { id: '8', name: 'Nadia Saidi', level: 'debutant' as CompetenceLevel, avg_score: 5.3, sessions: 4, best_product: 'Oligovit' },
]

const RANK_ICONS = [
  <Trophy key={0} className='size-4 text-amber-500' />,
  <Medal key={1} className='size-4 text-slate-400' />,
  <Award key={2} className='size-4 text-orange-400' />,
]

function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

export default function DelegateLeaderboard() {
  const top3 = DEMO_DELEGATES.slice(0, 3)
  const rest = DEMO_DELEGATES.slice(3)
  const maxScore = DEMO_DELEGATES[0]?.avg_score ?? 10

  return (
    <div className='grid grid-cols-6 gap-4'>
      {/* Top 3 Podium Cards */}
      {top3.map((delegate, i) => {
        const levelMeta = LEVEL_META[delegate.level]
        return (
          <Card key={delegate.id} className={`col-span-6 sm:col-span-2 ${i === 0 ? 'border-amber-300 dark:border-amber-700 shadow-md' : ''}`}>
            <CardHeader className='items-center text-center pb-2'>
              <div className='relative'>
                <Avatar className='size-14'>
                  <AvatarFallback className='bg-primary/10 text-primary font-bold text-lg'>
                    {getInitials(delegate.name)}
                  </AvatarFallback>
                </Avatar>
                <span className='absolute -top-1 -right-1'>{RANK_ICONS[i]}</span>
              </div>
              <CardTitle className='text-sm mt-2'>{delegate.name}</CardTitle>
              <Badge variant='secondary' className={`${levelMeta?.textClass} text-xs`}>
                {levelMeta?.label}
              </Badge>
            </CardHeader>
            <CardContent className='text-center space-y-1'>
              <p className='text-2xl font-bold tabular-nums text-primary'>{delegate.avg_score.toFixed(1)}</p>
              <p className='text-xs text-muted-foreground'>{delegate.sessions} sessions</p>
              <p className='text-xs text-muted-foreground'>Best: {delegate.best_product}</p>
              <Progress value={(delegate.avg_score / maxScore) * 100} className='h-1.5 mt-2' />
            </CardContent>
          </Card>
        )
      })}

      {/* Full Leaderboard Table */}
      <Card className='col-span-full'>
        <CardHeader>
          <CardTitle className='text-base'>Full Leaderboard</CardTitle>
          <CardDescription>All delegates ranked by average training score</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className='w-12'>Rank</TableHead>
                <TableHead>Delegate</TableHead>
                <TableHead>Level</TableHead>
                <TableHead className='text-center'>Sessions</TableHead>
                <TableHead className='text-center'>Avg Score</TableHead>
                <TableHead>Best Product</TableHead>
                <TableHead>Progress</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {DEMO_DELEGATES.map((delegate, i) => {
                const levelMeta = LEVEL_META[delegate.level]
                const rankIcon = RANK_ICONS[i]
                return (
                  <TableRow key={delegate.id}>
                    <TableCell className='text-center'>
                      {rankIcon ?? <span className='text-muted-foreground text-sm tabular-nums'>{i + 1}</span>}
                    </TableCell>
                    <TableCell>
                      <div className='flex items-center gap-2'>
                        <Avatar className='size-7'>
                          <AvatarFallback className='bg-primary/10 text-primary text-xs font-bold'>
                            {getInitials(delegate.name)}
                          </AvatarFallback>
                        </Avatar>
                        <span className='font-medium text-sm'>{delegate.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant='secondary' className={`${levelMeta?.textClass} text-xs`}>
                        {levelMeta?.label}
                      </Badge>
                    </TableCell>
                    <TableCell className='text-center tabular-nums text-muted-foreground'>{delegate.sessions}</TableCell>
                    <TableCell className='text-center'>
                      <span className='font-bold tabular-nums text-primary'>{delegate.avg_score.toFixed(1)}</span>
                    </TableCell>
                    <TableCell className='text-sm text-muted-foreground'>{delegate.best_product}</TableCell>
                    <TableCell className='min-w-28'>
                      <Progress value={(delegate.avg_score / 10) * 100} className='h-2' />
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
