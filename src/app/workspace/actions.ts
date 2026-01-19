'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// 요청을 담당자에게 배정
export async function assignRequest(requestId: string, managerId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: '로그인이 필요합니다.' }
  }

  // 현재 요청 상태 조회
  const { data: request } = await supabase
    .from('service_requests')
    .select('status, manager_id')
    .eq('id', requestId)
    .single()

  if (!request) {
    return { error: '요청을 찾을 수 없습니다.' }
  }

  // 권한 확인: 관리자이거나 현재 담당자여야 함 (이미 배정된 경우)
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (profileError) {
    console.error('프로필 조회 오류:', profileError)
    return { error: '권한 확인 중 오류가 발생했습니다.' }
  }

  const isAdmin = profile?.role === 'admin'
  const isCurrentManager = request.manager_id === user.id

  // 이미 다른 사람에게 배정된 경우 (절취 방지)
  // 단, 관리자이거나 현재 담당자가 이관하는 경우는 허용
  if (request.manager_id && request.manager_id !== managerId && !isAdmin && !isCurrentManager) {
    // 디버깅을 위해 로그 남김
    console.warn(`배정 거부: 요청(${requestId})의 현재 담당자(${request.manager_id})가 호출자(${user.id})와 다르고 호출자가 관리자도 아님.`)
    return { error: '이미 다른 담당자에게 배정된 요청입니다.' }
  }

  // 배정 (상태는 변경하지 않음 - 담당자가 명시적으로 다음 단계로 진행)
  const { error } = await supabase
    .from('service_requests')
    .update({
      manager_id: managerId
    })
    .eq('id', requestId)

  if (error) {
    console.error('배정 오류:', error)
    return { error: `배정 오류: ${JSON.stringify(error)}` }
  }

  // 배정/이관 히스토리 기록
  const isTransfer = request.manager_id && request.manager_id !== managerId
  await supabase.from('sr_history').insert({
    request_id: requestId,
    actor_id: user.id,
    action: isTransfer ? 'transferred' : 'assigned',
    previous_status: request.status,
    new_status: request.status,
    note: isTransfer ? '담당자 이관됨' : '담당자 배정됨',
  })

  revalidatePath('/workspace')
  revalidatePath('/requests')

  return { success: true }
}

// 요청 상태 변경
export async function updateRequestStatus(requestId: string, newStatus: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: '로그인이 필요합니다.' }
  }

  // 현재 상태 조회
  const { data: request } = await supabase
    .from('service_requests')
    .select('status')
    .eq('id', requestId)
    .single()

  if (!request) {
    return { error: '요청을 찾을 수 없습니다.' }
  }

  const previousStatus = request.status

  // 상태 업데이트
  const updateData: {
    status: string
    completed_at?: string
    deploy_batch_id?: null
    deploy_batch_name?: null
  } = { status: newStatus }

  if (newStatus === 'completed') {
    updateData.completed_at = new Date().toISOString()
  }

  // 배포 요청 상태에서 테스트 완료로 되돌릴 때 배포 그룹 정보 초기화
  if (previousStatus === 'deploy_requested' && newStatus === 'test_completed') {
    updateData.deploy_batch_id = null
    updateData.deploy_batch_name = null
  }

  const { error } = await supabase
    .from('service_requests')
    .update(updateData)
    .eq('id', requestId)

  if (error) {
    console.error('상태 변경 오류:', error)
    return { error: '상태 변경 중 오류가 발생했습니다.' }
  }

  // 히스토리 기록
  const statusLabels: Record<string, string> = {
    requested: '요청',
    reviewing: '검토중',
    processing: '처리중',
    completed: '완료',
    rejected: '반려',
  }

  await supabase.from('sr_history').insert({
    request_id: requestId,
    actor_id: user.id,
    action: 'status_change',
    previous_status: previousStatus,
    new_status: newStatus,
    note: `상태 변경: ${statusLabels[previousStatus] || previousStatus} → ${statusLabels[newStatus] || newStatus}`,
  })

  revalidatePath('/workspace')
  revalidatePath('/requests')
  revalidatePath(`/requests/${requestId}`)

  return { success: true }
}

