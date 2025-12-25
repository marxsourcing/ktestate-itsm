'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function createConversation(title?: string, requestId?: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: '로그인이 필요합니다.' }
  }

  const { data, error } = await supabase
    .from('conversations')
    .insert({
      user_id: user.id,
      title: title || '새 대화',
      request_id: requestId || null,
    })
    .select()
    .single()

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/chat')
  if (requestId) {
    revalidatePath(`/requests/${requestId}`)
  }
  return { id: data.id, conversation: data }
}

export async function deleteConversation(conversationId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: '로그인이 필요합니다.' }
  }

  const { error } = await supabase
    .from('conversations')
    .delete()
    .eq('id', conversationId)
    .eq('user_id', user.id)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/chat')
  return { success: true }
}

export async function updateConversationTitle(conversationId: string, title: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: '로그인이 필요합니다.' }
  }

  const { error } = await supabase
    .from('conversations')
    .update({ title, updated_at: new Date().toISOString() })
    .eq('id', conversationId)
    .eq('user_id', user.id)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/chat')
  return { success: true }
}

export async function getConversation(conversationId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: '로그인이 필요합니다.' }
  }

  const { data: conversation, error: convError } = await supabase
    .from('conversations')
    .select('*')
    .eq('id', conversationId)
    .eq('user_id', user.id)
    .single()

  if (convError) {
    return { error: convError.message }
  }

  const { data: messages, error: msgError } = await supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })

  if (msgError) {
    return { error: msgError.message }
  }

  return { conversation, messages }
}

export async function addMessage(
  conversationId: string,
  role: 'user' | 'assistant' | 'system',
  content: string,
  metadata?: Record<string, unknown>
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: '로그인이 필요합니다.' }
  }

  // 대화 소유권 확인
  const { data: conversation } = await supabase
    .from('conversations')
    .select('id')
    .eq('id', conversationId)
    .eq('user_id', user.id)
    .single()

  if (!conversation) {
    return { error: '대화를 찾을 수 없습니다.' }
  }

  const { data, error } = await supabase
    .from('messages')
    .insert({
      conversation_id: conversationId,
      role,
      content,
      metadata,
    })
    .select()
    .single()

  if (error) {
    return { error: error.message }
  }

  // 대화 updated_at 갱신
  await supabase
    .from('conversations')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', conversationId)

  return { message: data }
}

export async function confirmRequirement(
  conversationId: string,
  requirementData: {
    title: string
    description: string
    type: string
    system_id?: string
  }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: '로그인이 필요합니다.' }
  }

  // 서비스 요청 생성
  const { data: request, error: reqError } = await supabase
    .from('service_requests')
    .insert({
      requester_id: user.id,
      title: requirementData.title,
      description: requirementData.description,
      type: requirementData.type || 'other',
      system_id: requirementData.system_id,
      status: 'requested',
      priority: 'medium',
    })
    .select()
    .single()

  if (reqError) {
    return { error: reqError.message }
  }

  // 대화 상태를 confirmed로 변경하고 request_id 연결
  const { error: convError } = await supabase
    .from('conversations')
    .update({
      status: 'confirmed',
      request_id: request.id,
      updated_at: new Date().toISOString(),
    })
    .eq('id', conversationId)
    .eq('user_id', user.id)

  if (convError) {
    return { error: convError.message }
  }

  revalidatePath('/chat')
  revalidatePath('/requests')

  return { request }
}

