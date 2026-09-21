'use client'

import React, { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Search,
  Send,
  Paperclip,
  Smile,
  Phone,
  Video,
  MoreVertical,
  Circle,
  CheckCheck
} from 'lucide-react'

export type ChatContact = {
  id: string
  name: string
  avatar: string
  fallback: string
  status: 'online' | 'offline' | 'busy' | 'away'
  lastMessage: string
  time: string
  unread: number
}

export type ChatMessage = {
  id: string
  senderId: string
  text: string
  time: string
  isSender: boolean
}

const contacts: ChatContact[] = [
  {
    id: '1',
    name: 'Sarah Connor',
    avatar: '/images/avatars/avatar-1.webp',
    fallback: 'SC',
    status: 'online',
    lastMessage: 'Hey! Are we still meeting for the product review today?',
    time: '10:45 AM',
    unread: 2
  },
  {
    id: '2',
    name: 'Michael Thompson',
    avatar: '/images/avatars/avatar-2.webp',
    fallback: 'MT',
    status: 'online',
    lastMessage: 'The new dashboard designs look incredible. Great job!',
    time: '09:30 AM',
    unread: 0
  },
  {
    id: '3',
    name: 'Emily Carter',
    avatar: '/images/avatars/avatar-3.webp',
    fallback: 'EC',
    status: 'busy',
    lastMessage: 'I uploaded the quarterly financial report to the cloud.',
    time: 'Yesterday',
    unread: 0
  },
  {
    id: '4',
    name: 'David Lee',
    avatar: '/images/avatars/avatar-4.webp',
    fallback: 'DL',
    status: 'away',
    lastMessage: 'Can you check the API rate limit logs?',
    time: 'Yesterday',
    unread: 0
  },
  {
    id: '5',
    name: 'Jack Alfredo',
    avatar: '/images/avatars/avatar-5.webp',
    fallback: 'JA',
    status: 'offline',
    lastMessage: 'Thanks for the quick feedback on the pull request.',
    time: '2 days ago',
    unread: 0
  }
]

const initialMessages: Record<string, ChatMessage[]> = {
  '1': [
    {
      id: 'm1',
      senderId: '1',
      text: 'Good morning! Did you get a chance to review the latest wireframes?',
      time: '10:30 AM',
      isSender: false
    },
    {
      id: 'm2',
      senderId: 'me',
      text: 'Yes! The UI layout and chart widgets look super clean.',
      time: '10:35 AM',
      isSender: true
    },
    {
      id: 'm3',
      senderId: '1',
      text: 'Hey! Are we still meeting for the product review today?',
      time: '10:45 AM',
      isSender: false
    }
  ]
}

