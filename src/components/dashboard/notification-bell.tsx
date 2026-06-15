'use client'

import { Bell } from 'lucide-react'
import { cn } from '@/lib/utils'

export function NotificationBell({
  className,
  hasUnread = false,
}: {
  className?: string
  hasUnread?: boolean
}) {
  return (
    <button
      className={cn(
        'relative h-9 w-9 shrink-0 grid place-items-center rounded-xl cursor-pointer',
        'text-muted-foreground hover:text-foreground hover:bg-muted/60',
        'transition-colors duration-150',
        className,
      )}
      aria-label="Notifications"
    >
      <Bell className="h-[17px] w-[17px]" />
      {hasUnread && (
        <span
          className="absolute top-[7px] right-[7px] h-[7px] w-[7px] rounded-full ring-[1.5px] ring-background"
          style={{ background: 'oklch(0.585 0.163 37)' }}
        />
      )}
    </button>
  )
}