// 공수 데이터 타입
interface EffortData {
  estimated_fp?: number | null
  actual_fp?: number | null
  estimated_md?: number | null
  actual_md?: number | null
}

// 사유와 함께 상태 변경 (완료/반려)
export async function updateRequestStatusWithReason(
  requestId: string,
  newStatus: 'completed' | 'rejected',
  reason: string,
  effort?: EffortData
): Promise<{ success?: boolean; error?: string; commentId?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: '로그인이 필요합니다.' }
  }

  // 반려 시 사유 필수
  if (newStatus === 'rejected' && !reason.trim()) {
    return { error: '반려 사유를 입력해주세요.' }
  }

  // 현재 상태 조회
  const { data: request } = await supabase
    .from('service_requests')
    .select('status')
    .eq('id', requestId)
    .single()

  if (!request) {
    return { error: '요청을 찾을 수 없습니다.' }
  }

  const previousStatus = request.status

  // 상태 업데이트 (완료 시 공수 데이터 포함)
  const updateData: {
    status: string
    completed_at?: string
    estimated_fp?: number | null
    actual_fp?: number | null
    estimated_md?: number | null
    actual_md?: number | null
  } = { status: newStatus }

  if (newStatus === 'completed') {
    updateData.completed_at = new Date().toISOString()
    // 공수 데이터 추가
    if (effort) {
      updateData.estimated_fp = effort.estimated_fp
      updateData.actual_fp = effort.actual_fp
      updateData.estimated_md = effort.estimated_md
      updateData.actual_md = effort.actual_md
    }
  }

  const { error: updateError } = await supabase
    .from('service_requests')
    .update(updateData)
    .eq('id', requestId)

  if (updateError) {
    console.error('상태 변경 오류:', updateError)
    return { error: '상태 변경 중 오류가 발생했습니다.' }
  }

  // 히스토리 기록
  const actionNote = newStatus === 'completed'
    ? `처리 완료${reason ? `: ${reason}` : ''}`
    : `반려: ${reason}`

  await supabase.from('sr_history').insert({
    request_id: requestId,
    actor_id: user.id,
    action: 'status_change',
    previous_status: previousStatus,
    new_status: newStatus,
    note: actionNote,
  })

  // 댓글 자동 등록 (요청자에게 공개)
  let commentId: string | undefined
  if (reason.trim()) {
    const commentContent = newStatus === 'completed'
      ? `✅ **처리 완료**\n\n${reason}`
      : `❌ **요청 반려**\n\n${reason}`

    const { data: commentData, error: commentError } = await supabase.from('sr_comments').insert({
      request_id: requestId,
      author_id: user.id,
      content: commentContent,
      is_internal: false, // 요청자에게 공개
    }).select('id').single()

    if (commentError) {
      console.error('댓글 등록 오류:', commentError)
      // 댓글 등록 실패해도 상태 변경은 성공으로 처리
    } else {
      commentId = commentData.id
    }
  }

  revalidatePath('/workspace')
  revalidatePath('/requests')
  revalidatePath(`/requests/${requestId}`)

  return { success: true, commentId }
}

