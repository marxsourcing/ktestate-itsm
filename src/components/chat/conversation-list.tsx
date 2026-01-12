'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Plus, MessageSquare, Trash2, CheckCircle2, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { createConversation, deleteConversation } from '@/app/chat/actions'

interface Conversation {
  id: string
  title: string
  status: 'active' | 'confirmed' | 'archived'
  created_at: string
  updated_at: string
}

export function ConversationList() {
  const router = useRouter()
  const pathname = usePathname()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [isPending, startTransition] = useTransition()
  const [isLoading, setIsLoading] = useState(true)

  const currentConversationId = pathname.split('/chat/')[1]

  useEffect(() => {
    const supabase = createClient()
    let channel: ReturnType<typeof supabase.channel> | null = null

    async function loadConversations() {
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        setIsLoading(false)
        return
      }

      const { data } = await supabase
        .from('conversations')
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })

      if (data) {
        setConversations(data)
      }
      setIsLoading(false)
    }

    async function setup() {
      await loadConversations()

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // 실시간 구독 - 현재 사용자의 대화만
      channel = supabase
        .channel('my-conversations')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'conversations',
            filter: `user_id=eq.${user.id}`,
          },
          () => {
            loadConversations()
          }
        )
        .subscribe()
    }

    setup()

    return () => {
      if (channel) {
        supabase.removeChannel(channel)
      }
    }
  }, [])

  async function handleNewConversation() {
    startTransition(async () => {
      const result = await createConversation()
      if (result.id) {
        router.push(`/chat/${result.id}`)
      }
    })
  }

  async function handleDelete(e: React.MouseEvent, conversationId: string) {
    e.stopPropagation()
    if (!confirm('이 대화를 삭제하시겠습니까?')) return

    startTransition(async () => {
      await deleteConversation(conversationId)
      if (currentConversationId === conversationId) {
        router.push('/chat')
      }
    })
  }

  function formatDate(dateString: string) {
    const date = new Date(dateString)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))

    if (days === 0) return '오늘'
    if (days === 1) return '어제'
    if (days < 7) return `${days}일 전`
    return date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
  }

  return (
    <div className="flex h-full flex-col">
      {/* New conversation button */}
      <div className="p-3">
        <Button
          onClick={handleNewConversation}
          disabled={isPending}
          className="w-full justify-start gap-3 kt-gradient kt-shadow text-white hover:opacity-90"
        >
          {isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Plus className="size-4" />
          )}
          새 대화
        </Button>
      </div>

      {/* Conversation list */}
      <div className="flex-1 overflow-y-auto px-2">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="size-6 animate-spin text-gray-400" />
          </div>
        ) : conversations.length === 0 ? (
          <div className="px-3 py-8 text-center text-sm text-gray-500">
            대화가 없습니다.
            <br />새 대화를 시작해보세요!
          </div>
        ) : (
          <div className="space-y-1 pb-4">
            {conversations.map((conv) => (
              <div
                key={conv.id}
                onClick={() => router.push(`/chat/${conv.id}`)}
                className={cn(
                  'group flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 transition-colors',
                  currentConversationId === conv.id
                    ? 'bg-rose-50 text-rose-700'
                    : 'text-gray-700 hover:bg-gray-100'
                )}
              >
                <MessageSquare className="size-4 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium">
                      {conv.title}
                    </span>
                    {conv.status === 'confirmed' && (
                      <CheckCircle2 className="size-3.5 text-rose-500 shrink-0" />
                    )}
                  </div>
                  <span className="text-xs text-gray-400">
                    {formatDate(conv.updated_at)}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 hover:bg-transparent"
                  onClick={(e) => handleDelete(e, conv.id)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
