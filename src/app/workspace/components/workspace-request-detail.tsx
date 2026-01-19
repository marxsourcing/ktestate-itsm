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
  ArrowRight,
  Calculator,
  Pencil,
  Package,
  Loader2,
  X,
  Sparkles,
  ArrowLeftRight
} from 'lucide-react'
import { ManagerAiChat } from './manager-ai-chat'
import { OriginalChatModal } from './original-chat-modal'
import { SimilarCasesPanel } from './similar-cases-panel'
import { StatusChangeModal } from './status-change-modal'
import { DeployInfoModal, DeployInfo } from './deploy-info-modal'
import { TestRequestModal, TestInfo } from './test-request-modal'
import { RequestEditModal } from './request-edit-modal'
import { TransferManagerModal } from '@/app/workspace/components/transfer-manager-modal'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { assignRequest, updateRequestStatus, updateRequestStatusWithReason, updateRequestWithDeployInfo, getManagers, requestTest, completeTest, approveDeploy, approveBatchDeploy, getBatchDeployRequests } from '../actions'
import { uploadAttachment } from '@/app/chat/attachments'
import { toast } from 'sonner'

interface AssignedRequest {
  id: string
  title: string
  description: string
  status: string
  priority: string
  created_at: string
  completed_at?: string
  requester?: { full_name?: string; email: string }
  manager?: { full_name?: string; email: string }
  manager_id?: string | null
  system?: { id: string; name: string } | null
  module?: { id: string; name: string } | null
  system_id?: string | null
  module_id?: string | null
  category_lv1?: { id: string; name: string } | null  // 대분류 (SR 구분)
  category_lv2?: { id: string; name: string } | null  // 소분류 (SR 상세 구분)
  category_lv1_id?: string | null
  category_lv2_id?: string | null
  test_manager_id?: string | null
  deploy_type?: string | null
  deploy_manager_id?: string | null
  deploy_scheduled_at?: string | null
  deploy_completed_at?: string | null
  // 일괄 배포 관련 필드
  deploy_batch_id?: string | null
  deploy_batch_name?: string | null
  // 공수 관리 필드
  estimated_fp?: number | null
  actual_fp?: number | null
  estimated_md?: number | null
  actual_md?: number | null
}

interface WorkspaceRequestDetailProps {
  request: AssignedRequest
  currentUserId: string
  onStatusChange?: (requestId: string, newStatus: string, previousStatus?: string) => void
  viewMode?: 'full' | 'detail-only' | 'side-panel'
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


export function WorkspaceRequestDetail({ 
  request, 
  currentUserId, 
  onStatusChange,
  viewMode = 'full'
}: WorkspaceRequestDetailProps) {
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
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false)
  const [isAiChatOpen, setIsAiChatOpen] = useState(false)
  const [managers, setManagers] = useState<{ id: string; full_name: string | null; email: string }[]>([])
  // 일괄 배포 관련 상태
  const [batchRequests, setBatchRequests] = useState<Array<{
    id: string
    title: string
    status: string
    priority: string
    system?: { name: string } | null
    module?: { name: string } | null
  }>>([])
  const [isBatchDeployLoading, setIsBatchDeployLoading] = useState(false)
  const [isBatchLoading, setIsBatchLoading] = useState(false)

  // 담당자 목록 로드
  useEffect(() => {
    const loadManagers = async () => {
      const result = await getManagers()
      setManagers(result.managers)
    }
    loadManagers()
  }, [])

  // 배포 그룹 요청 목록 로드 (요청이 변경될 때마다 최신 데이터 로드)
  useEffect(() => {
    const loadBatchRequests = async () => {
      if (request.deploy_batch_id) {
        setIsBatchLoading(true)
        try {
          const result = await getBatchDeployRequests(request.deploy_batch_id)
          setBatchRequests(result.requests)
        } catch (error) {
          console.error('배포 그룹 요청 조회 오류:', error)
        } finally {
          setIsBatchLoading(false)
        }
      } else {
        setBatchRequests([])
      }
    }
    loadBatchRequests()
  }, [request.deploy_batch_id, request.id])

