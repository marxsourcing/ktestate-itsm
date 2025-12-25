'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { 
  AlertTriangle, 
  ArrowUp, 
  Minus, 
  ArrowDown,
  Clock,
  User,
  Server,
  ChevronRight,
  Inbox,
  CheckCircle2,
  Bot,
  Sparkles
} from 'lucide-react'
import Link from 'next/link'
import { WorkspaceRequestDetail } from './workspace-request-detail'

export type AssignedRequest = {
  id: string
  title: string
  description: string
  status: string
  priority: string
  type: string
  created_at: string
  completed_at?: string
  requester?: { full_name?: string; email: string }
  system?: { name: string } | null
}

interface RequestListProps {
  myRequests: AssignedRequest[]
  unassignedRequests: AssignedRequest[]
  recentCompletedRequests: AssignedRequest[]
  currentUserId: string
}

const PRIORITY_CONFIG = {
  urgent: { 
    label: '긴급', 
    icon: AlertTriangle,
    color: 'text-rose-600 bg-rose-50 border-rose-200',
    dotColor: 'bg-rose-500',
    gradient: 'from-rose-500 to-red-500'
  },
  high: { 
    label: '높음', 
    icon: ArrowUp,
    color: 'text-orange-600 bg-orange-50 border-orange-200',
    dotColor: 'bg-orange-500',
    gradient: 'from-orange-500 to-amber-500'
  },
  medium: { 
    label: '보통', 
    icon: Minus,
    color: 'text-blue-600 bg-blue-50 border-blue-200',
    dotColor: 'bg-blue-500',
    gradient: 'from-blue-500 to-cyan-500'
  },
  low: { 
    label: '낮음', 
    icon: ArrowDown,
    color: 'text-gray-600 bg-gray-50 border-gray-200',
    dotColor: 'bg-gray-400',
    gradient: 'from-gray-400 to-gray-500'
  },
}

const TYPE_LABELS: Record<string, string> = {
  account: '계정',
  software: '소프트웨어',
  hardware: '하드웨어',
  network: '네트워크',
  other: '기타',
}

