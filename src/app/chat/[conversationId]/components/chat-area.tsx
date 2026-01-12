'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { ChatMessages, Message, RequirementData } from '@/components/chat/chat-messages'
import { ChatInput } from '@/components/chat/chat-input'
import { createClient } from '@/lib/supabase/client'
import { addMessage, updateConversationTitle } from '@/app/chat/actions'
import type { AttachmentData } from '@/app/chat/attachments'

interface ChatAreaProps {
  conversationId: string
  initialMessages: Message[]
  conversationStatus: string
}

export function ChatArea({ conversationId, initialMessages, conversationStatus }: ChatAreaProps) {
  const searchParams = useSearchParams()
  const [messages, setMessages] = useState<Message[]>(initialMessages)
  const [isLoading, setIsLoading] = useState(false)
  const initialMessageSentRef = useRef(false)
  const sendMessageRef = useRef<((content: string, attachments?: AttachmentData[]) => Promise<void>) | null>(null)

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

  // URL에서 초기 메시지 확인 및 전송
  useEffect(() => {
    const initialMessage = searchParams.get('message')
    if (initialMessage && !initialMessageSentRef.current && messages.length === 0 && sendMessageRef.current) {
      initialMessageSentRef.current = true
      sendMessageRef.current(initialMessage)
    }
  }, [searchParams, messages.length])

  const sendMessage = useCallback(async (content: string, attachments?: AttachmentData[]) => {
    if (conversationStatus === 'confirmed') return

    setIsLoading(true)

    console.log('sendMessage called, attachments:', attachments)

    try {
      // 사용자 메시지의 metadata (첨부파일 포함)
      const userMetadata = attachments && attachments.length > 0
        ? { attachments }
        : undefined

      console.log('userMetadata:', userMetadata)

      // 사용자 메시지 추가
      const userResult = await addMessage(conversationId, 'user', content, userMetadata)
      console.log('addMessage result:', userResult)
      if (userResult.message) {
        setMessages((prev) => [...prev, userResult.message as Message])
      }

      // 첫 메시지라면 대화 제목 업데이트
      if (messages.length === 0) {
        const title = content.length > 30 ? content.slice(0, 30) + '...' : content
        await updateConversationTitle(conversationId, title)
      }

      // AI 응답 요청 (스트리밍)
      const response = await fetch('/api/chat/stream', {
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
            url: a.url  // 이미지 URL 전달 (AI가 분석할 수 있도록)
          }))
        }),
      })

      if (!response.ok) {
        throw new Error('AI 응답 실패')
      }

      // 스트리밍 응답 처리
      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      
      // 스트리밍용 임시 메시지
      const streamingMessageId = `streaming-${Date.now()}`
      let streamedContent = ''
      let streamedMetadata: Record<string, unknown> | undefined

      // 스트리밍 메시지 추가
      setMessages((prev) => [...prev, {
        id: streamingMessageId,
        role: 'assistant' as const,
        content: '',
        created_at: new Date().toISOString(),
      }])

      if (reader) {
        let buffer = ''
        
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6)
              if (data === '[DONE]') continue

              try {
                const parsed = JSON.parse(data)
                if (parsed.type === 'content') {
                  streamedContent += parsed.data
                  // 메시지 업데이트
                  setMessages((prev) => prev.map(m => 
                    m.id === streamingMessageId 
                      ? { ...m, content: streamedContent }
                      : m
                  ))
                } else if (parsed.type === 'metadata') {
                  streamedMetadata = parsed.data
                }
              } catch (e) {
                // JSON 파싱 실패 무시
              }
            }
          }
        }
      }

      // 요구사항 카드 마크다운 제거 (화면에서)
      const cleanContent = streamedContent.replace(/```requirement[\s\S]*?```/g, '').trim()
      
      // 최종 메시지를 DB에 저장
      const aiResult = await addMessage(
        conversationId,
        'assistant',
        cleanContent,
        streamedMetadata
      )

      // 스트리밍 메시지를 실제 메시지로 교체
      if (aiResult.message) {
        setMessages((prev) => prev.map(m => 
          m.id === streamingMessageId 
            ? { ...(aiResult.message as Message), content: cleanContent }
            : m
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

  // sendMessage ref 업데이트
  useEffect(() => {
    sendMessageRef.current = sendMessage
  }, [sendMessage])

  const handleRequirementUpdate = useCallback((data: RequirementData) => {
    setMessages((prev) => {
      const lastCardIndex = prev.findLastIndex((m) => m.metadata?.requirementCard)
      if (lastCardIndex === -1) return prev

      const updated = [...prev]
      updated[lastCardIndex] = {
        ...updated[lastCardIndex],
        metadata: {
          ...updated[lastCardIndex].metadata,
          requirementCard: data,
        },
      }
      return updated
    })
  }, [])

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
