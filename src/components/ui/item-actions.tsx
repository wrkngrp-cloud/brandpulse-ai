'use client'

import { useState, useTransition } from 'react'
import { MoreHorizontal } from 'lucide-react'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuGroup,
  DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter, DialogClose,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

export interface ItemAction {
  label:              string
  icon?:              React.ElementType
  onClick:            () => void | Promise<void>
  variant?:           'default' | 'destructive'
  disabled?:          boolean
  separator?:         boolean  // renders a separator BEFORE this item
  requireConfirm?:    boolean
  confirmTitle?:      string
  confirmDescription?: string
}

interface Props {
  actions:   ItemAction[]
  className?: string
}

export function ItemActions({ actions, className }: Props) {
  const [confirmAction, setConfirmAction] = useState<ItemAction | null>(null)
  const [pending, start] = useTransition()

  function handleClick(action: ItemAction, e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (action.requireConfirm) {
      setConfirmAction(action)
    } else {
      action.onClick()
    }
  }

  function handleConfirm() {
    if (!confirmAction) return
    start(async () => {
      await confirmAction.onClick()
      setConfirmAction(null)
    })
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          onClick={e => { e.preventDefault(); e.stopPropagation() }}
          className={`h-7 w-7 inline-flex items-center justify-center rounded-md text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted transition-colors outline-none ${className ?? ''}`}
          aria-label="More options"
        >
          <MoreHorizontal className="h-4 w-4" />
        </DropdownMenuTrigger>

        <DropdownMenuContent
          align="end"
          className="w-44"
          onClick={e => e.stopPropagation()}
        >
          {actions.map((action, i) => {
            const Icon = action.icon
            return (
              <DropdownMenuGroup key={i}>
                {action.separator && i > 0 && <DropdownMenuSeparator />}
                <DropdownMenuItem
                  variant={action.variant}
                  disabled={action.disabled}
                  onClick={e => handleClick(action, e)}
                >
                  {Icon && <Icon className="mr-2 h-4 w-4" />}
                  {action.label}
                </DropdownMenuItem>
              </DropdownMenuGroup>
            )
          })}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Confirmation dialog — rendered outside the dropdown so it survives dropdown close */}
      <Dialog
        open={Boolean(confirmAction)}
        onOpenChange={open => { if (!open && !pending) setConfirmAction(null) }}
      >
        <DialogContent className="max-w-sm" onClick={e => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>{confirmAction?.confirmTitle ?? 'Are you sure?'}</DialogTitle>
            <DialogDescription>
              {confirmAction?.confirmDescription ?? 'This action cannot be undone.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose
              render={<button type="button" />}
              className="inline-flex items-center justify-center h-8 px-3 rounded-lg border border-input bg-background text-sm font-medium hover:bg-muted transition-colors"
              disabled={pending}
            >
              Cancel
            </DialogClose>
            <Button variant="destructive" size="sm" disabled={pending} onClick={handleConfirm}>
              {pending ? 'Deleting…' : (confirmAction?.confirmTitle ?? 'Delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
