import type { Metadata } from 'next'
import { MessageSquare } from 'lucide-react'
import ChatAppView from '@/views/ala/shared/chat-app'

export const metadata: Metadata = {
  title: 'Chat | ALIA Avatar',
  description: 'Chat with ALIA — training conversations for delegates and consultation chats for doctors.'
}

const ChatPage = () => {
  return (
    <div className='grid grid-cols-6 gap-6'>
      <div className='col-span-full'>
        <div className='flex items-center gap-2 mb-2'>
          <MessageSquare className='size-6 text-primary' />
          <h1 className='text-2xl font-bold'>Chat</h1>
        </div>
        <p className='text-sm text-muted-foreground'>
          Role-aware conversations — delegate training with AI doctors, doctor consultations with VITAL delegates.
        </p>
      </div>

      <div className='col-span-full'>
        <ChatAppView />
      </div>
    </div>
  )
}

export default ChatPage