'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

// 히스토리 기록 헬퍼 함수
async function recordHistory(
  supabase: any,
  requestId: string,
  actorId: string,
  action: string,
  options?: {
    previousStatus?: string
    newStatus?: string
    note?: string
  }
) {
  await supabase.from('sr_history').insert({
    request_id: requestId,
    actor_id: actorId,
    action,
    previous_status: options?.previousStatus || null,
    new_status: options?.newStatus || null,
    note: options?.note || null,
  })
}

export async function createServiceRequest(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: '로그인이 필요합니다.' }
  }

  const title = formData.get('title') as string
  const description = formData.get('description') as string
  const priority = formData.get('priority') as any
  const system_id = formData.get('system_id') as string || null
  const category_lv1_id = formData.get('category_lv1_id') as string || null
  const category_lv2_id = formData.get('category_lv2_id') as string || null

  const { data, error } = await supabase.from('service_requests').insert({
    title,
    description,
    priority,
    system_id,
    category_lv1_id,
    category_lv2_id,
    requester_id: user.id,
  }).select('id').single()

  if (error) {
    return { error: error.message }
  }

  // SR 생성 히스토리 기록
  await recordHistory(supabase, data.id, user.id, 'created', {
    newStatus: 'requested',
    note: `새 요청 생성: ${title}`,
  })

  revalidatePath('/requests')
  return { success: true }
}

export async function updateRequestStatus(id: string, status: any, note?: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: '로그인이 필요합니다.' }

  // 권한 체크: 관리자나 담당자만 상태 변경 가능 (또는 본인의 요청 취소)
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const { data: request } = await supabase
    .from('service_requests')
    .select('requester_id, status')
    .eq('id', id)
    .single()

  const isManager = profile?.role === 'manager' || profile?.role === 'admin'
  const isOwner = request?.requester_id === user.id

  if (!isManager && !isOwner) {
    return { error: '권한이 없습니다.' }
  }

  const previousStatus = request?.status
  const updateData: any = { status }
  if (status === 'completed') {
    updateData.completed_at = new Date().toISOString()
  }

  const { error } = await supabase
    .from('service_requests')
    .update(updateData)
    .eq('id', id)

  if (error) return { error: error.message }

  // 상태 변경 히스토리 기록
  await recordHistory(supabase, id, user.id, 'status_change', {
    previousStatus,
    newStatus: status,
    note,
  })

  revalidatePath(`/requests/${id}`)
  revalidatePath('/requests')
  revalidatePath('/admin/requests')
  return { success: true }
}

export async function assignManager(id: string, managerId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: '로그인이 필요합니다.' }

  // 현재 상태 조회
  const { data: request } = await supabase
    .from('service_requests')
    .select('status')
    .eq('id', id)
    .single()

  // 담당자 이름 조회
  const { data: manager } = await supabase
    .from('profiles')
    .select('full_name, email')
    .eq('id', managerId)
    .single()
  
  const { error } = await supabase
    .from('service_requests')
    .update({ manager_id: managerId, status: 'reviewing' })
    .eq('id', id)

  if (error) return { error: error.message }

  // 담당자 배정 히스토리 기록
  await recordHistory(supabase, id, user.id, 'assigned', {
    previousStatus: request?.status,
    newStatus: 'reviewing',
    note: `담당자 배정: ${manager?.full_name || manager?.email}`,
  })

  revalidatePath(`/requests/${id}`)
  revalidatePath('/admin/requests')
  return { success: true }
}

// 댓글 추가
export async function addComment(requestId: string, content: string, isInternal: boolean = false) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: '로그인이 필요합니다.' }

  // 내부 메모는 관리자만 작성 가능
  if (isInternal) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'manager' && profile?.role !== 'admin') {
      return { error: '내부 메모는 관리자만 작성할 수 있습니다.' }
    }
  }

  const { error } = await supabase.from('sr_comments').insert({
    request_id: requestId,
    author_id: user.id,
    content,
    is_internal: isInternal,
  })

  if (error) return { error: error.message }

  // 댓글 추가 히스토리 기록
  await recordHistory(supabase, requestId, user.id, 'comment_added', {
    note: isInternal ? '내부 메모 추가' : '댓글 추가',
  })

  revalidatePath(`/requests/${requestId}`)
  return { success: true }
}

// 히스토리 조회
export async function getRequestHistory(requestId: string) {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('sr_history')
    .select(`
      *,
      actor:profiles!sr_history_actor_id_fkey(full_name, email)
    `)
    .eq('request_id', requestId)
    .order('created_at', { ascending: false })

  if (error) return { error: error.message }
  return { data }
}

// 댓글 조회
export async function getRequestComments(requestId: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('sr_comments')
    .select(`
      *,
      author:profiles!sr_comments_author_id_fkey(full_name, email, role)
    `)
    .eq('request_id', requestId)
    .order('created_at', { ascending: true })

  if (error) return { error: error.message }
  return { data }
}

