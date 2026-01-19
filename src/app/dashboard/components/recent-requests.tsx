'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getRecentRequests, type RecentRequestData } from '../actions'
import { cn } from '@/lib/utils'
import { ExternalLink } from 'lucide-react'

const statusStyles: Record<string, { bg: string; text: string; label: string }> = {
  requested: { bg: 'bg-amber-100', text: 'text-amber-700', label: '접수 대기' },
  reviewing: { bg: 'bg-blue-100', text: 'text-blue-700', label: '검토 중' },
  processing: { bg: 'bg-violet-100', text: 'text-violet-700', label: '처리 중' },
  completed: { bg: 'bg-emerald-100', text: 'text-emerald-700', label: '완료' },
  rejected: { bg: 'bg-red-100', text: 'text-red-700', label: '반려' }
}

const priorityStyles: Record<string, { bg: string; text: string }> = {
  urgent: { bg: 'bg-red-500', text: 'text-white' },
  high: { bg: 'bg-orange-500', text: 'text-white' },
  medium: { bg: 'bg-gray-400', text: 'text-white' },
  low: { bg: 'bg-gray-300', text: 'text-gray-700' }
}

const priorityLabels: Record<string, string> = {
  urgent: '긴급',
  high: '높음',
  medium: '보통',
  low: '낮음'
}

export function RecentRequests() {
  const [data, setData] = useState<RecentRequestData[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      const result = await getRecentRequests()
      if (result.data) {
        setData(result.data)
      }
      setLoading(false)
    }
    fetchData()
  }, [])

  if (loading) {
    return (
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">최근 요청</h3>
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 bg-gray-100 rounded animate-pulse"></div>
          ))}
        </div>
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">최근 요청</h3>
        <div className="py-12 text-center text-gray-400">
          아직 등록된 요청이 없습니다.
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">최근 요청</h3>
        <Link 
          href="/requests"
          className="text-sm text-rose-600 hover:text-rose-700 flex items-center gap-1"
        >
          전체 보기
          <ExternalLink className="size-4" />
        </Link>
      </div>
      
      <div className="space-y-3">
        {data.map((request) => {
          const status = statusStyles[request.status] || statusStyles.requested
          const priority = priorityStyles[request.priority] || priorityStyles.medium

          return (
            <Link
              key={request.id}
              href={`/requests/${request.id}`}
              className="block rounded-lg border border-gray-100 p-4 hover:border-gray-200 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-gray-900 truncate">
                    {request.title}
                  </h4>
                  <div className="mt-1 flex items-center gap-2 text-sm text-gray-500">
                    <span>{request.requester_name}</span>
                    <span>•</span>
                    <span>
                      {new Date(request.created_at).toLocaleDateString('ko-KR', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={cn(
                    'px-2 py-0.5 text-xs font-medium rounded-full',
                    priority.bg, priority.text
                  )}>
                    {priorityLabels[request.priority]}
                  </span>
                  <span className={cn(
                    'px-2 py-0.5 text-xs font-medium rounded-full',
                    status.bg, status.text
                  )}>
                    {status.label}
                  </span>
                </div>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}

