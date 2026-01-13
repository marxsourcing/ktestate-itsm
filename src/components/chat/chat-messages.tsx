'use client'

import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { Bot, User, FileText, Download, Image as ImageIcon, ExternalLink } from 'lucide-react'
import { RequirementCard } from './requirement-card'
import type { AttachmentData } from '@/app/chat/attachments'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

export interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  metadata?: {
    requirementCard?: {
      system?: string
      module?: string
      type?: 'feature_add' | 'feature_improve' | 'bug_fix' | 'other' | 'feature' | 'improvement' | 'bug'
      title?: string
      description?: string
    }
    similarRequests?: Array<{
      id: string
      title: string
      similarity: number
    }>
    attachments?: AttachmentData[]
  }
  created_at: string
}

export type RequirementData = NonNullable<NonNullable<Message['metadata']>['requirementCard']>

interface ChatMessagesProps {
  messages: Message[]
  isLoading?: boolean
  onRequirementUpdate?: (data: RequirementData) => void
}

export function ChatMessages({ messages, isLoading, onRequirementUpdate }: ChatMessagesProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // 메시지가 없을 때는 아무것도 렌더링하지 않음 (EmptyChatArea에서 처리)
  if (messages.length === 0 && !isLoading) {
    return null
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="flex flex-col gap-6 px-4 py-6 md:px-8 lg:px-16 xl:px-32">
        {messages.map((message) => (
          <div
            key={message.id}
            className={cn(
              'flex gap-4',
              message.role === 'user' ? 'justify-end' : 'justify-start'
            )}
          >
            {message.role === 'assistant' && (
              <div className="flex-shrink-0">
                <div className="flex size-8 items-center justify-center rounded-full kt-gradient">
                  <Bot className="size-5 text-white" />
                </div>
              </div>
            )}
            <div
              className={cn(
                'max-w-[85%] md:max-w-[75%]',
                message.role === 'user' ? 'order-1' : ''
              )}
            >
              {/* 메시지 버블 - content가 있거나 첨부파일이 있을 때만 표시 */}
              {(message.content.trim() || (message.metadata?.attachments && message.metadata.attachments.length > 0)) && (
                <div
                  className={cn(
                    'rounded-2xl px-4 py-3 text-[15px] leading-relaxed',
                    message.role === 'user'
                      ? 'bg-rose-500 text-white'
                      : 'bg-white text-gray-800 border border-gray-200 shadow-sm'
                  )}
                >
                  {message.content.trim() && (
                    <div className={cn(
                      'markdown-content',
                      message.role === 'user' ? 'markdown-user' : 'markdown-assistant'
                    )}>
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {message.content}
                      </ReactMarkdown>
                    </div>
                  )}

                  {/* 첨부파일 표시 */}
                  {message.metadata?.attachments && message.metadata.attachments.length > 0 && (
                    <div className={cn(message.content.trim() ? 'mt-3' : '', 'space-y-2')}>
                      {message.metadata.attachments.map((attachment) => (
                        <AttachmentPreview
                          key={attachment.id}
                          attachment={attachment}
                          isUserMessage={message.role === 'user'}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Requirement Card */}
              {message.metadata?.requirementCard && (
                <div className="mt-4">
                  <RequirementCard
                    data={message.metadata.requirementCard}
                    onUpdate={onRequirementUpdate}
                  />
                </div>
              )}

              {/* Similar Requests */}
              {message.metadata?.similarRequests &&
                message.metadata.similarRequests.length > 0 && (
                  <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
                    <p className="mb-2 text-sm font-medium text-amber-700">
                      📚 유사한 요청이 {message.metadata.similarRequests.length}건
                      발견되었습니다
                    </p>
                    <div className="space-y-2">
                      {message.metadata.similarRequests.map((req) => (
                        <div
                          key={req.id}
                          className="flex items-center justify-between rounded-lg bg-white px-3 py-2 text-sm border border-amber-100"
                        >
                          <span className="text-gray-700">{req.title}</span>
                          <span className="text-amber-600 font-medium">
                            {Math.round(req.similarity * 100)}% 유사
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              <span className="mt-1 block text-xs text-gray-400">
                {new Date(message.created_at).toLocaleTimeString('ko-KR', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>
            {message.role === 'user' && (
              <div className="flex-shrink-0 order-2">
                <div className="flex size-8 items-center justify-center rounded-full bg-gray-200">
                  <User className="size-5 text-gray-600" />
                </div>
              </div>
            )}
          </div>
        ))}

        {/* Loading indicator */}
        {isLoading && (
          <div className="flex gap-4">
            <div className="flex-shrink-0">
              <div className="flex size-8 items-center justify-center rounded-full kt-gradient">
                <Bot className="size-5 text-white" />
              </div>
            </div>
            <div className="rounded-2xl bg-white px-4 py-3 border border-gray-200 shadow-sm">
              <div className="flex gap-1">
                <span className="size-2 animate-bounce rounded-full bg-gray-400 [animation-delay:-0.3s]" />
                <span className="size-2 animate-bounce rounded-full bg-gray-400 [animation-delay:-0.15s]" />
                <span className="size-2 animate-bounce rounded-full bg-gray-400" />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>
    </div>
  )
}

// 첨부파일 미리보기 컴포넌트
function AttachmentPreview({ 
  attachment, 
  isUserMessage 
}: { 
  attachment: AttachmentData
  isUserMessage: boolean 
}) {
  const [imageError, setImageError] = useState(false)
  const isImage = attachment.file_type.startsWith('image/') && !imageError

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes}B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
  }

  const getFileIcon = () => {
    if (attachment.file_type.startsWith('image/')) return <ImageIcon className="size-5" />
    return <FileText className="size-5" />
  }

  if (isImage && attachment.url) {
    return (
      <div className="group relative">
        <img
          src={attachment.url}
          alt={attachment.file_name}
          className="max-w-[300px] max-h-[200px] rounded-lg object-cover cursor-pointer"
          onClick={() => window.open(attachment.url, '_blank')}
          onError={() => setImageError(true)}
        />
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg">
          <a
            href={attachment.url}
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 rounded-full bg-white/20 hover:bg-white/30 text-white"
          >
            <ExternalLink className="size-5" />
          </a>
        </div>
      </div>
    )
  }

  return (
    <a
      href={attachment.url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        'flex items-center gap-3 rounded-lg p-3 transition-colors',
        isUserMessage 
          ? 'bg-rose-400/30 hover:bg-rose-400/40' 
          : 'bg-gray-100 hover:bg-gray-200'
      )}
    >
      <div className={cn(
        'flex size-10 items-center justify-center rounded-lg',
        isUserMessage ? 'bg-rose-400/50 text-white' : 'bg-gray-200 text-gray-600'
      )}>
        {getFileIcon()}
      </div>
      <div className="flex-1 min-w-0">
        <p className={cn(
          'truncate text-sm font-medium',
          isUserMessage ? 'text-white' : 'text-gray-800'
        )}>
          {attachment.file_name}
        </p>
        <p className={cn(
          'text-xs',
          isUserMessage ? 'text-rose-100' : 'text-gray-500'
        )}>
          {formatFileSize(attachment.file_size)}
        </p>
      </div>
      <Download className={cn(
        'size-5 flex-shrink-0',
        isUserMessage ? 'text-white' : 'text-gray-400'
      )} />
    </a>
  )
}
