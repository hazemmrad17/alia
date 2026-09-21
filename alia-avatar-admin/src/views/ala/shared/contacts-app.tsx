'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowDownAZ,
  ArrowUpAZ,
  Calendar,
  Contact,
  EllipsisVertical,
  Mail,
  MapPin,
  MessageSquare,
  Phone,
  Plus,
  Search,
  Star,
  X,
} from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { resolveRole, type UserRole } from '@/lib/user-role'
import { cn } from '@/lib/utils'

// ── Types ───────────────────────────────────────────────────────────────────────

type LabelId = 'vip' | 'cle' | 'partenaire' | 'prospect' | 'recurrent' | 'specialiste'

const LABEL_META: Record<LabelId, { label: string; color: string }> = {
  vip: { label: 'VIP', color: 'bg-amber-500' },
  cle: { label: 'Clé', color: 'bg-blue-500' },
  partenaire: { label: 'Partenaire', color: 'bg-purple-500' },
  prospect: { label: 'Prospect', color: 'bg-sky-500' },
  recurrent: { label: 'Récurrent', color: 'bg-emerald-500' },
  specialiste: { label: 'Spécialiste', color: 'bg-pink-500' },
}

interface AppContact {
  id: string
  name: string
  email: string
  phone: string
  location: string
  subtitle: string
  avatar: string
  labels: LabelId[]
  favourite: boolean
  note: string
  addedOn: string
}

// ── Role-aware data ─────────────────────────────────────────────────────────────

const avatar = (n: number) => `/images/avatars/avatar-${(n % 20) + 1}.webp`

const DELEGATE_CONTACTS: AppContact[] = [
  { id: 'c1', name: 'Dr. Martin', email: 'martin@clinique-elmenzah.tn', phone: '+216 98 123 456', location: 'Tunis', subtitle: 'Cardiologie · Analysant', avatar: avatar(1), labels: ['vip', 'cle'], favourite: true, note: 'Prescripteur clé cardiologie. Sensible aux données cliniques et à la tolérance.', addedOn: '12 mars 2026' },
  { id: 'c2', name: 'Dr. Ben Salah', email: 'bensalah@polyclinique-tunis.tn', phone: '+216 22 654 321', location: 'Tunis', subtitle: 'Pédiatrie · Facilitant', avatar: avatar(2), labels: ['partenaire'], favourite: false, note: 'Pédiatre ouvert aux gammes pédiatriques (PEDIAKIDS).', addedOn: '3 février 2026' },
  { id: 'c3', name: 'Dr. Khelifi', email: 'khelifi@dermatologie-sfax.tn', phone: '+216 55 987 210', location: 'Sfax', subtitle: 'Dermatologie · Promouvant', avatar: avatar(3), labels: ['specialiste'], favourite: true, note: 'Dermatologue, intérêt marqué pour HYDRA et COSMOPHARMA.', addedOn: '18 janvier 2026' },
  { id: 'c4', name: 'Dr. Trabelsi', email: 'trabelsi@mg-sousse.tn', phone: '+216 20 445 566', location: 'Sousse', subtitle: 'Médecine Générale · Controlant', avatar: avatar(4), labels: ['prospect'], favourite: false, note: 'MG sceptique — à convaincre avec des preuves concrètes.', addedOn: '22 avril 2026' },
  { id: 'c5', name: 'Dr. Mansouri', email: 'mansouri@carthage-cardio.tn', phone: '+216 96 111 222', location: 'Tunis', subtitle: 'Cardiologie · Analysant', avatar: avatar(5), labels: ['cle'], favourite: false, note: 'Second prescripteur cardio — LV Fersang en priorité.', addedOn: '9 mai 2026' },
  { id: 'c6', name: 'Dr. Haddad', email: 'haddad@pediatrie-bizerte.tn', phone: '+216 27 333 444', location: 'Bizerte', subtitle: 'Pédiatrie · Controlant', avatar: avatar(6), labels: ['recurrent'], favourite: false, note: 'Visites mensuelles régulières.', addedOn: '30 novembre 2025' },
  { id: 'c7', name: 'Dr. Zouari', email: 'zouari@gyneco-nabeul.tn', phone: '+216 24 555 666', location: 'Nabeul', subtitle: 'Gynécologie · Facilitant', avatar: avatar(7), labels: ['prospect'], favourite: false, note: 'Intérêt potentiel FERBIOTIC (grossesse).', addedOn: '14 juin 2026' },
  { id: 'c8', name: 'Dr. Bouazizi', email: 'bouazizi@pneumo-monastir.tn', phone: '+216 92 777 888', location: 'Monastir', subtitle: 'Pneumologie · Analysant', avatar: avatar(8), labels: ['partenaire', 'specialiste'], favourite: true, note: 'Partenaire de longue date — PULMAX.', addedOn: '2 septembre 2025' },
  { id: 'c9', name: 'Dr. Gharbi', email: 'gharbi@neuro-tunis.tn', phone: '+216 98 000 111', location: 'Tunis', subtitle: 'Neurologie · Promouvant', avatar: avatar(9), labels: ['vip'], favourite: false, note: 'VIP — CALMOSS et OMEVIE.', addedOn: '21 juillet 2026' },
]

