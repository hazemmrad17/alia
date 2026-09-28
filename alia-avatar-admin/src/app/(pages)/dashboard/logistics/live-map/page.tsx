import type { Metadata } from 'next'
import { MapPinned } from 'lucide-react'

import LiveMapView from '@/views/ala/logistics/live-map'

export const metadata: Metadata = {
  title: 'Carte live | ALIA Avatar',
  description: 'Suivi en temps réel des unités, circuits et retards de la force de vente VITAL.'
}

type PageProps = {
  searchParams?: Promise<{ unit?: string }>
}

const LiveMapPage = async ({ searchParams }: PageProps) => {
  // The operations overview links here with ?unit=VITAL-06 when a visit row is
  // opened, so the map arrives on the unit that is running it. A name the
  // registry does not know is ignored rather than passed through.
  const params = await searchParams

  return (
    <>
      <div className='mb-6 flex items-center gap-3'>
        <span className='bg-primary/10 text-primary grid size-10 shrink-0 place-items-center rounded-lg'>
          <MapPinned className='size-5' />
        </span>
        <div>
          <h2 className='text-lg font-semibold'>Opérations terrain</h2>
          <p className='text-muted-foreground text-sm'>
            Carte live · Flotte &amp; tournées · suivi des délégués en déplacement
          </p>
        </div>
      </div>
      <LiveMapView initialUnit={params?.unit} />
    </>
  )
}

export default LiveMapPage
