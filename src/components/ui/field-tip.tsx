'use client'

import { HelpCircle } from 'lucide-react'
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip'

export function FieldTip({ tip }: { tip: string }) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger
          tabIndex={-1}
          className="inline-flex items-center text-muted-foreground/50 hover:text-muted-foreground transition-colors ml-1 align-middle"
        >
          <HelpCircle className="h-3.5 w-3.5" />
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[280px] text-xs leading-snug">
          {tip}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
