'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function createConversation(
  title?: string, 
  requestId?: string, 
  type: 'requester' | 'manager' = 'requester'
) {
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
      type,
    })
    .select()
    .single()

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/chat')
  if (requestId) {
    revalidatePath(`/requests/${requestId}`)
    revalidatePath('/workspace')
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

export async function updateMessageMetadata(
  messageId: string,
  metadata: Record<string, unknown>
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: '로그인이 필요합니다.' }
  }

  // 메시지 소유권 확인 (대화를 통해)
  const { data: message } = await supabase
    .from('messages')
    .select('conversation_id')
    .eq('id', messageId)
    .single()

  if (!message) {
    return { error: '메시지를 찾을 수 없습니다.' }
  }

  const { data: conversation } = await supabase
    .from('conversations')
    .select('id')
    .eq('id', message.conversation_id)
    .eq('user_id', user.id)
    .single()

  if (!conversation) {
    return { error: '권한이 없습니다.' }
  }

  const { error } = await supabase
    .from('messages')
    .update({ metadata })
    .eq('id', messageId)

  if (error) {
    return { error: error.message }
  }

  return { success: true }
}

export async function confirmRequirement(
  conversationId: string,
  requirementData: {
    title: string
    description: string
    type: string
    system?: string
    system_id?: string
    module?: string
    module_id?: string
  }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: '로그인이 필요합니다.' }
  }

  // 시스템 이름 또는 코드로 system_id 조회
  let systemId = requirementData.system_id
  if (!systemId && requirementData.system) {
    // 1. 정확한 이름 매칭
    let { data: systemData } = await supabase
      .from('systems')
      .select('id')
      .eq('name', requirementData.system)
      .maybeSingle()

    // 2. 코드로 매칭 (예: "ERP" -> 전사적자원관리(ERP))
    if (!systemData) {
      const { data: systemByCode } = await supabase
        .from('systems')
        .select('id')
        .eq('code', requirementData.system.toUpperCase())
        .maybeSingle()
      systemData = systemByCode
    }

    // 3. 이름에 포함된 경우 (예: "ERP" -> 전사적자원관리(ERP))
    if (!systemData) {
      const { data: systemByPartial } = await supabase
        .from('systems')
        .select('id')
        .ilike('name', `%${requirementData.system}%`)
        .maybeSingle()
      systemData = systemByPartial
    }

    if (systemData) {
      systemId = systemData.id
    }
  }

  // 모듈 이름으로 module_id 조회
  let moduleId = requirementData.module_id
  if (!moduleId && requirementData.module && systemId) {
    const { data: moduleData } = await supabase
      .from('system_modules')
      .select('id')
      .eq('system_id', systemId)
      .eq('name', requirementData.module)
      .maybeSingle()

    if (moduleData) {
      moduleId = moduleData.id
    }
  }

  // 서비스 요청 생성
  const { data: request, error: reqError } = await supabase
    .from('service_requests')
    .insert({
      requester_id: user.id,
      title: requirementData.title,
      description: requirementData.description,
      type: requirementData.type || 'other',
      system_id: systemId,
      module_id: moduleId,
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

