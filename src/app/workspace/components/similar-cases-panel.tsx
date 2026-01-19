'use client'

import { useState, useEffect, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  FileSearch,
  ExternalLink,
  Copy,
  CheckCircle,
  Clock,
  XCircle,
  Loader2,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  RefreshCw
} from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'

interface SimilarCase {
  id: string
  title: string
  description: string
  status: string
  system_name: string | null
  created_at: string
  similarity: number
  category_lv1_name?: string | null  // 대분류 (SR 구분)
  category_lv2_name?: string | null  // 소분류 (SR 상세 구분)
  comments?: Array<{
    content: string
    is_internal: boolean
    author_name?: string
    created_at: string
  }>
}

interface SimilarCasesPanelProps {
  requestId: string
  requestTitle: string
  requestDescription: string
  systemName?: string
  onSelectCase?: (caseData: SimilarCase) => void
}

const STATUS_CONFIG: Record<string, { label: string; icon: typeof CheckCircle; color: string }> = {
  completed: { label: '완료', icon: CheckCircle, color: 'text-emerald-600' },
  processing: { label: '처리중', icon: Clock, color: 'text-blue-600' },
  reviewing: { label: '검토중', icon: Clock, color: 'text-amber-600' },
  requested: { label: '요청', icon: AlertCircle, color: 'text-gray-500' },
  rejected: { label: '반려', icon: XCircle, color: 'text-red-600' },
}


