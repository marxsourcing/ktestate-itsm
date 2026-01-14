'use client'

import { cn } from '@/lib/utils'
import { RequestCard } from './request-card'
import { Badge } from '@/components/ui/badge'
import {
  FileEdit,
  Send,
  ThumbsUp,
  Users,
  ClipboardCheck,
  Loader2,
  TestTube2,
  CheckSquare,
  Rocket,
  ShieldCheck,
  CheckCircle2,
  XCircle,
} from 'lucide-react'

// 상태별 컬럼 정의 (12개 상태 체계)
const STATUS_COLUMNS = [
  {
    id: 'draft',
    label: '작성중',
    icon: FileEdit,
    gradient: 'from-gray-400 to-gray-500',
    bgColor: 'bg-gray-50',
    borderColor: 'border-gray-200',
  },
  {
    id: 'requested',
    label: '요청',
    icon: Send,
    gradient: 'from-amber-500 to-orange-500',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
  },
  {
    id: 'approved',
    label: '승인',
    icon: ThumbsUp,
    gradient: 'from-sky-500 to-blue-500',
    bgColor: 'bg-sky-50',
    borderColor: 'border-sky-200',
  },
  {
    id: 'consulting',
    label: '실무협의',
    icon: Users,
    gradient: 'from-indigo-500 to-purple-500',
    bgColor: 'bg-indigo-50',
    borderColor: 'border-indigo-200',
  },
  {
    id: 'accepted',
    label: '접수',
    icon: ClipboardCheck,
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
    id: 'test_requested',
    label: '테스트요청',
    icon: TestTube2,
    gradient: 'from-orange-500 to-red-500',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-200',
  },
  {
    id: 'test_completed',
    label: '테스트완료',
    icon: CheckSquare,
    gradient: 'from-teal-500 to-green-500',
    bgColor: 'bg-teal-50',
    borderColor: 'border-teal-200',
  },
  {
    id: 'deploy_requested',
    label: '배포요청',
    icon: Rocket,
    gradient: 'from-cyan-500 to-blue-500',
    bgColor: 'bg-cyan-50',
    borderColor: 'border-cyan-200',
  },
  {
    id: 'deploy_approved',
    label: '배포승인',
    icon: ShieldCheck,
    gradient: 'from-lime-500 to-green-500',
    bgColor: 'bg-lime-50',
    borderColor: 'border-lime-200',
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
    <div className="flex gap-2 overflow-x-auto pb-4 px-1 h-full">
      {STATUS_COLUMNS.map((column) => {
        const columnRequests = getRequestsByStatus(column.id)
        const Icon = column.icon

        return (
          <div
            key={column.id}
            className={cn(
              'flex-shrink-0 w-[240px] flex flex-col rounded-xl',
              'bg-white border border-gray-200'
            )}
          >
            {/* Column Header */}
            <div className={cn('p-3 rounded-t-xl', column.bgColor)}>
              <div className="flex items-center gap-2">
                <div className={cn(
                  'w-7 h-7 rounded-lg flex items-center justify-center bg-gradient-to-br text-white',
                  column.gradient
                )}>
                  <Icon className="size-3.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-800 text-sm truncate">{column.label}</h3>
                </div>
                <Badge
                  variant="secondary"
                  className="bg-white/80 text-gray-700 text-xs px-1.5"
                >
                  {columnRequests.length}
                </Badge>
              </div>
            </div>

            {/* Column Content */}
            <div className="flex-1 p-2 space-y-2 overflow-y-auto min-h-[200px] max-h-[calc(100vh-280px)]">
              {columnRequests.length === 0 ? (
                <div className={cn(
                  'flex flex-col items-center justify-center py-6 rounded-lg border-2 border-dashed',
                  column.borderColor
                )}>
                  <Icon className="size-6 text-gray-300 mb-1" />
                  <p className="text-xs text-gray-400">없음</p>
                </div>
              ) : (
                columnRequests.map((request) => (
                  <RequestCard
                    key={request.id}
                    request={request}
                    compact
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

