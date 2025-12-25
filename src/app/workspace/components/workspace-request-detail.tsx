'use client'

import { useState, useEffect, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { 
  User, 
  Calendar, 
  Server, 
  Tag,
  Clock,
  Bot,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  Play,
  Send,
  MessageSquare,
  FileText,
  AlertTriangle,
  Link as LinkIcon
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChatMessages, Message } from '@/components/chat/chat-messages'
import { ChatInput } from '@/components/chat/chat-input'
import { createClient } from '@/lib/supabase/client'
import { addMessage, createConversation } from '@/app/chat/actions'
import { assignRequest, updateRequestStatus } from '../actions'
import { toast } from 'sonner'

interface AssignedRequest {
  id: string
  title: string
  description: string
  status: string
  priority: string
  type: string
  created_at: string
  completed_at?: string
  requester?: { full_name?: string; email: string }
  system?: { name: string } | null
}

interface WorkspaceRequestDetailProps {
  request: AssignedRequest
  currentUserId: string
}

const PRIORITY_CONFIG = {
  urgent: { label: '긴급', color: 'bg-rose-100 text-rose-700 border-rose-200' },
  high: { label: '높음', color: 'bg-orange-100 text-orange-700 border-orange-200' },
  medium: { label: '보통', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  low: { label: '낮음', color: 'bg-gray-100 text-gray-600 border-gray-200' },
}

const STATUS_CONFIG = {
  requested: { label: '요청', color: 'bg-amber-100 text-amber-700' },
  reviewing: { label: '검토중', color: 'bg-blue-100 text-blue-700' },
  processing: { label: '처리중', color: 'bg-violet-100 text-violet-700' },
  completed: { label: '완료', color: 'bg-emerald-100 text-emerald-700' },
  rejected: { label: '반려', color: 'bg-red-100 text-red-700' },
}

const TYPE_LABELS: Record<string, string> = {
  account: '계정',
  software: '소프트웨어',
  hardware: '하드웨어',
  network: '네트워크',
  other: '기타',
}

// AI 협업 제안 옵션
const AI_WORK_SUGGESTIONS = [
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
    prompt: '이 요청에 대해 요청자에게 보낼 답변 초안을 작성해주세요. 전문적이면서도 친근한 어조로 부탁드립니다.',
  },
  {
    icon: '📋',
    title: '처리 계획 수립',
    description: '단계별 처리 방법',
    prompt: '이 요청을 처리하기 위한 단계별 계획을 세워주세요. 예상 소요 시간도 포함해주세요.',
  },
  {
    icon: '⚠️',
    title: '위험 요소 분석',
    description: '주의해야 할 사항',
    prompt: '이 요청을 처리할 때 주의해야 할 위험 요소나 고려사항이 있나요?',
  },
  {
    icon: '📚',
    title: '관련 문서 추천',
    description: '참고할 만한 가이드',
    prompt: '이 요청과 관련된 내부 가이드나 문서가 있다면 추천해주세요.',
  },
  {
    icon: '💡',
    title: '최적의 해결책',
    description: 'AI 추천 솔루션',
    prompt: '이 요청에 대한 최적의 해결책을 추천해주세요. 장단점도 함께 설명해주세요.',
  },
]

export function WorkspaceRequestDetail({ request, currentUserId }: WorkspaceRequestDetailProps) {
  const router = useRouter()
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isAssigning, setIsAssigning] = useState(false)
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false)

  const priorityConfig = PRIORITY_CONFIG[request.priority as keyof typeof PRIORITY_CONFIG] || PRIORITY_CONFIG.medium
  const statusConfig = STATUS_CONFIG[request.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.requested
  const createdDate = new Date(request.created_at)

  // 기존 대화 로드 또는 리셋
  useEffect(() => {
    const loadConversation = async () => {
      const supabase = createClient()
      
      // 해당 요청에 연결된 대화 조회
      const { data: conv } = await supabase
        .from('conversations')
        .select('id, messages(*)')
        .eq('request_id', request.id)
        .order('created_at', { ascending: true, referencedTable: 'messages' })
        .single()

      if (conv) {
        setConversationId(conv.id)
        setMessages(conv.messages || [])
      } else {
        setConversationId(null)
        setMessages([])
      }
    }

    loadConversation()
  }, [request.id])

  // 실시간 메시지 구독
  useEffect(() => {
    if (!conversationId) return

    const supabase = createClient()
    const channel = supabase
      .channel(`workspace-messages:${conversationId}`)
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
      let activeConversationId = conversationId
      
      // 대화가 없으면 새로 생성
      if (!activeConversationId) {
        const result = await createConversation(`[처리] ${request.title}`, request.id)
        if (result.error || !result.conversation) {
          throw new Error(result.error || '대화 생성 실패')
        }
        activeConversationId = result.conversation.id
        setConversationId(activeConversationId)
      }

      // 사용자 메시지 추가
      const userResult = await addMessage(activeConversationId!, 'user', content)
      if (userResult.message) {
        setMessages((prev) => [...prev, userResult.message as Message])
      }

      // AI 응답 요청 (요청 컨텍스트 + 담당자 모드)
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: activeConversationId,
          message: content,
          messages: [...messages, { role: 'user', content }],
          context: {
            type: 'manager_workspace',
            requestId: request.id,
            requestTitle: request.title,
            requestDescription: request.description,
            requestPriority: request.priority,
            requestType: request.type,
            requesterName: request.requester?.full_name || request.requester?.email,
          },
        }),
      })

      if (!response.ok) {
        throw new Error('AI 응답 실패')
      }

      const aiResponse = await response.json()
      
      // AI 응답 메시지 추가
      const aiResult = await addMessage(
        activeConversationId!,
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
  }, [conversationId, messages, request])

  const handleAssign = async () => {
    setIsAssigning(true)
    try {
      const result = await assignRequest(request.id, currentUserId)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success('요청이 배정되었습니다!')
        router.refresh()
      }
    } catch {
      toast.error('배정 중 오류가 발생했습니다.')
    } finally {
      setIsAssigning(false)
    }
  }

  const handleStatusChange = async (newStatus: string) => {
    setIsUpdatingStatus(true)
    try {
      const result = await updateRequestStatus(request.id, newStatus)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(`상태가 ${STATUS_CONFIG[newStatus as keyof typeof STATUS_CONFIG]?.label || newStatus}로 변경되었습니다.`)
        router.refresh()
      }
    } catch {
      toast.error('상태 변경 중 오류가 발생했습니다.')
    } finally {
      setIsUpdatingStatus(false)
    }
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* Request Info Panel */}
      <div className="w-[320px] flex-shrink-0 bg-white border-r border-gray-200 overflow-y-auto">
        {/* Header */}
        <div className="p-4 border-b border-gray-100 bg-gradient-to-br from-gray-50 to-white">
          <div className="flex items-center gap-2 mb-3">
            <Badge variant="outline" className={statusConfig.color}>
              {statusConfig.label}
            </Badge>
            <Badge variant="outline" className={priorityConfig.color}>
              {priorityConfig.label}
            </Badge>
          </div>
          <h2 className="text-lg font-bold text-gray-900 mb-2 line-clamp-2">
            {request.title}
          </h2>
          <Link 
            href={`/requests/${request.id}`}
            className="text-xs text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
          >
            <LinkIcon className="size-3" />
            상세 페이지 열기
          </Link>
        </div>

        {/* Description */}
        <div className="p-4 border-b border-gray-100">
          <h3 className="text-xs font-semibold text-gray-500 mb-2 flex items-center gap-1">
            <FileText className="size-3" />
            요청 내용
          </h3>
          <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
            {request.description}
          </p>
        </div>

        {/* Meta Info */}
        <div className="p-4 border-b border-gray-100 space-y-3">
          <div className="flex items-center gap-2 text-sm">
            <User className="size-4 text-gray-400" />
            <span className="text-gray-500">요청자:</span>
            <span className="text-gray-900 font-medium">
              {request.requester?.full_name || request.requester?.email}
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Tag className="size-4 text-gray-400" />
            <span className="text-gray-500">유형:</span>
            <span className="text-gray-900">{TYPE_LABELS[request.type] || request.type}</span>
          </div>
          {request.system && (
            <div className="flex items-center gap-2 text-sm">
              <Server className="size-4 text-gray-400" />
              <span className="text-gray-500">시스템:</span>
              <span className="text-gray-900">{request.system.name}</span>
            </div>
          )}
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="size-4 text-gray-400" />
            <span className="text-gray-500">신청일:</span>
            <span className="text-gray-900">
              {createdDate.toLocaleDateString('ko-KR', { 
                year: 'numeric', 
                month: 'short', 
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </span>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="p-4 space-y-2">
          <h3 className="text-xs font-semibold text-gray-500 mb-3">빠른 작업</h3>
          
          {request.status === 'requested' && (
            <Button 
              onClick={handleAssign}
              disabled={isAssigning}
              className="w-full bg-indigo-600 hover:bg-indigo-700"
            >
              <Play className="size-4 mr-2" />
              {isAssigning ? '배정 중...' : '내게 배정하기'}
            </Button>
          )}
          
          {request.status === 'reviewing' && (
            <Button 
              onClick={() => handleStatusChange('processing')}
              disabled={isUpdatingStatus}
              className="w-full bg-violet-600 hover:bg-violet-700"
            >
              <Play className="size-4 mr-2" />
              {isUpdatingStatus ? '변경 중...' : '처리 시작'}
            </Button>
          )}
          
          {request.status === 'processing' && (
            <Button 
              onClick={() => handleStatusChange('completed')}
              disabled={isUpdatingStatus}
              className="w-full bg-emerald-600 hover:bg-emerald-700"
            >
              <CheckCircle2 className="size-4 mr-2" />
              {isUpdatingStatus ? '변경 중...' : '처리 완료'}
            </Button>
          )}

          {request.status !== 'completed' && request.status !== 'rejected' && (
            <Button 
              variant="outline"
              onClick={() => handleStatusChange('rejected')}
              disabled={isUpdatingStatus}
              className="w-full text-rose-600 border-rose-200 hover:bg-rose-50"
            >
              <AlertTriangle className="size-4 mr-2" />
              {isUpdatingStatus ? '변경 중...' : '반려'}
            </Button>
          )}
        </div>
      </div>

      {/* AI Chat Panel */}
      <div className="flex-1 flex flex-col overflow-hidden bg-gray-50">
        {/* Chat Header */}
        <div className="flex-shrink-0 px-4 py-3 bg-white border-b border-gray-200">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-sm">
              <Bot className="size-4 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">AI 협업 어시스턴트</h3>
              <p className="text-xs text-gray-500">요청 처리를 함께 도와드립니다</p>
            </div>
          </div>
        </div>

        {/* Messages or Suggestions */}
        {messages.length === 0 && !isLoading ? (
          <div className="flex-1 overflow-y-auto p-6">
            <div className="max-w-2xl mx-auto">
              {/* Welcome */}
              <div className="text-center mb-8">
                <div className="inline-flex size-16 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-100 to-purple-100 mb-4">
                  <Sparkles className="size-8 text-indigo-600" />
                </div>
                <h2 className="text-xl font-semibold text-gray-900 mb-2">
                  이 요청을 함께 처리해볼까요?
                </h2>
                <p className="text-gray-500 text-sm">
                  AI 어시스턴트가 요청 분석, 답변 작성, 해결책 제안을 도와드립니다.
                </p>
              </div>

              {/* Suggestion Cards */}
              <div className="grid grid-cols-2 gap-3">
                {AI_WORK_SUGGESTIONS.map((suggestion, index) => (
                  <button
                    key={index}
                    onClick={() => sendMessage(suggestion.prompt)}
                    disabled={isLoading}
                    className={cn(
                      'p-4 rounded-xl border bg-white text-left transition-all group',
                      'hover:border-indigo-300 hover:shadow-md hover:-translate-y-0.5',
                      'disabled:opacity-50 disabled:cursor-not-allowed'
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-2xl">{suggestion.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-gray-900 group-hover:text-indigo-600 transition-colors">
                          {suggestion.title}
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          {suggestion.description}
                        </div>
                      </div>
                      <ArrowRight className="size-4 text-gray-300 group-hover:text-indigo-400 group-hover:translate-x-1 transition-all" />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <ChatMessages
            messages={messages}
            isLoading={isLoading}
          />
        )}

        {/* Input */}
        <ChatInput
          onSend={sendMessage}
          disabled={false}
          isLoading={isLoading}
          placeholder="AI에게 도움을 요청하세요... (유사 사례, 답변 초안 등)"
        />
      </div>
    </div>
  )
}

