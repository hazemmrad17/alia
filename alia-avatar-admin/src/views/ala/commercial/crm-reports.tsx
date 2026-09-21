'use client'

import { FileText, Download, CheckCircle, Clock, AlertCircle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table'
import type { VisitFormat, DoctorStyle } from '@/types/alia'

type ReportStatus = 'generated' | 'pending' | 'failed'

interface DemoReport {
  id: string
  session_id: string
  date: string
  doctor: string
  specialty: string
  product: string
  format: VisitFormat
  doctor_style: DoctorStyle
  score: number
  engagement: string
  status: ReportStatus
}

const DEMO_REPORTS: DemoReport[] = [
  { id: 'rpt-001', session_id: 'com-001', date: '2026-09-01', doctor: 'Dr. Khalid Mansouri', specialty: 'Cardiologist', product: 'LV Fersang', format: 'approfondie', doctor_style: 'analysant', score: 8.2, engagement: 'High', status: 'generated' },
  { id: 'rpt-002', session_id: 'com-002', date: '2026-09-01', doctor: 'Dr. Amina Bouazza', specialty: 'Generalist', product: 'Oligovit', format: 'standard', doctor_style: 'facilitant', score: 7.5, engagement: 'Moderate', status: 'generated' },
  { id: 'rpt-003', session_id: 'com-003', date: '2026-09-01', doctor: 'Dr. Sara Khelil', specialty: 'Pharmacist', product: 'CALMOSS', format: 'flash', doctor_style: 'controlant', score: 8.9, engagement: 'High', status: 'generated' },
  { id: 'rpt-004', session_id: 'com-004', date: '2026-08-31', doctor: 'Dr. Youssef El Haddad', specialty: 'Pediatrician', product: 'VITONIC', format: 'standard', doctor_style: 'promouvant', score: 6.8, engagement: 'Moderate', status: 'pending' },
  { id: 'rpt-005', session_id: 'com-005', date: '2026-08-30', doctor: 'Dr. Khalid Mansouri', specialty: 'Cardiologist', product: 'LV Fersang', format: 'approfondie', doctor_style: 'analysant', score: 9.1, engagement: 'High', status: 'generated' },
]

function StatusBadge({ status }: { status: ReportStatus }) {
  if (status === 'generated') return (
    <span className='inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'>
      <CheckCircle className='size-3' /> Generated
    </span>
  )
  if (status === 'pending') return (
    <span className='inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'>
      <Clock className='size-3' /> Pending
    </span>
  )
  return (
    <span className='inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400'>
      <AlertCircle className='size-3' /> Failed
    </span>
  )
}

function ScoreBadge({ score }: { score: number }) {
  const cls =
    score >= 8 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
    score >= 6 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400'
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold tabular-nums ${cls}`}>
      {score.toFixed(1)}
    </span>
  )
}

const FORMAT_LABELS: Record<VisitFormat, string> = {
  flash: 'Flash',
  standard: 'Standard',
  approfondie: 'Approfondie',
}

export default function CRMReports() {
  const generated = DEMO_REPORTS.filter(r => r.status === 'generated').length

  return (
    <div className='grid grid-cols-6 gap-4'>
      {/* Summary */}
      <div className='col-span-full grid grid-cols-3 gap-4'>
        <Card>
          <CardContent className='pt-4'>
            <div className='flex items-center gap-3'>
              <FileText className='size-8 text-primary' />
              <div>
                <p className='text-2xl font-bold tabular-nums'>{DEMO_REPORTS.length}</p>
                <p className='text-xs text-muted-foreground'>Total Reports</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className='pt-4'>
            <div className='flex items-center gap-3'>
              <CheckCircle className='size-8 text-emerald-500' />
              <div>
                <p className='text-2xl font-bold tabular-nums text-emerald-600'>{generated}</p>
                <p className='text-xs text-muted-foreground'>Generated</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className='pt-4'>
            <div className='flex items-center gap-3'>
              <Clock className='size-8 text-amber-500' />
              <div>
                <p className='text-2xl font-bold tabular-nums text-amber-600'>
                  {DEMO_REPORTS.filter(r => r.status === 'pending').length}
                </p>
                <p className='text-xs text-muted-foreground'>Pending</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Reports Table */}
      <Card className='col-span-full'>
        <CardHeader>
          <CardTitle className='text-base'>CRM Visit Reports</CardTitle>
          <CardDescription>Auto-generated after each commercial session</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Report ID</TableHead>
                <TableHead>Doctor</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Format</TableHead>
                <TableHead className='text-center'>Score</TableHead>
                <TableHead>Engagement</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className='text-right'>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {DEMO_REPORTS.map(report => (
                <TableRow key={report.id}>
                  <TableCell className='font-mono text-xs text-muted-foreground'>{report.id}</TableCell>
                  <TableCell>
                    <div>
                      <p className='text-sm font-medium'>{report.doctor}</p>
                      <p className='text-xs text-muted-foreground'>{report.specialty}</p>
                    </div>
                  </TableCell>
                  <TableCell className='text-sm font-medium'>{report.product}</TableCell>
                  <TableCell>
                    <Badge variant='outline' className='text-xs'>{FORMAT_LABELS[report.format]}</Badge>
                  </TableCell>
                  <TableCell className='text-center'>
                    <ScoreBadge score={report.score} />
                  </TableCell>
                  <TableCell>
                    <span className={`text-xs font-medium ${
                      report.engagement === 'High' ? 'text-emerald-600' :
                      report.engagement === 'Moderate' ? 'text-amber-600' : 'text-rose-600'
                    }`}>{report.engagement}</span>
                  </TableCell>
                  <TableCell><StatusBadge status={report.status} /></TableCell>
                  <TableCell className='text-sm text-muted-foreground'>
                    {new Date(report.date).toLocaleDateString('fr-FR')}
                  </TableCell>
                  <TableCell className='text-right'>
                    {report.status === 'generated' && (
                      <Button variant='ghost' size='icon-sm' className='text-muted-foreground hover:text-foreground'>
                        <Download className='size-3.5' />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
