'use client'

import { useState, useMemo } from 'react'
import {
  useReactTable, getCoreRowModel, getSortedRowModel,
  getFilteredRowModel, flexRender,
  type ColumnDef, type SortingState,
} from '@tanstack/react-table'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { ArrowUpDown, TrendingUp } from 'lucide-react'
import { toast } from 'sonner'

function IgIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
    </svg>
  )
}
function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.742l7.729-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  )
}
function FbIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  )
}

export interface SocialPost {
  id: string
  platform: string
  content: string | null
  content_type: string | null
  reach: number
  impressions: number
  likes: number
  comments: number
  shares: number
  engagement_rate: number | null
  funnel_stage: string | null
  ai_performance_score: number | null
  posted_at: string | null
}

const FUNNEL_STAGES = ['awareness', 'consideration', 'preference', 'action', 'loyalty', 'advocacy']

const FUNNEL_COLOURS: Record<string, string> = {
  awareness: 'bg-blue-100 text-blue-800',
  consideration: 'bg-purple-100 text-purple-800',
  preference: 'bg-indigo-100 text-indigo-800',
  action: 'bg-green-100 text-green-800',
  loyalty: 'bg-amber-100 text-amber-800',
  advocacy: 'bg-rose-100 text-rose-800',
}

function PlatformIcon({ platform }: { platform: string }) {
  const cls = 'h-3.5 w-3.5'
  if (platform === 'instagram') return <IgIcon className={cls} />
  if (platform === 'twitter') return <XIcon className={cls} />
  if (platform === 'facebook') return <FbIcon className={cls} />
  return <span className="text-xs">{platform[0].toUpperCase()}</span>
}

function ScoreBadge({ score }: { score: number | null }) {
  if (score === null) return <span className="text-xs text-muted-foreground">—</span>
  const colour = score >= 70 ? 'text-green-700' : score >= 40 ? 'text-amber-700' : 'text-red-700'
  return <span className={`text-sm font-semibold ${colour}`}>{score.toFixed(0)}</span>
}

