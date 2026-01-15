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

  // 이미 배정된 경우 확인
  if (request.manager_id && request.manager_id !== managerId) {
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

  // 히스토리 기록
  await supabase.from('sr_history').insert({
    request_id: requestId,
    actor_id: user.id,
    action: 'assigned',
    previous_status: request.status,
    new_status: request.status,
    note: '담당자 배정됨',
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
  const updateData: { status: string; completed_at?: string } = { status: newStatus }
  if (newStatus === 'completed') {
    updateData.completed_at = new Date().toISOString()
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
) {
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
  if (reason.trim()) {
    const commentContent = newStatus === 'completed'
      ? `✅ **처리 완료**\n\n${reason}`
      : `❌ **요청 반려**\n\n${reason}`

    const { error: commentError } = await supabase.from('sr_comments').insert({
      request_id: requestId,
      author_id: user.id,
      content: commentContent,
      is_internal: false, // 요청자에게 공개
    })

    if (commentError) {
      console.error('댓글 등록 오류:', commentError)
      // 댓글 등록 실패해도 상태 변경은 성공으로 처리
    }
  }

  revalidatePath('/workspace')
  revalidatePath('/requests')
  revalidatePath(`/requests/${requestId}`)

  return { success: true }
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

  // 배포 승인 처리
  const { error } = await supabase
    .from('service_requests')
    .update({
      status: 'deploy_approved',
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
    note: '배포 승인',
  })

  revalidatePath('/workspace')
  revalidatePath('/requests')
  revalidatePath(`/requests/${requestId}`)

  return { success: true }
}
