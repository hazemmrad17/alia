import type { Metadata } from 'next'
import { LifeBuoy, Mail, MessageSquare, Phone, Clock } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import SupportFeedbackPanel from '@/components/support/support-feedback-panel'

export const metadata: Metadata = {
  title: 'Support | ALIA Avatar',
  description: 'Contact the ALIA team for help with training, presentations, or technical issues.'
}

const CONTACTS = [
  { icon: Mail, title: 'Email', value: 'support@vital-sa.tn', hint: 'We reply within 24 hours' },
  { icon: Phone, title: 'Phone', value: '+216 71 000 000', hint: 'Mon–Fri, 8:30–17:30' },
  { icon: MessageSquare, title: 'In-app chat', value: 'Chat with the ALIA team', hint: 'Fastest for quick questions' },
]

const TOP_QUESTIONS = [
  { q: 'How do I start a training session?', a: 'Go to Live Simulator in the Delegate workspace, choose your level and doctor personality, then press Start.' },
  { q: 'Where can I find a product’s full sheet?', a: 'Open VITAL Products, then click any card to see formulation, indications, packaging and dosing.' },
  { q: 'How do I book an ALIA consultation?', a: 'Doctors can request a pitch from the Consultation Calendar and join scheduled ones with one click.' },
  { q: 'The catalog shows local data — is that normal?', a: 'Yes: if the backend is offline the app falls back to local catalog data and shows a notice.' },
]

const SupportPage = () => {
  return (
    <div className='grid grid-cols-6 gap-6'>
      <div className='col-span-full'>
        <div className='flex items-center gap-2 mb-2'>
          <LifeBuoy className='size-6 text-primary' />
          <h1 className='text-2xl font-bold'>Support</h1>
        </div>
        <p className='text-sm text-muted-foreground'>
          We are here to help — pick the channel that works best for you.
        </p>
      </div>

      <div className='col-span-full grid grid-cols-1 gap-5 sm:grid-cols-3'>
        {CONTACTS.map(c => {
          const Icon = c.icon
          return (
            <Card key={c.title}>
              <CardHeader className='flex-row items-center gap-3'>
                <span className='flex size-10 items-center justify-center rounded-lg bg-primary/10'>
                  <Icon className='size-5 text-primary' />
                </span>
                <div>
                  <CardTitle className='text-base'>{c.title}</CardTitle>
                  <CardDescription>{c.hint}</CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                <p className='font-medium'>{c.value}</p>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* ── Report a problem / send feedback about ALIA ── */}
      <SupportFeedbackPanel />

      <div className='col-span-full'>
        <Card>
          <CardHeader className='flex-row items-center gap-3'>
            <span className='flex size-10 items-center justify-center rounded-lg bg-primary/10'>
              <Clock className='size-5 text-primary' />
            </span>
            <div>
              <CardTitle className='text-base'>Frequently asked questions</CardTitle>
              <CardDescription>Quick answers to common questions</CardDescription>
            </div>
            <Badge variant='secondary' className='ml-auto hidden sm:inline-flex'>4 topics</Badge>
          </CardHeader>
          <CardContent className='space-y-4'>
            {TOP_QUESTIONS.map(item => (
              <div key={item.q} className='rounded-lg border border-border/60 p-4'>
                <p className='text-sm font-semibold'>{item.q}</p>
                <p className='mt-1 text-sm text-muted-foreground'>{item.a}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default SupportPage