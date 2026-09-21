'use client'

import React, { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Search, HelpCircle, ChevronDown, MessageCircle, Mail, Phone } from 'lucide-react'
import Image from 'next/image'

const faqCategories = ['General', 'Pricing & Plans', 'Usage & Billing', 'Security & Compliance', 'API Integration']

const faqs = [
  {
    q: 'How do I connect my custom backend API to AdminCN?',
    a: 'AdminCN uses Next.js App Router and server actions. You can configure your base API URL in .env.local and create route handlers or client query hooks (like TanStack Query or native fetch) to stream real-time data.',
    category: 'General'
  },
  {
    q: 'Can I export custom charts to CSV and PDF formats?',
    a: 'Yes! All Recharts widgets and TanStack Datatables support client-side and server-side data serialization so you can export filtered datasets directly into spreadsheet format.',
    category: 'General'
  },
  {
    q: 'What payment gateways are supported out of the box?',
    a: 'AdminCN includes prebuilt webhook endpoints and UI widgets for Stripe, PayPal, Visa, and Mastercard with auto-reconciliation of failed payments.',
    category: 'Pricing & Plans'
  },
  {
    q: 'How does role-based access control (RBAC) work?',
    a: 'You can assign granular permission sets (Read, Write, Delete, Audit) across preset roles (Admin, Editor, Author, Subscriber) in the Roles & Permissions app.',
    category: 'Security & Compliance'
  },
  {
    q: 'Are all avatars and flag icons included in the local package?',
    a: 'Yes! All 91 assets across avatars, country flags, company logos, widgets, and illustrations are stored directly in your public/images/ directory.',
    category: 'General'
  }
]

export const FAQView = () => {
  const [activeCategory, setActiveCategory] = useState('General')
  const [searchTerm, setSearchTerm] = useState('')
  const [openIdx, setOpenIdx] = useState<number | null>(0)

  const filteredFaqs = faqs.filter(f => {
    const matchesSearch =
      f.q.toLowerCase().includes(searchTerm.toLowerCase()) ||
      f.a.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesCategory = activeCategory === 'General' || f.category === activeCategory
    return matchesSearch && matchesCategory
  })

  return (
    <div className='max-w-4xl mx-auto space-y-10 py-4'>
      {/* Hero Banner with Illustration */}
      <Card className='p-8 bg-gradient-to-r from-primary/10 via-card to-card border-border flex flex-col md:flex-row items-center justify-between gap-6 overflow-hidden relative'>
        <div className='space-y-3 max-w-lg z-10'>
          <Badge variant='secondary' className='text-xs px-2.5 py-0.5 bg-primary/15 text-primary'>
            Support Center
          </Badge>
          <h1 className='text-2xl sm:text-3xl font-bold text-foreground'>
            Frequently Asked Questions
          </h1>
          <p className='text-xs sm:text-sm text-muted-foreground leading-relaxed'>
            Find answers to common questions about AdminCN setup, dashboards, permissions, and theme customization.
          </p>

          <div className='relative pt-2'>
            <Search className='absolute left-3 top-4.5 size-4 text-muted-foreground' />
            <Input
              placeholder='Search questions, topics, or keywords...'
              className='pl-9 h-10 text-xs bg-background'
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className='relative size-40 shrink-0'>
          <Image
            src='/images/misc/faq-illustration.webp'
            alt='FAQ Illustration'
            fill
            className='object-contain'
          />
        </div>
      </Card>

      {/* Categories Tabs */}
      <div className='flex items-center justify-center gap-2 overflow-x-auto pb-2'>
        {faqCategories.map(cat => (
          <Button
            key={cat}
            variant={activeCategory === cat ? 'default' : 'outline'}
            size='sm'
            className='h-9 text-xs'
            onClick={() => setActiveCategory(cat)}
          >
            {cat}
          </Button>
        ))}
      </div>

      {/* Accordion Questions */}
      <div className='space-y-3'>
        {filteredFaqs.map((faq, idx) => {
          const isOpen = openIdx === idx
          return (
            <Card
              key={idx}
              className='border border-border cursor-pointer transition-colors p-5'
              onClick={() => setOpenIdx(isOpen ? null : idx)}
            >
              <div className='flex items-center justify-between gap-4'>
                <h3 className='font-semibold text-sm sm:text-base text-foreground flex items-center gap-2'>
                  <HelpCircle className='size-4 text-primary shrink-0' />
                  {faq.q}
                </h3>
                <ChevronDown
                  className={`size-4 text-muted-foreground shrink-0 transition-transform ${
                    isOpen ? 'rotate-180' : ''
                  }`}
                />
              </div>

              {isOpen && (
                <p className='text-xs sm:text-sm text-muted-foreground leading-relaxed mt-3 pt-3 border-t border-border'>
                  {faq.a}
                </p>
              )}
            </Card>
          )
        })}
      </div>

      {/* Bottom Contact Help Box */}
      <Card className='p-6 text-center space-y-4 bg-muted/20 border-dashed'>
        <h3 className='text-base font-bold text-foreground'>Still have questions?</h3>
        <p className='text-xs text-muted-foreground max-w-md mx-auto'>
          If you can&apos;t find an answer in our FAQ, you can always contact our dedicated engineering team.
        </p>
        <div className='flex items-center justify-center gap-3 pt-1'>
          <Button size='sm' className='h-9 text-xs gap-1.5'>
            <Mail className='size-3.5' /> Contact Support
          </Button>
          <Button variant='outline' size='sm' className='h-9 text-xs gap-1.5'>
            <MessageCircle className='size-3.5' /> Live Chat
          </Button>
        </div>
      </Card>
    </div>
  )
}
export default FAQView