  const priorityConfig = PRIORITY_CONFIG[request.priority as keyof typeof PRIORITY_CONFIG] || PRIORITY_CONFIG.medium
  const statusConfig = STATUS_CONFIG[request.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.requested
  const createdDate = new Date(request.created_at)

  if (viewMode === 'side-panel') {
    return (
      <div className="h-full overflow-y-auto p-4 space-y-6 bg-gray-50">
        <SimilarCasesPanel
          requestId={request.id}
          requestTitle={request.title}
          requestDescription={request.description}
          systemName={request.system?.name}
        />
      </div>
    )
  }

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
    const previousStatus = request.status // 현재 상태를 저장
    try {
      const result = await updateRequestStatus(request.id, newStatus)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(`상태가 ${STATUS_CONFIG[newStatus as keyof typeof STATUS_CONFIG]?.label || newStatus}로 변경되었습니다.`)
        // 로컬 상태 즉시 업데이트 (이전 상태 전달)
        onStatusChange?.(request.id, newStatus, previousStatus)
        router.refresh()
      }
    } catch {
      toast.error('상태 변경 중 오류가 발생했습니다.')
    } finally {
      setIsUpdatingStatus(false)
    }
  }

  // 모달을 통한 상태 변경 (완료/반려)
  const handleStatusWithReason = async (reason: string, effort?: { estimated_fp?: number | null; actual_fp?: number | null; estimated_md?: number | null; actual_md?: number | null }, files?: File[]) => {
    if (!statusModalType) return

    setIsStatusModalLoading(true)
    try {
      // 1. 상태 변경 및 공수 기록
      const result = await updateRequestStatusWithReason(request.id, statusModalType, reason, effort)
      
      if (result.error) {
        toast.error(result.error)
        return
      }

      // 2. 파일 업로드 (있는 경우)
      if (files && files.length > 0) {
        const uploadPromises = files.map(file => {
          const formData = new FormData()
          formData.append('file', file)
          // commentId가 있으면 함께 전달
          return uploadAttachment(formData, undefined, request.id, result.commentId)
        })
        
        const uploadResults = await Promise.all(uploadPromises)
        const failedUploads = uploadResults.filter(r => r.error)
        
        if (failedUploads.length > 0) {
          toast.warning(`${failedUploads.length}개의 파일 업로드에 실패했습니다.`)
        }
      }

      const statusLabel = statusModalType === 'completed' ? '완료' : '반려'
      toast.success(`요청이 ${statusLabel} 처리되었습니다.`)
      onStatusChange?.(request.id, statusModalType)
      setStatusModalType(null)
      router.refresh()
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

  // 배포 승인 처리 (권한 검증 포함) - 개별 승인 시 배포 그룹에서 제외
  const handleApproveDeploy = async () => {
    setIsUpdatingStatus(true)
    const previousStatus = request.status
    try {
      const result = await approveDeploy(request.id)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success('배포가 승인되었습니다.')
        // 개별 승인 시 배포 그룹에서 제외되므로 previousStatus 전달
        onStatusChange?.(request.id, 'deploy_approved', previousStatus)
        router.refresh()
      }
    } catch {
      toast.error('배포 승인 중 오류가 발생했습니다.')
    } finally {
      setIsUpdatingStatus(false)
    }
  }

  // 일괄 배포 승인 처리
  const handleApproveBatchDeploy = async () => {
    if (!request.deploy_batch_id) return

    setIsBatchDeployLoading(true)
    try {
      const result = await approveBatchDeploy(request.deploy_batch_id)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(result.message)
        onStatusChange?.(request.id, 'deploy_approved')
        router.refresh()
      }
    } catch {
      toast.error('일괄 배포 승인 중 오류가 발생했습니다.')
    } finally {
      setIsBatchDeployLoading(false)
    }
  }

  // 담당자 이관 처리
  const handleTransfer = async (managerId: string) => {
    setIsUpdatingStatus(true)
    try {
      const result = await assignRequest(request.id, managerId)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success('담당자가 이관되었습니다.')
        setIsTransferModalOpen(false)
        router.refresh()
      }
    } catch {
      toast.error('이관 중 오류가 발생했습니다.')
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
    <div className="flex h-full overflow-hidden relative">
      {/* Request Info Panel */}
      <div className={cn(
        "shrink-0 bg-white flex flex-col h-full",
        viewMode === 'full' ? "w-[320px] border-r border-gray-200" : "w-full"
      )}>
        {/* Header (Fixed) */}
        <div className="p-4 border-b border-gray-100 bg-linear-to-br from-gray-50 to-white shrink-0">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={statusConfig.color}>
                {statusConfig.label}
              </Badge>
              <Badge variant="outline" className={priorityConfig.color}>
                {priorityConfig.label}
              </Badge>
            </div>
            {/* AI Assistant Button (Detail-only mode) */}
            {viewMode === 'detail-only' && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setIsAiChatOpen(true)}
                className="h-8 gap-1.5 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50"
              >
                <Sparkles className="size-4" />
                AI 어시스턴트
              </Button>
            )}
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

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto">
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
            {/* SR 구분 (대분류/소분류) */}
            <div className="flex items-center gap-2 text-sm">
              <Tag className="size-4 text-gray-400" />
              <span className="text-gray-500">SR 구분:</span>
              {request.category_lv1?.name ? (
                <span className="text-gray-900">
                  {request.category_lv1.name}
                  {request.category_lv2?.name && ` / ${request.category_lv2.name}`}
                </span>
              ) : (
                <span className="text-gray-400">미분류</span>
              )}
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

            {/* 공수 정보 표시 */}
            {(request.estimated_fp || request.actual_fp || request.estimated_md || request.actual_md) && (
              <div className="mt-3 p-3 rounded-lg bg-emerald-50 border border-emerald-200">
                <div className="flex items-center gap-2 text-xs font-medium text-emerald-700 mb-2">
                  <Calculator className="size-3" />
                  공수 정보
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {(request.estimated_fp != null || request.actual_fp != null) && (
                    <div>
                      <span className="text-emerald-600 block">FP</span>
                      <span className="text-gray-700">
                        {request.estimated_fp != null && `예상:${request.estimated_fp}`}
                        {request.estimated_fp != null && request.actual_fp != null && ' / '}
                        {request.actual_fp != null && `실제:${request.actual_fp}`}
                      </span>
                    </div>
                  )}
                  {(request.estimated_md != null || request.actual_md != null) && (
                    <div>
                      <span className="text-emerald-600 block">MD</span>
                      <span className="text-gray-700">
                        {request.estimated_md != null && `예상:${request.estimated_md}`}
                        {request.estimated_md != null && request.actual_md != null && ' / '}
                        {request.actual_md != null && `실제:${request.actual_md}`}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Similar Cases Panel (Only in full mode) */}
          {viewMode === 'full' && (
            <div className="p-4 border-t border-gray-100">
              <SimilarCasesPanel
                requestId={request.id}
                requestTitle={request.title}
                requestDescription={request.description}
                systemName={request.system?.name}
              />
            </div>
          )}
        </div>

        {/* Quick Actions (Fixed at bottom) */}
        <div className="p-4 border-t border-gray-100 bg-white shrink-0 space-y-4">
          {/* 상단 관리 버튼 (정보 수정, 담당자 이관, 원본 채팅) */}
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsEditModalOpen(true)}
                className="gap-2 text-indigo-600 border-indigo-100 hover:bg-indigo-50"
              >
                <Pencil className="size-3.5" />
                정보 수정
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsTransferModalOpen(true)}
                className="gap-2 text-amber-600 border-amber-100 hover:bg-amber-50"
              >
                <ArrowLeftRight className="size-3.5" />
                담당자 이관
              </Button>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsOriginalChatOpen(true)}
              disabled={hasOriginalChat === false}
              className="w-full gap-2 text-blue-600 border-blue-100 hover:bg-blue-50 disabled:text-gray-400 disabled:border-gray-200"
            >
              <Eye className="size-3.5" />
              {hasOriginalChat === false ? '원본 채팅 없음' : '요청자 원본 채팅 보기'}
            </Button>
          </div>

          {/* 상태별 워크플로우 버튼 영역 */}
          <div className="space-y-2 pt-2 border-t border-gray-50">
            {/* 1. 초기 - 승인/반려 (배정되지 않았거나 요청 상태일 때) */}
            {request.status === 'requested' && (
              <div className="space-y-2">
                {!request.manager_id && (
                  <Button
                    onClick={handleAssign}
                    disabled={isAssigning}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white"
                  >
                    <Play className="size-4 mr-2" />
                    {isAssigning ? '배정 중...' : '내게 배정하기'}
                  </Button>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    onClick={() => handleStatusUpdate('approved')}
                    disabled={isUpdatingStatus}
                    className="bg-sky-600 hover:bg-sky-700 text-white"
                  >
                    <ThumbsUp className="size-4 mr-2" />
                    승인
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setStatusModalType('rejected')}
                    disabled={isUpdatingStatus}
                    className="text-rose-600 border-rose-200 hover:bg-rose-50"
                  >
                    <AlertTriangle className="size-4 mr-2" />
                    반려
                  </Button>
                </div>
              </div>
            )}

            {/* 2. 승인 클릭 시 - 실무 협의 요청/접수/반려 */}
            {request.status === 'approved' && (
              <div className="space-y-2">
                <Button
                  onClick={() => handleStatusUpdate('consulting')}
                  disabled={isUpdatingStatus}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white"
                >
                  <Users className="size-4 mr-2" />
                  실무협의 요청
                </Button>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    onClick={() => handleStatusUpdate('accepted')}
                    disabled={isUpdatingStatus}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    <ClipboardCheck className="size-4 mr-2" />
                    접수
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setStatusModalType('rejected')}
                    disabled={isUpdatingStatus}
                    className="text-rose-600 border-rose-200 hover:bg-rose-50"
                  >
                    <AlertTriangle className="size-4 mr-2" />
                    반려
                  </Button>
                </div>
              </div>
            )}

            {/* 실무협의 중 - 접수/반려 */}
            {request.status === 'consulting' && (
              <div className="grid grid-cols-2 gap-2">
                <Button
                  onClick={() => handleStatusUpdate('accepted')}
                  disabled={isUpdatingStatus}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <ClipboardCheck className="size-4 mr-2" />
                  접수
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setStatusModalType('rejected')}
                  disabled={isUpdatingStatus}
                  className="text-rose-600 border-rose-200 hover:bg-rose-50"
                >
                  <AlertTriangle className="size-4 mr-2" />
                  반려
                </Button>
              </div>
            )}

            {/* 3. 접수 클릭 시 - 처리 시작/반려 */}
            {request.status === 'accepted' && (
              <div className="grid grid-cols-2 gap-2">
                <Button
                  onClick={() => handleStatusUpdate('processing')}
                  disabled={isUpdatingStatus}
                  className="bg-violet-600 hover:bg-violet-700 text-white"
                >
                  <Play className="size-4 mr-2" />
                  처리 시작
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setStatusModalType('rejected')}
                  disabled={isUpdatingStatus}
                  className="text-rose-600 border-rose-200 hover:bg-rose-50"
                >
                  <AlertTriangle className="size-4 mr-2" />
                  반려
                </Button>
              </div>
            )}

            {/* 4. 처리 시작 버튼 클릭 시 - 처리 완료/반려/테스트 요청 */}
            {request.status === 'processing' && (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    onClick={() => setStatusModalType('completed')}
                    disabled={isUpdatingStatus}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    <CheckCircle2 className="size-4 mr-2" />
                    처리 완료
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setStatusModalType('rejected')}
                    disabled={isUpdatingStatus}
                    className="text-rose-600 border-rose-200 hover:bg-rose-50"
                  >
                    <AlertTriangle className="size-4 mr-2" />
                    반려
                  </Button>
                </div>
                <Button
                  onClick={() => setIsTestModalOpen(true)}
                  disabled={isUpdatingStatus}
                  className="w-full bg-orange-600 hover:bg-orange-700 text-white"
                >
                  <TestTube2 className="size-4 mr-2" />
                  테스트 요청
                </Button>
              </div>
            )}

            {/* 5-1. 테스트 요청 버튼 클릭 시 - 테스트 완료/처리중으로 되돌리기/반려 */}
            {request.status === 'test_requested' && (
              <div className="space-y-2">
                {canCompleteTest ? (
                  <Button
                    onClick={handleCompleteTest}
                    disabled={isUpdatingStatus}
                    className="w-full bg-teal-600 hover:bg-teal-700 text-white"
                  >
                    <CheckSquare className="size-4 mr-2" />
                    테스트 완료
                  </Button>
                ) : (
                  <div className="text-sm text-gray-500 bg-gray-50 p-3 rounded-lg text-center">
                    테스트 담당자가 테스트를 진행 중입니다.
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    onClick={() => handleStatusUpdate('processing')}
                    disabled={isUpdatingStatus}
                    className="text-gray-600"
                  >
                    <ArrowRight className="size-4 mr-2 rotate-180" />
                    처리중으로
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setStatusModalType('rejected')}
                    disabled={isUpdatingStatus}
                    className="text-rose-600 border-rose-200 hover:bg-rose-50"
                  >
                    <AlertTriangle className="size-4 mr-2" />
                    반려
                  </Button>
                </div>
              </div>
            )}

            {/* 6. 테스트 완료 버튼 클릭 시 - 배포요청/처리중으로 되돌리기/반려 */}
            {request.status === 'test_completed' && (
              <div className="space-y-2">
                <Button
                  onClick={() => setIsDeployModalOpen(true)}
                  disabled={isUpdatingStatus}
                  className="w-full bg-cyan-600 hover:bg-cyan-700 text-white"
                >
                  <Rocket className="size-4 mr-2" />
                  배포 요청
                </Button>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    onClick={() => handleStatusUpdate('processing')}
                    disabled={isUpdatingStatus}
                    className="text-gray-600"
                  >
                    <ArrowRight className="size-4 mr-2 rotate-180" />
                    처리중으로
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setStatusModalType('rejected')}
                    disabled={isUpdatingStatus}
                    className="text-rose-600 border-rose-200 hover:bg-rose-50"
                  >
                    <AlertTriangle className="size-4 mr-2" />
                    반려
                  </Button>
                </div>
              </div>
            )}

            {/* 7. 배포 요청 버튼 클릭 시 -> 배포승인/테스트 완료로 되돌리기/반려 */}
            {request.status === 'deploy_requested' && (
              <div className="space-y-2">
                {/* 일괄 배포 그룹 정보 표시 (기존 로직 유지) */}
                {request.deploy_batch_id && request.deploy_batch_name && (
                  <div className="mb-2 p-3 bg-cyan-50 border border-cyan-200 rounded-lg">
                    <div className="flex items-center gap-2 text-[10px] font-bold text-cyan-700 mb-1 uppercase tracking-wider">
                      {isBatchLoading ? (
                        <Loader2 className="size-3 animate-spin" />
                      ) : (
                        <Package className="size-3" />
                      )}
                      일괄 배포 그룹
                    </div>
                    <p className="text-sm font-bold text-cyan-900 truncate">
                      {request.deploy_batch_name}
                    </p>
                  </div>
                )}

                {canApproveDeploy ? (
                  <>
                    {request.deploy_batch_id && batchRequests.length > 1 && (
                      <Button
                        onClick={handleApproveBatchDeploy}
                        disabled={isBatchDeployLoading || isUpdatingStatus}
                        className="w-full bg-cyan-600 hover:bg-cyan-700 mb-2 text-white"
                      >
                        {isBatchDeployLoading ? (
                          <Loader2 className="size-4 mr-2 animate-spin" />
                        ) : (
                          <Package className="size-4 mr-2" />
                        )}
                        {batchRequests.length}건 일괄 배포 승인
                      </Button>
                    )}
                    <Button
                      onClick={handleApproveDeploy}
                      disabled={isUpdatingStatus}
                      className="w-full bg-lime-600 hover:bg-lime-700 text-white"
                    >
                      <ShieldCheck className="size-4 mr-2" />
                      {request.deploy_batch_id && batchRequests.length > 1 ? '이 요청만 배포 승인' : '배포 승인'}
                    </Button>
                  </>
                ) : (
                  <div className="text-sm text-gray-500 bg-gray-50 p-3 rounded-lg text-center">
                    배포 승인자가 승인을 진행 중입니다.
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    onClick={() => handleStatusUpdate('test_completed')}
                    disabled={isUpdatingStatus}
                    className="text-gray-600 text-xs px-1"
                  >
                    <ArrowRight className="size-3 mr-1 rotate-180" />
                    테스트완료로
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setStatusModalType('rejected')}
                    disabled={isUpdatingStatus}
                    className="text-rose-600 border-rose-200 hover:bg-rose-50"
                  >
                    <AlertTriangle className="size-4 mr-2" />
                    반려
                  </Button>
                </div>
              </div>
            )}

            {/* 8. 배포 승인 클릭 시 -> 완료/배포요청으로 되돌리기/반려 */}
            {request.status === 'deploy_approved' && (
              <div className="space-y-2">
                <Button
                  onClick={() => setStatusModalType('completed')}
                  disabled={isUpdatingStatus}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  <CheckCircle2 className="size-4 mr-2" />
                  완료
                </Button>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    onClick={() => handleStatusUpdate('deploy_requested')}
                    disabled={isUpdatingStatus}
                    className="text-gray-600 text-xs px-1"
                  >
                    <ArrowRight className="size-3 mr-1 rotate-180" />
                    배포요청으로
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setStatusModalType('rejected')}
                    disabled={isUpdatingStatus}
                    className="text-rose-600 border-rose-200 hover:bg-rose-50"
                  >
                    <AlertTriangle className="size-4 mr-2" />
                    반려
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* AI Chat Panel (Full mode or Popup) */}
      {viewMode === 'full' ? (
        <div className="flex-1 overflow-hidden">
          <ManagerAiChat
            requestId={request.id}
            requestContext={{
              title: request.title,
              description: request.description,
              priority: request.priority,
              requesterName: request.requester?.full_name || request.requester?.email,
              systemName: request.system?.name,
              moduleName: request.module?.name,
              category_lv1_name: request.category_lv1?.name,
              category_lv2_name: request.category_lv2?.name
            }}
          />
        </div>
      ) : (
        /* AI Assistant Popup */
        isAiChatOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl h-[80vh] flex flex-col overflow-hidden border border-gray-200">
              <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-white shrink-0">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
                    <Sparkles className="size-4 text-white" />
                  </div>
                  <h3 className="font-bold text-gray-900">AI 어시스턴트</h3>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setIsAiChatOpen(false)}>
                  <X className="size-5" />
                </Button>
              </div>
              <div className="flex-1 overflow-hidden">
                <ManagerAiChat
                  requestId={request.id}
                  requestContext={{
                    title: request.title,
                    description: request.description,
                    priority: request.priority,
                    requesterName: request.requester?.full_name || request.requester?.email,
                    systemName: request.system?.name,
                    moduleName: request.module?.name,
                    category_lv1_name: request.category_lv1?.name,
                    category_lv2_name: request.category_lv2?.name
                  }}
                />
              </div>
            </div>
          </div>
        )
      )}

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
          currentEffort={{
            estimated_fp: request.estimated_fp,
            actual_fp: request.actual_fp,
            estimated_md: request.estimated_md,
            actual_md: request.actual_md,
          }}
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

      {/* 담당자 이관 모달 */}
      <TransferManagerModal
        open={isTransferModalOpen}
        onOpenChange={setIsTransferModalOpen}
        onConfirm={handleTransfer}
        managers={managers}
        currentManagerId={request.manager_id}
      />

      {/* 요청 정보 수정 모달 */}
      <RequestEditModal
        open={isEditModalOpen}
        onOpenChange={setIsEditModalOpen}
        requestId={request.id}
        currentData={{
          system_id: request.system_id || request.system?.id || null,
          module_id: request.module_id || request.module?.id || null,
          category_lv1_id: request.category_lv1_id || request.category_lv1?.id || null,
          category_lv2_id: request.category_lv2_id || request.category_lv2?.id || null,
          priority: request.priority
        }}
      />
    </div>
  )
}
