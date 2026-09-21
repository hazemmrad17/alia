'use client'

import { useEffect, useState } from 'react'
import { AlertCircle, Bug, Inbox, Lightbulb, Loader2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { listSupportReports } from '@/lib/alia-api'
import type { SupportReport, SupportReportKind } from '@/lib/alia-api'
import { cn } from '@/lib/utils'

const KIND_META: Record<SupportReportKind, { label: string; icon: typeof Bug; className: string }> = {
  problem: { label: 'Problème', icon: Bug, className: 'bg-destructive/10 text-destructive border-transparent' },
  suggestion: { label: 'Suggestion', icon: Lightbulb, className: 'bg-primary/10 text-primary border-transparent' },
  feedback: { label: 'Feedback', icon: Lightbulb, className: 'bg-primary/10 text-primary border-transparent' }
}

/** Recent reports sent from the session (or from this page), newest first. */
export default function SupportReportList({
  limit = 8,
  refreshKey = 0
}: {
  limit?: number
  /** Bump to refetch — a sibling form just sent a new report. */
  refreshKey?: number
}) {
  const [reports, setReports] = useState<SupportReport[] | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let alive = true

    setError(false)
    listSupportReports(limit)
      .then(res => {
        if (alive) setReports(res.reports)
      })
      .catch(() => {
        // Backend offline: the page still renders, the inbox is just unknown.
        if (alive) setError(true)
      })

    return () => {
      alive = false
    }
  }, [limit, refreshKey])

  if (error) {
    return (
      <p className='flex items-center gap-2 py-6 text-sm text-muted-foreground'>
        <AlertCircle className='size-4 shrink-0' />
        Serveur injoignable — impossible de charger les signalements.
      </p>
    )
  }

  if (!reports) {
    return (
      <p className='flex items-center gap-2 py-6 text-sm text-muted-foreground'>
        <Loader2 className='size-4 animate-spin' />
        Chargement des signalements…
      </p>
    )
  }

  if (reports.length === 0) {
    return (
      <div className='flex flex-col items-center gap-2 py-8 text-center'>
        <Inbox className='size-6 text-muted-foreground/50' />
        <p className='text-sm text-muted-foreground'>Aucun signalement pour l’instant.</p>
      </div>
    )
  }

  return (
    <ul className='flex flex-col divide-y divide-border/60'>
      {reports.map(r => {
        const meta = KIND_META[r.kind] ?? KIND_META.problem
        const Icon = meta.icon
        // Only the context that actually exists — keeps the line readable.
        const context = [
          r.product_focus,
          r.step,
          r.level,
          r.visit_format,
          r.doctor_style
        ]
          .filter(Boolean)
          .join(' · ')

        return (
          <li key={r.id} className='flex flex-col gap-1.5 py-3 first:pt-0 last:pb-0'>
            <div className='flex items-center gap-2'>
              <Badge variant='outline' className={cn('gap-1', meta.className)}>
                <Icon className='size-3' />
                {meta.label}
              </Badge>
              {r.category && (
                <span className='text-xs text-muted-foreground'>{r.category}</span>
              )}
              <span className='ml-auto shrink-0 text-xs tabular-nums text-muted-foreground'>
                {r.created_at ? r.created_at.replace('T', ' ').slice(0, 16) : ''}
              </span>
            </div>
            <p className='text-sm whitespace-pre-wrap'>{r.message}</p>
            {context && <p className='text-xs text-muted-foreground'>{context}</p>}
            {r.contact && <p className='text-xs text-primary'>{r.contact}</p>}
          </li>
        )
      })}
    </ul>
  )
}