export function RequestList({ 
  myRequests, 
  unassignedRequests, 
  recentCompletedRequests,
  currentUserId 
}: RequestListProps) {
  const [selectedRequest, setSelectedRequest] = useState<AssignedRequest | null>(
    myRequests[0] || unassignedRequests[0] || null
  )

  // 우선순위별 그룹핑
  const groupByPriority = (requests: AssignedRequest[]) => {
    const groups: Record<string, AssignedRequest[]> = {
      urgent: [],
      high: [],
      medium: [],
      low: [],
    }
    requests.forEach(req => {
      const priority = req.priority as keyof typeof groups
      if (groups[priority]) {
        groups[priority].push(req)
      } else {
        groups.medium.push(req)
      }
    })
    return groups
  }

  const myGrouped = groupByPriority(myRequests)

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left: Request List */}
      <div className="w-[400px] flex-shrink-0 bg-white border-r border-gray-200 flex flex-col overflow-hidden">
        {/* Tab-like sections */}
        <div className="flex-1 overflow-y-auto">
          {/* My Assigned Requests */}
          <div className="p-4 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-500 mb-3 flex items-center gap-2">
              <div className="w-5 h-5 rounded bg-indigo-100 flex items-center justify-center">
                <Bot className="size-3 text-indigo-600" />
              </div>
              내 작업 ({myRequests.length})
            </h3>

            {myRequests.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <CheckCircle2 className="size-12 mx-auto mb-3 text-gray-300" />
                <p className="text-sm">모든 작업을 완료했습니다! 🎉</p>
              </div>
            ) : (
              <div className="space-y-4">
                {(['urgent', 'high', 'medium', 'low'] as const).map(priority => {
                  const requests = myGrouped[priority]
                  if (requests.length === 0) return null
                  
                  const config = PRIORITY_CONFIG[priority]
                  const Icon = config.icon

                  return (
                    <div key={priority}>
                      <div className={cn(
                        'flex items-center gap-2 px-2 py-1 rounded-lg text-xs font-medium mb-2',
                        config.color
                      )}>
                        <Icon className="size-3" />
                        {config.label} ({requests.length})
                      </div>
                      <div className="space-y-2">
                        {requests.map(request => (
                          <RequestItem
                            key={request.id}
                            request={request}
                            isSelected={selectedRequest?.id === request.id}
                            onClick={() => setSelectedRequest(request)}
                            priority={priority}
                          />
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Unassigned Requests */}
          {unassignedRequests.length > 0 && (
            <div className="p-4 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-500 mb-3 flex items-center gap-2">
                <div className="w-5 h-5 rounded bg-amber-100 flex items-center justify-center">
                  <Inbox className="size-3 text-amber-600" />
                </div>
                배정 대기 ({unassignedRequests.length})
              </h3>
              <div className="space-y-2">
                {unassignedRequests.slice(0, 5).map(request => (
                  <RequestItem
                    key={request.id}
                    request={request}
                    isSelected={selectedRequest?.id === request.id}
                    onClick={() => setSelectedRequest(request)}
                    priority={request.priority as keyof typeof PRIORITY_CONFIG}
                    showAssignButton
                  />
                ))}
                {unassignedRequests.length > 5 && (
                  <Link 
                    href="/requests"
                    className="block text-center text-sm text-gray-500 hover:text-gray-700 py-2"
                  >
                    +{unassignedRequests.length - 5}개 더 보기
                  </Link>
                )}
              </div>
            </div>
          )}

          {/* Recent Completed */}
          {recentCompletedRequests.length > 0 && (
            <div className="p-4">
              <h3 className="text-sm font-semibold text-gray-500 mb-3 flex items-center gap-2">
                <div className="w-5 h-5 rounded bg-emerald-100 flex items-center justify-center">
                  <CheckCircle2 className="size-3 text-emerald-600" />
                </div>
                최근 완료 ({recentCompletedRequests.length})
              </h3>
              <div className="space-y-2">
                {recentCompletedRequests.slice(0, 3).map(request => (
                  <RequestItem
                    key={request.id}
                    request={request}
                    isSelected={selectedRequest?.id === request.id}
                    onClick={() => setSelectedRequest(request)}
                    priority={request.priority as keyof typeof PRIORITY_CONFIG}
                    completed
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right: Detail + AI Chat */}
      <div className="flex-1 overflow-hidden">
        {selectedRequest ? (
          <WorkspaceRequestDetail 
            request={selectedRequest}
            currentUserId={currentUserId}
          />
        ) : (
          <EmptyState />
        )}
      </div>
    </div>
  )
}

function RequestItem({
  request,
  isSelected,
  onClick,
  priority,
  showAssignButton = false,
  completed = false,
}: {
  request: AssignedRequest
  isSelected: boolean
  onClick: () => void
  priority: keyof typeof PRIORITY_CONFIG
  showAssignButton?: boolean
  completed?: boolean
}) {
  const config = PRIORITY_CONFIG[priority] || PRIORITY_CONFIG.medium
  const timeAgo = getTimeAgo(request.created_at)

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left p-3 rounded-xl border transition-all',
        'hover:shadow-md hover:-translate-y-0.5',
        isSelected
          ? 'bg-indigo-50 border-indigo-300 shadow-sm'
          : 'bg-white border-gray-200 hover:border-gray-300',
        completed && 'opacity-60'
      )}
    >
      <div className="flex items-start gap-3">
        {/* Priority Dot */}
        <div className={cn('w-2 h-2 rounded-full mt-2 flex-shrink-0', config.dotColor)} />
        
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <h4 className={cn(
              'font-medium text-sm line-clamp-1',
              isSelected ? 'text-indigo-900' : 'text-gray-900'
            )}>
              {request.title}
            </h4>
            <ChevronRight className={cn(
              'size-4 flex-shrink-0 transition-transform',
              isSelected ? 'text-indigo-600 translate-x-0.5' : 'text-gray-400'
            )} />
          </div>

          <p className="text-xs text-gray-500 line-clamp-1 mb-2">
            {request.description}
          </p>

          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn(
              'inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded',
              config.color
            )}>
              {config.label}
            </span>
            <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
              {TYPE_LABELS[request.type] || request.type}
            </span>
            <span className="text-[10px] text-gray-400 flex items-center gap-1">
              <Clock className="size-3" />
              {timeAgo}
            </span>
            {request.requester && (
              <span className="text-[10px] text-gray-400 flex items-center gap-1">
                <User className="size-3" />
                {request.requester.full_name || request.requester.email?.split('@')[0]}
              </span>
            )}
          </div>
        </div>
      </div>
    </button>
  )
}

function EmptyState() {
  return (
    <div className="flex items-center justify-center h-full bg-gray-50">
      <div className="text-center max-w-md">
        <div className="inline-flex size-20 items-center justify-center rounded-3xl bg-gradient-to-br from-indigo-100 to-purple-100 mb-6">
          <Sparkles className="size-10 text-indigo-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-3">
          요청을 선택해주세요
        </h2>
        <p className="text-gray-500">
          왼쪽 목록에서 처리할 요청을 선택하면<br />
          AI 어시스턴트와 함께 작업할 수 있습니다.
        </p>
      </div>
    </div>
  )
}

function getTimeAgo(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMins < 1) return '방금 전'
  if (diffMins < 60) return `${diffMins}분 전`
  if (diffHours < 24) return `${diffHours}시간 전`
  if (diffDays < 7) return `${diffDays}일 전`
  return date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
}

