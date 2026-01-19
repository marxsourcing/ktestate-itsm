'use client'

import { useState, useCallback, useMemo } from 'react'
import { ChatLayout } from '@/components/chat/chat-layout'
import { ConversationList } from '@/components/chat/conversation-list'
import { ChatArea } from './chat-area'
import { RequirementCard, RequirementData } from '@/components/chat/requirement-card'
import { Message } from '@/components/chat/chat-messages'
import { updateMessageMetadata } from '@/app/chat/actions'

interface ConversationClientProps {
  conversation: {
    id: string
    status: string
    request_id?: string | null
  }
  initialMessages: Message[]
}

export function ConversationClient({ conversation, initialMessages }: ConversationClientProps) {
  const [messages, setMessages] = useState<Message[]>(initialMessages)

  // 최신 요구사항 분석 결과 추출 (메시지 목록에서 역순으로 검색)
  const latestRequirementData = useMemo(() => {
    const lastCardMessage = [...messages].reverse().find(m => m.metadata?.requirementCard)
    return lastCardMessage?.metadata?.requirementCard || null
  }, [messages])

  // 요구사항 카드 업데이트 핸들러 (ChatArea와 공유)
  const handleRequirementUpdate = useCallback(async (data: RequirementData) => {
    const lastCardMessage = [...messages].reverse().find((m) => m.metadata?.requirementCard)
    if (!lastCardMessage) return

    const messageId = lastCardMessage.id
    const updatedMetadata = {
      ...lastCardMessage.metadata,
      requirementCard: data,
    }

    // 1. 로컬 상태 즉시 업데이트 (동기화 핵심)
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

    // 2. DB 저장
    if (!messageId.startsWith('ai-') && !messageId.startsWith('error-')) {
      const result = await updateMessageMetadata(messageId, updatedMetadata)
      if (result.error) {
        console.error('메타데이터 저장 실패:', result.error)
      }
    }
  }, [messages])

  return (
    <ChatLayout
      sidebar={<ConversationList />}
      rightSidebar={
        <div className="flex flex-col h-full overflow-hidden bg-white">
          <div className="p-4 border-b border-gray-200 bg-gray-50 shrink-0">
            <h3 className="font-bold text-gray-900 flex items-center gap-2">
              <div className="w-1 h-4 bg-rose-500 rounded-full" />
              요청/문의사항 분석 결과
            </h3>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            <RequirementCard 
              data={latestRequirementData || {}} 
              conversationId={conversation.id}
              onUpdate={handleRequirementUpdate}
              readOnly={conversation.status === 'confirmed'}
              excludeRequestId={conversation.request_id || undefined}
            />
          </div>
        </div>
      }
    >
      <ChatArea
        conversationId={conversation.id}
        messages={messages}
        setMessages={setMessages}
        conversationStatus={conversation.status}
        linkedRequestId={conversation.request_id}
        onRequirementUpdate={handleRequirementUpdate}
      />
    </ChatLayout>
  )
}
