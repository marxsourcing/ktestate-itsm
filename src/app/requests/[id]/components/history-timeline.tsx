'use client'

import { History, UserCheck, MessageSquare, FileText, RefreshCcw } from 'lucide-react'

interface HistoryItem {
  id: string
  action: string
  previous_status: string | null
  new_status: string | null
  note: string | null
  created_at: string
  actor: {
    full_name: string | null
    email: string
  }
}

interface HistoryTimelineProps {
  history: HistoryItem[]
  compact?: boolean
}

const getStatusLabel = (status: string | null) => {
  if (!status) return ''
  const statusLabels: Record<string, string> = {
    draft: '작성중',
    requested: '요청',
    approved: '승인',
    consulting: '실무협의',
    accepted: '접수',
    processing: '처리중',
    test_requested: '테스트요청',
    test_completed: '테스트완료',
    deploy_requested: '배포요청',
    deploy_approved: '배포승인',
    completed: '완료',
    rejected: '반려',
  }
  return statusLabels[status] || status
}

const getActionIcon = (action: string) => {
  switch (action) {
    case 'created':
      return <FileText className="h-4 w-4" />
    case 'status_change':
      return <RefreshCcw className="h-4 w-4" />
    case 'assigned':
      return <UserCheck className="h-4 w-4" />
    case 'comment_added':
      return <MessageSquare className="h-4 w-4" />
    default:
      return <History className="h-4 w-4" />
  }
}

const getActionLabel = (action: string) => {
  switch (action) {
    case 'created': return '요청 생성'
    case 'status_change': return '상태 변경'
    case 'assigned': return '담당자 배정'
    case 'comment_added': return '댓글 추가'
    default: return action
  }
}

const getActionColor = (action: string) => {
  switch (action) {
    case 'created':
      return 'bg-blue-500'
    case 'status_change':
      return 'bg-amber-500'
    case 'assigned':
      return 'bg-green-500'
    case 'comment_added':
      return 'bg-purple-500'
    default:
      return 'bg-gray-500'
  }
}

export function HistoryTimeline({ history, compact = false }: HistoryTimelineProps) {
  if (!history || history.length === 0) {
    return (
      <div className={`text-center ${compact ? 'py-4' : 'py-8'} text-muted-foreground`}>
        <History className={`${compact ? 'h-6 w-6' : 'h-10 w-10'} mx-auto mb-2 opacity-50`} />
        <p className={compact ? 'text-xs' : ''}>처리 이력이 없습니다.</p>
      </div>
    )
  }

  if (compact) {
    return (
      <div className="relative">
        {/* 타임라인 세로선 */}
        <div className="absolute left-2.5 top-0 bottom-0 w-0.5 bg-gray-200" />
        
        <ul className="space-y-2">
          {history.slice(0, 5).map((item) => (
            <li key={item.id} className="relative pl-7">
              {/* 아이콘 원형 배경 */}
              <div className={`absolute left-0 w-5 h-5 rounded-full flex items-center justify-center text-white ${getActionColor(item.action)}`}>
                <div className="scale-75">{getActionIcon(item.action)}</div>
              </div>
              
              <div className="py-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-gray-700">
                    {getActionLabel(item.action)}
                  </span>
                  {item.action === 'status_change' && item.new_status && (
                    <span className="px-1.5 py-0.5 text-[10px] bg-gray-100 rounded text-gray-600">
                      → {getStatusLabel(item.new_status)}
                    </span>
                  )}
                </div>
                <div className="text-[10px] text-gray-400 mt-0.5">
                  {new Date(item.created_at).toLocaleString('ko-KR', { 
                    month: 'short', 
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                  {' · '}
                  {item.actor?.full_name || item.actor?.email}
                </div>
              </div>
            </li>
          ))}
        </ul>
        {history.length > 5 && (
          <p className="text-xs text-gray-400 mt-2 pl-7">
            +{history.length - 5}건 더 있음
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="relative">
      {/* 타임라인 세로선 */}
      <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />
      
      <ul className="space-y-4">
        {history.map((item) => (
          <li key={item.id} className="relative pl-10">
            {/* 아이콘 원형 배경 */}
            <div className={`absolute left-0 w-8 h-8 rounded-full flex items-center justify-center text-white ${getActionColor(item.action)}`}>
              {getActionIcon(item.action)}
            </div>
            
            <div className="bg-slate-50 rounded-lg p-4 border">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-sm">
                  {getActionLabel(item.action)}
                </span>
                <span className="text-xs text-muted-foreground">
                  {new Date(item.created_at).toLocaleString('ko-KR')}
                </span>
              </div>
              
              {item.action === 'status_change' && item.previous_status && item.new_status && (
                <div className="flex items-center gap-2 text-sm mb-2">
                  <span className="px-2 py-0.5 bg-slate-200 rounded text-slate-600">
                    {getStatusLabel(item.previous_status)}
                  </span>
                  <span className="text-muted-foreground">→</span>
                  <span className="px-2 py-0.5 bg-primary/10 rounded text-primary font-medium">
                    {getStatusLabel(item.new_status)}
                  </span>
                </div>
              )}
              
              {item.note && (
                <p className="text-sm text-muted-foreground">
                  {item.note}
                </p>
              )}
              
              <p className="text-xs text-muted-foreground mt-2">
                by {item.actor?.full_name || item.actor?.email}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