// 배포 정보와 함께 상태 변경
export async function updateRequestWithDeployInfo(
  requestId: string,
  newStatus: string,
  deployInfo: {
    deploy_type: 'scheduled' | 'unscheduled'
    deploy_manager_id: string | null // null이면 본인이 직접 배포 승인
    deploy_scheduled_at: string
  }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: '로그인이 필요합니다.' }
  }

  // 현재 상태 조회
  const { data: request } = await supabase
    .from('service_requests')
    .select('status')
    .eq('id', requestId)
    .single()

  if (!request) {
    return { error: '요청을 찾을 수 없습니다.' }
  }

  const previousStatus = request.status

  // deploy_manager_id가 null이면 본인이 직접 처리하므로 현재 사용자 ID 사용
  const effectiveDeployManagerId = deployInfo.deploy_manager_id ?? user.id

  // 배포 정보와 상태 업데이트
  const { error } = await supabase
    .from('service_requests')
    .update({
      status: newStatus,
      deploy_type: deployInfo.deploy_type,
      deploy_manager_id: effectiveDeployManagerId,
      deploy_scheduled_at: deployInfo.deploy_scheduled_at,
    })
    .eq('id', requestId)

  if (error) {
    console.error('배포 정보 업데이트 오류:', error)
    return { error: '배포 정보 업데이트 중 오류가 발생했습니다.' }
  }

  // 배포 담당자 이름 조회
  const { data: deployManager } = await supabase
    .from('profiles')
    .select('full_name, email')
    .eq('id', effectiveDeployManagerId)
    .single()

  const deployManagerName = deployManager?.full_name || deployManager?.email || '알 수 없음'
  const deployTypeLabel = deployInfo.deploy_type === 'scheduled' ? '정기' : '비정기'
  const scheduledDate = new Date(deployInfo.deploy_scheduled_at).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })

  // 히스토리 기록
  await supabase.from('sr_history').insert({
    request_id: requestId,
    actor_id: user.id,
    action: 'status_change',
    previous_status: previousStatus,
    new_status: newStatus,
    note: `배포 요청: ${deployTypeLabel} 배포, 담당자: ${deployManagerName}, 예정일: ${scheduledDate}`,
  })

  revalidatePath('/workspace')
  revalidatePath('/requests')
  revalidatePath(`/requests/${requestId}`)

  return { success: true }
}

// 배포 완료 처리
export async function completeDeployment(requestId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: '로그인이 필요합니다.' }
  }

  // 현재 상태 조회
  const { data: request } = await supabase
    .from('service_requests')
    .select('status')
    .eq('id', requestId)
    .single()

  if (!request) {
    return { error: '요청을 찾을 수 없습니다.' }
  }

  const previousStatus = request.status

  // 배포 완료 처리
  const { error } = await supabase
    .from('service_requests')
    .update({
      status: 'completed',
      deploy_completed_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
    })
    .eq('id', requestId)

  if (error) {
    console.error('배포 완료 오류:', error)
    return { error: '배포 완료 처리 중 오류가 발생했습니다.' }
  }

  // 히스토리 기록
  await supabase.from('sr_history').insert({
    request_id: requestId,
    actor_id: user.id,
    action: 'status_change',
    previous_status: previousStatus,
    new_status: 'completed',
    note: '배포 완료',
  })

  revalidatePath('/workspace')
  revalidatePath('/requests')
  revalidatePath(`/requests/${requestId}`)

  return { success: true }
}

// 담당자 목록 조회
export async function getManagers() {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, email')
    .in('role', ['manager', 'admin'])
    .order('full_name')

  if (error) {
    console.error('담당자 목록 조회 오류:', error)
    return { managers: [] }
  }

  return { managers: data || [] }
}

