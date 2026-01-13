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

  // 배정 및 상태 변경
  const newStatus = request.status === 'requested' ? 'reviewing' : request.status

  const { error } = await supabase
    .from('service_requests')
    .update({
      manager_id: managerId,
      status: newStatus
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
    new_status: request.status === 'requested' ? 'reviewing' : request.status,
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

