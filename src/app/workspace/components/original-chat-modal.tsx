'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { Bot, User, MessageSquare, Loader2, Eye } from 'lucide-react'

interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  created_at: string
}

interface Conversation {
  id: string
  title: string
  user?: {
    full_name?: string
    email: string
  }
}

interface OriginalChatModalProps {
  requestId: string
  requesterName?: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onChatExistsChange?: (exists: boolean) => void
}

export function OriginalChatModal({
  requestId,
  requesterName,
  open,
  onOpenChange,
  onChatExistsChange
}: OriginalChatModalProps) {
  const [conversation, setConversation] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const supabase = createClient()

  // 요청 ID가 변경될 때 원본 채팅 존재 여부 확인
  useEffect(() => {
    if (!requestId) {
      onChatExistsChange?.(false)
      return
    }

    const checkChatExists = async () => {
      const { count } = await supabase
        .from('conversations')
        .select('id', { count: 'exact', head: true })
        .eq('request_id', requestId)
        .eq('type', 'requester')

      onChatExistsChange?.((count ?? 0) > 0)
    }

    checkChatExists()
  }, [requestId, supabase, onChatExistsChange])

  // 모달이 닫히거나 requestId가 변경될 때 상태 초기화
  useEffect(() => {
    // 항상 상태 초기화 (requestId 변경 시 포함)
    setConversation(null)
    setMessages([])
    setIsLoading(true)
  }, [open, requestId])

  useEffect(() => {
    if (!open || !requestId) return

    const loadOriginalChat = async () => {
      try {
        // 요청에 연결된 요청자의 대화 조회
        const { data: conversationData, error: convError } = await supabase
          .from('conversations')
          .select(`
            id,
            title,
            user:profiles!conversations_user_id_fkey(full_name, email)
          `)
          .eq('request_id', requestId)
          .eq('type', 'requester')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (convError) {
          console.error('Conversation fetch error:', convError)
          return
        }

        if (conversationData) {
          // user가 배열로 반환되므로 첫 번째 요소 추출
          const userData = Array.isArray(conversationData.user)
            ? conversationData.user[0]
            : conversationData.user

          setConversation({
            id: conversationData.id,
            title: conversationData.title,
            user: userData
          })

          // 메시지 조회
          const { data: messagesData, error: msgError } = await supabase
            .from('messages')
            .select('id, role, content, created_at')
            .eq('conversation_id', conversationData.id)
            .order('created_at', { ascending: true })

          if (msgError) {
            console.error('Messages fetch error:', msgError)
          } else {
            setMessages(messagesData || [])
          }
        }
      } catch (error) {
        console.error('Load original chat error:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadOriginalChat()
  }, [open, requestId, supabase])

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('ko-KR', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl h-[80vh] flex flex-col p-0">
        <DialogHeader className="px-6 py-4 border-b bg-gradient-to-r from-blue-50 to-indigo-50">
          <DialogTitle className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-blue-100">
              <Eye className="size-5 text-blue-600" />
            </div>
            <div>
              <span className="text-lg">요청자 원본 채팅</span>
              <p className="text-sm font-normal text-gray-500 mt-0.5">
                {requesterName || '요청자'}님이 AI와 나눈 대화 (읽기 전용)
              </p>
            </div>
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 px-6 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="size-8 animate-spin text-blue-500" />
            </div>
          ) : !conversation ? (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <MessageSquare className="size-12 text-gray-300 mb-4" />
              <p className="text-gray-500">연결된 채팅 내역이 없습니다</p>
              <p className="text-sm text-gray-400 mt-1">
                요청자가 AI 채팅 없이 직접 요청을 생성했을 수 있습니다
              </p>
            </div>
          ) : (
            <div className="py-4 space-y-4">
              {/* Conversation Info */}
              <div className="p-3 rounded-lg bg-gray-50 border border-gray-200 mb-6">
                <p className="text-xs text-gray-500 mb-1">대화 제목</p>
                <p className="text-sm font-medium text-gray-800">
                  {conversation.title || '제목 없음'}
                </p>
              </div>

              {/* Messages */}
              {messages.length === 0 ? (
                <div className="text-center text-gray-500 py-8">
                  메시지가 없습니다
                </div>
              ) : (
                messages.map((message) => {
                  // 빈 메시지는 표시하지 않음
                  if (!message.content?.trim()) return null

                  return (
                    <div
                      key={message.id}
                      className={cn(
                        'flex gap-3',
                        message.role === 'user' ? 'justify-end' : 'justify-start'
                      )}
                    >
                      {message.role !== 'user' && (
                        <div className="flex size-8 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600">
                          <Bot className="size-4 text-white" />
                        </div>
                      )}
                      <div className="max-w-[80%]">
                        <div
                          className={cn(
                            'rounded-xl px-4 py-3',
                            message.role === 'user'
                              ? 'bg-blue-600 text-white'
                              : 'bg-white border border-gray-200 text-gray-800'
                          )}
                        >
                          <div className="text-sm whitespace-pre-wrap">
                            {message.content}
                          </div>
                        </div>
                        <p className={cn(
                          'text-xs text-gray-400 mt-1',
                          message.role === 'user' ? 'text-right' : 'text-left'
                        )}>
                          {formatTime(message.created_at)}
                        </p>
                      </div>
                      {message.role === 'user' && (
                        <div className="flex size-8 flex-shrink-0 items-center justify-center rounded-lg bg-gray-200">
                          <User className="size-4 text-gray-600" />
                        </div>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          )}
        </ScrollArea>

        {/* Footer */}
        <div className="px-6 py-3 border-t bg-amber-50">
          <p className="text-xs text-amber-700 flex items-center gap-2">
            <Eye className="size-3" />
            읽기 전용 - 요청자가 AI와 나눈 원본 대화를 확인할 수 있습니다
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