export function ContentTable({
  posts,
  onFunnelStageChange,
}: {
  posts: SocialPost[]
  onFunnelStageChange: (postId: string, stage: string) => Promise<void>
}) {
  const [sorting, setSorting] = useState<SortingState>([{ id: 'posted_at', desc: true }])
  const [platformFilter, setPlatformFilter] = useState<string>('all')
  const [search, setSearch] = useState('')

  const columns = useMemo<ColumnDef<SocialPost>[]>(() => [
    {
      id: 'platform',
      header: 'Platform',
      accessorKey: 'platform',
      cell: ({ row }) => (
        <div className="flex items-center gap-1.5 capitalize text-sm">
          <PlatformIcon platform={row.original.platform} />
          {row.original.platform}
        </div>
      ),
      size: 100,
    },
    {
      id: 'content',
      header: 'Content',
      accessorKey: 'content',
      cell: ({ row }) => (
        <p className="text-sm text-foreground max-w-xs truncate">
          {row.original.content ?? '—'}
        </p>
      ),
    },
    {
      id: 'posted_at',
      header: ({ column }) => (
        <Button variant="ghost" size="sm" className="-ml-3 h-8"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
          Date <ArrowUpDown className="ml-1 h-3.5 w-3.5" />
        </Button>
      ),
      accessorKey: 'posted_at',
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {row.original.posted_at
            ? new Date(row.original.posted_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })
            : '—'}
        </span>
      ),
      size: 90,
    },
    {
      id: 'reach',
      header: ({ column }) => (
        <Button variant="ghost" size="sm" className="-ml-3 h-8"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
          Reach <ArrowUpDown className="ml-1 h-3.5 w-3.5" />
        </Button>
      ),
      accessorKey: 'reach',
      cell: ({ row }) => (
        <span className="text-sm tabular-nums">{row.original.reach.toLocaleString()}</span>
      ),
      size: 90,
    },
    {
      id: 'engagement_rate',
      header: ({ column }) => (
        <Button variant="ghost" size="sm" className="-ml-3 h-8"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
          Eng% <ArrowUpDown className="ml-1 h-3.5 w-3.5" />
        </Button>
      ),
      accessorKey: 'engagement_rate',
      cell: ({ row }) => (
        <span className="text-sm tabular-nums">
          {row.original.engagement_rate !== null
            ? `${Number(row.original.engagement_rate).toFixed(2)}%`
            : '—'}
        </span>
      ),
      size: 80,
    },
    {
      id: 'funnel_stage',
      header: 'Funnel stage',
      accessorKey: 'funnel_stage',
      cell: ({ row }) => {
        const current = row.original.funnel_stage ?? ''
        return (
          <Select
            value={current}
            onValueChange={async (v) => {
              try {
                await onFunnelStageChange(row.original.id, v ?? '')
              } catch {
                toast.error('Failed to update funnel stage')
              }
            }}
          >
            <SelectTrigger className="h-7 text-xs w-36 border-dashed">
              <SelectValue placeholder="Tag stage…">
                {current ? (
                  <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${FUNNEL_COLOURS[current] ?? ''}`}>
                    {current}
                  </span>
                ) : 'Tag stage…'}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {FUNNEL_STAGES.map(s => (
                <SelectItem key={s} value={s}>
                  <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${FUNNEL_COLOURS[s]}`}>{s}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )
      },
      size: 160,
    },
    {
      id: 'ai_performance_score',
      header: () => (
        <div className="flex items-center gap-1">
          <TrendingUp className="h-3.5 w-3.5" />
          AI score
        </div>
      ),
      accessorKey: 'ai_performance_score',
      cell: ({ row }) => <ScoreBadge score={row.original.ai_performance_score} />,
      size: 80,
    },
  ], [onFunnelStageChange])

  const filtered = useMemo(() => posts.filter(p => {
    if (platformFilter !== 'all' && p.platform !== platformFilter) return false
    if (search && !p.content?.toLowerCase().includes(search.toLowerCase())) return false
    return true
  }), [posts, platformFilter, search])

  const table = useReactTable({
    data: filtered,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  })

  return (
    <div className="space-y-3">
      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <Input
          placeholder="Search content…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="h-8 w-48 text-sm"
        />
        <Select value={platformFilter} onValueChange={v => setPlatformFilter(v ?? 'all')}>
          <SelectTrigger className="h-8 w-36 text-sm">
            <SelectValue placeholder="All platforms" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All platforms</SelectItem>
            <SelectItem value="instagram">Instagram</SelectItem>
            <SelectItem value="facebook">Facebook</SelectItem>
            <SelectItem value="twitter">X (Twitter)</SelectItem>
          </SelectContent>
        </Select>
        <Badge variant="outline" className="h-8 px-3 text-xs font-normal">
          {filtered.length} posts
        </Badge>
      </div>

      {/* Table */}
      <div className="rounded-lg border overflow-hidden">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map(hg => (
              <TableRow key={hg.id} className="bg-muted/50">
                {hg.headers.map(h => (
                  <TableHead key={h.id} style={{ width: h.getSize() }}>
                    {flexRender(h.column.columnDef.header, h.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="text-center py-12 text-muted-foreground text-sm">
                  No posts yet. Connect a social account to start pulling data.
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map(row => (
                <TableRow key={row.id} className="hover:bg-muted/30">
                  {row.getVisibleCells().map(cell => (
                    <TableCell key={cell.id} className="py-2.5">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

export function ContentTableSkeleton() {
  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-8 w-36" />
      </div>
      <div className="border rounded-lg overflow-hidden">
        <div className="bg-muted/50 h-10" />
        {[...Array(6)].map((_, i) => (
          <div key={i} className="flex gap-4 px-4 py-3 border-t">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-7 w-32" />
            <Skeleton className="h-4 w-12" />
          </div>
        ))}
      </div>
    </div>
  )
}
