'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { ChatMessages, Message, RequirementData } from '@/components/chat/chat-messages'
import { ChatInput } from '@/components/chat/chat-input'
import { createClient } from '@/lib/supabase/client'
import { addMessage, updateConversationTitle, updateMessageMetadata } from '@/app/chat/actions'
import type { AttachmentData } from '@/app/chat/attachments'

interface ChatAreaProps {
  conversationId: string
  initialMessages: Message[]
  conversationStatus: string
  linkedRequestId?: string | null  // 이 대화에 연결된 요청 ID (확정된 경우)
}

export function ChatArea({ conversationId, initialMessages, conversationStatus, linkedRequestId }: ChatAreaProps) {
  const searchParams = useSearchParams()
  const [messages, setMessages] = useState<Message[]>(initialMessages)
  const [isLoading, setIsLoading] = useState(false)
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
  }, [conversationId])

  const sendMessage = useCallback(async (content: string, attachments?: AttachmentData[]) => {
    if (conversationStatus === 'confirmed') return

    setIsLoading(true)

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

      // AI 응답 요청 (일반 JSON 방식 - 배포 환경 안정성 확보)
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
      setIsLoading(false)
    }
  }, [conversationId, messages, conversationStatus])

  // URL에서 초기 메시지 확인 및 전송 (함수 준비 시점 최적화)
  useEffect(() => {
    const initialMessage = searchParams.get('message')
    if (initialMessage && !initialMessageSentRef.current && messages.length === 0) {
      initialMessageSentRef.current = true
      sendMessage(initialMessage)
    }
  }, [searchParams, messages.length, sendMessage])

  // 요구사항 카드 편집 핸들러
  const handleRequirementUpdate = useCallback(async (data: RequirementData) => {
    // 마지막 요구사항 카드가 있는 메시지 찾기
    const lastCardMessage = messages.findLast((m) => m.metadata?.requirementCard)
    if (!lastCardMessage) return

    const messageId = lastCardMessage.id
    const updatedMetadata = {
      ...lastCardMessage.metadata,
      requirementCard: data,
    }

    // 로컬 상태 업데이트
    setMessages((prev) => {
      const lastCardIndex = prev.findLastIndex((m) => m.metadata?.requirementCard)
      if (lastCardIndex === -1) return prev

      const updated = [...prev]
      updated[lastCardIndex] = {
        ...updated[lastCardIndex],
        metadata: updatedMetadata,
      }
      return updated
    })

    // DB 업데이트
    if (!messageId.startsWith('ai-') && !messageId.startsWith('error-')) {
      const result = await updateMessageMetadata(messageId, updatedMetadata)
      if (result.error) {
        console.error('메타데이터 저장 실패:', result.error)
      }
    }
  }, [messages])

  const isConfirmed = conversationStatus === 'confirmed'

  return (
    <div className="flex h-full flex-col">
      {/* Messages or empty state */}
      {messages.length === 0 && !isLoading ? (
        <div className="flex flex-1 flex-col items-center justify-center px-4">
          <div className="max-w-md text-center">
            <div className="mb-6 inline-flex size-16 items-center justify-center rounded-2xl kt-gradient shadow-lg kt-shadow">
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
          isLoading={isLoading}
          onRequirementUpdate={handleRequirementUpdate}
          excludeRequestId={linkedRequestId || undefined}
        />
      )}

      {/* Input */}
      <ChatInput
        onSend={sendMessage}
        disabled={isConfirmed}
        isLoading={isLoading}
        placeholder={
          isConfirmed
            ? '이 대화는 요구사항으로 확정되어 수정할 수 없습니다.'
            : 'IT 시스템에 대한 요구사항을 입력하세요...'
        }
      />
    </div>
  )
}
