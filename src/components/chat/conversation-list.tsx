'use client'

import { useEffect, useState, useTransition, useMemo } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { 
  Plus, 
  MessageSquare, 
  Trash2, 
  Loader2, 
  ChevronDown, 
  ChevronRight, 
  Clock, 
  CheckCircle, 
  Send, 
  XCircle 
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { createClient } from '@/lib/supabase/client'
import { createConversation, deleteConversation } from '@/app/chat/actions'

interface Conversation {
  id: string
  title: string
  status: 'active' | 'confirmed' | 'archived'
  request_id: string | null
  created_at: string
  updated_at: string
  service_requests?: {
    status: string
  } | null
}

type GroupedConversations = {
  [key: string]: Conversation[]
}

const STATUS_GROUPS = [
  { id: 'draft', label: '작성중', icon: Clock, color: 'text-gray-500' },
  { id: 'requested', label: '요청', icon: Send, color: 'text-amber-500' },
  { id: 'in_progress', label: '진행중', icon: Loader2, color: 'text-blue-500' },
  { id: 'completed', label: '완료', icon: CheckCircle, color: 'text-emerald-500' },
  { id: 'rejected', label: '반려', icon: XCircle, color: 'text-rose-500' },
]

const GET_STATUS_TAG = (status: string | undefined) => {
  if (!status) return null
  switch (status) {
    case 'requested': return { label: '요청', color: 'bg-amber-100 text-amber-700' }
    case 'completed': return { label: '완료', color: 'bg-emerald-100 text-emerald-700' }
    case 'rejected': return { label: '반려', color: 'bg-rose-100 text-rose-700' }
    default:
      if (['approved', 'consulting', 'accepted', 'processing', 'test_requested', 'test_completed', 'deploy_requested', 'deploy_approved'].includes(status)) {
        return { label: '진행중', color: 'bg-blue-100 text-blue-700' }
      }
      return null
  }
}

export function ConversationList() {
  const router = useRouter()
  const pathname = usePathname()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [isPending, startTransition] = useTransition()
  const [isLoading, setIsLoading] = useState(true)
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    draft: true,
    requested: true,
    in_progress: true,
    completed: false,
    rejected: false,
  })

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
        .select('*, service_requests(status)')
        .eq('user_id', user.id)
        .is('deleted_at', null)
        .order('updated_at', { ascending: false })

      if (data) {
        setConversations(data as any)
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

  const groupedConversations = useMemo(() => {
    const grouped: GroupedConversations = {
      draft: [],
      requested: [],
      in_progress: [],
      completed: [],
      rejected: [],
    }

    conversations.forEach(conv => {
      const status = conv.service_requests?.status
      if (!status) {
        grouped.draft.push(conv)
      } else if (status === 'requested') {
        grouped.requested.push(conv)
      } else if (status === 'completed') {
        grouped.completed.push(conv)
      } else if (status === 'rejected') {
        grouped.rejected.push(conv)
      } else {
        grouped.in_progress.push(conv)
      }
    })

    return grouped
  }, [conversations])

  const toggleGroup = (groupId: string) => {
    setExpandedGroups(prev => ({
      ...prev,
      [groupId]: !prev[groupId]
    }))
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
      <div className="flex-1 overflow-y-auto px-2 space-y-4 pb-4">
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
          STATUS_GROUPS.map(group => {
            const items = groupedConversations[group.id] || []
            if (items.length === 0 && group.id !== 'draft') return null
            if (items.length === 0 && group.id === 'draft' && conversations.length > 0) return null

            const isExpanded = expandedGroups[group.id]
            const GroupIcon = group.icon

            return (
              <div key={group.id} className="space-y-1">
                <button
                  onClick={() => toggleGroup(group.id)}
                  className="flex w-full items-center gap-2 px-2 py-1.5 text-xs font-semibold text-gray-500 hover:bg-gray-100 rounded-md transition-colors group"
                >
                  {isExpanded ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
                  <GroupIcon className={cn("size-3.5", group.color, group.id === 'in_progress' && items.length > 0 && "animate-spin-slow")} />
                  <span className="flex-1 text-left">{group.label}</span>
                  <Badge variant="secondary" className="px-1.5 py-0 h-4 text-[10px] bg-gray-100 text-gray-500 border-none group-hover:bg-white">
                    {items.length}
                  </Badge>
                </button>

                {isExpanded && (
                  <div className="space-y-0.5">
                    {items.map((conv) => {
                      const statusTag = GET_STATUS_TAG(conv.service_requests?.status)
                      return (
                        <div
                          key={conv.id}
                          onClick={() => router.push(`/chat/${conv.id}`)}
                          className={cn(
                            'group flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 transition-colors relative',
                            currentConversationId === conv.id
                              ? 'bg-rose-50 text-rose-700 ring-1 ring-rose-200/50'
                              : 'text-gray-700 hover:bg-gray-50'
                          )}
                        >
                          <MessageSquare className={cn(
                            "size-3.5 shrink-0",
                            currentConversationId === conv.id ? "text-rose-500" : "text-gray-400"
                          )} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 mb-0.5">
                              <span className="truncate text-[13px] font-medium leading-tight">
                                {conv.title || '새 대화'}
                              </span>
                              {statusTag && (
                                <span className={cn(
                                  "shrink-0 text-[9px] px-1 rounded font-bold leading-none py-0.5",
                                  statusTag.color
                                )}>
                                  {statusTag.label}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] text-gray-400">
                                {formatDate(conv.updated_at)}
                              </span>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 hover:bg-transparent h-6 w-6 shrink-0"
                            onClick={(e) => handleDelete(e, conv.id)}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