// 테스트 요청 (본인 또는 다른 담당자에게 위임)
export async function requestTest(
  requestId: string,
  testInfo: {
    test_manager_id: string | null // null이면 본인이 직접 테스트
  }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: '로그인이 필요합니다.' }
  }

  // 현재 상태 조회
  const { data: request } = await supabase
    .from('service_requests')
    .select('status, manager_id')
    .eq('id', requestId)
    .single()

  if (!request) {
    return { error: '요청을 찾을 수 없습니다.' }
  }

  // 권한 확인: 담당자만 테스트 요청 가능
  if (request.manager_id !== user.id) {
    return { error: '담당자만 테스트 요청을 할 수 있습니다.' }
  }

  const previousStatus = request.status

  // 테스트 요청 처리
  const { error } = await supabase
    .from('service_requests')
    .update({
      status: 'test_requested',
      test_manager_id: testInfo.test_manager_id,
    })
    .eq('id', requestId)

  if (error) {
    console.error('테스트 요청 오류:', error)
    return { error: '테스트 요청 중 오류가 발생했습니다.' }
  }

  // 테스트 담당자 이름 조회 (다른 담당자에게 위임한 경우)
  let note = '테스트 요청 (본인 진행)'
  if (testInfo.test_manager_id) {
    const { data: testManager } = await supabase
      .from('profiles')
      .select('full_name, email')
      .eq('id', testInfo.test_manager_id)
      .single()

    const testManagerName = testManager?.full_name || testManager?.email || '알 수 없음'
    note = `테스트 요청: ${testManagerName}에게 위임`
  }

  // 히스토리 기록
  await supabase.from('sr_history').insert({
    request_id: requestId,
    actor_id: user.id,
    action: 'status_change',
    previous_status: previousStatus,
    new_status: 'test_requested',
    note,
  })

  revalidatePath('/workspace')
  revalidatePath('/requests')
  revalidatePath(`/requests/${requestId}`)

  return { success: true }
}

// 테스트 완료 처리 (권한 검증 포함)
export async function completeTest(requestId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: '로그인이 필요합니다.' }
  }

  // 현재 상태 및 테스트 담당자 조회
  const { data: request } = await supabase
    .from('service_requests')
    .select('status, manager_id, test_manager_id')
    .eq('id', requestId)
    .single()

  if (!request) {
    return { error: '요청을 찾을 수 없습니다.' }
  }

  // 권한 확인: 테스트 담당자 또는 (테스트 담당자가 없으면) 기존 담당자만 완료 가능
  const canComplete = request.test_manager_id
    ? request.test_manager_id === user.id
    : request.manager_id === user.id

  if (!canComplete) {
    return { error: '테스트 완료 권한이 없습니다.' }
  }

  const previousStatus = request.status

  // 테스트 완료 처리
  const { error } = await supabase
    .from('service_requests')
    .update({
      status: 'test_completed',
    })
    .eq('id', requestId)

  if (error) {
    console.error('테스트 완료 오류:', error)
    return { error: '테스트 완료 처리 중 오류가 발생했습니다.' }
  }

  // 히스토리 기록
  await supabase.from('sr_history').insert({
    request_id: requestId,
    actor_id: user.id,
    action: 'status_change',
    previous_status: previousStatus,
    new_status: 'test_completed',
    note: '테스트 완료',
  })

  revalidatePath('/workspace')
  revalidatePath('/requests')
  revalidatePath(`/requests/${requestId}`)

  return { success: true }
}

// 배포 승인 처리 (권한 검증 포함)
export async function approveDeploy(requestId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: '로그인이 필요합니다.' }
  }

  // 현재 상태 및 배포 담당자 조회
  const { data: request } = await supabase
    .from('service_requests')
    .select('status, deploy_manager_id')
    .eq('id', requestId)
    .single()

  if (!request) {
    return { error: '요청을 찾을 수 없습니다.' }
  }

  // 권한 확인: 배포 담당자만 승인 가능
  if (request.deploy_manager_id !== user.id) {
    return { error: '배포 승인 권한이 없습니다.' }
  }

  const previousStatus = request.status

  // 배포 승인 처리 (개별 승인 시 배포 그룹에서 제외)
  const { error } = await supabase
    .from('service_requests')
    .update({
      status: 'deploy_approved',
      deploy_batch_id: null,
      deploy_batch_name: null,
    })
    .eq('id', requestId)

  if (error) {
    console.error('배포 승인 오류:', error)
    return { error: '배포 승인 처리 중 오류가 발생했습니다.' }
  }

  // 히스토리 기록
  await supabase.from('sr_history').insert({
    request_id: requestId,
    actor_id: user.id,
    action: 'status_change',
    previous_status: previousStatus,
    new_status: 'deploy_approved',
    note: '배포 승인 (개별)',
  })

  revalidatePath('/workspace')
  revalidatePath('/requests')
  revalidatePath(`/requests/${requestId}`)

  return { success: true }
}

