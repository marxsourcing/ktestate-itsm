'use server'

import { createClient } from '@/lib/supabase/server'

export interface AttachmentData {
  id: string
  file_name: string
  file_size: number
  file_type: string
  storage_path: string
  url?: string
  created_at: string
}

export async function uploadAttachment(
  formData: FormData,
  messageId?: string,
  requestId?: string,
  commentId?: string,
  conversationId?: string
): Promise<{ attachment?: AttachmentData; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: '로그인이 필요합니다.' }
  }

  const file = formData.get('file') as File
  if (!file) {
    return { error: '파일이 없습니다.' }
  }

  // 파일 크기 제한 (50MB)
  if (file.size > 50 * 1024 * 1024) {
    return { error: '파일 크기는 50MB를 초과할 수 없습니다.' }
  }

  // 허용된 파일 타입
  const allowedTypes = [
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain', 'text/csv'
  ]

  if (!allowedTypes.includes(file.type)) {
    return { error: '지원하지 않는 파일 형식입니다.' }
  }

  // 고유한 파일 경로 생성
  const timestamp = Date.now()
  const extension = file.name.split('.').pop() || ''
  const safeName = `file_${timestamp}.${extension}`
  const storagePath = `${user.id}/${safeName}`

  // File을 ArrayBuffer로 변환
  const arrayBuffer = await file.arrayBuffer()
  const fileBuffer = new Uint8Array(arrayBuffer)

  const { error: uploadError } = await supabase.storage
    .from('attachments')
    .upload(storagePath, fileBuffer, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type
    })

  if (uploadError) {
    return { error: `파일 업로드에 실패했습니다: ${uploadError.message}` }
  }

  // attachments 테이블에 기록
  const { data: attachment, error: dbError } = await supabase
    .from('attachments')
    .insert({
      message_id: messageId || null,
      request_id: requestId || null,
      comment_id: commentId || null,
      conversation_id: conversationId || null,
      file_name: file.name,
      file_size: file.size,
      file_type: file.type,
      storage_path: storagePath,
      uploaded_by: user.id
    })
    .select()
    .single()

  if (dbError) {
    await supabase.storage.from('attachments').remove([storagePath])
    return { error: `파일 정보 저장에 실패했습니다: ${dbError.message}` }
  }

  // Signed URL 생성
  const { data: urlData } = await supabase.storage
    .from('attachments')
    .createSignedUrl(storagePath, 3600)

  return {
    attachment: {
      ...attachment,
      url: urlData?.signedUrl
    }
  }
}

export async function getAttachmentUrl(storagePath: string): Promise<{ url?: string; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: '로그인이 필요합니다.' }
  }

  const { data, error } = await supabase.storage
    .from('attachments')
    .createSignedUrl(storagePath, 3600)

  if (error) {
    return { error: '파일 URL 생성에 실패했습니다.' }
  }

  return { url: data.signedUrl }
}

export async function deleteAttachment(attachmentId: string): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: '로그인이 필요합니다.' }
  }

  const { data: attachment, error: fetchError } = await supabase
    .from('attachments')
    .select('*')
    .eq('id', attachmentId)
    .eq('uploaded_by', user.id)
    .single()

  if (fetchError || !attachment) {
    return { error: '파일을 찾을 수 없습니다.' }
  }

  await supabase.storage.from('attachments').remove([attachment.storage_path])

  const { error: dbError } = await supabase
    .from('attachments')
    .delete()
    .eq('id', attachmentId)

  if (dbError) {
    return { error: '파일 삭제에 실패했습니다.' }
  }

  return { success: true }
}

export async function getMessageAttachments(messageId: string): Promise<{ attachments?: AttachmentData[]; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: '로그인이 필요합니다.' }
  }

  const { data: attachments, error } = await supabase
    .from('attachments')
    .select('*')
    .eq('message_id', messageId)
    .order('created_at', { ascending: true })

  if (error) {
    return { error: '첨부파일 조회에 실패했습니다.' }
  }

  const attachmentsWithUrls = await Promise.all(
    attachments.map(async (att) => {
      const { data } = await supabase.storage
        .from('attachments')
        .createSignedUrl(att.storage_path, 3600)
      return { ...att, url: data?.signedUrl }
    })
  )

  return { attachments: attachmentsWithUrls }
}
