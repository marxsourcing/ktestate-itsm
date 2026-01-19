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


const STATUS_DETAIL_CONFIG: Record<string, { label: string; color: string }> = {
  requested: { label: '요청됨', color: 'bg-amber-100 text-amber-700' },
  approved: { label: '승인됨', color: 'bg-sky-100 text-sky-700' },
  consulting: { label: '실무협의', color: 'bg-indigo-100 text-indigo-700' },
  accepted: { label: '접수됨', color: 'bg-blue-100 text-blue-700' },
  processing: { label: '처리중', color: 'bg-violet-100 text-violet-700' },
  test_requested: { label: '테스트중', color: 'bg-orange-100 text-orange-700' },
  test_completed: { label: '테스트완료', color: 'bg-teal-100 text-teal-700' },
  deploy_requested: { label: '배포대기', color: 'bg-cyan-100 text-cyan-700' },
  deploy_approved: { label: '배포승인', color: 'bg-lime-100 text-lime-700' },
}

interface RequestCardProps {
  request: Request
  compact?: boolean
  showDetailedStatus?: boolean
  isManager?: boolean
}

export function RequestCard({
  request,
  compact = false,
  showDetailedStatus = false,
  isManager = false,
}: RequestCardProps) {
  const priority = PRIORITY_CONFIG[request.priority as keyof typeof PRIORITY_CONFIG] || PRIORITY_CONFIG.medium
  const PriorityIcon = priority.icon
  const [timeAgo, setTimeAgo] = useState<string>('')

  // 상세 상태 정보
  const detailedStatus = STATUS_DETAIL_CONFIG[request.status]

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
    
    // Avoid synchronous setState warning
    queueMicrotask(() => setTimeAgo(time))
  }, [request.created_at])

  // 링크 대상 (채팅 드래프트는 채팅방으로, 일반 요청은 상세 페이지로)
  const href = request.is_chat_draft ? `/chat/${request.id}` : `/requests/${request.id}`

  return (
    <Link
      href={href}
      className={cn(
        'block rounded-lg border bg-white p-4 transition-all cursor-pointer',
        'hover:shadow-md hover:border-primary/30 hover:-translate-y-0.5',
        request.is_chat_draft ? 'border-dashed border-gray-300 bg-gray-50/50' : 'bg-white',
        'group'
      )}
    >
      {/* Header: Priority + Time */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {isManager && (
            <Badge variant="outline" className={cn('text-[10px] h-5', priority.className)}>
              <PriorityIcon className="size-2.5 mr-1" />
              {priority.label}
            </Badge>
          )}
          {showDetailedStatus && detailedStatus && (
            <Badge variant="secondary" className={cn('text-[10px] h-5 font-normal', detailedStatus.color)}>
              {detailedStatus.label}
            </Badge>
          )}
          {request.is_chat_draft && (
            <Badge variant="outline" className="text-[10px] h-5 bg-gray-100 text-gray-600 border-gray-200">
              <MessageSquare className="size-2.5 mr-1" />
              채팅 중
            </Badge>
          )}
        </div>
        <span className="text-[10px] text-gray-400 flex items-center gap-1">
          <Clock className="size-2.5" />
          {timeAgo}
        </span>
      </div>

      {/* Title */}
      <h4 className="font-medium text-sm text-gray-900 mb-2 line-clamp-2 group-hover:text-primary transition-colors">
        {request.title}
      </h4>

      {/* Description (truncated) */}
      {!compact && request.description && (
        <p className="text-xs text-gray-500 mb-3 line-clamp-2">
          {request.description}
        </p>
      )}

      {/* Footer: Category + System + Requester */}
      <div className="flex flex-wrap items-center gap-2 text-[10px] text-gray-500">
        {/* SR 구분 (대분류/소분류) */}
        {request.category_lv1?.name && (
          <span className="px-1.5 py-0.5 rounded bg-rose-50 text-rose-600 border border-rose-100">
            {request.category_lv1.name}
            {request.category_lv2?.name && ` / ${request.category_lv2.name}`}
          </span>
        )}

        {/* System & Module */}
        {request.system?.name && (
          <span className="flex items-center gap-1">
            <Server className="size-2.5 text-gray-400" />
            {request.system.name}
            {request.module?.name && (
              <span className="text-gray-400">/ {request.module.name}</span>
            )}
          </span>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Requester Avatar */}
        {request.requester && (
          <div className="flex items-center gap-1" title={request.requester.full_name || request.requester.email}>
            <div className="w-4 h-4 rounded-full bg-linear-to-br from-indigo-400 to-indigo-600 flex items-center justify-center text-[8px] text-white font-medium shadow-sm">
              {(request.requester.full_name || request.requester.email).charAt(0).toUpperCase()}
            </div>
          </div>
        )}

        {/* Manager assigned indicator */}
        {request.manager && (
          <div className="flex items-center gap-1 text-emerald-600" title={`담당: ${request.manager.full_name || request.manager.email}`}>
            <User className="size-2.5" />
          </div>
        )}
      </div>
    </Link>
  )
}
