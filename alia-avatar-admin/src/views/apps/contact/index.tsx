'use client'

import React, { useState } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import Image from 'next/image'
import {
  Search,
  Plus,
  Mail,
  Phone,
  MapPin,
  Building,
  Star,
  Trash2,
  Edit,
  MoreVertical,
  Globe,
  Share2
} from 'lucide-react'

export type ContactPerson = {
  id: string
  name: string
  role: string
  company: string
  email: string
  phone: string
  country: string
  avatar: string
  fallback: string
  tag: string
  starred: boolean
}

const contactList: ContactPerson[] = [
  {
    id: 'c-1',
    name: 'Sarah Connor',
    role: 'Product Lead',
    company: 'Cyberdyne Systems',
    email: 'sarah.connor@cyberdyne.io',
    phone: '+1 (555) 234-5678',
    country: 'United States',
    avatar: '/images/avatars/avatar-1.webp',
    fallback: 'SC',
    tag: 'Client',
    starred: true
  },
  {
    id: 'c-2',
    name: 'Michael Thompson',
    role: 'Senior Fullstack Engineer',
    company: 'Vercel Labs',
    email: 'michael.t@vercel.app',
    phone: '+1 (555) 876-5432',
    country: 'Canada',
    avatar: '/images/avatars/avatar-2.webp',
    fallback: 'MT',
    tag: 'Developer',
    starred: false
  },
  {
    id: 'c-3',
    name: 'Emily Carter',
    role: 'Finance & Operations',
    company: 'Stripe Global',
    email: 'emily.carter@stripe.com',
    phone: '+44 20 7946 0912',
    country: 'United Kingdom',
    avatar: '/images/avatars/avatar-3.webp',
    fallback: 'EC',
    tag: 'Finance',
    starred: true
  },
  {
    id: 'c-4',
    name: 'David Lee',
    role: 'Lead Cloud Architect',
    company: 'Amazon AWS',
    email: 'david.lee@aws.amazon.com',
    phone: '+1 (555) 345-6789',
    country: 'United States',
    avatar: '/images/avatars/avatar-4.webp',
    fallback: 'DL',
    tag: 'Partner',
    starred: false
  },
  {
    id: 'c-5',
    name: 'Sophia Patel',
    role: 'Head of Marketing',
    company: 'Shadcn Studio',
    email: 'sophia@shadcnstudio.com',
    phone: '+1 (555) 987-6543',
    country: 'Australia',
    avatar: '/images/avatars/avatar-6.webp',
    fallback: 'SP',
    tag: 'Marketing',
    starred: false
  }
]

