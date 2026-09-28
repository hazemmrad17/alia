'use client'

// ──────────────────────────────────────────────
// Permissions
//
// The third face of the same object as Comptes & accès and Rôles & permissions.
// The roster answers "who has an account"; the roles page answers "what is each
// role for"; this page lays the two side by side — every module down the side,
// every role across the top, the four actions inside each cell.
//
// Read-only, deliberately. The grants come from lib/roles-data.ts, which is a
// transcription of rules the server owns (the navbars each role is shown, and the
// 403s the API answers to everything else). A toggle here would write nothing a
// request would honour, so the cells are indicators, not controls — the honest
// shape of a rule this screen does not own.
// ──────────────────────────────────────────────

import { useCallback, useEffect, useMemo, useState } from 'react'

import type { LucideIcon } from 'lucide-react'
import { Eye, PencilLine, Plus, ShieldCheck, Trash2 } from 'lucide-react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

import { listAccounts } from '@/lib/alia-api'
import { ACCOUNT_ROLE_LABELS, type AccountRole, type AuthUser } from '@/lib/auth'
import {
  ROLE_ACTIONS,
  ROLE_ACTION_LABELS,
  ROLE_DEFINITIONS,
  actionUsageCounts,
  activePermissionCount,
  allModules,
  roleGrant,
  type RoleAction
} from '@/lib/roles-data'

const ROLE_ORDER: AccountRole[] = ['admin', 'doctor', 'delegate']

const ACTION_ICON: Record<RoleAction, LucideIcon> = {
  lire: Eye,
  ecrire: PencilLine,
  creer: Plus,
  supprimer: Trash2
}

type RosterState = 'loading' | 'ready' | 'unavailable'

function accountLabel(state: RosterState, count: number): string {
  if (state === 'loading') return 'Chargement…'
  if (state === 'unavailable') return 'Comptes indisponibles'

  return `${count} ${count > 1 ? 'comptes' : 'compte'}`
}

/**
 * One action of one role on one module. Rendered as an indicator rather than a
 * button: the state is the server's rule, not something this screen may change —
 * a control that silently did nothing would be worse than no control at all.
 */
function ActionMark({ role, module, action }: { role: AccountRole; module: string; action: RoleAction }) {
  const grant = roleGrant(role, module)
  const granted = grant?.actions.includes(action) ?? false
  const Icon = ACTION_ICON[action]

  const label =
    `${ROLE_ACTION_LABELS[action]} — ${ACCOUNT_ROLE_LABELS[role]} sur « ${module} » : ` +
    (granted ? 'accordé' : 'non accordé') +
    (granted && grant?.own ? ' (ses propres enregistrements)' : '')

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span
            role='img'
            aria-label={label}
            className={cn(
              'grid size-8 place-items-center rounded-[min(var(--radius-md),10px)]',
              granted ? 'bg-primary/10 text-primary' : 'border-border text-muted-foreground/40 bg-background border'
            )}
          />
        }
      >
        <Icon className='size-3' />
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

export default function AdminPermissions() {
  const [accounts, setAccounts] = useState<AuthUser[]>([])
  const [rosterState, setRosterState] = useState<RosterState>('loading')

  const modules = useMemo(() => allModules(), [])
  const usage = useMemo(() => actionUsageCounts(), [])

  const load = useCallback(async () => {
    setRosterState('loading')

    try {
      const data = await listAccounts()

      setAccounts(data.users)
      setRosterState('ready')
    } catch {
      // The matrix does not depend on the roster, so a failed read costs only the
      // per-role counts — not the page. It says so instead of showing zero.
      setAccounts([])
      setRosterState('unavailable')
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const countsByRole = useMemo(() => {
    const counts = { admin: 0, doctor: 0, delegate: 0 } as Record<AccountRole, number>

    for (const account of accounts) counts[account.role] += 1

    return counts
  }, [accounts])

  const metrics = [
    { label: 'Rôles', value: ROLE_DEFINITIONS.length },
    { label: 'Ressources', value: modules.length },
    { label: 'Permissions actives', value: activePermissionCount() }
  ]

  return (
    <div className='flex flex-col gap-3 md:gap-6'>
      <div>
        <h1 className='font-heading text-xl font-semibold'>Permissions</h1>
        <p className='text-muted-foreground mt-1 text-sm'>
          Vue d’ensemble des rôles et des permissions associées à chaque ressource.
        </p>
      </div>

      <div className='grid grid-cols-1 gap-3 sm:grid-cols-3 md:gap-6'>
        {metrics.map(({ label, value }) => (
          <Card key={label}>
            <CardContent className='flex flex-col gap-1'>
              <span className='text-2xl font-semibold tabular-nums'>{value}</span>
              <span className='text-muted-foreground text-sm'>{label}</span>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className='gap-0 overflow-hidden py-0 shadow-none'>
        <CardContent className='p-0'>
          {/* Légende : les quatre actions, avec le nombre de modules qui les accordent. */}
          <div className='flex flex-wrap items-center gap-x-4 gap-y-2 border-b px-6 py-3'>
            <span className='text-muted-foreground text-xs'>Chaque case porte les quatre actions :</span>

            {ROLE_ACTIONS.map(action => {
              const Icon = ACTION_ICON[action]

              return (
                <span key={action} className='text-muted-foreground flex items-center gap-1.5 text-xs'>
                  <span className='bg-primary/10 text-primary grid size-6 place-items-center rounded-[min(var(--radius-md),10px)]'>
                    <Icon className='size-3' />
                  </span>
                  {ROLE_ACTION_LABELS[action]}
                  <span className='text-foreground tabular-nums'>{usage[action]}</span>
                </span>
              )
            })}
          </div>

          <Table>
            <TableHeader>
              <TableRow className='border-t'>
                <TableHead className='p-4 font-semibold'>Ressource</TableHead>

                {ROLE_ORDER.map(role => (
                  <TableHead key={role} className='p-4'>
                    <span className='block font-semibold'>{ACCOUNT_ROLE_LABELS[role]}</span>
                    <span className='text-muted-foreground block text-xs font-normal'>
                      {accountLabel(rosterState, countsByRole[role])}
                    </span>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>

            <TableBody>
              {modules.map(module => (
                <TableRow key={module}>
                  <TableCell className='p-4 font-medium'>{module}</TableCell>

                  {ROLE_ORDER.map(role => (
                    <TableCell key={role} className='px-4'>
                      <div className='flex gap-1'>
                        {ROLE_ACTIONS.map(action => (
                          <ActionMark key={action} role={role} module={module} action={action} />
                        ))}
                      </div>
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Alert>
        <ShieldCheck className='size-4' />
        <AlertDescription>
          Les règles d’accès vivent dans l’API : c’est le serveur qui décide de ce que chaque rôle peut appeler, et le
          menu de chaque compte en découle. Cette matrice les décrit — elle ne les modifie pas. Modifier une case
          demanderait une évolution côté serveur, pas une action depuis cet écran.
        </AlertDescription>
      </Alert>
    </div>
  )
}
