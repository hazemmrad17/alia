'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  CalendarDays,
  CalendarPlus,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Play,
  Stethoscope,
  Video,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { titleCase } from './product-catalog'

type ConsultationStatus = 'confirmed' | 'pending' | 'done'

interface Consultation {
  date: string // YYYY-MM-DD
  time: string
  product: string
  delegate: string
  format: string
  status: ConsultationStatus
}

const STATUS_META: Record<ConsultationStatus, { label: string; className: string }> = {
  confirmed: { label: 'Confirmed', className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' },
  pending: { label: 'Pending', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' },
  done: { label: 'Done', className: 'bg-muted text-muted-foreground' },
}

// Sample schedule for September 2026 (current month in the demo environment).
const DEMO_CONSULTATIONS: Consultation[] = [
  { date: '2026-09-02', time: '10:00', product: 'LV Fersang', delegate: 'Amira Zouari', format: 'Flash', status: 'done' },
  { date: '2026-09-03', time: '09:30', product: 'CALMOSS', delegate: 'Karim Benali', format: 'Standard', status: 'confirmed' },
  { date: '2026-09-03', time: '14:00', product: 'VITONIC', delegate: 'Amira Zouari', format: 'Standard', status: 'confirmed' },
  { date: '2026-09-05', time: '11:30', product: 'Oligovit Vitamine C', delegate: 'Yacine Hadj', format: 'Flash', status: 'pending' },
  { date: '2026-09-08', time: '15:00', product: 'Magné B6', delegate: 'Karim Benali', format: 'Approfondie', status: 'pending' },
  { date: '2026-09-10', time: '09:00', product: 'Doliprane 1000', delegate: 'Amira Zouari', format: 'Flash', status: 'pending' },
  { date: '2026-09-12', time: '10:30', product: 'Spasfon Lyoc', delegate: 'Yacine Hadj', format: 'Standard', status: 'pending' },
  { date: '2026-09-15', time: '14:30', product: 'FERBIOTIC', delegate: 'Karim Benali', format: 'Approfondie', status: 'pending' },
  { date: '2026-09-17', time: '09:15', product: 'CALMOSS', delegate: 'Amira Zouari', format: 'Standard', status: 'pending' },
  { date: '2026-09-19', time: '11:00', product: 'VITONIC', delegate: 'Yacine Hadj', format: 'Flash', status: 'pending' },
  { date: '2026-09-22', time: '10:00', product: 'LV Fersang', delegate: 'Karim Benali', format: 'Approfondie', status: 'pending' },
]

const WEEKDAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
const MONTHS_FR = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']

function toKey(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

export default function ConsultationCalendarView() {
  const router = useRouter()
  const today = useMemo(() => new Date(), [])
  const [cursor, setCursor] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1))
  const [selectedKey, setSelectedKey] = useState(() => toKey(today))

  const byDate = useMemo(() => {
    const map = new Map<string, Consultation[]>()
    for (const c of DEMO_CONSULTATIONS) {
      const list = map.get(c.date) ?? []
      list.push(c)
      map.set(c.date, list)
    }
    return map
  }, [])

  const selectedDate = useMemo(() => {
    const [y, m, d] = selectedKey.split('-').map(Number)
    return new Date(y, m - 1, d)
  }, [selectedKey])

  const cells = useMemo(() => {
    const year = cursor.getFullYear()
    const month = cursor.getMonth()
    const first = new Date(year, month, 1)
    // Monday-first offset (JS: Sunday = 0 → Monday = 1)
    const offset = (first.getDay() + 6) % 7
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const out: (string | null)[] = []
    for (let i = 0; i < offset; i++) out.push(null)
    for (let d = 1; d <= daysInMonth; d++) out.push(toKey(new Date(year, month, d)))
    return out
  }, [cursor])

  const monthLabel = `${MONTHS_FR[cursor.getMonth()]} ${cursor.getFullYear()}`
  const dayConsultations = byDate.get(selectedKey) ?? []

  const moveMonth = (delta: number) => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + delta, 1))
  const goToday = () => {
    setCursor(new Date(today.getFullYear(), today.getMonth(), 1))
    setSelectedKey(toKey(today))
  }

  const launch = (product: string) => router.push(`/commercial?product=${encodeURIComponent(product)}`)

  return (
    <div className='grid grid-cols-6 gap-6'>
      {/* ── Calendar ── */}
      <Card className='col-span-6 xl:col-span-4'>
        <CardHeader className='flex-row flex-wrap items-center justify-between gap-3'>
          <div>
            <CardTitle className='flex items-center gap-2 text-base'>
              <CalendarDays className='size-4 text-primary' />
              {monthLabel}
            </CardTitle>
            <CardDescription>ALIA consultation &amp; sales-pitch schedule</CardDescription>
          </div>
          <div className='flex items-center gap-1.5'>
            <Button variant='outline' size='icon' className='size-8' onClick={() => moveMonth(-1)} aria-label='Previous month'>
              <ChevronLeft className='size-4' />
            </Button>
            <Button variant='outline' size='sm' onClick={goToday}>Today</Button>
            <Button variant='outline' size='icon' className='size-8' onClick={() => moveMonth(1)} aria-label='Next month'>
              <ChevronRight className='size-4' />
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          {/* Weekday header */}
          <div className='grid grid-cols-7 gap-1.5'>
            {WEEKDAYS.map(w => (
              <div key={w} className='pb-1 text-center text-xs font-semibold text-muted-foreground'>
                {w}
              </div>
            ))}
          </div>

          {/* Day grid */}
          <div className='grid grid-cols-7 gap-1.5'>
            {cells.map((key, i) => {
              if (!key) return <div key={`empty-${i}`} className='min-h-20 rounded-lg border border-transparent' />

              const date = new Date(key + 'T00:00:00')
              const events = byDate.get(key) ?? []
              const isToday = key === toKey(today)
              const isSelected = key === selectedKey

              return (
                <button
                  key={key}
                  type='button'
                  onClick={() => setSelectedKey(key)}
                  className={cn(
                    'flex min-h-20 flex-col items-stretch gap-1 rounded-lg border p-1.5 text-left transition-colors',
                    isSelected
                      ? 'border-primary bg-primary/10'
                      : 'border-border/60 hover:border-primary/40 hover:bg-muted/40'
                  )}
                >
                  <span
                    className={cn(
                      'flex size-6 items-center justify-center rounded-full text-xs font-semibold',
                      isToday ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'
                    )}
                  >
                    {date.getDate()}
                  </span>
                  <div className='flex flex-col gap-1'>
                    {events.slice(0, 2).map(e => (
                      <span
                        key={e.time}
                        className={cn(
                          'truncate rounded px-1 py-0.5 text-[10px] font-medium',
                          STATUS_META[e.status].className
                        )}
                      >
                        {e.time} · {e.product}
                      </span>
                    ))}
                    {events.length > 2 && (
                      <span className='px-1 text-[10px] text-muted-foreground'>+{events.length - 2} more</span>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* ── Selected day: consultations ── */}
      <div className='col-span-6 space-y-4 xl:col-span-2'>
        <Card>
          <CardHeader>
            <CardTitle className='text-base'>
              {selectedDate.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
            </CardTitle>
            <CardDescription>
              {dayConsultations.length > 0
                ? `${dayConsultations.length} consultation${dayConsultations.length > 1 ? 's' : ''} scheduled`
                : 'No consultations scheduled'}
            </CardDescription>
          </CardHeader>
          <CardContent className='space-y-2.5'>
            {dayConsultations.length === 0 ? (
              <div className='flex flex-col items-center gap-2 py-6 text-center text-muted-foreground'>
                <CalendarPlus className='size-8 opacity-40' />
                <p className='text-sm'>Nothing planned for this day.</p>
              </div>
            ) : (
              dayConsultations.map(c => (
                <div key={c.time} className='rounded-lg border border-border/60 p-3'>
                  <div className='flex items-center justify-between gap-2'>
                    <Badge className={cn('border-0', STATUS_META[c.status].className)}>{STATUS_META[c.status].label}</Badge>
                    <span className='flex items-center gap-1 text-xs text-muted-foreground'>
                      <Clock className='size-3.5' />
                      {c.time}
                    </span>
                  </div>
                  <p className='mt-2 text-sm font-semibold'>{titleCase(c.product)}</p>
                  <p className='mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground'>
                    <Stethoscope className='size-3.5' />
                    {c.delegate} · {c.format}
                  </p>
                  <div className='mt-3 flex gap-2'>
                    <Button
                      size='sm'
                      className='flex-1'
                      disabled={c.status === 'done'}
                      onClick={() => launch(c.product)}
                    >
                      <Play className='mr-1.5 size-3.5' />
                      {c.status === 'done' ? 'Completed' : 'Join pitch'}
                    </Button>
                    <Button size='sm' variant='outline' className='flex-1' disabled={c.status === 'done'} onClick={() => launch(c.product)}>
                      <Video className='mr-1.5 size-3.5' />
                      Present
                    </Button>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Legend */}
        <Card>
          <CardContent className='space-y-1.5 p-4'>
            <p className='mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground'>Status</p>
            {(Object.keys(STATUS_META) as ConsultationStatus[]).map(s => (
              <div key={s} className='flex items-center gap-2 text-sm'>
                {s === 'confirmed' ? (
                  <CheckCircle2 className='size-4 text-emerald-500' />
                ) : (
                  <span className={cn('size-2 rounded-full', s === 'pending' ? 'bg-amber-500' : 'bg-muted-foreground/40')} />
                )}
                {STATUS_META[s].label}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}