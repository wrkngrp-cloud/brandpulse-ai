'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { logout } from '@/app/auth/actions'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Settings, LogOut, ChevronDown } from 'lucide-react'

interface Props {
  name: string
  email: string
  brandName: string
}

function getInitials(name: string) {
  return name.trim().split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?'
}

export function UserDropdown({ name, email, brandName }: Props) {
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-accent transition-colors outline-none cursor-pointer">
        <span className="h-7 w-7 rounded-full bg-foreground text-background flex items-center justify-center text-xs font-semibold shrink-0 select-none">
          {getInitials(name || email)}
        </span>
        <span className="hidden sm:block font-medium max-w-[120px] truncate">{brandName}</span>
        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <div className="flex flex-col gap-0.5">
            <p className="text-sm font-medium truncate">{name || 'User'}</p>
            <p className="text-xs text-muted-foreground truncate">{email}</p>
          </div>
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          className="cursor-pointer"
          onSelect={() => router.push('/dashboard/settings')}
        >
          <Settings className="mr-2 h-4 w-4" />
          Settings
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          variant="destructive"
          disabled={pending}
          className="cursor-pointer"
          onSelect={() => startTransition(() => logout())}
        >
          <LogOut className="mr-2 h-4 w-4" />
          {pending ? 'Signing out…' : 'Sign out'}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
