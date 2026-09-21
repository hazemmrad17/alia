'use client'

import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import type { SessionConfig, CompetenceLevel, DoctorStyle, VisitFormat } from '@/types/alia'

const LEVELS: { id: CompetenceLevel; name: string; desc: string; detail: string }[] = [
  { id: 'debutant', name: 'Debutant', desc: 'Scripted, basic', detail: '1-2 basic questions, 1 objection, simple script' },
  { id: 'junior', name: 'Junior', desc: 'Interactive, 2-4 questions', detail: 'A-C-R-V objections, engagement detection' },
  { id: 'confirme', name: 'Confirme', desc: 'Autonomous, adapts', detail: '3 objections, patient segmentation' },
  { id: 'expert', name: 'Expert', desc: 'Top performer, coaching', detail: 'Difficult visits, long cycles, precision' },
]

const FORMATS: { id: VisitFormat; name: string; duration: string; desc: string }[] = [
  { id: 'flash', name: 'Flash', duration: '20-60s', desc: 'Quick permission, 1 value, closing' },
  { id: 'standard', name: 'Standard', duration: '2-4 min', desc: 'Full 6-step visit' },
  { id: 'approfondie', name: 'Approfondie', duration: '5-8 min', desc: 'Deep discovery + segmentation' },
]

const STYLES: { id: DoctorStyle; name: string; desc: string; soncas: string; behavior: string }[] = [
  { id: 'analysant', name: 'Analysant', desc: 'Needs proof & data', soncas: 'Securite -- wants evidence, studies', behavior: 'Asks detailed questions, challenges claims' },
  { id: 'controlant', name: 'Controlant', desc: 'Needs structure', soncas: 'Organisation -- wants control', behavior: 'Sets the agenda, wants clear organization' },
  { id: 'facilitant', name: 'Facilitant', desc: 'Values relationship', soncas: 'Relation -- values trust', behavior: 'Friendly, open, expects rapport first' },
  { id: 'promouvant', name: 'Promouvant', desc: 'Likes innovation', soncas: 'Innovation -- attracted by novelty', behavior: 'Enthusiastic, early adopter mindset' },
]

export default function TrainingSetup({ config, onChange, onStart }: {
  config: SessionConfig; onChange: (c: SessionConfig) => void; onStart: (c: SessionConfig) => void
}) {
  return (
    <Card className='p-8 max-w-4xl mx-auto'>
      <div className='mb-6'>
        <h3 className='text-xl font-bold'>Training Session Setup</h3>
        <p className='text-sm text-muted-foreground'>Configure your practice visit</p>
      </div>

      {/* Level */}
      <div className='mb-8'>
        <label className='block text-sm font-semibold mb-3 uppercase tracking-wide text-muted-foreground'>Your Competence Level</label>
        <div className='grid grid-cols-2 md:grid-cols-4 gap-3'>
          {LEVELS.map(l => (
            <button key={l.id} onClick={() => onChange({ ...config, level: l.id })}
              className={`p-4 rounded-xl border-2 text-center transition-all ${config.level === l.id ? 'border-primary bg-primary/5' : 'border-border hover:border-border/80'}`}>
              <p className='font-semibold text-sm'>{l.name}</p>
              <p className='text-xs text-muted-foreground mt-0.5'>{l.desc}</p>
            </button>
          ))}
        </div>
        <p className='text-xs text-muted-foreground mt-2 ml-1'>{LEVELS.find(l => l.id === config.level)?.detail}</p>
      </div>

      {/* Doctor Personality */}
      <div className='mb-8'>
        <label className='block text-sm font-semibold mb-1 uppercase tracking-wide text-muted-foreground'>Doctor Personality</label>
        <p className='text-xs text-muted-foreground mb-3'>Each doctor has a different communication style and SONCAS trigger.</p>
        <div className='grid grid-cols-2 gap-4'>
          {STYLES.map(s => (
            <button key={s.id} onClick={() => onChange({ ...config, doctorStyle: s.id })}
              className={`p-4 rounded-xl border-2 text-left transition-all ${config.doctorStyle === s.id ? 'border-primary bg-primary/5' : 'border-border hover:border-border/80'}`}>
              <p className='font-semibold text-sm'>{s.name}</p>
              <p className='text-xs text-muted-foreground'>{s.desc}</p>
              <p className='text-xs text-muted-foreground italic mt-1'>{s.behavior}</p>
              {config.doctorStyle === s.id && (
                <div className='mt-2 p-2 bg-primary/5 rounded-lg'>
                  <p className='text-xs text-primary font-medium'>SONCAS: {s.soncas}</p>
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Format */}
      <div className='mb-8'>
        <label className='block text-sm font-semibold mb-3 uppercase tracking-wide text-muted-foreground'>Visit Format</label>
        <div className='grid grid-cols-3 gap-4'>
          {FORMATS.map(f => (
            <button key={f.id} onClick={() => onChange({ ...config, format: f.id })}
              className={`p-4 rounded-xl border-2 text-center transition-all ${config.format === f.id ? 'border-primary bg-primary/5' : 'border-border hover:border-border/80'}`}>
              <p className='font-semibold'>{f.name}</p>
              <p className='text-sm text-primary font-medium'>{f.duration}</p>
              <p className='text-xs text-muted-foreground mt-1'>{f.desc}</p>
            </button>
          ))}
        </div>
      </div>

      <Button className='w-full py-6 text-lg' onClick={() => onStart(config)}>Start Training Session</Button>
    </Card>
  )
}