export const ContactApp = () => {
  const [contacts, setContacts] = useState<ContactPerson[]>(contactList)
  const [selectedId, setSelectedId] = useState<string>('c-1')
  const [searchTerm, setSearchTerm] = useState('')
  const [activeTag, setActiveTag] = useState('All')

  const selectedContact = contacts.find(c => c.id === selectedId) || contacts[0]

  const filteredContacts = contacts.filter(c => {
    const matchesSearch =
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.company.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesTag = activeTag === 'All' || c.tag === activeTag
    return matchesSearch && matchesTag
  })

  const toggleStar = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setContacts(prev =>
      prev.map(c => (c.id === id ? { ...c, starred: !c.starred } : c))
    )
  }

  return (
    <div className='grid grid-cols-1 xl:grid-cols-3 gap-6 items-start'>
      {/* Contact List & Directory (col-span-2) */}
      <Card className='xl:col-span-2 p-0 overflow-hidden border border-border'>
        {/* Header toolbar */}
        <div className='p-5 border-b border-border space-y-4'>
          <div className='flex items-center justify-between'>
            <div>
              <h2 className='text-lg font-bold text-foreground'>Contact Directory</h2>
              <p className='text-xs text-muted-foreground'>
                Total {contacts.length} team members and verified business partners
              </p>
            </div>
            <Button size='sm' className='h-9 gap-1.5'>
              <Plus className='size-4' /> New Contact
            </Button>
          </div>

          <div className='flex flex-wrap items-center gap-3'>
            <div className='relative flex-1 min-w-[200px]'>
              <Search className='absolute left-3 top-2.5 size-4 text-muted-foreground' />
              <Input
                placeholder='Search contacts by name, email, company...'
                className='pl-9 h-9 text-xs'
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>

            <div className='flex items-center gap-1 overflow-x-auto'>
              {['All', 'Client', 'Developer', 'Finance', 'Partner', 'Marketing'].map(tag => (
                <Button
                  key={tag}
                  variant={activeTag === tag ? 'default' : 'outline'}
                  size='sm'
                  className='h-8 text-xs'
                  onClick={() => setActiveTag(tag)}
                >
                  {tag}
                </Button>
              ))}
            </div>
          </div>
        </div>

        {/* List items */}
        <div className='divide-y divide-border'>
          {filteredContacts.map(contact => (
            <div
              key={contact.id}
              onClick={() => setSelectedId(contact.id)}
              className={`p-4 flex items-center justify-between cursor-pointer transition-colors ${
                selectedId === contact.id ? 'bg-primary/5' : 'hover:bg-muted/40'
              }`}
            >
              <div className='flex items-center gap-3.5 min-w-0'>
                <Button
                  variant='ghost'
                  size='icon'
                  className='size-7 shrink-0 text-muted-foreground hover:text-amber-500'
                  onClick={e => toggleStar(contact.id, e)}
                >
                  <Star
                    className={`size-4 ${
                      contact.starred ? 'fill-amber-500 text-amber-500' : ''
                    }`}
                  />
                </Button>

                <Avatar className='size-10 shrink-0 border border-border'>
                  <AvatarImage src={contact.avatar} />
                  <AvatarFallback>{contact.fallback}</AvatarFallback>
                </Avatar>

                <div className='flex flex-col min-w-0'>
                  <div className='flex items-center gap-2'>
                    <span className='font-semibold text-sm text-foreground truncate'>
                      {contact.name}
                    </span>
                    <Badge variant='secondary' className='text-[10px] px-1.5 py-0'>
                      {contact.tag}
                    </Badge>
                  </div>
                  <span className='text-xs text-muted-foreground truncate'>
                    {contact.role} • {contact.company}
                  </span>
                </div>
              </div>

              <div className='flex items-center gap-6'>
                <div className='hidden md:flex flex-col text-right text-xs text-muted-foreground'>
                  <span>{contact.email}</span>
                  <span>{contact.phone}</span>
                </div>

                <Button variant='ghost' size='icon' className='size-8 text-muted-foreground'>
                  <MoreVertical className='size-4' />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Contact Details Side Card (col-span-1) */}
      <Card className='xl:col-span-1 p-0 overflow-hidden border border-border relative'>
        {/* Background Banner */}
        <div className='h-32 w-full relative bg-muted'>
          <Image
            src='/images/contacts/contact-details-bg.webp'
            alt='Cover'
            fill
            className='object-cover opacity-90'
          />
        </div>

        {/* Profile Info */}
        <div className='px-6 pb-6 relative'>
          <div className='-mt-12 flex justify-between items-end mb-4'>
            <Avatar className='size-20 ring-4 ring-card border-none shadow-md'>
              <AvatarImage src={selectedContact.avatar} />
              <AvatarFallback className='text-xl'>{selectedContact.fallback}</AvatarFallback>
            </Avatar>

            <div className='flex gap-1.5'>
              <Button variant='outline' size='icon' className='size-9'>
                <Edit className='size-4' />
              </Button>
              <Button size='icon' className='size-9'>
                <Mail className='size-4' />
              </Button>
            </div>
          </div>

          <div>
            <h3 className='text-lg font-bold text-foreground'>{selectedContact.name}</h3>
            <p className='text-xs text-muted-foreground'>{selectedContact.role}</p>
          </div>

          <div className='space-y-3 mt-6 pt-6 border-t border-border text-xs'>
            <div className='flex items-center gap-3 text-muted-foreground'>
              <Building className='size-4 text-primary shrink-0' />
              <span className='text-foreground font-medium'>{selectedContact.company}</span>
            </div>

            <div className='flex items-center gap-3 text-muted-foreground'>
              <Mail className='size-4 text-primary shrink-0' />
              <span className='text-foreground'>{selectedContact.email}</span>
            </div>

            <div className='flex items-center gap-3 text-muted-foreground'>
              <Phone className='size-4 text-primary shrink-0' />
              <span className='text-foreground'>{selectedContact.phone}</span>
            </div>

            <div className='flex items-center gap-3 text-muted-foreground'>
              <MapPin className='size-4 text-primary shrink-0' />
              <span className='text-foreground'>{selectedContact.country}</span>
            </div>
          </div>

          <div className='mt-6 pt-6 border-t border-border flex items-center justify-between'>
            <span className='text-xs text-muted-foreground'>Quick Share:</span>
            <Button variant='outline' size='sm' className='h-8 text-xs gap-1.5'>
              <Share2 className='size-3.5' /> Share Profile
            </Button>
          </div>
        </div>
      </Card>
    </div>
  )
}
export default ContactApp