const COMMERCIAL_CONTACTS: AppContact[] = [
  { id: 'c1', name: 'Karim Benali', email: 'karim.benali@vital-sa.tn', phone: '+216 99 111 223', location: 'Tunis', subtitle: 'Délégué médical · LV Fersang', avatar: avatar(1), labels: ['vip'], favourite: true, note: 'Référent LV Fersang. Suivi hebdomadaire.', addedOn: '12 mars 2026' },
  { id: 'c2', name: 'Amira Zouari', email: 'amira.zouari@vital-sa.tn', phone: '+216 21 334 455', location: 'Sfax', subtitle: 'Déléguée médicale · CALMOSS', avatar: avatar(2), labels: ['cle'], favourite: false, note: 'CALMOSS & troubles du sommeil.', addedOn: '3 février 2026' },
  { id: 'c3', name: 'Yacine Hadj', email: 'yacine.hadj@vital-sa.tn', phone: '+216 55 667 788', location: 'Sousse', subtitle: 'Délégué médical · VITONIC', avatar: avatar(3), labels: ['partenaire'], favourite: false, note: 'VITONIC & convalescence.', addedOn: '18 janvier 2026' },
  { id: 'c4', name: 'Rania Boudali', email: 'rania.boudali@vital-sa.tn', phone: '+216 27 889 900', location: 'Nabeul', subtitle: 'Déléguée médicale · Magné B6', avatar: avatar(4), labels: ['recurrent'], favourite: false, note: 'Magné B6 & carences.', addedOn: '22 avril 2026' },
  { id: 'c5', name: 'Sami Djabri', email: 'sami.djabri@vital-sa.tn', phone: '+216 96 223 344', location: 'Bizerte', subtitle: 'Délégué médical · Doliprane 1000', avatar: avatar(5), labels: ['prospect'], favourite: false, note: 'Antalgiques & fièvre.', addedOn: '9 mai 2026' },
  { id: 'c6', name: 'Leila Mansour', email: 'leila.mansour@vital-sa.tn', phone: '+216 22 445 566', location: 'Tunis', subtitle: 'Déléguée médicale · Oligovit', avatar: avatar(6), labels: ['vip', 'partenaire'], favourite: true, note: 'Vitamines & minéraux.', addedOn: '30 novembre 2025' },
  { id: 'c7', name: 'Omar Kacem', email: 'omar.kacem@vital-sa.tn', phone: '+216 20 667 788', location: 'Monastir', subtitle: 'Délégué médical · Spasfon Lyoc', avatar: avatar(7), labels: ['partenaire'], favourite: false, note: 'Gastro-entérologie.', addedOn: '14 juin 2026' },
  { id: 'c8', name: 'Nadia Slim', email: 'nadia.slim@vital-sa.tn', phone: '+216 92 889 900', location: 'Gabès', subtitle: 'Déléguée médicale · FERBIOTIC', avatar: avatar(8), labels: ['prospect'], favourite: false, note: 'Hématologie & grossesse.', addedOn: '2 septembre 2025' },
  { id: 'c9', name: 'Hichem Saidi', email: 'hichem.saidi@vital-sa.tn', phone: '+216 98 111 223', location: 'Kairouan', subtitle: 'Délégué médical · PULMAX', avatar: avatar(9), labels: ['recurrent', 'specialiste'], favourite: false, note: 'Respiratoire & antitussifs.', addedOn: '21 juillet 2026' },
]