export function SimilarCasesPanel({
  requestId,
  requestTitle,
  requestDescription,
  systemName,
  onSelectCase
}: SimilarCasesPanelProps) {
  const [similarCases, setSimilarCases] = useState<SimilarCase[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isSearched, setIsSearched] = useState(false)
  const [expandedCaseId, setExpandedCaseId] = useState<string | null>(null)
  const [loadingComments, setLoadingComments] = useState<string | null>(null)

  const searchSimilarCases = useCallback(async () => {
    setIsLoading(true)
    setIsSearched(true)

    try {
      const response = await fetch('/api/ai/similar-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: requestTitle,
          description: requestDescription,
          system: systemName,
          excludeId: requestId
        })
      })

      if (!response.ok) {
        throw new Error('검색 실패')
      }

      const data = await response.json()
      setSimilarCases(data.similarRequests || [])
    } catch (error) {
      console.error('Similar cases search error:', error)
      toast.error('유사 사례 검색 중 오류가 발생했습니다.')
      setSimilarCases([])
    } finally {
      setIsLoading(false)
    }
  }, [requestId, requestTitle, requestDescription, systemName])

  // 요청 변경 시 검색 상태 초기화 및 자동 검색
  useEffect(() => {
    setSimilarCases([])
    setIsSearched(false)
    setExpandedCaseId(null)
    setLoadingComments(null)

    if (requestId && requestTitle) {
      searchSimilarCases()
    }
  }, [requestId, requestTitle, searchSimilarCases])

  // 댓글(답변) 로드
  const loadComments = async (caseId: string) => {
    setLoadingComments(caseId)
    try {
      const response = await fetch(`/api/requests/${caseId}/comments`)
      if (response.ok) {
        const data = await response.json()
        setSimilarCases(prev =>
          prev.map(c =>
            c.id === caseId ? { ...c, comments: data.comments } : c
          )
        )
      }
    } catch (error) {
      console.error('Load comments error:', error)
    } finally {
      setLoadingComments(null)
    }
  }

  const toggleExpand = async (caseId: string) => {
    if (expandedCaseId === caseId) {
      setExpandedCaseId(null)
    } else {
      setExpandedCaseId(caseId)
      const selectedCase = similarCases.find(c => c.id === caseId)
      if (selectedCase && !selectedCase.comments) {
        await loadComments(caseId)
      }
    }
  }

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast.success('클립보드에 복사되었습니다.')
    } catch {
      toast.error('복사 실패')
    }
  }

  const getSimilarityColor = (similarity: number) => {
    if (similarity >= 80) return 'text-red-600 bg-red-50'
    if (similarity >= 60) return 'text-orange-600 bg-orange-50'
    if (similarity >= 40) return 'text-amber-600 bg-amber-50'
    return 'text-gray-600 bg-gray-50'
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-linear-to-br from-indigo-50 to-purple-50 border-b">
        <div className="flex items-center gap-2">
          <FileSearch className="size-4 text-indigo-600" />
          <h3 className="text-sm font-semibold text-gray-900">유사 사례 검색</h3>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={searchSimilarCases}
          disabled={isLoading}
          className="text-xs gap-1.5"
        >
          {isLoading ? (
            <Loader2 className="size-3 animate-spin" />
          ) : (
            <RefreshCw className="size-3" />
          )}
          {isSearched ? '다시 검색' : '검색하기'}
        </Button>
      </div>

      {/* Content */}
      <div className="p-3 max-h-[400px] overflow-y-auto">
        {!isSearched ? (
          <div className="text-center py-8 text-gray-500 text-sm">
            <FileSearch className="size-10 mx-auto mb-3 text-gray-300" />
            <p>버튼을 클릭하여 유사한 과거 사례를 검색하세요</p>
            <p className="text-xs mt-1 text-gray-400">
              제목과 설명을 기반으로 유사도를 분석합니다
            </p>
          </div>
        ) : isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="size-6 animate-spin text-indigo-500" />
          </div>
        ) : similarCases.length === 0 ? (
          <div className="text-center py-8 text-gray-500 text-sm">
            <AlertCircle className="size-10 mx-auto mb-3 text-gray-300" />
            <p>유사한 사례를 찾지 못했습니다</p>
            <p className="text-xs mt-1 text-gray-400">
              새로운 유형의 요청일 수 있습니다
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {similarCases.map((caseItem) => {
              const statusConfig = STATUS_CONFIG[caseItem.status] || STATUS_CONFIG.requested
              const StatusIcon = statusConfig.icon
              const isExpanded = expandedCaseId === caseItem.id

              return (
                <div
                  key={caseItem.id}
                  className="border border-gray-200 rounded-lg overflow-hidden hover:border-indigo-200 transition-colors"
                >
                  {/* Case Header */}
                  <div
                    className="p-3 cursor-pointer hover:bg-gray-50"
                    onClick={() => toggleExpand(caseItem.id)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span
                            className={cn(
                              'text-xs font-bold px-2 py-0.5 rounded',
                              getSimilarityColor(caseItem.similarity)
                            )}
                          >
                            {caseItem.similarity}% 유사
                          </span>
                          <span className={cn('flex items-center gap-1 text-xs', statusConfig.color)}>
                            <StatusIcon className="size-3" />
                            {statusConfig.label}
                          </span>
                        </div>
                        <h4 className="text-sm font-medium text-gray-900 truncate">
                          {caseItem.title}
                        </h4>
                        <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                          {/* SR 구분 (대분류/소분류) */}
                          {caseItem.category_lv1_name && (
                            <span className="text-rose-600">
                              {caseItem.category_lv1_name}
                              {caseItem.category_lv2_name && ` / ${caseItem.category_lv2_name}`}
                            </span>
                          )}
                          {caseItem.system_name && (
                            <>
                              <span>•</span>
                              <span>{caseItem.system_name}</span>
                            </>
                          )}
                          <span>•</span>
                          <span>
                            {new Date(caseItem.created_at).toLocaleDateString('ko-KR')}
                          </span>
                        </div>
                      </div>
                      <button className="p-1 text-gray-400 hover:text-gray-600">
                        {isExpanded ? (
                          <ChevronUp className="size-4" />
                        ) : (
                          <ChevronDown className="size-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Expanded Content */}
                  {isExpanded && (
                    <div className="border-t border-gray-100 p-3 bg-gray-50 space-y-3">
                      {/* Description */}
                      <div>
                        <h5 className="text-xs font-semibold text-gray-500 mb-1">요청 내용</h5>
                        <p className="text-sm text-gray-700 whitespace-pre-wrap">
                          {caseItem.description || '내용 없음'}
                        </p>
                      </div>

                      {/* Comments/Answers */}
                      {loadingComments === caseItem.id ? (
                        <div className="flex items-center justify-center py-4">
                          <Loader2 className="size-4 animate-spin text-gray-400" />
                        </div>
                      ) : caseItem.comments && caseItem.comments.length > 0 ? (
                        <div>
                          <h5 className="text-xs font-semibold text-gray-500 mb-2">
                            처리 답변 ({caseItem.comments.filter(c => !c.is_internal).length}건)
                          </h5>
                          <div className="space-y-2">
                            {caseItem.comments
                              .filter(c => !c.is_internal)
                              .map((comment, idx) => (
                                <div
                                  key={idx}
                                  className="bg-white border border-gray-200 rounded p-2.5"
                                >
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="text-xs text-gray-500">
                                      {comment.author_name || '담당자'} • {' '}
                                      {new Date(comment.created_at).toLocaleDateString('ko-KR')}
                                    </span>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        copyToClipboard(comment.content)
                                      }}
                                      className="p-1 text-gray-400 hover:text-indigo-600"
                                      title="답변 복사"
                                    >
                                      <Copy className="size-3" />
                                    </button>
                                  </div>
                                  <p className="text-sm text-gray-700 whitespace-pre-wrap">
                                    {comment.content}
                                  </p>
                                </div>
                              ))}
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-gray-400">등록된 답변이 없습니다</p>
                      )}

                      {/* Actions */}
                      <div className="flex items-center gap-2 pt-2 border-t border-gray-200">
                        <Link
                          href={`/requests/${caseItem.id}`}
                          target="_blank"
                          className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <ExternalLink className="size-3" />
                          상세 보기
                        </Link>
                        {onSelectCase && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              onSelectCase(caseItem)
                            }}
                            className="flex items-center gap-1 text-xs text-gray-600 hover:text-gray-700"
                          >
                            AI에게 이 사례 참고 요청
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
