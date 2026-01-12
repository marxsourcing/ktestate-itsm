'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { 
  Clock,
  User,
  Server,
  AlertTriangle,
  ArrowUp,
  Minus,
  ArrowDown,
  MessageSquare
} from 'lucide-react'
import type { Request } from './kanban-board'

const PRIORITY_CONFIG = {
  urgent: {
    label: '긴급',
    icon: AlertTriangle,
    className: 'bg-red-100 text-red-700 border-red-200',
    dotColor: 'bg-red-500',
  },
  high: {
    label: '높음',
    icon: ArrowUp,
    className: 'bg-orange-100 text-orange-700 border-orange-200',
    dotColor: 'bg-orange-500',
  },
  medium: {
    label: '보통',
    icon: Minus,
    className: 'bg-blue-100 text-blue-700 border-blue-200',
    dotColor: 'bg-blue-500',
  },
  low: {
    label: '낮음',
    icon: ArrowDown,
    className: 'bg-gray-100 text-gray-600 border-gray-200',
    dotColor: 'bg-gray-400',
  },
}

const TYPE_LABELS: Record<string, string> = {
  feature_add: '기능추가',
  feature_improve: '기능개선',
  bug_fix: '버그수정',
  other: '기타',
}

interface RequestCardProps {
  request: Request
  compact?: boolean
}

export function RequestCard({
  request,
  compact = false,
}: RequestCardProps) {
  const priority = PRIORITY_CONFIG[request.priority as keyof typeof PRIORITY_CONFIG] || PRIORITY_CONFIG.medium
  const PriorityIcon = priority.icon
  const [timeAgo, setTimeAgo] = useState<string>('')

  // 클라이언트에서만 시간 계산 (Hydration mismatch 방지)
  useEffect(() => {
    const createdDate = new Date(request.created_at)
    const now = new Date()
    const diffDays = Math.floor((now.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24))

    let time = ''
    if (diffDays === 0) {
      time = '오늘'
    } else if (diffDays === 1) {
      time = '어제'
    } else if (diffDays < 7) {
      time = `${diffDays}일 전`
    } else {
      time = createdDate.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
    }
    setTimeAgo(time)
  }, [request.created_at])

  return (
    <Link
      href={`/requests/${request.id}`}
      className={cn(
        'block rounded-lg border bg-white p-4 transition-all cursor-pointer',
        'hover:shadow-md hover:border-primary/30 hover:-translate-y-0.5',
        'group'
      )}
    >
      {/* Header: Priority + Time */}
      <div className="flex items-center justify-between mb-2">
        <Badge variant="outline" className={cn('text-xs', priority.className)}>
          <PriorityIcon className="size-3 mr-1" />
          {priority.label}
        </Badge>
        <span className="text-xs text-gray-400 flex items-center gap-1">
          <Clock className="size-3" />
          {timeAgo}
        </span>
      </div>

      {/* Title */}
      <h4 className="font-medium text-gray-900 mb-2 line-clamp-2 group-hover:text-primary transition-colors">
        {request.title}
      </h4>

      {/* Description (truncated) */}
      {!compact && request.description && (
        <p className="text-sm text-gray-500 mb-3 line-clamp-2">
          {request.description}
        </p>
      )}

      {/* Footer: Type + System + Requester */}
      <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
        {/* Type Badge */}
        <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-600">
          {TYPE_LABELS[request.type] || request.type}
        </span>

        {/* System */}
        {request.system?.name && (
          <span className="flex items-center gap-1">
            <Server className="size-3" />
            {request.system.name}
          </span>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Requester Avatar */}
        {request.requester && (
          <div className="flex items-center gap-1" title={request.requester.full_name || request.requester.email}>
            <div className="w-5 h-5 rounded-full bg-gradient-to-br from-rose-400 to-rose-600 flex items-center justify-center text-[10px] text-white font-medium">
              {(request.requester.full_name || request.requester.email).charAt(0).toUpperCase()}
            </div>
          </div>
        )}

        {/* Manager assigned indicator */}
        {request.manager && (
          <div className="flex items-center gap-1 text-emerald-600" title={`담당: ${request.manager.full_name || request.manager.email}`}>
            <User className="size-3" />
          </div>
        )}
      </div>
    </Link>
  )
}

