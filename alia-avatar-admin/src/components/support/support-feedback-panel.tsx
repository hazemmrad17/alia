'use client'

import { useState } from 'react'
import { Flag, Inbox } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import SupportReportForm from '@/components/support/support-report-form'
import SupportReportList from '@/components/support/support-report-list'

/**
 * The two halves of the feedback loop side by side: filing a report, and
 * reading back what has already been sent. Sending one refreshes the list so
 * the reporter can see it landed.
 */
export default function SupportFeedbackPanel() {
  const [refreshKey, setRefreshKey] = useState(0)

  return (
    <div className='col-span-full grid grid-cols-1 gap-5 lg:grid-cols-2'>
      <Card>
        <CardHeader className='flex-row items-center gap-3'>
          <span className='flex size-10 items-center justify-center rounded-lg bg-primary/10'>
            <Flag className='size-5 text-primary' />
          </span>
          <div>
            <CardTitle className='text-base'>Signaler un problème / Feedback</CardTitle>
            <CardDescription>Un souci avec ALIA pendant un entraînement ? Une idée à proposer ?</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <SupportReportForm onSubmitted={() => setRefreshKey(k => k + 1)} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className='flex-row items-center gap-3'>
          <span className='flex size-10 items-center justify-center rounded-lg bg-primary/10'>
            <Inbox className='size-5 text-primary' />
          </span>
          <div>
            <CardTitle className='text-base'>Signalements récents</CardTitle>
            <CardDescription>Les derniers retours envoyés</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <SupportReportList refreshKey={refreshKey} />
        </CardContent>
      </Card>
    </div>
  )
}
