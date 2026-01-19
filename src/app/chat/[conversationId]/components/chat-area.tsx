'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { ChatMessages, Message } from '@/components/chat/chat-messages'
import { RequirementData } from '@/components/chat/requirement-card'
import { ChatInput } from '@/components/chat/chat-input'
import { createClient } from '@/lib/supabase/client'
import { addMessage, updateConversationTitle } from '@/app/chat/actions'
import type { AttachmentData } from '@/app/chat/attachments'
import { cn } from '@/lib/utils'

interface ChatAreaProps {
  conversationId: string
  messages: Message[]
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>
  conversationStatus: string
  linkedRequestId?: string | null  // 이 대화에 연결된 요청 ID (확정된 경우)
  onRequirementUpdate: (data: RequirementData) => void
}

export function ChatArea({ 
  conversationId, 
  messages, 
  setMessages, 
  conversationStatus, 
  linkedRequestId,
  onRequirementUpdate
}: ChatAreaProps) {
  const searchParams = useSearchParams()
  const [isLocalLoading, setIsLocalLoading] = useState(false)
  const initialMessageSentRef = useRef(false)

  // 실시간 메시지 구독
  useEffect(() => {
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
  }, [conversationId, setMessages])

  const sendMessage = useCallback(async (content: string, attachments?: AttachmentData[]) => {
    if (conversationStatus === 'confirmed') return

    setIsLocalLoading(true)

    try {
      // 사용자 메시지의 metadata (첨부파일 포함)
      const userMetadata = attachments && attachments.length > 0
        ? { attachments }
        : undefined

      // 사용자 메시지 추가
      const userResult = await addMessage(conversationId, 'user', content, userMetadata)
      if (userResult.message) {
        setMessages((prev) => [...prev, userResult.message as Message])
      }

      // 첫 메시지라면 대화 제목 업데이트
      if (messages.length === 0) {
        const title = content.length > 30 ? content.slice(0, 30) + '...' : content
        await updateConversationTitle(conversationId, title)
      }

      // AI 응답 요청 (일반 JSON 방식)
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId,
          message: content,
          messages: [...messages, { role: 'user', content }],
          attachments: attachments?.map(a => ({
            file_name: a.file_name,
            file_type: a.file_type,
            file_size: a.file_size,
            url: a.url
          }))
        }),
      })

      if (!response.ok) {
        throw new Error('AI 응답 실패')
      }

      const data = await response.json()
      const aiContent = data.content || ''
      const aiMetadata = data.metadata || {}

      // AI 메시지 추가 (로컬 상태)
      const tempAiMessageId = `ai-${Date.now()}`
      setMessages((prev) => [...prev, {
        id: tempAiMessageId,
        role: 'assistant',
        content: aiContent,
        metadata: aiMetadata,
        created_at: new Date().toISOString(),
      }])

      // 최종 메시지를 DB에 저장
      const aiResult = await addMessage(
        conversationId,
        'assistant',
        aiContent,
        aiMetadata
      )

      // 임시 ID를 실제 DB ID로 교체
      if (aiResult.message) {
        setMessages((prev) => prev.map(m => 
          m.id === tempAiMessageId ? (aiResult.message as Message) : m
        ))
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
      setIsLocalLoading(false)
    }
  }, [conversationId, messages, conversationStatus, setMessages])

  // URL에서 초기 메시지 확인 및 전송
  useEffect(() => {
    const initialMessage = searchParams.get('message')
    if (initialMessage && !initialMessageSentRef.current && messages.length === 0) {
      initialMessageSentRef.current = true
      sendMessage(initialMessage)
    }
  }, [searchParams, messages.length, sendMessage])

  const isConfirmed = conversationStatus === 'confirmed'

  return (
    <div className="flex h-full flex-col bg-white">
      {/* Messages or empty state */}
      {messages.length === 0 && !isLocalLoading ? (
        <div className="flex flex-1 flex-col items-center justify-center px-4 bg-gray-50">
          <div className="max-w-md text-center">
            <div className="mb-6 inline-flex size-16 items-center justify-center rounded-2xl bg-linear-to-br from-rose-500 to-rose-600 shadow-lg shadow-rose-200">
              <span className="text-xl font-bold text-white">KT</span>
            </div>
            <h2 className="mb-3 text-2xl font-semibold text-gray-900">
              무엇을 도와드릴까요?
            </h2>
            <p className="text-gray-500 leading-relaxed">
              IT 시스템에 대한 요구사항이나 개선 사항을 자유롭게 말씀해주세요.
            </p>
          </div>
        </div>
      ) : (
        <ChatMessages
          messages={messages}
          isLoading={isLocalLoading}
          onRequirementUpdate={onRequirementUpdate}
          excludeRequestId={linkedRequestId || undefined}
          hideCards={true} // 중앙 채팅에서는 카드 숨김 (우측 패널에서만 노출)
        />
      )}

      {/* Input */}
      <div className={cn(
        "p-4 border-t transition-colors duration-300",
        isConfirmed ? "bg-gray-50 border-gray-200" : "bg-white border-gray-100"
      )}>
        <ChatInput
          onSend={sendMessage}
          disabled={isConfirmed}
          isLoading={isLocalLoading}
          placeholder={
            isConfirmed
              ? '요구사항이 확정되어 더 이상 대화할 수 없습니다.'
              : 'IT 시스템에 대한 요구사항을 입력하세요...'
          }
        />
        {isConfirmed && linkedRequestId && (
          <div className="mt-2 text-center">
            <p className="text-xs text-gray-400">
              이미 확정된 요청입니다. 상세 내용은 <a href={`/requests/${linkedRequestId}`} className="text-rose-500 hover:underline font-medium">요청 상세 페이지</a>에서 확인하세요.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
