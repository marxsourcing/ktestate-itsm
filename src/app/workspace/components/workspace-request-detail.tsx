'use client'

import { useState, useEffect } from 'react'
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
  Eye,
  ThumbsUp,
  Users,
  ClipboardCheck,
  TestTube2,
  CheckSquare,
  Rocket,
  ShieldCheck,
  ArrowRight
} from 'lucide-react'
import { ManagerAiChat } from './manager-ai-chat'
import { OriginalChatModal } from './original-chat-modal'
import { SimilarCasesPanel } from './similar-cases-panel'
import { StatusChangeModal } from './status-change-modal'
import { DeployInfoModal, DeployInfo } from './deploy-info-modal'
import { TestRequestModal, TestInfo } from './test-request-modal'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { assignRequest, updateRequestStatus, updateRequestStatusWithReason, updateRequestWithDeployInfo, getManagers, requestTest, completeTest, approveDeploy } from '../actions'
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
  manager?: { full_name?: string; email: string }
  system?: { name: string } | null
  module?: { name: string } | null
  test_manager_id?: string | null
  deploy_type?: string | null
  deploy_manager_id?: string | null
  deploy_scheduled_at?: string | null
  deploy_completed_at?: string | null
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
  const [isDeployModalOpen, setIsDeployModalOpen] = useState(false)
  const [isDeployModalLoading, setIsDeployModalLoading] = useState(false)
  const [isTestModalOpen, setIsTestModalOpen] = useState(false)
  const [isTestModalLoading, setIsTestModalLoading] = useState(false)
  const [managers, setManagers] = useState<{ id: string; full_name: string | null; email: string }[]>([])

  // 담당자 목록 로드
  useEffect(() => {
    const loadManagers = async () => {
      const result = await getManagers()
      setManagers(result.managers)
    }
    loadManagers()
  }, [])

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

  // 배포 정보와 함께 상태 변경
  const handleDeployRequest = async (deployInfo: DeployInfo) => {
    setIsDeployModalLoading(true)
    try {
      const result = await updateRequestWithDeployInfo(request.id, 'deploy_requested', deployInfo)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success('배포 요청이 등록되었습니다.')
        onStatusChange?.(request.id, 'deploy_requested')
        setIsDeployModalOpen(false)
        router.refresh()
      }
    } catch {
      toast.error('배포 요청 중 오류가 발생했습니다.')
    } finally {
      setIsDeployModalLoading(false)
    }
  }

  // 테스트 요청 (본인/타인 선택)
  const handleTestRequest = async (testInfo: TestInfo) => {
    setIsTestModalLoading(true)
    try {
      const result = await requestTest(request.id, testInfo)
      if (result.error) {
        toast.error(result.error)
      } else {
        const msg = testInfo.test_manager_id
          ? '테스트 요청이 다른 담당자에게 전달되었습니다.'
          : '테스트 요청이 등록되었습니다. 테스트 완료 후 버튼을 눌러주세요.'
        toast.success(msg)
        onStatusChange?.(request.id, 'test_requested')
        setIsTestModalOpen(false)
        router.refresh()
      }
    } catch {
      toast.error('테스트 요청 중 오류가 발생했습니다.')
    } finally {
      setIsTestModalLoading(false)
    }
  }

  // 테스트 완료 처리 (권한 검증 포함)
  const handleCompleteTest = async () => {
    setIsUpdatingStatus(true)
    try {
      const result = await completeTest(request.id)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success('테스트가 완료되었습니다.')
        onStatusChange?.(request.id, 'test_completed')
        router.refresh()
      }
    } catch {
      toast.error('테스트 완료 처리 중 오류가 발생했습니다.')
    } finally {
      setIsUpdatingStatus(false)
    }
  }

  // 배포 승인 처리 (권한 검증 포함)
  const handleApproveDeploy = async () => {
    setIsUpdatingStatus(true)
    try {
      const result = await approveDeploy(request.id)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success('배포가 승인되었습니다.')
        onStatusChange?.(request.id, 'deploy_approved')
        router.refresh()
      }
    } catch {
      toast.error('배포 승인 중 오류가 발생했습니다.')
    } finally {
      setIsUpdatingStatus(false)
    }
  }

  // 테스트 완료 권한 체크
  const canCompleteTest = request.status === 'test_requested' && (
    request.test_manager_id
      ? request.test_manager_id === currentUserId
      : !request.manager || request.manager?.email === undefined // manager가 없거나 본인인 경우
  )

  // 배포 승인 권한 체크
  const canApproveDeploy = request.status === 'deploy_requested' && (
    request.deploy_manager_id
      ? request.deploy_manager_id === currentUserId
      : true // deploy_manager_id가 null이면 본인이 직접 처리
  )

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

          {/* 상태별 다음 단계 버튼들 */}
          {request.status === 'requested' && (
            <>
              <Button
                onClick={handleAssign}
                disabled={isAssigning}
                className="w-full bg-indigo-600 hover:bg-indigo-700"
              >
                <Play className="size-4 mr-2" />
                {isAssigning ? '배정 중...' : '내게 배정하기'}
              </Button>
              <Button
                onClick={() => handleStatusUpdate('approved')}
                disabled={isUpdatingStatus}
                className="w-full bg-sky-600 hover:bg-sky-700"
              >
                <ThumbsUp className="size-4 mr-2" />
                승인
              </Button>
            </>
          )}

          {request.status === 'approved' && (
            <>
              <Button
                onClick={() => handleStatusUpdate('consulting')}
                disabled={isUpdatingStatus}
                className="w-full bg-indigo-600 hover:bg-indigo-700"
              >
                <Users className="size-4 mr-2" />
                실무협의 요청
              </Button>
              <Button
                onClick={() => handleStatusUpdate('accepted')}
                disabled={isUpdatingStatus}
                className="w-full bg-blue-600 hover:bg-blue-700"
              >
                <ClipboardCheck className="size-4 mr-2" />
                접수
              </Button>
            </>
          )}

          {request.status === 'consulting' && (
            <Button
              onClick={() => handleStatusUpdate('accepted')}
              disabled={isUpdatingStatus}
              className="w-full bg-blue-600 hover:bg-blue-700"
            >
              <ClipboardCheck className="size-4 mr-2" />
              접수
            </Button>
          )}

          {request.status === 'accepted' && (
            <Button
              onClick={() => handleStatusUpdate('processing')}
              disabled={isUpdatingStatus}
              className="w-full bg-violet-600 hover:bg-violet-700"
            >
              <Play className="size-4 mr-2" />
              처리 시작
            </Button>
          )}

          {request.status === 'processing' && (
            <>
              <Button
                onClick={() => setIsTestModalOpen(true)}
                disabled={isUpdatingStatus}
                className="w-full bg-orange-600 hover:bg-orange-700"
              >
                <TestTube2 className="size-4 mr-2" />
                테스트 요청
              </Button>
              <Button
                onClick={() => setStatusModalType('completed')}
                disabled={isUpdatingStatus}
                className="w-full bg-emerald-600 hover:bg-emerald-700"
              >
                <CheckCircle2 className="size-4 mr-2" />
                처리 완료
              </Button>
            </>
          )}

          {request.status === 'test_requested' && (
            <>
              {canCompleteTest ? (
                <Button
                  onClick={handleCompleteTest}
                  disabled={isUpdatingStatus}
                  className="w-full bg-teal-600 hover:bg-teal-700"
                >
                  <CheckSquare className="size-4 mr-2" />
                  테스트 완료
                </Button>
              ) : (
                <div className="text-sm text-gray-500 bg-gray-50 p-3 rounded-lg text-center">
                  테스트 담당자가 테스트를 진행 중입니다.
                </div>
              )}
              <Button
                variant="outline"
                onClick={() => handleStatusUpdate('processing')}
                disabled={isUpdatingStatus}
                className="w-full"
              >
                <ArrowRight className="size-4 mr-2 rotate-180" />
                처리중으로 되돌리기
              </Button>
            </>
          )}

          {request.status === 'test_completed' && (
            <>
              <Button
                onClick={() => setIsDeployModalOpen(true)}
                disabled={isUpdatingStatus}
                className="w-full bg-cyan-600 hover:bg-cyan-700"
              >
                <Rocket className="size-4 mr-2" />
                배포 요청
              </Button>
              <Button
                variant="outline"
                onClick={() => handleStatusUpdate('processing')}
                disabled={isUpdatingStatus}
                className="w-full"
              >
                <ArrowRight className="size-4 mr-2 rotate-180" />
                처리중으로 되돌리기
              </Button>
            </>
          )}

          {request.status === 'deploy_requested' && (
            <>
              {canApproveDeploy ? (
                <Button
                  onClick={handleApproveDeploy}
                  disabled={isUpdatingStatus}
                  className="w-full bg-lime-600 hover:bg-lime-700"
                >
                  <ShieldCheck className="size-4 mr-2" />
                  배포 승인
                </Button>
              ) : (
                <div className="text-sm text-gray-500 bg-gray-50 p-3 rounded-lg text-center">
                  배포 승인자가 승인을 진행 중입니다.
                </div>
              )}
              <Button
                variant="outline"
                onClick={() => handleStatusUpdate('test_completed')}
                disabled={isUpdatingStatus}
                className="w-full"
              >
                <ArrowRight className="size-4 mr-2 rotate-180" />
                테스트완료로 되돌리기
              </Button>
            </>
          )}

          {request.status === 'deploy_approved' && (
            <>
              <Button
                onClick={() => setStatusModalType('completed')}
                disabled={isUpdatingStatus}
                className="w-full bg-emerald-600 hover:bg-emerald-700"
              >
                <CheckCircle2 className="size-4 mr-2" />
                완료
              </Button>
              <Button
                variant="outline"
                onClick={() => handleStatusUpdate('deploy_requested')}
                disabled={isUpdatingStatus}
                className="w-full"
              >
                <ArrowRight className="size-4 mr-2 rotate-180" />
                배포요청으로 되돌리기
              </Button>
            </>
          )}

          {/* 반려 버튼 (완료/반려 상태가 아닐 때만) */}
          {request.status !== 'completed' && request.status !== 'rejected' && request.status !== 'draft' && (
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

      {/* 배포 정보 입력 모달 */}
      <DeployInfoModal
        open={isDeployModalOpen}
        onOpenChange={setIsDeployModalOpen}
        onConfirm={handleDeployRequest}
        isLoading={isDeployModalLoading}
        managers={managers}
        currentUserId={currentUserId}
        currentDeployInfo={{
          deploy_type: request.deploy_type,
          deploy_manager_id: request.deploy_manager_id,
          deploy_scheduled_at: request.deploy_scheduled_at
        }}
      />

      {/* 테스트 요청 모달 */}
      <TestRequestModal
        open={isTestModalOpen}
        onOpenChange={setIsTestModalOpen}
        onConfirm={handleTestRequest}
        isLoading={isTestModalLoading}
        managers={managers}
        currentUserId={currentUserId}
      />
    </div>
  )
}

