'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  Sparkles,
  Loader2,
  Copy,
  Check,
  RotateCcw,
  X,
  Pencil,
  Send
} from 'lucide-react'
import { toast } from 'sonner'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface RequestInfo {
  id: string
  title: string
  description: string
  priority: string
  requesterName?: string
  systemName?: string
  category_lv1_name?: string  // 대분류 (SR 구분)
  category_lv2_name?: string  // 소분류 (SR 상세 구분)
}

interface AiDraftButtonProps {
  request: RequestInfo
  chatHistory?: ChatMessage[]  // 담당자-AI 대화 내역
  onApply?: (draft: string) => void
  className?: string
}

export function AiDraftButton({ request, chatHistory, onApply, className }: AiDraftButtonProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [draft, setDraft] = useState('')
  const [editedDraft, setEditedDraft] = useState('')
  const [isEditing, setIsEditing] = useState(false)
  const [isCopied, setIsCopied] = useState(false)

  const generateDraft = async () => {
    setIsLoading(true)
    setIsOpen(true)
    setDraft('')
    setEditedDraft('')
    setIsEditing(false)

    try {
      const response = await fetch('/api/ai/draft-response', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId: request.id,
          requestTitle: request.title,
          requestDescription: request.description,
          requestPriority: request.priority,
          requesterName: request.requesterName,
          systemName: request.systemName,
          categoryLv1Name: request.category_lv1_name,
          categoryLv2Name: request.category_lv2_name,
          chatHistory: chatHistory?.map(msg => ({
            role: msg.role,
            content: msg.content
          }))
        })
      })

      if (!response.ok) {
        throw new Error('답변 초안 생성 실패')
      }

      const data = await response.json()
      setDraft(data.draft)
      setEditedDraft(data.draft)
    } catch (error) {
      console.error('Draft generation error:', error)
      toast.error('답변 초안 생성에 실패했습니다.')
      setIsOpen(false)
    } finally {
      setIsLoading(false)
    }
  }

  const handleCopy = async () => {
    const textToCopy = isEditing ? editedDraft : draft
    try {
      await navigator.clipboard.writeText(textToCopy)
      setIsCopied(true)
      toast.success('클립보드에 복사되었습니다.')
      setTimeout(() => setIsCopied(false), 2000)
    } catch {
      toast.error('복사에 실패했습니다.')
    }
  }

  const handleApply = () => {
    const textToApply = isEditing ? editedDraft : draft
    if (onApply) {
      onApply(textToApply)
      toast.success('답변이 적용되었습니다.')
      setIsOpen(false)
    } else {
      handleCopy()
    }
  }

  const handleRegenerate = () => {
    generateDraft()
  }

  const handleClose = () => {
    setIsOpen(false)
    setDraft('')
    setEditedDraft('')
    setIsEditing(false)
  }

  const hasChatHistory = chatHistory && chatHistory.length > 0

  if (!isOpen) {
    return (
      <div className={className}>
        <Button
          onClick={generateDraft}
          variant="outline"
          className={cn(
            'w-full gap-2 text-indigo-600 border-indigo-200 hover:bg-indigo-50 hover:border-indigo-300'
          )}
        >
          <Sparkles className="size-4" />
          AI 답변 초안
        </Button>
        {!hasChatHistory && (
          <p className="mt-1.5 text-xs text-gray-500 text-center">
            AI와 대화 후 초안 생성을 권장합니다
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl rounded-xl bg-white shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b bg-gradient-to-r from-indigo-500 to-purple-600">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-white/20">
              <Sparkles className="size-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-white">AI 답변 초안</h3>
              <p className="text-xs text-indigo-100">요청자에게 보낼 답변을 생성합니다</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 rounded-lg hover:bg-white/10 text-white transition-colors"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <Loader2 className="size-10 animate-spin text-indigo-500" />
              <div className="text-center">
                <p className="font-medium text-gray-700">답변 초안 생성 중...</p>
                <p className="text-sm text-gray-500 mt-1">잠시만 기다려주세요</p>
              </div>
            </div>
          ) : (
            <>
              {/* Request Info Summary */}
              <div className="mb-4 p-3 rounded-lg bg-gray-50 border border-gray-200">
                <p className="text-xs text-gray-500 mb-1">요청 제목</p>
                <p className="text-sm font-medium text-gray-800 line-clamp-2">
                  {request.title}
                </p>
              </div>

              {/* Draft Area */}
              <div className="relative">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">
                    {isEditing ? '초안 편집' : '생성된 초안'}
                  </span>
                  {!isEditing && draft && (
                    <button
                      onClick={() => setIsEditing(true)}
                      className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700"
                    >
                      <Pencil className="size-3" />
                      편집
                    </button>
                  )}
                </div>

                {isEditing ? (
                  <textarea
                    value={editedDraft}
                    onChange={(e) => setEditedDraft(e.target.value)}
                    className="w-full h-64 p-4 rounded-lg border border-gray-300 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 resize-none text-sm leading-relaxed"
                    placeholder="답변 내용을 편집하세요..."
                  />
                ) : (
                  <div className="w-full h-64 p-4 rounded-lg border border-gray-200 bg-gray-50 overflow-y-auto">
                    <pre className="whitespace-pre-wrap text-sm leading-relaxed text-gray-700 font-sans">
                      {draft}
                    </pre>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer Actions */}
        {!isLoading && draft && (
          <div className="flex items-center justify-between px-5 py-4 border-t bg-gray-50">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRegenerate}
                className="gap-1.5 text-gray-600"
              >
                <RotateCcw className="size-4" />
                다시 생성
              </Button>
              {isEditing && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setIsEditing(false)
                    setEditedDraft(draft)
                  }}
                  className="text-gray-600"
                >
                  편집 취소
                </Button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopy}
                className="gap-1.5"
              >
                {isCopied ? (
                  <>
                    <Check className="size-4 text-emerald-500" />
                    복사됨
                  </>
                ) : (
                  <>
                    <Copy className="size-4" />
                    복사
                  </>
                )}
              </Button>
              {onApply ? (
                <Button
                  size="sm"
                  onClick={handleApply}
                  className="gap-1.5 bg-indigo-600 hover:bg-indigo-700"
                >
                  <Send className="size-4" />
                  적용하기
                </Button>
              ) : (
                <Button
                  size="sm"
                  onClick={handleClose}
                  className="bg-gray-600 hover:bg-gray-700"
                >
                  닫기
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
