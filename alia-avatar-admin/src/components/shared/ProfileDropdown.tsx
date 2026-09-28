'use client'

// Next Imports
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

// Third-party Imports
import { LogOutIcon, SettingsIcon, UserIcon } from 'lucide-react'

// Component Imports
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'

// Util Imports
import { ACCOUNT_ROLE_LABELS, getCurrentUser, initialsOf, signOut, type AuthUser } from '@/lib/auth'

const ProfileDropdown = () => {
  const router = useRouter()
  // Read in an effect rather than during render: the session lives in
  // localStorage, which does not exist while this renders on the server.
  const [user, setUser] = useState<AuthUser | null>(null)

  useEffect(() => {
    setUser(getCurrentUser())
  }, [])

  const name = user?.full_name || 'Compte ALIA'
  const email = user?.email || ''
  const initials = user ? initialsOf(user.full_name) : '—'

  const handleSignOut = () => {
    signOut()
    router.push('/login')
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant='ghost' size='icon' className='relative rounded-full hover:bg-transparent' />}
      >
        <Avatar>
          <AvatarImage src='/images/avatars/avatar-1.webp' alt={name} />
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
        <span className='ring-card absolute right-0 bottom-0 block size-2 rounded-full bg-green-600 ring-2' />
      </DropdownMenuTrigger>
      <DropdownMenuContent align='end' className='w-64'>
        <DropdownMenuGroup>
          <DropdownMenuLabel className='flex items-center gap-4 px-2 py-2.5 font-normal'>
            <div className='relative'>
              <Avatar className='size-10'>
                <AvatarImage src='/images/avatars/avatar-1.webp' alt={name} />
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
              <span className='ring-card absolute right-0 bottom-0 block size-2 rounded-full bg-green-600 ring-2' />
            </div>
            <div className='flex flex-1 flex-col items-start gap-0.5'>
              <span className='text-foreground text-base font-semibold'>{name}</span>
              <span className='text-muted-foreground truncate text-sm'>{email}</span>
            </div>
          </DropdownMenuLabel>
        </DropdownMenuGroup>

        {user && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuLabel className='flex items-center justify-between px-2 py-1.5 font-normal'>
                <span className='text-muted-foreground text-xs'>Rôle</span>
                <Badge variant='secondary'>{ACCOUNT_ROLE_LABELS[user.role]}</Badge>
              </DropdownMenuLabel>
              <DropdownMenuLabel className='flex items-center justify-between px-2 py-1.5 font-normal'>
                <span className='text-muted-foreground text-xs'>Organisation</span>
                <span className='text-xs font-medium uppercase'>{user.tenant_id}</span>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
          </>
        )}

        <DropdownMenuSeparator />

        <DropdownMenuGroup>
          <DropdownMenuItem render={<Link href='/pages/user-profile?view=profile' />}>
            <UserIcon />
            <span>My Account</span>
          </DropdownMenuItem>
          <DropdownMenuItem render={<Link href='/pages/user-settings?setting=general' />}>
            <SettingsIcon />
            <span>Settings</span>
          </DropdownMenuItem>
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

        <DropdownMenuGroup>
          <DropdownMenuItem variant='destructive' onClick={handleSignOut}>
            <LogOutIcon />
            <span>Sign out</span>
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export default ProfileDropdown
