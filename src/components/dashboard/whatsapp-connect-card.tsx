'use client'

import Link from 'next/link'
import { MessageCircle, ArrowRight, CheckCircle2, Users } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface WhatsAppConnectCardProps {
  configured: boolean
  contactCount: number
  campaignCount: number
}

export function WhatsAppConnectCard({ configured, contactCount, campaignCount }: WhatsAppConnectCardProps) {
  return (
    <div className="border rounded-xl p-5 bg-card space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className={cn(
            'h-9 w-9 rounded-lg flex items-center justify-center shrink-0',
            configured ? 'bg-green-50 dark:bg-green-950/30' : 'bg-muted'
          )}>
            <MessageCircle className={cn('h-4 w-4', configured ? 'text-green-600' : 'text-muted-foreground')} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold">WhatsApp Business</p>
              {configured && (
                <span className="inline-flex items-center gap-1 text-[10px] font-medium text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950/40 rounded-full px-2 py-0.5">
                  <CheckCircle2 className="h-2.5 w-2.5" /> Active
                </span>
              )}
            </div>
            {configured ? (
              <p className="text-xs text-muted-foreground mt-0.5">
                {contactCount > 0
                  ? <><Users className="inline h-3 w-3 mr-1" />{contactCount.toLocaleString()} contacts · {campaignCount} campaign{campaignCount !== 1 ? 's' : ''} sent</>
                  : 'Connected · Import contacts to start sending'
                }
              </p>
            ) : (
              <p className="text-xs text-muted-foreground mt-0.5">
                Broadcast surveys, NPS, and re-engagement messages via WhatsApp
              </p>
            )}
          </div>
        </div>
        <Link
          href="/dashboard/whatsapp"
          className={cn(buttonVariants({ size: 'sm', variant: configured ? 'outline' : 'default' }), 'shrink-0 inline-flex items-center gap-1.5')}
        >
          {configured ? 'Manage' : 'Set up'}
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {!configured && (
        <div className="rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 px-3 py-2.5 text-[11.5px] text-amber-800 dark:text-amber-300 leading-relaxed">
          Add <code className="font-mono">WHATSAPP_PHONE_NUMBER_ID</code>, <code className="font-mono">WHATSAPP_BUSINESS_ACCOUNT_ID</code>, and <code className="font-mono">WHATSAPP_ACCESS_TOKEN</code> to your environment variables to activate.
        </div>
      )}
    </div>
  )
}
