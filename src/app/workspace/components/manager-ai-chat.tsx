'use client'

import { useState, useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Bot,
  Send,
  Loader2,
  User,
  Sparkles,
  FileSearch,
  FileText,
  ClipboardList,
  AlertTriangle
} from 'lucide-react'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  created_at: string
}

interface RequestContext {
  title: string
  description: string
  type: string
  priority: string
  requesterName?: string
  systemName?: string
  moduleName?: string
}

interface ManagerAiChatProps {
  requestId: string
  requestContext: RequestContext
  onChatHistoryChange?: (messages: ChatMessage[]) => void
}

const QUICK_PROMPTS = [
  { icon: FileSearch, label: '유사 사례', prompt: '이 요청과 유사한 과거 사례를 찾아주세요' },
  { icon: FileText, label: '답변 초안', prompt: '요청자에게 보낼 답변 초안을 작성해주세요' },
  { icon: ClipboardList, label: '처리 계획', prompt: '이 요청의 처리 계획을 세워주세요' },
  { icon: AlertTriangle, label: '주의사항', prompt: '처리 시 주의해야 할 사항을 알려주세요' },
]

export function ManagerAiChat({ requestId, requestContext, onChatHistoryChange }: ManagerAiChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isInitialLoading, setIsInitialLoading] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // 기존 대화 내역 로드
  useEffect(() => {
    const loadMessages = async () => {
      try {
        const response = await fetch(`/api/ai/manager-chat?requestId=${requestId}`)
        if (response.ok) {
          const data = await response.json()
          setMessages(data.messages || [])
        }
      } catch (error) {
        console.error('Failed to load messages:', error)
      } finally {
        setIsInitialLoading(false)
      }
    }
    loadMessages()
  }, [requestId])

  // 메시지 변경 시 부모 컴포넌트에 알림
  useEffect(() => {
    if (onChatHistoryChange) {
      onChatHistoryChange(messages)
    }
  }, [messages, onChatHistoryChange])

  // 스크롤 자동 이동
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async (messageText: string) => {
    if (!messageText.trim() || isLoading) return

    const userMessage: ChatMessage = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content: messageText.trim(),
      created_at: new Date().toISOString()
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    try {
      const response = await fetch('/api/ai/manager-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId,
          message: messageText.trim(),
          requestContext
        })
      })

      if (!response.ok) {
        throw new Error('API 요청 실패')
      }

      const data = await response.json()

      const aiMessage: ChatMessage = {
        id: `ai-${Date.now()}`,
        role: 'assistant',
        content: data.content,
        created_at: new Date().toISOString()
      }

      setMessages(prev => [...prev, aiMessage])
    } catch (error) {
      console.error('Send message error:', error)
      // 에러 메시지 추가
      const errorMessage: ChatMessage = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: '죄송합니다. 응답 생성 중 오류가 발생했습니다. 다시 시도해주세요.',
        created_at: new Date().toISOString()
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    sendMessage(input)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  const handleQuickPrompt = (prompt: string) => {
    sendMessage(prompt)
  }

  if (isInitialLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="size-6 animate-spin text-indigo-500" />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 bg-white border-b">
        <div className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600">
          <Bot className="size-4 text-white" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-gray-900">AI 협업 채팅</h3>
          <p className="text-xs text-gray-500">🔒 내부 전용 (요청자 비공개)</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-8">
            <div className="flex size-16 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-100 to-purple-100 mb-4">
              <Sparkles className="size-8 text-indigo-600" />
            </div>
            <h4 className="font-semibold text-gray-900 mb-2">AI 어시스턴트</h4>
            <p className="text-sm text-gray-500 mb-6 max-w-xs">
              요청 처리에 도움이 필요하시면 아래 버튼을 클릭하거나 직접 질문해주세요
            </p>

            {/* Quick Prompts */}
            <div className="grid grid-cols-2 gap-2 w-full max-w-xs">
              {QUICK_PROMPTS.map((item) => (
                <button
                  key={item.label}
                  onClick={() => handleQuickPrompt(item.prompt)}
                  className="flex items-center gap-2 p-3 rounded-lg border border-gray-200 bg-white hover:bg-indigo-50 hover:border-indigo-200 transition-colors text-left"
                >
                  <item.icon className="size-4 text-indigo-600" />
                  <span className="text-sm text-gray-700">{item.label}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  'flex gap-3',
                  message.role === 'user' ? 'justify-end' : 'justify-start'
                )}
              >
                {message.role === 'assistant' && (
                  <div className="flex size-8 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600">
                    <Bot className="size-4 text-white" />
                  </div>
                )}
                <div
                  className={cn(
                    'max-w-[80%] rounded-xl px-4 py-3',
                    message.role === 'user'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-white border border-gray-200 text-gray-800'
                  )}
                >
                  <div className="text-sm whitespace-pre-wrap">{message.content}</div>
                </div>
                {message.role === 'user' && (
                  <div className="flex size-8 flex-shrink-0 items-center justify-center rounded-lg bg-gray-200">
                    <User className="size-4 text-gray-600" />
                  </div>
                )}
              </div>
            ))}

            {isLoading && (
              <div className="flex gap-3">
                <div className="flex size-8 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600">
                  <Bot className="size-4 text-white" />
                </div>
                <div className="bg-white border border-gray-200 rounded-xl px-4 py-3">
                  <Loader2 className="size-5 animate-spin text-indigo-500" />
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Quick Prompts (when messages exist) */}
      {messages.length > 0 && (
        <div className="px-4 pb-2">
          <div className="flex gap-2 overflow-x-auto pb-2">
            {QUICK_PROMPTS.map((item) => (
              <button
                key={item.label}
                onClick={() => handleQuickPrompt(item.prompt)}
                disabled={isLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-gray-200 bg-white hover:bg-indigo-50 hover:border-indigo-200 transition-colors text-xs whitespace-nowrap disabled:opacity-50"
              >
                <item.icon className="size-3 text-indigo-600" />
                <span className="text-gray-700">{item.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-4 bg-white border-t">
        <div className="flex gap-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="AI에게 질문하세요..."
            rows={1}
            className="flex-1 resize-none rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 focus:outline-none"
            disabled={isLoading}
          />
          <Button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="bg-indigo-600 hover:bg-indigo-700"
          >
            {isLoading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Send className="size-4" />
            )}
          </Button>
        </div>
      </form>
    </div>
  )
}
