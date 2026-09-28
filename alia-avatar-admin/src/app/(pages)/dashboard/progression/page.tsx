import type { Metadata } from 'next'

import ProgressionPath from '@/views/ala/training/progression-path'

export const metadata: Metadata = {
  title: 'Progression | ALIA Avatar',
  description: 'Votre parcours de progression façon Duolingo : jalons, XP, série et ligue.'
}

const ProgressionPage = () => {
  return (
    <main className='mx-auto size-full max-w-360 flex-1 px-4 py-6 sm:px-6'>
      <div className='mb-6'>
        <h1 className='text-2xl font-semibold tracking-tight'>Progression</h1>
        <p className='text-muted-foreground text-sm'>
          Votre parcours d'entraînement, chapitre par chapitre.
        </p>
      </div>
      <ProgressionPath />
    </main>
  )
}

export default ProgressionPage