// 요청 정보 수정 (본인에게 배정된 요청만)
export async function updateRequestDetails(
  requestId: string,
  data: {
    system_id?: string | null
    module_id?: string | null
    category_lv1_id?: string | null
    category_lv2_id?: string | null
    priority?: string
  }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: '로그인이 필요합니다.' }
  }

  // 현재 요청 정보 조회 (권한 확인 및 변경 이력 기록용)
  const { data: currentRequest } = await supabase
    .from('service_requests')
    .select(`
      manager_id, system_id, module_id, category_lv1_id, category_lv2_id, priority,
      system:systems(name),
      module:system_modules(name),
      category_lv1:request_categories_lv1(name),
      category_lv2:request_categories_lv2(name)
    `)
    .eq('id', requestId)
    .single()

  if (!currentRequest) {
    return { error: '요청을 찾을 수 없습니다.' }
  }

  // 권한 확인: 본인에게 배정된 요청만 수정 가능
  // 관리자는 모든 요청 수정 가능
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const isAdmin = profile?.role === 'admin'
  const isAssignedManager = currentRequest.manager_id === user.id

  if (!isAdmin && !isAssignedManager) {
    return { error: '본인에게 배정된 요청만 수정할 수 있습니다.' }
  }

  // 업데이트 데이터 준비
  const updateData: Record<string, string | null> = {}
  const changes: string[] = []

  if (data.system_id !== undefined && data.system_id !== currentRequest.system_id) {
    updateData.system_id = data.system_id || null
    changes.push('시스템')
  }
  if (data.module_id !== undefined && data.module_id !== currentRequest.module_id) {
    updateData.module_id = data.module_id || null
    changes.push('모듈')
  }
  if (data.category_lv1_id !== undefined && data.category_lv1_id !== currentRequest.category_lv1_id) {
    updateData.category_lv1_id = data.category_lv1_id || null
    changes.push('SR 구분')
  }
  if (data.category_lv2_id !== undefined && data.category_lv2_id !== currentRequest.category_lv2_id) {
    updateData.category_lv2_id = data.category_lv2_id || null
    changes.push('SR 상세 구분')
  }
  if (data.priority !== undefined && data.priority !== currentRequest.priority) {
    updateData.priority = data.priority
    changes.push('우선순위')
  }

  if (Object.keys(updateData).length === 0) {
    return { success: true, message: '변경된 내용이 없습니다.' }
  }

  const { error } = await supabase
    .from('service_requests')
    .update(updateData)
    .eq('id', requestId)

  if (error) {
    console.error('요청 정보 수정 오류:', error)
    return { error: '요청 정보 수정 중 오류가 발생했습니다.' }
  }

  // 수정 히스토리 기록
  await supabase.from('sr_history').insert({
    request_id: requestId,
    actor_id: user.id,
    action: '요청 정보 수정',
    note: `변경 항목: ${changes.join(', ')}`,
  })

  revalidatePath('/workspace')
  revalidatePath('/requests')
  revalidatePath(`/requests/${requestId}`)

  return { success: true }
}

// 시스템 목록 조회
export async function getSystems() {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('systems')
    .select('id, name, code')
    .eq('status', 'active')
    .order('name')

  if (error) {
    console.error('시스템 목록 조회 오류:', error)
    return { systems: [] }
  }

  return { systems: data || [] }
}

