'use client'

import { useState } from 'react'
import { AlertTriangle, ChevronDown, ChevronUp, ExternalLink, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import Link from 'next/link'

interface SimilarRequest {
  id: string
  title: string
  description: string
  status: string
  system_name: string | null
  created_at: string
  similarity: number
  category_lv1_name?: string | null  // 대분류 (SR 구분)
  category_lv2_name?: string | null  // 소분류 (SR 상세 구분)
}

interface DuplicateAlertProps {
  similarRequests: SimilarRequest[]
  hasDuplicate: boolean
  onDismiss?: () => void
  onProceed?: () => void
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  draft: { label: '작성중', color: 'bg-gray-100 text-gray-600' },
  requested: { label: '요청', color: 'bg-amber-100 text-amber-700' },
  approved: { label: '승인', color: 'bg-sky-100 text-sky-700' },
  consulting: { label: '실무협의', color: 'bg-indigo-100 text-indigo-700' },
  accepted: { label: '접수', color: 'bg-blue-100 text-blue-700' },
  processing: { label: '처리중', color: 'bg-violet-100 text-violet-700' },
  test_requested: { label: '테스트요청', color: 'bg-orange-100 text-orange-700' },
  test_completed: { label: '테스트완료', color: 'bg-teal-100 text-teal-700' },
  deploy_requested: { label: '배포요청', color: 'bg-cyan-100 text-cyan-700' },
  deploy_approved: { label: '배포승인', color: 'bg-lime-100 text-lime-700' },
  completed: { label: '완료', color: 'bg-emerald-100 text-emerald-700' },
  rejected: { label: '반려', color: 'bg-red-100 text-red-700' },
}


export function DuplicateAlert({
  similarRequests,
  hasDuplicate,
  onDismiss,
  onProceed
}: DuplicateAlertProps) {
  const [isExpanded, setIsExpanded] = useState(true)

  if (similarRequests.length === 0) return null

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  return (
    <div className={cn(
      'rounded-lg border overflow-hidden',
      hasDuplicate
        ? 'border-red-300 bg-red-50'
        : 'border-amber-300 bg-amber-50'
    )}>
      {/* Header */}
      <div
        className={cn(
          'flex items-center gap-3 px-4 py-3 cursor-pointer',
          hasDuplicate ? 'bg-red-100' : 'bg-amber-100'
        )}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <AlertTriangle className={cn(
          'size-5',
          hasDuplicate ? 'text-red-600' : 'text-amber-600'
        )} />
        <div className="flex-1">
          <span className={cn(
            'font-medium',
            hasDuplicate ? 'text-red-700' : 'text-amber-700'
          )}>
            {hasDuplicate
              ? '⚠️ 매우 유사한 요청이 있습니다!'
              : '유사한 요청 발견'
            }
          </span>
          {hasDuplicate && (
            <p className="text-sm text-red-600 mt-0.5">
              중복 요청일 수 있으니 기존 요청을 먼저 확인해주세요.
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isExpanded ? (
            <ChevronUp className={cn('size-5', hasDuplicate ? 'text-red-600' : 'text-amber-600')} />
          ) : (
            <ChevronDown className={cn('size-5', hasDuplicate ? 'text-red-600' : 'text-amber-600')} />
          )}
          {onDismiss && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onDismiss()
              }}
              className={cn(
                'p-1 rounded hover:bg-white/50',
                hasDuplicate ? 'text-red-600' : 'text-amber-600'
              )}
            >
              <X className="size-4" />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      {isExpanded && (
        <div className="p-4 space-y-3 bg-white">
          {similarRequests.map((req) => (
            <div
              key={req.id}
              className={cn(
                'p-3 rounded-lg border',
                req.similarity >= 80
                  ? 'border-red-200 bg-red-50'
                  : 'border-gray-200 bg-gray-50'
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={cn(
                      'text-xs px-2 py-0.5 rounded font-medium',
                      req.similarity >= 80
                        ? 'bg-red-200 text-red-700'
                        : req.similarity >= 50
                          ? 'bg-amber-200 text-amber-700'
                          : 'bg-gray-200 text-gray-600'
                    )}>
                      {req.similarity}% 유사
                    </span>
                    <span className={cn(
                      'text-xs px-2 py-0.5 rounded',
                      STATUS_LABELS[req.status]?.color || 'bg-gray-100 text-gray-600'
                    )}>
                      {STATUS_LABELS[req.status]?.label || req.status}
                    </span>
                    {/* SR 구분 (대분류/소분류) */}
                    {req.category_lv1_name && (
                      <span className="text-xs text-rose-600">
                        {req.category_lv1_name}
                        {req.category_lv2_name && ` / ${req.category_lv2_name}`}
                      </span>
                    )}
                  </div>
                  <h4 className="font-medium text-gray-900 mt-1.5 truncate">
                    {req.title}
                  </h4>
                  {req.description && (
                    <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                      {req.description}
                    </p>
                  )}
                  <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                    {req.system_name && (
                      <span>{req.system_name}</span>
                    )}
                    <span>{formatDate(req.created_at)}</span>
                  </div>
                </div>
                <Link href={`/requests/${req.id}`} target="_blank">
                  <Button
                    variant="outline"
                    size="sm"
                    className="shrink-0 text-gray-600 hover:text-gray-900"
                  >
                    <ExternalLink className="size-4" />
                  </Button>
                </Link>
              </div>
            </div>
          ))}

          {/* Actions */}
          {hasDuplicate && onProceed && (
            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button
                variant="outline"
                size="sm"
                onClick={onDismiss}
                className="text-gray-600"
              >
                취소
              </Button>
              <Button
                size="sm"
                onClick={onProceed}
                className="bg-amber-600 hover:bg-amber-700 text-white"
              >
                그래도 요청하기
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
