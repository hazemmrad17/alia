import type { ReactNode } from 'react'
import { TrendingUp, TrendingDown } from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

interface StatCardProps {
  icon: ReactNode
  value: string
  title: string
  change: string
  trend: 'up' | 'down' | 'neutral'
  loading?: boolean
  tooltip?: string
  /** Tailwind class for the icon background, e.g. 'bg-primary/10 text-primary' */
  iconClass?: string
}

export function StatCard({ icon, value, title, change, trend, loading = false, tooltip, iconClass = 'bg-primary/10 text-primary' }: StatCardProps) {
  if (loading) {
    return (
      <Card>
        <CardHeader className='flex items-center gap-3 pb-2'>
          <Skeleton className='size-9 rounded-md' />
          <Skeleton className='h-8 w-20' />
        </CardHeader>
        <CardContent className='flex flex-col gap-2'>
          <Skeleton className='h-5 w-32' />
          <Skeleton className='h-4 w-24' />
        </CardContent>
      </Card>
    )
  }

  const card = (
    <Card className='transition-shadow hover:shadow-md'>
      <CardHeader className='flex items-center gap-3 pb-2'>
        <div className={`flex size-9 shrink-0 items-center justify-center rounded-md ${iconClass}`}>
          {icon}
        </div>
        <span className='text-2xl font-bold tabular-nums'>{value}</span>
      </CardHeader>
      <CardContent className='flex flex-col gap-1.5'>
        <span className='text-sm font-semibold leading-tight'>{title}</span>
        <p className='flex items-center gap-1.5'>
          {trend === 'up' && <TrendingUp className='size-3.5 text-emerald-500' />}
          {trend === 'down' && <TrendingDown className='size-3.5 text-rose-500' />}
          <span className={`text-xs font-medium ${trend === 'up' ? 'text-emerald-600' : trend === 'down' ? 'text-rose-600' : 'text-muted-foreground'}`}>
            {change}
          </span>
          <span className='text-xs text-muted-foreground'>vs last week</span>
        </p>
      </CardContent>
    </Card>
  )

  if (tooltip) {
    return (
      <Tooltip>
        <TooltipTrigger render={card} />
        <TooltipContent>{tooltip}</TooltipContent>
      </Tooltip>
    )
  }

  return card
}
