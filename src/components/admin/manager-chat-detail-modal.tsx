'use client'

import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Loader2, User, Bot, ExternalLink, Shield } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  created_at: string
}

interface ManagerChatDetailModalProps {
  conversationId: string
  title: string
  manager: {
    id: string
    full_name: string | null
    email: string
  } | null
  request: {
    id: string
    title: string
    status: string
  } | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ManagerChatDetailModal({
  conversationId,
  title,
  manager,
  request,
  open,
  onOpenChange,
}: ManagerChatDetailModalProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (open && conversationId) {
      loadMessages()
    }
  }, [open, conversationId])

  async function loadMessages() {
    setIsLoading(true)
    const supabase = createClient()

    const { data } = await supabase
      .from('manager_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })

    if (data) {
      setMessages(data)
    }
    setIsLoading(false)
  }

  function formatTime(dateString: string) {
    return new Date(dateString).toLocaleString('ko-KR', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  function getStatusLabel(status: string) {
    const labels: Record<string, string> = {
      draft: '작성중',
      requested: '요청',
      approved: '승인',
      consulting: '실무협의',
      accepted: '접수',
      processing: '처리중',
      test_requested: '테스트요청',
      test_completed: '테스트완료',
      deploy_requested: '배포요청',
      deploy_approved: '배포승인',
      completed: '완료',
      rejected: '반려',
    }
    return labels[status] || status
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-4xl h-[85vh] flex flex-col p-4 sm:p-6">
        <DialogHeader className="flex-shrink-0 space-y-2 overflow-hidden">
          {/* 제목 영역 */}
          <div className="flex items-start justify-between gap-2">
            <DialogTitle className="text-base sm:text-lg leading-tight flex-1 min-w-0 flex items-center gap-2">
              <Shield className="size-5 text-indigo-600" />
              담당자 내부 채팅: {title}
            </DialogTitle>
          </div>
          {/* 메타 정보 영역 */}
          <div className="text-sm text-gray-500 space-y-1">
            <div>
              <span className="font-medium">담당자:</span>{' '}
              {manager?.full_name || manager?.email || '-'}
            </div>
            {request && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium">연결된 요청:</span>
                <Link
                  href={`/requests/${request.id}`}
                  className="text-blue-600 hover:underline inline-flex items-center gap-1 max-w-full"
                  onClick={() => onOpenChange(false)}
                >
                  <span className="truncate max-w-[150px] sm:max-w-[250px]">{request.title}</span>
                  <ExternalLink className="size-3 shrink-0" />
                </Link>
                <Badge variant="outline" className="text-xs">
                  {getStatusLabel(request.status)}
                </Badge>
              </div>
            )}
          </div>
          {/* 내부 전용 안내 */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            <p className="text-xs text-amber-700 flex items-center gap-2">
              <Shield className="size-3" />
              내부 전용 대화 - 요청자에게 공개되지 않은 담당자와 AI 간의 협업 채팅입니다
            </p>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 min-h-0 mt-4 pr-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="size-6 animate-spin text-gray-400" />
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              메시지가 없습니다.
            </div>
          ) : (
            <div className="space-y-4 pb-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex gap-3 ${
                    message.role === 'user' ? 'justify-end' : 'justify-start'
                  }`}
                >
                  {message.role !== 'user' && (
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                      <Bot className="size-4 text-white" />
                    </div>
                  )}
                  <div
                    className={`max-w-[70%] rounded-lg px-4 py-2 ${
                      message.role === 'user'
                        ? 'bg-indigo-600 text-white'
                        : 'bg-gray-100 text-gray-900'
                    }`}
                  >
                    <div className="text-xs opacity-70 mb-1">
                      {formatTime(message.created_at)}
                    </div>
                    <div className="whitespace-pre-wrap text-sm">
                      {message.content}
                    </div>
                  </div>
                  {message.role === 'user' && (
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center">
                      <User className="size-4 text-white" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