// 모듈 목록 조회
export async function getModules() {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('system_modules')
    .select('id, system_id, code, name')
    .eq('is_active', true)
    .order('sort_order')

  if (error) {
    console.error('모듈 목록 조회 오류:', error)
    return { modules: [] }
  }

  return { modules: data || [] }
}

// 분류 목록 조회
export async function getCategories() {
  const supabase = await createClient()

  const { data: lv1Data, error: lv1Error } = await supabase
    .from('request_categories_lv1')
    .select('id, code, name')
    .eq('is_active', true)
    .order('sort_order')

  const { data: lv2Data, error: lv2Error } = await supabase
    .from('request_categories_lv2')
    .select('id, category_lv1_id, code, name')
    .eq('is_active', true)
    .order('sort_order')

  if (lv1Error || lv2Error) {
    console.error('분류 목록 조회 오류:', lv1Error || lv2Error)
    return { categoriesLv1: [], categoriesLv2: [] }
  }

  return {
    categoriesLv1: lv1Data || [],
    categoriesLv2: lv2Data || []
  }
}

// ========== 일괄 배포(통합 배포) 기능 ==========

// 일괄 배포 요청
export async function requestBatchDeploy(
  requestIds: string[],
  deployInfo: {
    deploy_batch_name: string
    deploy_type: 'scheduled' | 'unscheduled'
    deploy_manager_id: string | null
    deploy_scheduled_at: string
  }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: '로그인이 필요합니다.' }
  }

  if (requestIds.length === 0) {
    return { error: '배포할 요청을 선택해주세요.' }
  }

  // 배포 그룹 ID 생성
  const deployBatchId = crypto.randomUUID()

  // 선택된 요청들의 현재 상태 확인
  const { data: requests, error: fetchError } = await supabase
    .from('service_requests')
    .select('id, status, title, manager_id')
    .in('id', requestIds)

  if (fetchError || !requests) {
    console.error('요청 조회 오류:', fetchError)
    return { error: '요청 조회 중 오류가 발생했습니다.' }
  }

  // 모든 요청이 test_completed 상태인지 확인
  const invalidRequests = requests.filter(r => r.status !== 'test_completed')
  if (invalidRequests.length > 0) {
    const titles = invalidRequests.map(r => r.title).join(', ')
    return { error: `테스트가 완료되지 않은 요청이 있습니다: ${titles}` }
  }

  // 권한 확인: 현재 사용자가 모든 요청의 담당자인지
  const unauthorizedRequests = requests.filter(r => r.manager_id !== user.id)
  if (unauthorizedRequests.length > 0) {
    const titles = unauthorizedRequests.map(r => r.title).join(', ')
    return { error: `담당자가 아닌 요청이 있습니다: ${titles}` }
  }

  // deploy_manager_id가 null이면 본인이 직접 처리
  const effectiveDeployManagerId = deployInfo.deploy_manager_id ?? user.id

  // 일괄 업데이트
  const { error: updateError } = await supabase
    .from('service_requests')
    .update({
      status: 'deploy_requested',
      deploy_batch_id: deployBatchId,
      deploy_batch_name: deployInfo.deploy_batch_name,
      deploy_type: deployInfo.deploy_type,
      deploy_manager_id: effectiveDeployManagerId,
      deploy_scheduled_at: deployInfo.deploy_scheduled_at,
    })
    .in('id', requestIds)

  if (updateError) {
    console.error('일괄 배포 요청 오류:', updateError)
    return { error: '일괄 배포 요청 중 오류가 발생했습니다.' }
  }

  // 배포 담당자 이름 조회
  const { data: deployManager } = await supabase
    .from('profiles')
    .select('full_name, email')
    .eq('id', effectiveDeployManagerId)
    .single()

  const deployManagerName = deployManager?.full_name || deployManager?.email || '알 수 없음'
  const deployTypeLabel = deployInfo.deploy_type === 'scheduled' ? '정기' : '비정기'
  const scheduledDate = new Date(deployInfo.deploy_scheduled_at).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })

  // 각 요청에 대해 히스토리 기록
  const historyInserts = requests.map(r => ({
    request_id: r.id,
    actor_id: user.id,
    action: 'status_change',
    previous_status: 'test_completed',
    new_status: 'deploy_requested',
    note: `일괄 배포 요청: ${deployInfo.deploy_batch_name} (${deployTypeLabel} 배포, 담당자: ${deployManagerName}, 예정일: ${scheduledDate})`,
  }))

  await supabase.from('sr_history').insert(historyInserts)

  revalidatePath('/workspace')
  revalidatePath('/requests')

  return {
    success: true,
    deployBatchId,
    message: `${requests.length}개 요청이 일괄 배포 요청되었습니다.`
  }
}

