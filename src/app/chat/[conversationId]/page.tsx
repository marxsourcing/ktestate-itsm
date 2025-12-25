import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ChatLayout } from '@/components/chat/chat-layout'
import { ConversationList } from '@/components/chat/conversation-list'
import { ChatArea } from './components/chat-area'
import { ActionBar } from './components/action-bar'

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
  const { data: messages } = await supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })

  return (
    <ChatLayout
      sidebar={<ConversationList />}
      actionBar={
        conversation.status !== 'confirmed' && (
          <ActionBar conversationId={conversationId} />
        )
      }
    >
      <ChatArea 
        conversationId={conversationId} 
        initialMessages={messages || []}
        conversationStatus={conversation.status}
      />
    </ChatLayout>
  )
}