export const ChatApp = () => {
  const [activeContactId, setActiveContactId] = useState<string>('1')
  const [searchTerm, setSearchTerm] = useState('')
  const [inputMessage, setInputMessage] = useState('')
  const [messages, setMessages] = useState(initialMessages)

  const activeContact = contacts.find(c => c.id === activeContactId) || contacts[0]
  const currentMessages = messages[activeContactId] || []

  const handleSendMessage = () => {
    if (!inputMessage.trim()) return

    const newMessage: ChatMessage = {
      id: `m_${Date.now()}`,
      senderId: 'me',
      text: inputMessage.trim(),
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isSender: true
    }

    setMessages(prev => ({
      ...prev,
      [activeContactId]: [...(prev[activeContactId] || []), newMessage]
    }))

    setInputMessage('')
  }

  const filteredContacts = contacts.filter(c =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const getStatusDot = (status: ChatContact['status']) => {
    switch (status) {
      case 'online':
        return 'bg-emerald-500'
      case 'busy':
        return 'bg-destructive'
      case 'away':
        return 'bg-amber-500'
      default:
        return 'bg-muted-foreground'
    }
  }

  return (
    <Card className='h-[calc(100vh-10rem)] min-h-[580px] p-0 flex overflow-hidden border border-border'>
      {/* Sidebar / Contacts list */}
      <div className='w-full sm:w-80 md:w-96 border-r border-border flex flex-col shrink-0'>
        <div className='p-4 border-b border-border space-y-3'>
          <div className='flex items-center justify-between'>
            <div className='flex items-center gap-3'>
              <Avatar className='size-10 ring-2 ring-primary/20'>
                <AvatarImage src='/images/avatars/avatar-10.webp' />
                <AvatarFallback>ME</AvatarFallback>
              </Avatar>
              <div>
                <h3 className='font-semibold text-sm'>Hazem (You)</h3>
                <span className='text-xs text-emerald-500 flex items-center gap-1'>
                  <span className='size-2 rounded-full bg-emerald-500 inline-block' /> Online
                </span>
              </div>
            </div>
          </div>

          <div className='relative'>
            <Search className='absolute left-3 top-2.5 size-4 text-muted-foreground' />
            <Input
              placeholder='Search contacts...'
              className='pl-9 h-9 text-xs'
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <ScrollArea className='flex-1'>
          <div className='p-2 space-y-1'>
            {filteredContacts.map(contact => (
              <div
                key={contact.id}
                onClick={() => setActiveContactId(contact.id)}
                className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors ${
                  activeContactId === contact.id ? 'bg-primary/10 text-primary' : 'hover:bg-muted/60'
                }`}
              >
                <div className='relative'>
                  <Avatar className='size-11 border border-border'>
                    <AvatarImage src={contact.avatar} />
                    <AvatarFallback>{contact.fallback}</AvatarFallback>
                  </Avatar>
                  <span
                    className={`absolute bottom-0 right-0 size-3 rounded-full border-2 border-background ${getStatusDot(
                      contact.status
                    )}`}
                  />
                </div>

                <div className='flex-1 min-w-0'>
                  <div className='flex items-center justify-between'>
                    <span className='font-semibold text-sm truncate text-foreground'>
                      {contact.name}
                    </span>
                    <span className='text-[11px] text-muted-foreground'>{contact.time}</span>
                  </div>
                  <p className='text-xs text-muted-foreground truncate mt-0.5'>
                    {contact.lastMessage}
                  </p>
                </div>

                {contact.unread > 0 && (
                  <Badge className='size-5 p-0 flex items-center justify-center text-[10px] rounded-full'>
                    {contact.unread}
                  </Badge>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Main Chat Area */}
      <div className='flex-1 flex flex-col min-w-0 bg-muted/10'>
        {/* Chat Header */}
        <div className='p-4 border-b border-border bg-card flex items-center justify-between'>
          <div className='flex items-center gap-3'>
            <div className='relative'>
              <Avatar className='size-10 border border-border'>
                <AvatarImage src={activeContact.avatar} />
                <AvatarFallback>{activeContact.fallback}</AvatarFallback>
              </Avatar>
              <span
                className={`absolute bottom-0 right-0 size-2.5 rounded-full border-2 border-background ${getStatusDot(
                  activeContact.status
                )}`}
              />
            </div>
            <div>
              <h2 className='font-semibold text-sm text-foreground'>{activeContact.name}</h2>
              <span className='text-xs text-muted-foreground capitalize'>
                {activeContact.status}
              </span>
            </div>
          </div>

          <div className='flex items-center gap-1'>
            <Button variant='ghost' size='icon' className='size-9 text-muted-foreground'>
              <Phone className='size-4' />
            </Button>
            <Button variant='ghost' size='icon' className='size-9 text-muted-foreground'>
              <Video className='size-4' />
            </Button>
            <Button variant='ghost' size='icon' className='size-9 text-muted-foreground'>
              <MoreVertical className='size-4' />
            </Button>
          </div>
        </div>

        {/* Message Feed */}
        <ScrollArea className='flex-1 p-4'>
          <div className='space-y-4 max-w-3xl mx-auto'>
            {currentMessages.map(msg => (
              <div
                key={msg.id}
                className={`flex gap-3 ${msg.isSender ? 'justify-end' : 'justify-start'}`}
              >
                {!msg.isSender && (
                  <Avatar className='size-8 shrink-0 mt-1 border border-border'>
                    <AvatarImage src={activeContact.avatar} />
                    <AvatarFallback>{activeContact.fallback}</AvatarFallback>
                  </Avatar>
                )}

                <div
                  className={`max-w-md p-3.5 rounded-2xl text-sm leading-relaxed shadow-xs ${
                    msg.isSender
                      ? 'bg-primary text-primary-foreground rounded-br-xs'
                      : 'bg-card text-card-foreground border border-border rounded-bl-xs'
                  }`}
                >
                  <p>{msg.text}</p>
                  <div
                    className={`flex items-center justify-end gap-1 mt-1 text-[10px] ${
                      msg.isSender ? 'text-primary-foreground/70' : 'text-muted-foreground'
                    }`}
                  >
                    <span>{msg.time}</span>
                    {msg.isSender && <CheckCheck className='size-3' />}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>

        {/* Chat Input */}
        <div className='p-3 bg-card border-t border-border flex items-center gap-2'>
          <Button variant='ghost' size='icon' className='size-9 text-muted-foreground shrink-0'>
            <Paperclip className='size-4' />
          </Button>
          <Button variant='ghost' size='icon' className='size-9 text-muted-foreground shrink-0'>
            <Smile className='size-4' />
          </Button>

          <Input
            placeholder='Type a message...'
            className='flex-1 h-10 text-sm border-border'
            value={inputMessage}
            onChange={e => setInputMessage(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') handleSendMessage()
            }}
          />

          <Button size='icon' className='size-10 shrink-0' onClick={handleSendMessage}>
            <Send className='size-4' />
          </Button>
        </div>
      </div>
    </Card>
  )
}
export default ChatApp