// 일괄 배포 승인
export async function approveBatchDeploy(deployBatchId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: '로그인이 필요합니다.' }
  }

  // 해당 배포 그룹의 요청들 조회
  const { data: requests, error: fetchError } = await supabase
    .from('service_requests')
    .select('id, status, deploy_manager_id, deploy_batch_name')
    .eq('deploy_batch_id', deployBatchId)

  if (fetchError || !requests || requests.length === 0) {
    console.error('배포 그룹 조회 오류:', fetchError)
    return { error: '배포 그룹을 찾을 수 없습니다.' }
  }

  // 권한 확인: 현재 사용자가 배포 담당자인지
  const unauthorizedRequests = requests.filter(r => r.deploy_manager_id !== user.id)
  if (unauthorizedRequests.length > 0) {
    return { error: '일괄 배포 승인 권한이 없습니다.' }
  }

  // 모든 요청이 deploy_requested 상태인지 확인
  const invalidRequests = requests.filter(r => r.status !== 'deploy_requested')
  if (invalidRequests.length > 0) {
    return { error: '배포 요청 상태가 아닌 요청이 포함되어 있습니다.' }
  }

  const deployBatchName = requests[0].deploy_batch_name || '일괄 배포'

  // 일괄 배포 승인 처리
  const { error: updateError } = await supabase
    .from('service_requests')
    .update({
      status: 'deploy_approved',
    })
    .eq('deploy_batch_id', deployBatchId)

  if (updateError) {
    console.error('일괄 배포 승인 오류:', updateError)
    return { error: '일괄 배포 승인 중 오류가 발생했습니다.' }
  }

  // 히스토리 기록
  const historyInserts = requests.map(r => ({
    request_id: r.id,
    actor_id: user.id,
    action: 'status_change',
    previous_status: 'deploy_requested',
    new_status: 'deploy_approved',
    note: `일괄 배포 승인: ${deployBatchName}`,
  }))

  await supabase.from('sr_history').insert(historyInserts)

  revalidatePath('/workspace')
  revalidatePath('/requests')

  return {
    success: true,
    message: `${requests.length}개 요청이 일괄 배포 승인되었습니다.`
  }
}

// 배포 그룹에 속한 요청 목록 조회
export async function getBatchDeployRequests(deployBatchId: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('service_requests')
    .select(`
      id, title, status, priority,
      system:systems(name),
      module:system_modules(name)
    `)
    .eq('deploy_batch_id', deployBatchId)
    .order('created_at')

  if (error) {
    console.error('배포 그룹 요청 조회 오류:', error)
    return { requests: [] as Array<{
      id: string
      title: string
      status: string
      priority: string
      system: { name: string } | null
      module: { name: string } | null
    }> }
  }

  // Supabase 반환 타입 정리 (배열을 단일 객체로 변환)
  const requests = (data || []).map(item => ({
    id: item.id,
    title: item.title,
    status: item.status,
    priority: item.priority,
    system: Array.isArray(item.system) ? item.system[0] || null : item.system,
    module: Array.isArray(item.module) ? item.module[0] || null : item.module,
  }))

  return { requests }
}
