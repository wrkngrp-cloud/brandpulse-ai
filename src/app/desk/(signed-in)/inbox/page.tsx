import { MessageQuoteIcon } from '@/components/brand/icon'

export const dynamic = 'force-dynamic'

/**
 * The middle pane with nothing chosen yet.
 *
 * The queue beside this is rendered by the layout, so this is only the empty
 * half of the screen. It names the next action rather than sitting blank.
 */
export default function InboxIndexPage() {
  return (
    <div className="flex h-full min-h-64 flex-col items-center justify-center gap-2 text-center">
      <MessageQuoteIcon className="size-5 text-tx-3" />
      <p className="text-sm text-tx-2">Pick a conversation to read it.</p>
      <p className="text-xs text-tx-3">
        The ones waiting on us are marked, oldest wait first.
      </p>
    </div>
  )
}
