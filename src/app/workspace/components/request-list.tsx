'use client'

import { useState, useEffect, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
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
  Sparkles,
  TestTube2,
  Rocket,
  Package,
  X
} from 'lucide-react'
import Link from 'next/link'
import { WorkspaceRequestDetail } from './workspace-request-detail'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { BatchDeployModal, BatchDeployInfo } from './batch-deploy-modal'
import { requestBatchDeploy, getManagers } from '../actions'
import { toast } from 'sonner'

export type AssignedRequest = {
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
  deploy_manager_id?: string | null
  deploy_type?: string | null
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

interface RequestListProps {
  myRequests: AssignedRequest[]
  unassignedRequests: AssignedRequest[]
  recentCompletedRequests: AssignedRequest[]
  testAssignedRequests?: AssignedRequest[]
  deployAssignedRequests?: AssignedRequest[]
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


export function RequestList({
  myRequests: initialMyRequests,
  unassignedRequests: initialUnassignedRequests,
  recentCompletedRequests: initialRecentCompletedRequests,
  testAssignedRequests: initialTestAssignedRequests = [],
  deployAssignedRequests: initialDeployAssignedRequests = [],
  currentUserId
}: RequestListProps) {
  const router = useRouter()

  // 로컬 상태로 목록 관리 (실시간 업데이트 지원)
  const [myRequests, setMyRequests] = useState(initialMyRequests)
  const [unassignedRequests, setUnassignedRequests] = useState(initialUnassignedRequests)
  const [recentCompletedRequests, setRecentCompletedRequests] = useState(initialRecentCompletedRequests)
  const [testAssignedRequests, setTestAssignedRequests] = useState(initialTestAssignedRequests)
  const [deployAssignedRequests, setDeployAssignedRequests] = useState(initialDeployAssignedRequests)

  const [selectedRequest, setSelectedRequest] = useState<AssignedRequest | null>(
    initialMyRequests[0] || initialTestAssignedRequests[0] || initialDeployAssignedRequests[0] || initialUnassignedRequests[0] || null
  )

  // 일괄 배포 관련 상태
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false)
  const [selectedForBatch, setSelectedForBatch] = useState<Set<string>>(new Set())
  const [showBatchDeployModal, setShowBatchDeployModal] = useState(false)
  const [isBatchLoading, setIsBatchLoading] = useState(false)
  const [managers, setManagers] = useState<{ id: string; full_name: string | null; email: string }[]>([])

  // 일괄 배포 대상 요청 (테스트 완료 상태만)
  const batchDeployableRequests = myRequests.filter(r => r.status === 'test_completed')

  // 담당자 목록 로드
  useEffect(() => {
    if (isMultiSelectMode) {
      getManagers().then(({ managers: m }) => setManagers(m))
    }
  }, [isMultiSelectMode])

  // props 변경 시 상태 동기화
  useEffect(() => {
    setMyRequests(initialMyRequests)
    setUnassignedRequests(initialUnassignedRequests)
    setRecentCompletedRequests(initialRecentCompletedRequests)
    setTestAssignedRequests(initialTestAssignedRequests)
    setDeployAssignedRequests(initialDeployAssignedRequests)
  }, [initialMyRequests, initialUnassignedRequests, initialRecentCompletedRequests, initialTestAssignedRequests, initialDeployAssignedRequests])

  // 요청 제거 핸들러 (위임된 작업 완료 시)
  const handleRequestRemove = useCallback((requestId: string, listType: 'test' | 'deploy' | 'my') => {
    if (listType === 'test') {
      setTestAssignedRequests(prev => prev.filter(r => r.id !== requestId))
    } else if (listType === 'deploy') {
      setDeployAssignedRequests(prev => prev.filter(r => r.id !== requestId))
    } else {
      setMyRequests(prev => prev.filter(r => r.id !== requestId))
    }

    // 선택된 요청이 제거된 경우 다음 요청 선택
    if (selectedRequest?.id === requestId) {
      const allRequests = [...myRequests, ...testAssignedRequests, ...deployAssignedRequests, ...unassignedRequests]
      const remaining = allRequests.filter(r => r.id !== requestId)
      setSelectedRequest(remaining[0] || null)
    }
  }, [selectedRequest, myRequests, testAssignedRequests, deployAssignedRequests, unassignedRequests])

  // 요청이 어느 목록에 속하는지 확인
  const getRequestListType = useCallback((requestId: string): 'test' | 'deploy' | 'my' | null => {
    if (testAssignedRequests.some(r => r.id === requestId)) return 'test'
    if (deployAssignedRequests.some(r => r.id === requestId)) return 'deploy'
    if (myRequests.some(r => r.id === requestId)) return 'my'
    return null
  }, [testAssignedRequests, deployAssignedRequests, myRequests])

  // 선택된 요청의 상태 업데이트 핸들러
  const handleRequestStatusChange = useCallback((requestId: string, newStatus: string, previousStatus?: string) => {
    // 배포 그룹 정보 초기화 케이스:
    // 1. deploy_requested → test_completed (되돌리기)
    // 2. deploy_requested → deploy_approved (개별 배포 승인)
    const shouldClearBatchInfo = previousStatus === 'deploy_requested' &&
      (newStatus === 'test_completed' || newStatus === 'deploy_approved')

    if (selectedRequest?.id === requestId) {
      setSelectedRequest(prev => prev ? {
        ...prev,
        status: newStatus,
        ...(shouldClearBatchInfo ? { deploy_batch_id: null, deploy_batch_name: null } : {})
      } : null)
    }

    // myRequests 상태도 업데이트
    setMyRequests(prev => prev.map(r =>
      r.id === requestId
        ? {
            ...r,
            status: newStatus,
            ...(shouldClearBatchInfo ? { deploy_batch_id: null, deploy_batch_name: null } : {})
          }
        : r
    ))

    const listType = getRequestListType(requestId)

    // 상태에 따라 목록에서 제거 (테스트/배포 완료 시)
    if (newStatus === 'test_completed' && listType === 'test') {
      // 테스트 완료 → 테스트 요청 목록에서 제거 (위임된 경우만)
      handleRequestRemove(requestId, 'test')
    } else if (newStatus === 'deploy_approved' && listType === 'deploy') {
      // 배포 승인 → 배포 요청 목록에서 제거 (위임된 경우만)
      handleRequestRemove(requestId, 'deploy')
    } else if (newStatus === 'completed' || newStatus === 'rejected') {
      // 완료/반려 → 내 작업 목록에서 제거
      if (listType === 'my') {
        handleRequestRemove(requestId, 'my')
      }
    }
  }, [selectedRequest, handleRequestRemove, getRequestListType])

  // Supabase Realtime 구독 (다른 사용자의 변경 감지)
  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel('workspace-requests')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'service_requests'
        },
        (payload) => {
          const updated = payload.new as { id: string; status: string; manager_id: string; test_manager_id: string | null; deploy_manager_id: string | null }

          // 현재 사용자와 관련된 요청인지 확인
          const isMyRequest = updated.manager_id === currentUserId
          const isMyTestRequest = updated.test_manager_id === currentUserId
          const isMyDeployRequest = updated.deploy_manager_id === currentUserId

          if (isMyRequest || isMyTestRequest || isMyDeployRequest) {
            // 페이지 데이터 새로고침
            router.refresh()
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [currentUserId, router])

  // 일괄 배포 선택 토글
  const handleBatchSelectToggle = useCallback((requestId: string) => {
    setSelectedForBatch(prev => {
      const newSet = new Set(prev)
      if (newSet.has(requestId)) {
        newSet.delete(requestId)
      } else {
        newSet.add(requestId)
      }
      return newSet
    })
  }, [])

  // 일괄 배포 전체 선택/해제
  const handleSelectAllForBatch = useCallback(() => {
    if (selectedForBatch.size === batchDeployableRequests.length) {
      setSelectedForBatch(new Set())
    } else {
      setSelectedForBatch(new Set(batchDeployableRequests.map(r => r.id)))
    }
  }, [batchDeployableRequests, selectedForBatch.size])

  // 일괄 배포 모드 종료
  const exitMultiSelectMode = useCallback(() => {
    setIsMultiSelectMode(false)
    setSelectedForBatch(new Set())
  }, [])

  // 일괄 배포 요청 처리
  const handleBatchDeploy = useCallback(async (deployInfo: BatchDeployInfo) => {
    setIsBatchLoading(true)
    try {
      const result = await requestBatchDeploy(Array.from(selectedForBatch), deployInfo)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(result.message)
        setShowBatchDeployModal(false)

        // 로컬 상태 즉시 업데이트: 선택된 요청들의 상태를 deploy_requested로 변경
        const batchIds = Array.from(selectedForBatch)
        // deploy_manager_id가 null이면 본인이 직접 처리 (서버 로직과 동일)
        const effectiveDeployManagerId = deployInfo.deploy_manager_id ?? currentUserId

        setMyRequests(prev => prev.map(r =>
          batchIds.includes(r.id)
            ? {
                ...r,
                status: 'deploy_requested',
                deploy_batch_id: result.deployBatchId,
                deploy_batch_name: deployInfo.deploy_batch_name,
                deploy_type: deployInfo.deploy_type,
                deploy_scheduled_at: deployInfo.deploy_scheduled_at,
                deploy_manager_id: effectiveDeployManagerId
              }
            : r
        ))

        // 선택된 요청이 현재 상세 패널에 표시중이면 업데이트
        if (selectedRequest && batchIds.includes(selectedRequest.id)) {
          setSelectedRequest(prev => prev ? {
            ...prev,
            status: 'deploy_requested',
            deploy_batch_id: result.deployBatchId,
            deploy_batch_name: deployInfo.deploy_batch_name,
            deploy_type: deployInfo.deploy_type,
            deploy_scheduled_at: deployInfo.deploy_scheduled_at,
            deploy_manager_id: effectiveDeployManagerId
          } : null)
        }

        exitMultiSelectMode()
        router.refresh()
      }
    } catch (error) {
      toast.error('일괄 배포 요청 중 오류가 발생했습니다.')
    } finally {
      setIsBatchLoading(false)
    }
  }, [selectedForBatch, selectedRequest, exitMultiSelectMode, router])

  // 일괄 배포 모달에서 요청 제거
  const handleRemoveFromBatch = useCallback((requestId: string) => {
    setSelectedForBatch(prev => {
      const newSet = new Set(prev)
      newSet.delete(requestId)
      return newSet
    })
  }, [])

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

  // 선택된 요청 객체들
  const selectedRequestsForModal = myRequests.filter(r => selectedForBatch.has(r.id))

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left: Request List */}
      <div className="w-[400px] shrink-0 bg-white border-r border-gray-200 flex flex-col overflow-hidden">
        {/* Tab-like sections */}
        <div className="flex-1 overflow-y-auto">
          {/* My Assigned Requests */}
          <div className="p-4 border-b border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-500 flex items-center gap-2">
                <div className="w-5 h-5 rounded bg-indigo-100 flex items-center justify-center">
                  <Bot className="size-3 text-indigo-600" />
                </div>
                내 작업 ({myRequests.length})
              </h3>

              {/* 일괄 배포 모드 토글 버튼 */}
              {batchDeployableRequests.length > 0 && (
                <div className="flex items-center gap-2">
                  {isMultiSelectMode ? (
                    <>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={exitMultiSelectMode}
                        className="h-7 px-2 text-xs text-gray-500"
                      >
                        <X className="size-3 mr-1" />
                        취소
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => setShowBatchDeployModal(true)}
                        disabled={selectedForBatch.size === 0}
                        className="h-7 px-2 text-xs bg-cyan-600 hover:bg-cyan-700"
                      >
                        <Package className="size-3 mr-1" />
                        일괄 배포 ({selectedForBatch.size})
                      </Button>
                    </>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setIsMultiSelectMode(true)}
                      className="h-7 px-2 text-xs"
                    >
                      <Package className="size-3 mr-1" />
                      일괄 배포
                    </Button>
                  )}
                </div>
              )}
            </div>

            {/* 일괄 배포 모드 안내 */}
            {isMultiSelectMode && (
              <div className="mb-3 p-2 bg-cyan-50 border border-cyan-200 rounded-lg">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-cyan-700">
                    테스트 완료된 요청을 선택하여 일괄 배포하세요
                  </p>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleSelectAllForBatch}
                    className="h-6 px-2 text-xs text-cyan-700 hover:text-cyan-900"
                  >
                    {selectedForBatch.size === batchDeployableRequests.length ? '전체 해제' : '전체 선택'}
                  </Button>
                </div>
              </div>
            )}

            {myRequests.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <CheckCircle2 className="size-12 mx-auto mb-3 text-gray-300" />
                <p className="text-sm">모든 작업을 완료했습니다!</p>
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
                            isMultiSelectMode={isMultiSelectMode}
                            isSelectedForBatch={selectedForBatch.has(request.id)}
                            onBatchSelectToggle={handleBatchSelectToggle}
                            canBatchDeploy={request.status === 'test_completed'}
                          />
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* 테스트 담당 위임 요청 */}
          {testAssignedRequests.length > 0 && (
            <div className="p-4 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-500 mb-3 flex items-center gap-2">
                <div className="w-5 h-5 rounded bg-orange-100 flex items-center justify-center">
                  <TestTube2 className="size-3 text-orange-600" />
                </div>
                테스트 요청 ({testAssignedRequests.length})
              </h3>
              <div className="space-y-2">
                {testAssignedRequests.map(request => (
                  <RequestItem
                    key={request.id}
                    request={request}
                    isSelected={selectedRequest?.id === request.id}
                    onClick={() => setSelectedRequest(request)}
                    priority={request.priority as keyof typeof PRIORITY_CONFIG}
                    delegationType="test"
                  />
                ))}
              </div>
            </div>
          )}

          {/* 배포 승인 위임 요청 */}
          {deployAssignedRequests.length > 0 && (
            <div className="p-4 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-500 mb-3 flex items-center gap-2">
                <div className="w-5 h-5 rounded bg-cyan-100 flex items-center justify-center">
                  <Rocket className="size-3 text-cyan-600" />
                </div>
                배포 승인 요청 ({deployAssignedRequests.length})
              </h3>
              <div className="space-y-2">
                {deployAssignedRequests.map(request => (
                  <RequestItem
                    key={request.id}
                    request={request}
                    isSelected={selectedRequest?.id === request.id}
                    onClick={() => setSelectedRequest(request)}
                    priority={request.priority as keyof typeof PRIORITY_CONFIG}
                    delegationType="deploy"
                  />
                ))}
              </div>
            </div>
          )}

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
            onStatusChange={handleRequestStatusChange}
          />
        ) : (
          <EmptyState />
        )}
      </div>

      {/* 일괄 배포 모달 */}
      <BatchDeployModal
        open={showBatchDeployModal}
        onOpenChange={setShowBatchDeployModal}
        onConfirm={handleBatchDeploy}
        isLoading={isBatchLoading}
        managers={managers}
        currentUserId={currentUserId}
        selectedRequests={selectedRequestsForModal}
        onRemoveRequest={handleRemoveFromBatch}
      />
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
  delegationType,
  isMultiSelectMode = false,
  isSelectedForBatch = false,
  onBatchSelectToggle,
  canBatchDeploy = false,
}: {
  request: AssignedRequest
  isSelected: boolean
  onClick: () => void
  priority: keyof typeof PRIORITY_CONFIG
  showAssignButton?: boolean
  completed?: boolean
  delegationType?: 'test' | 'deploy'
  isMultiSelectMode?: boolean
  isSelectedForBatch?: boolean
  onBatchSelectToggle?: (requestId: string) => void
  canBatchDeploy?: boolean
}) {
  const config = PRIORITY_CONFIG[priority] || PRIORITY_CONFIG.medium
  const [timeAgo, setTimeAgo] = useState<string>('')

  // 클라이언트에서만 시간 계산 (Hydration mismatch 방지)
  useEffect(() => {
    setTimeAgo(getTimeAgo(request.created_at))
  }, [request.created_at])

  // 위임 타입에 따른 스타일
  const delegationStyles = {
    test: { bg: 'bg-orange-50', border: 'border-orange-300', text: 'text-orange-900' },
    deploy: { bg: 'bg-cyan-50', border: 'border-cyan-300', text: 'text-cyan-900' },
  }

  const selectedStyle = delegationType
    ? delegationStyles[delegationType]
    : { bg: 'bg-indigo-50', border: 'border-indigo-300', text: 'text-indigo-900' }

  // 일괄 배포 모드에서 체크박스 클릭 핸들러
  const handleCheckboxClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (onBatchSelectToggle && canBatchDeploy) {
      onBatchSelectToggle(request.id)
    }
  }

  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick() }}
      className={cn(
        'w-full text-left p-3 rounded-xl border transition-all cursor-pointer',
        'hover:shadow-md hover:-translate-y-0.5',
        isSelected
          ? `${selectedStyle.bg} ${selectedStyle.border} shadow-sm`
          : 'bg-white border-gray-200 hover:border-gray-300',
        completed && 'opacity-60',
        isSelectedForBatch && 'ring-2 ring-cyan-500 ring-offset-1'
      )}
    >
      <div className="flex items-start gap-3">
        {/* 일괄 배포 모드: 체크박스 */}
        {isMultiSelectMode && (
          <div
            onClick={handleCheckboxClick}
            className={cn(
              'mt-1 shrink-0',
              !canBatchDeploy && 'opacity-30 cursor-not-allowed'
            )}
          >
            <Checkbox
              checked={isSelectedForBatch}
              disabled={!canBatchDeploy}
              className="data-[state=checked]:bg-cyan-600 data-[state=checked]:border-cyan-600"
            />
          </div>
        )}

        {/* Priority Dot (일괄 배포 모드가 아닐 때만) */}
        {!isMultiSelectMode && (
          <div className={cn('w-2 h-2 rounded-full mt-2 shrink-0', config.dotColor)} />
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <h4 className={cn(
              'font-medium text-sm line-clamp-1',
              isSelected ? selectedStyle.text : 'text-gray-900'
            )}>
              {request.title}
            </h4>
            <ChevronRight className={cn(
              'size-4 shrink-0 transition-transform',
              isSelected ? 'text-indigo-600 translate-x-0.5' : 'text-gray-400'
            )} />
          </div>

          <p className="text-xs text-gray-500 line-clamp-1 mb-2">
            {request.description}
          </p>

          <div className="flex items-center gap-2 flex-wrap">
            {/* 위임 타입 배지 */}
            {delegationType === 'test' && (
              <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-orange-100 text-orange-700">
                <TestTube2 className="size-3" />
                테스트 요청
              </span>
            )}
            {delegationType === 'deploy' && (
              <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-cyan-100 text-cyan-700">
                <Rocket className="size-3" />
                배포 승인
              </span>
            )}
            <span className={cn(
              'inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded',
              config.color
            )}>
              {config.label}
            </span>
            {/* SR 구분 (대분류/소분류) */}
            {request.category_lv1?.name && (
              <span className="text-[10px] text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded">
                {request.category_lv1.name}
                {request.category_lv2?.name && ` / ${request.category_lv2.name}`}
              </span>
            )}
            <span className="text-[10px] text-gray-400 flex items-center gap-1">
              <Clock className="size-3" />
              {timeAgo}
            </span>
            {/* 위임 요청의 경우 요청 담당자 표시 */}
            {delegationType && request.manager && (
              <span className="text-[10px] text-gray-400 flex items-center gap-1">
                <User className="size-3" />
                from: {request.manager.full_name || request.manager.email?.split('@')[0]}
              </span>
            )}
            {/* 일반 요청의 경우 요청자 표시 */}
            {!delegationType && request.requester && (
              <span className="text-[10px] text-gray-400 flex items-center gap-1">
                <User className="size-3" />
                {request.requester.full_name || request.requester.email?.split('@')[0]}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
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

