'use client'

import { useState, useCallback, useEffect } from 'react'
import { ChatMessages, Message } from '@/components/chat/chat-messages'
import { ChatInput } from '@/components/chat/chat-input'
import { createClient } from '@/lib/supabase/client'
import { addMessage, updateConversationTitle, createConversation } from '@/app/chat/actions'
import { Bot, Sparkles, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface RequestChatAreaProps {
  requestId: string
  conversationId?: string
  initialMessages: Message[]
  requestTitle: string
  requestDescription: string
}

// AI 활용 제안 옵션
const AI_SUGGESTIONS = [
  {
    icon: '🔍',
    title: '유사 사례 검색',
    description: '과거 비슷한 요청 찾기',
    prompt: '이 요청과 유사한 과거 사례가 있나요? 어떻게 처리되었는지 알려주세요.',
  },
  {
    icon: '📝',
    title: '답변 초안 작성',
    description: '요청자에게 보낼 답변',
    prompt: '이 요청에 대해 요청자에게 보낼 답변 초안을 작성해주세요.',
  },
  {
    icon: '📋',
    title: '처리 계획 수립',
    description: '단계별 처리 방법',
    prompt: '이 요청을 처리하기 위한 단계별 계획을 세워주세요.',
  },
  {
    icon: '⚠️',
    title: '위험 요소 분석',
    description: '주의해야 할 사항',
    prompt: '이 요청을 처리할 때 주의해야 할 위험 요소나 고려사항이 있나요?',
  },
]

export function RequestChatArea({ 
  requestId, 
  conversationId: initialConversationId,
  initialMessages, 
  requestTitle,
  requestDescription 
}: RequestChatAreaProps) {
  const [conversationId, setConversationId] = useState<string | undefined>(initialConversationId)
  const [messages, setMessages] = useState<Message[]>(initialMessages)
  const [isLoading, setIsLoading] = useState(false)

  // 실시간 메시지 구독
  useEffect(() => {
    if (!conversationId) return

    const supabase = createClient()
    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const newMessage = payload.new as Message
          setMessages((prev) => {
            if (prev.some((m) => m.id === newMessage.id)) {
              return prev
            }
            return [...prev, newMessage]
          })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [conversationId])

  const sendMessage = useCallback(async (content: string) => {
    setIsLoading(true)

    try {
      // 대화가 없으면 새로 생성
      let activeConversationId = conversationId
      if (!activeConversationId) {
        const result = await createConversation(requestTitle, requestId)
        if (result.error || !result.conversation) {
          throw new Error(result.error || '대화 생성 실패')
        }
        activeConversationId = result.conversation.id
        setConversationId(activeConversationId)
      }

      if (!activeConversationId) {
        throw new Error('대화 ID를 가져올 수 없습니다.')
      }

      // 사용자 메시지 추가
      const userResult = await addMessage(activeConversationId, 'user', content)
      if (userResult.message) {
        setMessages((prev) => [...prev, userResult.message as Message])
      }

      // AI 응답 요청 (요청 컨텍스트 포함)
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: activeConversationId,
          message: content,
          messages: [...messages, { role: 'user', content }],
          context: {
            type: 'request_assistant',
            requestId,
            requestTitle,
            requestDescription,
          },
        }),
      })

      if (!response.ok) {
        throw new Error('AI 응답 실패')
      }

      const aiResponse = await response.json()
      
      // AI 응답 메시지 추가
      const aiResult = await addMessage(
        activeConversationId,
        'assistant',
        aiResponse.content,
        aiResponse.metadata
      )

      if (aiResult.message) {
        setMessages((prev) => [...prev, aiResult.message as Message])
      }
    } catch (error) {
      console.error('메시지 전송 실패:', error)
      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: '죄송합니다. 일시적인 오류가 발생했습니다. 다시 시도해주세요.',
        created_at: new Date().toISOString(),
      }
      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }, [conversationId, messages, requestId, requestTitle, requestDescription])

  const handleSuggestionClick = (prompt: string) => {
    sendMessage(prompt)
  }

  return (
    <div className="flex h-full flex-col bg-gray-50">
      {/* Header */}
      <div className="flex-shrink-0 px-4 py-3 bg-white border-b border-gray-200">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-rose-500 to-rose-600 flex items-center justify-center">
            <Bot className="size-4 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">AI 어시스턴트</h3>
            <p className="text-xs text-gray-500">요청 처리에 도움을 드립니다</p>
          </div>
        </div>
      </div>

      {/* Messages or Empty State */}
      {messages.length === 0 && !isLoading ? (
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-2xl mx-auto">
            {/* Welcome Message */}
            <div className="text-center mb-8">
              <div className="inline-flex size-16 items-center justify-center rounded-2xl bg-gradient-to-br from-rose-100 to-rose-200 mb-4">
                <Sparkles className="size-8 text-rose-600" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                이 요청에 대해 도움이 필요하신가요?
              </h2>
              <p className="text-gray-500 text-sm">
                AI 어시스턴트가 요청 처리를 도와드립니다. 아래 옵션을 선택하거나 직접 질문해보세요.
              </p>
            </div>

            {/* Suggestion Cards */}
            <div className="grid grid-cols-2 gap-3">
              {AI_SUGGESTIONS.map((suggestion, index) => (
                <button
                  key={index}
                  onClick={() => handleSuggestionClick(suggestion.prompt)}
                  disabled={isLoading}
                  className={cn(
                    'p-4 rounded-xl border bg-white text-left transition-all group',
                    'hover:border-rose-300 hover:shadow-md hover:-translate-y-0.5',
                    'disabled:opacity-50 disabled:cursor-not-allowed'
                  )}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">{suggestion.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-900 group-hover:text-rose-600 transition-colors">
                        {suggestion.title}
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {suggestion.description}
                      </div>
                    </div>
                    <ArrowRight className="size-4 text-gray-300 group-hover:text-rose-400 group-hover:translate-x-1 transition-all" />
                  </div>
                </button>
              ))}
            </div>

            {/* Context Info */}
            <div className="mt-6 p-4 rounded-lg bg-rose-50 border border-rose-100">
              <p className="text-xs text-rose-600 font-medium mb-1">현재 요청 컨텍스트</p>
              <p className="text-sm text-gray-700 font-medium">{requestTitle}</p>
              <p className="text-xs text-gray-500 mt-1 line-clamp-2">{requestDescription}</p>
            </div>
          </div>
        </div>
      ) : (
        <ChatMessages
          messages={messages}
          isLoading={isLoading}
          excludeRequestId={requestId}
        />
      )}

      {/* Input */}
      <ChatInput
        onSend={sendMessage}
        disabled={false}
        isLoading={isLoading}
        placeholder="AI에게 질문하거나 도움을 요청하세요..."
      />
    </div>
  )
}

