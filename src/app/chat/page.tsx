import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ChatLayout } from '@/components/chat/chat-layout'
import { ConversationList } from '@/components/chat/conversation-list'
import { EmptyChatArea } from './components/empty-chat-area'

export default async function ChatPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return (
    <ChatLayout
      sidebar={<ConversationList />}
    >
      <EmptyChatArea />
    </ChatLayout>
  )
}
