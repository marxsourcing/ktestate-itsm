import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ConversationClient } from './components/conversation-client'
import { AttachmentData } from '../attachments'
import { Message } from '@/components/chat/chat-messages'

interface Props {
  params: Promise<{
    conversationId: string
  }>
}

export default async function ConversationPage({ params }: Props) {
  const { conversationId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // 대화 정보 가져오기
  const { data: conversation, error: convError } = await supabase
    .from('conversations')
    .select('*')
    .eq('id', conversationId)
    .eq('user_id', user.id)
    .single()

  if (convError || !conversation) {
    notFound()
  }

  // 메시지 가져오기
  const { data: messagesRaw } = await supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })

  // 해당 대화의 모든 첨부파일 조회 및 Signed URL 생성
  const { data: attachmentsRaw } = await supabase
    .from('attachments')
    .select('*')
    .eq('conversation_id', conversationId)

  const attachmentMap = new Map<string, string>()
  if (attachmentsRaw && attachmentsRaw.length > 0) {
    await Promise.all(attachmentsRaw.map(async (att) => {
      const { data } = await supabase.storage
        .from('attachments')
        .createSignedUrl(att.storage_path, 3600)
      if (data?.signedUrl) {
        attachmentMap.set(att.id, data.signedUrl)
      }
    }))
  }

  // 메시지 메타데이터의 첨부파일 URL 갱신
  const messages = (messagesRaw || []).map(msg => {
    if (!msg.metadata) return msg

    const metadata = { ...msg.metadata } as any
    let hasChanges = false

    // 1. 일반 메시지 첨부파일 갱신
    if (metadata.attachments && Array.isArray(metadata.attachments)) {
      metadata.attachments = metadata.attachments.map((att: any) => ({
        ...att,
        url: attachmentMap.get(att.id) || att.url
      }))
      hasChanges = true
    }

    // 2. 요구사항 카드 내 첨부파일 갱신
    if (metadata.requirementCard?.attachments && Array.isArray(metadata.requirementCard.attachments)) {
      metadata.requirementCard = {
        ...metadata.requirementCard,
        attachments: metadata.requirementCard.attachments.map((att: any) => ({
          ...att,
          url: attachmentMap.get(att.id) || att.url
        }))
      }
      hasChanges = true
    }

    return hasChanges ? { ...msg, metadata } : msg
  })

  return (
    <ConversationClient
      conversation={conversation}
      initialMessages={messages as Message[]}
    />
  )
}