// ── Component ───────────────────────────────────────────────────────────────────

export default function ContactsAppView() {
  const router = useRouter()
  const [role, setRole] = useState<UserRole>('delegate')
  const [contacts, setContacts] = useState<AppContact[]>(DELEGATE_CONTACTS)
  const [search, setSearch] = useState('')
  const [group, setGroup] = useState<'all' | 'favourites' | LabelId>('all')
  const [sortAsc, setSortAsc] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [newOpen, setNewOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [newLabel, setNewLabel] = useState<LabelId>('prospect')
  const [newFavourite, setNewFavourite] = useState(false)

  useEffect(() => {
    const r = resolveRole(window.location.pathname)
    setRole(r)
    setContacts(r === 'delegate' ? DELEGATE_CONTACTS : COMMERCIAL_CONTACTS)
    setSelectedId(null)
  }, [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const sorted = [...contacts].sort((a, b) =>
      sortAsc ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name)
    )
    return sorted.filter(c => {
      if (group === 'favourites' && !c.favourite) return false
      if (group !== 'all' && group !== 'favourites' && !c.labels.includes(group)) return false
      if (!q) return true
      return c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q) || c.subtitle.toLowerCase().includes(q)
    })
  }, [contacts, search, group, sortAsc])

  const groupsByLetter = useMemo(() => {
    const map = new Map<string, AppContact[]>()
    for (const c of filtered) {
      const letter = c.name.charAt(0).toUpperCase()
      const list = map.get(letter) ?? []
      list.push(c)
      map.set(letter, list)
    }
    return [...map.entries()]
  }, [filtered])

  const selected = contacts.find(c => c.id === selectedId) ?? null

  const labelCounts = useMemo(() => {
    const counts = new Map<LabelId, number>()
    for (const c of contacts) for (const l of c.labels) counts.set(l, (counts.get(l) ?? 0) + 1)
    return counts
  }, [contacts])

  const toggleFavourite = (id: string) =>
    setContacts(prev => prev.map(c => (c.id === id ? { ...c, favourite: !c.favourite } : c)))

  const removeContact = (id: string) => {
    setContacts(prev => prev.filter(c => c.id !== id))
    if (selectedId === id) setSelectedId(null)
  }

  const addContact = () => {
    if (!newName.trim()) return
    const contact: AppContact = {
      id: `new-${Date.now()}`,
      name: newName.trim(),
      email: newEmail.trim() || `${newName.trim().toLowerCase().replace(/\s+/g, '.')}@example.com`,
      phone: '+216 00 000 000',
      location: 'Tunis',
      subtitle: role === 'delegate' ? 'Contact médical' : 'Contact VITAL SA',
      avatar: '',
      labels: [newLabel],
      favourite: newFavourite,
      note: 'Ajouté récemment.',
      addedOn: 'Aujourd’hui',
    }
    setContacts(prev => [...prev, contact])
    setSelectedId(contact.id)
    setNewOpen(false)
    setNewName('')
    setNewEmail('')
    setNewLabel('prospect')
    setNewFavourite(false)
  }

  return (
    <div className='grid h-[calc(100dvh-150px)] min-h-130 grid-cols-12 overflow-hidden rounded-lg border bg-card'>
      {/* ── Left: groups & labels ── */}
      <div className='col-span-4 hidden min-h-0 flex-col overflow-hidden border-r py-4 md:flex lg:col-span-3 xl:col-span-2'>
        <div className='flex shrink-0 flex-col gap-4 px-4'>
          <div className='flex items-center gap-2'>
            <Contact className='size-6' />
            <h1 className='text-xl font-semibold'>Contacts</h1>
          </div>
          <Button onClick={() => setNewOpen(true)} className='justify-start gap-2'>
            <Plus className='size-4' />
            New Contact
          </Button>
        </div>

        <div className='mt-4 min-h-0 flex-1 space-y-4 overflow-y-auto px-4'>
          <nav className='grid gap-1'>
            {(
              [
                { id: 'all', label: 'All Contacts', icon: Contact },
                { id: 'favourites', label: 'Favourites', icon: Star },
              ] as const
            ).map(item => {
              const Icon = item.icon
              const count = item.id === 'all' ? contacts.length : contacts.filter(c => c.favourite).length
              return (
                <Button
                  key={item.id}
                  variant='ghost'
                  className={cn('justify-start gap-2.5 px-3 font-medium', group === item.id && 'bg-accent text-accent-foreground font-semibold')}
                  onClick={() => setGroup(item.id)}
                >
                  <Icon className='size-4 opacity-70' />
                  {item.label}
                  <span className='ml-auto text-xs tabular-nums text-muted-foreground'>{count}</span>
                </Button>
              )
            })}
          </nav>

          <Separator />

          <div className='flex flex-col gap-2'>
            <p className='text-[11px] font-medium uppercase text-muted-foreground'>Labels</p>
            <nav className='grid gap-1'>
              {(Object.keys(LABEL_META) as LabelId[]).map(label => (
                <Button
                  key={label}
                  variant='ghost'
                  className={cn('justify-start gap-2.5 px-3 capitalize', group === label && 'bg-accent text-accent-foreground font-semibold')}
                  onClick={() => setGroup(label)}
                >
                  <span className={cn('size-2 shrink-0 rounded-full', LABEL_META[label].color)} />
                  {LABEL_META[label].label.toLowerCase()}
                  <span className='ml-auto text-xs tabular-nums text-muted-foreground'>{labelCounts.get(label) ?? 0}</span>
                </Button>
              ))}
            </nav>
          </div>
        </div>
      </div>

      {/* ── Middle: contact list ── */}
      <div className='col-span-12 flex min-h-0 flex-col overflow-hidden md:col-span-8 lg:col-span-9 xl:col-span-5 xl:border-r'>
        <div className='flex shrink-0 flex-col gap-4 py-4'>
          <div className='flex items-center gap-2 px-4'>
            <div className='relative flex-1'>
              <Search className='absolute left-2.5 top-2.5 size-4 text-muted-foreground' />
              <Input placeholder='Search Contact' className='pl-9' value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <Button variant='outline' size='icon' className='size-9 shrink-0 rounded-full' title='Sort A-Z' onClick={() => setSortAsc(a => !a)}>
              {sortAsc ? <ArrowDownAZ className='size-4' /> : <ArrowUpAZ className='size-4' />}
            </Button>
            <Button variant='outline' size='icon' className='size-9 shrink-0 rounded-full' onClick={() => setNewOpen(true)} title='New contact'>
              <Plus className='size-4' />
            </Button>
          </div>
        </div>

        <div className='min-h-0 flex-1 space-y-4 overflow-y-auto px-4 pb-4'>
          {groupsByLetter.length === 0 ? (
            <p className='py-10 text-center text-sm text-muted-foreground'>No contacts found.</p>
          ) : (
            groupsByLetter.map(([letter, list]) => (
              <div key={letter} className='flex flex-col gap-1.5'>
                <div className='flex flex-col gap-1'>
                  <span className='text-sm font-medium text-muted-foreground'>{letter}</span>
                  <Separator />
                </div>
                <div className='flex flex-col gap-1'>
                  {list.map(c => (
                    <div
                      key={c.id}
                      role='button'
                      tabIndex={0}
                      onClick={() => setSelectedId(c.id)}
                      onKeyDown={e => { if (e.key === 'Enter') setSelectedId(c.id) }}
                      className={cn(
                        'flex cursor-pointer items-center justify-between gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-accent',
                        selectedId === c.id && 'bg-accent'
                      )}
                    >
                      <div className='flex min-w-0 items-center gap-2'>
                        <Avatar className='size-10 shrink-0'>
                          {c.avatar && <AvatarImage src={c.avatar} alt={c.name} />}
                          <AvatarFallback>{c.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div className='flex max-w-50 flex-col truncate'>
                          <span className='truncate font-medium'>{c.name}</span>
                          <span className='truncate text-sm text-muted-foreground'>{c.email}</span>
                        </div>
                      </div>
                      <div className='flex shrink-0 items-center gap-2'>
                        <span className='hidden items-center gap-1.5 md:flex'>
                          {c.labels.slice(0, 1).map(l => (
                            <span key={l} className='hidden items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs capitalize md:flex'>
                              <span className={cn('size-1.5 rounded-full', LABEL_META[l].color)} />
                              {LABEL_META[l].label.toLowerCase()}
                            </span>
                          ))}
                          {c.labels.length > 1 && (
                            <Badge variant='outline' className='hidden md:inline-flex'>+{c.labels.length - 1}</Badge>
                          )}
                        </span>
                        <DropdownMenu>
                        <DropdownMenuTrigger render={<Button variant='ghost' size='icon' className='size-8 rounded-full hover:bg-primary/10' />}>
                          <EllipsisVertical className='size-4' />
                        </DropdownMenuTrigger>
                          <DropdownMenuContent align='end'>
                            <DropdownMenuItem onClick={() => toggleFavourite(c.id)}>
                              <Star className='size-4' />
                              {c.favourite ? 'Remove favourite' : 'Add to favourites'}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className='text-destructive focus:text-destructive' onClick={() => removeContact(c.id)}>
                              Delete contact
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ── Right: contact details ── */}
      {/* When nothing is selected, keep the pane hidden below xl so it never creates an empty full-width row under the list. */}
      <div className={`col-span-12 min-h-0 overflow-hidden xl:col-span-5 ${!selected ? 'hidden xl:block' : ''}`}>
        {!selected ? (
          <div className='flex h-full items-center justify-center p-8 text-center text-sm text-muted-foreground'>
            Select a contact to view details.
          </div>
        ) : (
          <div className='flex h-full min-h-0 flex-col gap-4 pb-4'>
            <div className='relative flex h-44 shrink-0 items-center justify-center gap-2 p-4 sm:h-60'>
              <img
                alt='Contact Details Background'
                className='absolute left-0 top-0 h-full w-full object-cover dark:invert'
                src='/images/contacts/contact-details-bg.webp'
              />
              <Button variant='outline' size='icon' className='absolute left-4 top-4 z-1 size-6 rounded-full' onClick={() => setSelectedId(null)}>
                <X className='size-3' />
              </Button>
              <Avatar className='z-1 size-20 shrink-0 sm:size-25 [&_[data-slot=avatar-fallback]]:text-xl'>
                {selected.avatar && <AvatarImage src={selected.avatar} alt={selected.name} />}
                <AvatarFallback>{selected.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className='z-1 flex flex-col gap-0.5'>
                <h2 className='max-w-50 truncate text-lg font-bold'>{selected.name}</h2>
                <span className='max-w-50 truncate text-sm text-muted-foreground'>{selected.email}</span>
                <div className='flex items-center gap-2'>
                  <Button variant='outline' size='icon' className='size-8 rounded-lg' title='Call'>
                    <Phone className='size-4' />
                  </Button>
                  <Button variant='outline' size='icon' className='size-8 rounded-lg' title='Email'>
                    <Mail className='size-4' />
                  </Button>
                  <Button variant='outline' size='icon' className='size-8 rounded-lg' title='Chat' onClick={() => router.push('/chat')}>
                    <MessageSquare className='size-4' />
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger render={<Button variant='outline' size='icon' className='size-8 rounded-lg' />}>
                      <EllipsisVertical className='size-4' />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align='end'>
                      <DropdownMenuItem onClick={() => toggleFavourite(selected.id)}>
                        <Star className='size-4' />
                        {selected.favourite ? 'Remove favourite' : 'Add to favourites'}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className='text-destructive focus:text-destructive' onClick={() => removeContact(selected.id)}>
                        Delete contact
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </div>

            <div className='min-h-0 flex-1 space-y-4 overflow-y-auto px-4'>
              <div className='flex flex-col gap-3'>
                <h3 className='font-semibold'>Contact Info</h3>
                <div className='grid gap-3 sm:grid-cols-2'>
                  <div className='flex items-center gap-2 rounded-md bg-muted p-3 text-sm text-muted-foreground'>
                    <Phone className='size-4 shrink-0' />
                    <span className='truncate'>{selected.phone}</span>
                  </div>
                  <div className='flex items-center gap-2 truncate rounded-md bg-muted p-3 text-sm text-muted-foreground'>
                    <Mail className='size-4 shrink-0' />
                    <span className='truncate'>{selected.email}</span>
                  </div>
                  <div className='flex items-center gap-2 rounded-md bg-muted p-3 text-sm text-muted-foreground'>
                    <MapPin className='size-4 shrink-0' />
                    <span>{selected.location}</span>
                  </div>
                  <div className='flex items-center gap-2 rounded-md bg-muted p-3 text-sm text-muted-foreground'>
                    <Calendar className='size-4 shrink-0' />
                    <span>Added on {selected.addedOn}</span>
                  </div>
                </div>
              </div>

              <Separator />

              <div className='flex flex-col gap-3'>
                <h3 className='font-semibold'>Note</h3>
                <div className='rounded-md bg-muted p-3 text-sm text-muted-foreground'>{selected.note}</div>
              </div>

              <Separator />

              <div className='flex flex-col gap-3'>
                <h3 className='font-semibold'>Labels</h3>
                <div className='flex flex-wrap items-center gap-2'>
                  {selected.labels.map(l => (
                    <Badge key={l} variant='outline' className='gap-1.5 capitalize'>
                      <span className={cn('size-1.5 rounded-full', LABEL_META[l].color)} />
                      {LABEL_META[l].label.toLowerCase()}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── New Contact dialog ── */}
      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent className='sm:max-w-md'>
          <DialogHeader>
            <DialogTitle>New Contact</DialogTitle>
            <DialogDescription>Add a {role === 'delegate' ? 'medical' : 'VITAL'} contact to your directory.</DialogDescription>
          </DialogHeader>
          <div className='space-y-4'>
            <div className='space-y-2'>
              <Label htmlFor='nc-name'>Name</Label>
              <Input id='nc-name' placeholder='Dr. Example' value={newName} onChange={e => setNewName(e.target.value)} />
            </div>
            <div className='space-y-2'>
              <Label htmlFor='nc-email'>Email</Label>
              <Input id='nc-email' placeholder='contact@example.tn' value={newEmail} onChange={e => setNewEmail(e.target.value)} />
            </div>
            <div className='flex items-center justify-between gap-4'>
              <Label htmlFor='nc-fav' className='cursor-pointer'>Add to favourites</Label>
              <Switch id='nc-fav' checked={newFavourite} onCheckedChange={setNewFavourite} />
            </div>
          </div>
          <DialogFooter>
            <Button variant='outline' onClick={() => setNewOpen(false)}>Cancel</Button>
            <Button onClick={addContact} disabled={!newName.trim()}>Add Contact</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}