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
import { Loader2, User, Bot, ExternalLink, Image as ImageIcon, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  created_at: string
  metadata?: {
    attachments?: Array<{
      id: string
      file_name: string
      file_url: string
      file_type: string
    }>
    requirementCard?: unknown
  }
}

interface ChatDetailModalProps {
  conversationId: string
  title: string
  user: {
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

export function ChatDetailModal({
  conversationId,
  title,
  user,
  request,
  open,
  onOpenChange,
}: ChatDetailModalProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isExporting, setIsExporting] = useState(false)

  useEffect(() => {
    if (open && conversationId) {
      loadMessages()
    }
  }, [open, conversationId])

  async function loadMessages() {
    setIsLoading(true)
    const supabase = createClient()

    const { data } = await supabase
      .from('messages')
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

  async function handleExport() {
    setIsExporting(true)
    try {
      const response = await fetch(`/api/admin/export?type=messages&conversationId=${conversationId}`)
      if (!response.ok) throw new Error('Export failed')

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `채팅상세_${new Date().toISOString().split('T')[0].replace(/-/g, '')}.xlsx`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      console.error('Export error:', error)
      alert('내보내기에 실패했습니다.')
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-4xl h-[85vh] flex flex-col p-4 sm:p-6">
        <DialogHeader className="shrink-0 space-y-2 overflow-hidden">
          {/* 제목 + 버튼 영역 */}
          <div className="flex items-start justify-between gap-2">
            <DialogTitle className="text-base sm:text-lg leading-tight flex-1 min-w-0">
              채팅 내역: {title}
            </DialogTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              disabled={isExporting || messages.length === 0}
              className="shrink-0"
            >
              {isExporting ? (
                <Loader2 className="size-4 animate-spin mr-1" />
              ) : (
                <Download className="size-4 mr-1" />
              )}
              <span className="hidden sm:inline">Excel 내보내기</span>
              <span className="sm:hidden">내보내기</span>
            </Button>
          </div>
          {/* 메타 정보 영역 */}
          <div className="text-sm text-gray-500 space-y-1">
            <div>
              <span className="font-medium">사용자:</span>{' '}
              {user?.full_name || user?.email || '-'}
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
                    <div className="shrink-0 w-8 h-8 rounded-full bg-linear-to-br from-rose-500 to-orange-400 flex items-center justify-center">
                      <Bot className="size-4 text-white" />
                    </div>
                  )}
                  <div
                    className={`max-w-[70%] rounded-lg px-4 py-2 ${
                      message.role === 'user'
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-100 text-gray-900'
                    }`}
                  >
                    <div className="text-xs opacity-70 mb-1">
                      {formatTime(message.created_at)}
                    </div>
                    <div className="whitespace-pre-wrap text-sm">
                      {message.content}
                    </div>
                    {/* 첨부파일 표시 */}
                    {message.metadata?.attachments && message.metadata.attachments.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {message.metadata.attachments.map((att) => (
                          <a
                            key={att.id}
                            href={att.file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`flex items-center gap-1 text-xs ${
                              message.role === 'user'
                                ? 'text-blue-100 hover:text-white'
                                : 'text-blue-600 hover:underline'
                            }`}
                          >
                            {att.file_type?.startsWith('image/') ? (
                              <ImageIcon className="size-3" />
                            ) : (
                              <ExternalLink className="size-3" />
                            )}
                            {att.file_name}
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                  {message.role === 'user' && (
                    <div className="shrink-0 w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center">
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
