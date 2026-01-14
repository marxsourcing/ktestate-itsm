'use client'

import { cn } from '@/lib/utils'
import { RequestCard } from './request-card'
import { Badge } from '@/components/ui/badge'
import {
  Search,
  Loader2,
  CheckCircle2,
  XCircle,
  Inbox
} from 'lucide-react'

// 상태별 컬럼 정의
const STATUS_COLUMNS = [
  {
    id: 'requested',
    label: '요청됨',
    icon: Inbox,
    gradient: 'from-amber-500 to-orange-500',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
  },
  {
    id: 'reviewing',
    label: '검토중',
    icon: Search,
    gradient: 'from-blue-500 to-cyan-500',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
  },
  {
    id: 'processing',
    label: '처리중',
    icon: Loader2,
    gradient: 'from-violet-500 to-purple-500',
    bgColor: 'bg-violet-50',
    borderColor: 'border-violet-200',
  },
  {
    id: 'completed',
    label: '완료',
    icon: CheckCircle2,
    gradient: 'from-emerald-500 to-green-500',
    bgColor: 'bg-emerald-50',
    borderColor: 'border-emerald-200',
  },
  {
    id: 'rejected',
    label: '반려',
    icon: XCircle,
    gradient: 'from-rose-500 to-red-500',
    bgColor: 'bg-rose-50',
    borderColor: 'border-rose-200',
  },
]

export type Request = {
  id: string
  title: string
  description: string
  status: string
  priority: string
  type: string
  created_at: string
  completed_at?: string
  requester?: { full_name?: string; email: string }
  manager?: { full_name?: string; email: string } | null
  system?: { name: string } | null
  module?: { name: string } | null
}

interface KanbanBoardProps {
  requests: Request[]
}

export function KanbanBoard({ requests }: KanbanBoardProps) {
  const getRequestsByStatus = (status: string) => {
    return requests.filter((r) => r.status === status)
  }

  return (
    <div className="flex gap-4 overflow-x-auto pb-4 px-1 h-full">
      {STATUS_COLUMNS.map((column) => {
        const columnRequests = getRequestsByStatus(column.id)
        const Icon = column.icon

        return (
          <div
            key={column.id}
            className={cn(
              'flex-shrink-0 w-[320px] flex flex-col rounded-xl',
              'bg-white border border-gray-200'
            )}
          >
            {/* Column Header */}
            <div className={cn('p-4 rounded-t-xl', column.bgColor)}>
              <div className="flex items-center gap-2">
                <div className={cn(
                  'w-8 h-8 rounded-lg flex items-center justify-center bg-gradient-to-br text-white',
                  column.gradient
                )}>
                  <Icon className="size-4" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-800">{column.label}</h3>
                </div>
                <Badge
                  variant="secondary"
                  className="bg-white/80 text-gray-700"
                >
                  {columnRequests.length}
                </Badge>
              </div>
            </div>

            {/* Column Content */}
            <div className="flex-1 p-3 space-y-3 overflow-y-auto min-h-[200px] max-h-[calc(100vh-280px)]">
              {columnRequests.length === 0 ? (
                <div className={cn(
                  'flex flex-col items-center justify-center py-8 rounded-lg border-2 border-dashed',
                  column.borderColor
                )}>
                  <Icon className="size-8 text-gray-300 mb-2" />
                  <p className="text-sm text-gray-400">요청이 없습니다</p>
                </div>
              ) : (
                columnRequests.map((request) => (
                  <RequestCard
                    key={request.id}
                    request={request}
                  />
                ))
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

