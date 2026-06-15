'use client'

import { useTheme } from 'next-themes'
import { Sun, Moon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  if (!mounted) return <div className="h-9 w-9 shrink-0" />

  const isDark = resolvedTheme === 'dark'

  return (
    <button
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className={cn(
        'h-9 w-9 shrink-0 grid place-items-center rounded-xl cursor-pointer',
        'text-muted-foreground hover:text-foreground hover:bg-muted/60',
        'transition-colors duration-150',
        className,
      )}
      aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
    >
      {isDark
        ? <Sun className="h-[17px] w-[17px]" />
        : <Moon className="h-[17px] w-[17px]" />
      }
    </button>
  )
}
