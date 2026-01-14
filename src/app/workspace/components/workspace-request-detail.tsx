'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  User,
  Calendar,
  Server,
  Tag,
  CheckCircle2,
  Play,
  FileText,
  AlertTriangle,
  Link as LinkIcon,
  Eye
} from 'lucide-react'
import { ManagerAiChat } from './manager-ai-chat'
import { OriginalChatModal } from './original-chat-modal'
import { SimilarCasesPanel } from './similar-cases-panel'
import { StatusChangeModal } from './status-change-modal'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { assignRequest, updateRequestStatus, updateRequestStatusWithReason } from '../actions'
import { toast } from 'sonner'

interface AssignedRequest {
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
  module?: { name: string } | null
}

interface WorkspaceRequestDetailProps {
  request: AssignedRequest
  currentUserId: string
  onStatusChange?: (requestId: string, newStatus: string) => void
}

const PRIORITY_CONFIG = {
  urgent: { label: '긴급', color: 'bg-rose-100 text-rose-700 border-rose-200' },
  high: { label: '높음', color: 'bg-orange-100 text-orange-700 border-orange-200' },
  medium: { label: '보통', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  low: { label: '낮음', color: 'bg-gray-100 text-gray-600 border-gray-200' },
}

const STATUS_CONFIG = {
  requested: { label: '요청', color: 'bg-amber-100 text-amber-700' },
  reviewing: { label: '검토중', color: 'bg-blue-100 text-blue-700' },
  processing: { label: '처리중', color: 'bg-violet-100 text-violet-700' },
  completed: { label: '완료', color: 'bg-emerald-100 text-emerald-700' },
  rejected: { label: '반려', color: 'bg-red-100 text-red-700' },
}

const TYPE_LABELS: Record<string, string> = {
  feature_add: '기능추가',
  feature_improve: '기능개선',
  bug_fix: '버그수정',
  other: '기타',
}

export function WorkspaceRequestDetail({ request, currentUserId, onStatusChange }: WorkspaceRequestDetailProps) {
  const router = useRouter()
  const [isAssigning, setIsAssigning] = useState(false)
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false)
  const [isOriginalChatOpen, setIsOriginalChatOpen] = useState(false)
  const [hasOriginalChat, setHasOriginalChat] = useState<boolean | null>(null)
  const [statusModalType, setStatusModalType] = useState<'completed' | 'rejected' | null>(null)
  const [isStatusModalLoading, setIsStatusModalLoading] = useState(false)

  const priorityConfig = PRIORITY_CONFIG[request.priority as keyof typeof PRIORITY_CONFIG] || PRIORITY_CONFIG.medium
  const statusConfig = STATUS_CONFIG[request.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.requested
  const createdDate = new Date(request.created_at)

  const handleAssign = async () => {
    setIsAssigning(true)
    try {
      const result = await assignRequest(request.id, currentUserId)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success('요청이 배정되었습니다!')
        // 로컬 상태 즉시 업데이트
        onStatusChange?.(request.id, 'reviewing')
        router.refresh()
      }
    } catch {
      toast.error('배정 중 오류가 발생했습니다.')
    } finally {
      setIsAssigning(false)
    }
  }

  const handleStatusUpdate = async (newStatus: string) => {
    setIsUpdatingStatus(true)
    try {
      const result = await updateRequestStatus(request.id, newStatus)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(`상태가 ${STATUS_CONFIG[newStatus as keyof typeof STATUS_CONFIG]?.label || newStatus}로 변경되었습니다.`)
        // 로컬 상태 즉시 업데이트
        onStatusChange?.(request.id, newStatus)
        router.refresh()
      }
    } catch {
      toast.error('상태 변경 중 오류가 발생했습니다.')
    } finally {
      setIsUpdatingStatus(false)
    }
  }

  // 모달을 통한 상태 변경 (완료/반려)
  const handleStatusWithReason = async (reason: string) => {
    if (!statusModalType) return

    setIsStatusModalLoading(true)
    try {
      const result = await updateRequestStatusWithReason(request.id, statusModalType, reason)
      if (result.error) {
        toast.error(result.error)
      } else {
        const statusLabel = statusModalType === 'completed' ? '완료' : '반려'
        toast.success(`요청이 ${statusLabel} 처리되었습니다.`)
        onStatusChange?.(request.id, statusModalType)
        setStatusModalType(null)
        router.refresh()
      }
    } catch {
      toast.error('상태 변경 중 오류가 발생했습니다.')
    } finally {
      setIsStatusModalLoading(false)
    }
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* Request Info Panel */}
      <div className="w-[320px] flex-shrink-0 bg-white border-r border-gray-200 overflow-y-auto">
        {/* Header */}
        <div className="p-4 border-b border-gray-100 bg-gradient-to-br from-gray-50 to-white">
          <div className="flex items-center gap-2 mb-3">
            <Badge variant="outline" className={statusConfig.color}>
              {statusConfig.label}
            </Badge>
            <Badge variant="outline" className={priorityConfig.color}>
              {priorityConfig.label}
            </Badge>
          </div>
          <h2 className="text-lg font-bold text-gray-900 mb-2 line-clamp-2">
            {request.title}
          </h2>
          <Link 
            href={`/requests/${request.id}`}
            className="text-xs text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
          >
            <LinkIcon className="size-3" />
            상세 페이지 열기
          </Link>
        </div>

        {/* Description */}
        <div className="p-4 border-b border-gray-100">
          <h3 className="text-xs font-semibold text-gray-500 mb-2 flex items-center gap-1">
            <FileText className="size-3" />
            요청 내용
          </h3>
          <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
            {request.description}
          </p>
        </div>

        {/* Meta Info */}
        <div className="p-4 border-b border-gray-100 space-y-3">
          <div className="flex items-center gap-2 text-sm">
            <User className="size-4 text-gray-400" />
            <span className="text-gray-500">요청자:</span>
            <span className="text-gray-900 font-medium">
              {request.requester?.full_name || request.requester?.email}
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Tag className="size-4 text-gray-400" />
            <span className="text-gray-500">유형:</span>
            <span className="text-gray-900">{TYPE_LABELS[request.type] || request.type}</span>
          </div>
          {request.system && (
            <div className="flex items-center gap-2 text-sm">
              <Server className="size-4 text-gray-400" />
              <span className="text-gray-500">시스템:</span>
              <span className="text-gray-900">
                {request.system.name}
                {request.module?.name && (
                  <span className="text-gray-500"> / {request.module.name}</span>
                )}
              </span>
            </div>
          )}
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="size-4 text-gray-400" />
            <span className="text-gray-500">신청일:</span>
            <span className="text-gray-900">
              {createdDate.toLocaleDateString('ko-KR', { 
                year: 'numeric', 
                month: 'short', 
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </span>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="p-4 space-y-2">
          <h3 className="text-xs font-semibold text-gray-500 mb-3">빠른 작업</h3>

          {/* 원본 채팅 보기 버튼 */}
          <Button
            variant="outline"
            onClick={() => setIsOriginalChatOpen(true)}
            disabled={hasOriginalChat === false}
            className="w-full gap-2 text-blue-600 border-blue-200 hover:bg-blue-50 hover:border-blue-300 disabled:text-gray-400 disabled:border-gray-200 disabled:bg-gray-50"
          >
            <Eye className="size-4" />
            {hasOriginalChat === false ? '원본 채팅 없음' : '요청자 원본 채팅 보기'}
          </Button>

          {request.status === 'requested' && (
            <Button
              onClick={handleAssign}
              disabled={isAssigning}
              className="w-full bg-indigo-600 hover:bg-indigo-700"
            >
              <Play className="size-4 mr-2" />
              {isAssigning ? '배정 중...' : '내게 배정하기'}
            </Button>
          )}

          {request.status === 'reviewing' && (
            <Button
              onClick={() => handleStatusUpdate('processing')}
              disabled={isUpdatingStatus}
              className="w-full bg-violet-600 hover:bg-violet-700"
            >
              <Play className="size-4 mr-2" />
              {isUpdatingStatus ? '변경 중...' : '처리 시작'}
            </Button>
          )}

          {request.status === 'processing' && (
            <Button
              onClick={() => setStatusModalType('completed')}
              disabled={isUpdatingStatus}
              className="w-full bg-emerald-600 hover:bg-emerald-700"
            >
              <CheckCircle2 className="size-4 mr-2" />
              처리 완료
            </Button>
          )}

          {request.status !== 'completed' && request.status !== 'rejected' && (
            <Button
              variant="outline"
              onClick={() => setStatusModalType('rejected')}
              disabled={isUpdatingStatus}
              className="w-full text-rose-600 border-rose-200 hover:bg-rose-50"
            >
              <AlertTriangle className="size-4 mr-2" />
              반려
            </Button>
          )}
        </div>

        {/* Similar Cases Panel */}
        <div className="p-4 border-t border-gray-100">
          <SimilarCasesPanel
            requestId={request.id}
            requestTitle={request.title}
            requestDescription={request.description}
            systemName={request.system?.name}
          />
        </div>
      </div>

      {/* AI Chat Panel - 새로운 분리된 담당자 채팅 컴포넌트 */}
      <div className="flex-1 overflow-hidden">
        <ManagerAiChat
          requestId={request.id}
          requestContext={{
            title: request.title,
            description: request.description,
            type: request.type,
            priority: request.priority,
            requesterName: request.requester?.full_name || request.requester?.email,
            systemName: request.system?.name,
            moduleName: request.module?.name
          }}
        />
      </div>

      {/* 원본 채팅 조회 모달 */}
      <OriginalChatModal
        requestId={request.id}
        requesterName={request.requester?.full_name || request.requester?.email}
        open={isOriginalChatOpen}
        onOpenChange={setIsOriginalChatOpen}
        onChatExistsChange={setHasOriginalChat}
      />

      {/* 상태 변경 모달 (완료/반려) */}
      {statusModalType && (
        <StatusChangeModal
          open={!!statusModalType}
          onOpenChange={(open) => !open && setStatusModalType(null)}
          type={statusModalType}
          onConfirm={handleStatusWithReason}
          isLoading={isStatusModalLoading}
        />
      )}
    </div>
  )
}

