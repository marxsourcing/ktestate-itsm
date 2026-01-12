'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Send, Paperclip, Loader2, X, FileText, Image as ImageIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { uploadAttachment, type AttachmentData } from '@/app/chat/attachments'

export interface PendingFile {
  file: File
  preview?: string
  uploading?: boolean
  uploaded?: AttachmentData
  error?: string
}

interface ChatInputProps {
  onSend: (message: string, attachments?: AttachmentData[]) => void
  disabled?: boolean
  isLoading?: boolean
  placeholder?: string
  messageId?: string
  requestId?: string
}

export function ChatInput({ 
  onSend, 
  disabled, 
  isLoading,
  placeholder = '메시지를 입력하세요...',
  messageId,
  requestId
}: ChatInputProps) {
  const [message, setMessage] = useState('')
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`
    }
  }, [message])

  // 파일 선택 처리
  const handleFileSelect = useCallback((files: FileList | null) => {
    if (!files) return

    const newFiles: PendingFile[] = Array.from(files).map(file => {
      const isImage = file.type.startsWith('image/')
      const preview = isImage ? URL.createObjectURL(file) : undefined
      return {
        file,
        preview
      }
    })

    setPendingFiles(prev => [...prev, ...newFiles])
  }, [])

  // 파일 제거
  const removeFile = useCallback((index: number) => {
    setPendingFiles(prev => {
      const file = prev[index]
      if (file.preview) {
        URL.revokeObjectURL(file.preview)
      }
      return prev.filter((_, i) => i !== index)
    })
  }, [])

  // 파일 업로드
  const uploadFiles = useCallback(async (): Promise<AttachmentData[]> => {
    const uploadedAttachments: AttachmentData[] = []

    for (let i = 0; i < pendingFiles.length; i++) {
      const pf = pendingFiles[i]
      if (pf.uploaded) {
        uploadedAttachments.push(pf.uploaded)
        continue
      }

      setPendingFiles(prev => prev.map((f, idx) =>
        idx === i ? { ...f, uploading: true } : f
      ))

      const formData = new FormData()
      formData.append('file', pf.file)

      const result = await uploadAttachment(formData, messageId, requestId)

      if (result.error) {
        setPendingFiles(prev => prev.map((f, idx) =>
          idx === i ? { ...f, uploading: false, error: result.error } : f
        ))
      } else if (result.attachment) {
        uploadedAttachments.push(result.attachment)
        setPendingFiles(prev => prev.map((f, idx) =>
          idx === i ? { ...f, uploading: false, uploaded: result.attachment } : f
        ))
      }
    }

    return uploadedAttachments
  }, [pendingFiles, messageId, requestId])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if ((!message.trim() && pendingFiles.length === 0) || disabled || isLoading || isUploading) return

    setIsUploading(true)
    
    try {
      // 파일 업로드
      const attachments = pendingFiles.length > 0 ? await uploadFiles() : undefined
      
      // 메시지 전송
      onSend(message.trim(), attachments)
      setMessage('')
      
      // 파일 목록 초기화
      pendingFiles.forEach(pf => {
        if (pf.preview) URL.revokeObjectURL(pf.preview)
      })
      setPendingFiles([])
    } finally {
      setIsUploading(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  const isDisabled = disabled || isLoading || isUploading
  const canSend = (message.trim() || pendingFiles.length > 0) && !isDisabled

  // 파일 타입 아이콘
  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) return <ImageIcon className="size-4" />
    return <FileText className="size-4" />
  }

  // 파일 크기 포맷
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes}B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-6">
      {/* 첨부 파일 미리보기 */}
      {pendingFiles.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {pendingFiles.map((pf, index) => (
            <div
              key={index}
              className={cn(
                'relative flex items-center gap-2 rounded-lg border bg-white px-3 py-2 text-sm',
                pf.error ? 'border-red-300 bg-red-50' : 'border-gray-200',
                pf.uploading && 'opacity-70'
              )}
            >
              {pf.preview ? (
                <img 
                  src={pf.preview} 
                  alt={pf.file.name}
                  className="size-8 rounded object-cover"
                />
              ) : (
                <div className="flex size-8 items-center justify-center rounded bg-gray-100 text-gray-500">
                  {getFileIcon(pf.file.type)}
                </div>
              )}
              <div className="flex flex-col">
                <span className="max-w-[150px] truncate text-gray-700">
                  {pf.file.name}
                </span>
                <span className="text-xs text-gray-400">
                  {formatFileSize(pf.file.size)}
                </span>
              </div>
              {pf.uploading ? (
                <Loader2 className="size-4 animate-spin text-rose-500" />
              ) : (
                <button
                  type="button"
                  onClick={() => removeFile(index)}
                  className="ml-1 rounded-full p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                >
                  <X className="size-4" />
                </button>
              )}
              {pf.error && (
                <span className="absolute -bottom-5 left-0 text-xs text-red-500">
                  {pf.error}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      <form onSubmit={handleSubmit} className="relative">
        <div className="flex items-center gap-2 rounded-2xl border border-gray-300 bg-white px-4 py-3 shadow-sm focus-within:border-rose-400 focus-within:ring-2 focus-within:ring-rose-100 transition-all">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv"
            onChange={(e) => handleFileSelect(e.target.files)}
            className="hidden"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="self-end text-gray-400 hover:text-gray-600 hover:bg-gray-100"
            disabled={isDisabled}
            onClick={() => fileInputRef.current?.click()}
          >
            <Paperclip className="size-5" />
          </Button>

          <textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={isDisabled}
            rows={1}
            className={cn(
              'flex-1 resize-none bg-transparent text-[15px] text-gray-900 placeholder:text-gray-400 focus:outline-none leading-8',
              'max-h-[200px] min-h-[32px]'
            )}
          />

          <Button
            type="submit"
            size="icon-sm"
            disabled={!canSend}
            className={cn(
              'self-end transition-all',
              canSend
                ? 'kt-gradient text-white hover:opacity-90'
                : 'bg-gray-200 text-gray-400'
            )}
          >
            {isLoading || isUploading ? (
              <Loader2 className="size-5 animate-spin" />
            ) : (
              <Send className="size-5" />
            )}
          </Button>
        </div>

        <p className="mt-2 text-center text-xs text-gray-400">
          AI가 분석하여 요구사항을 정리합니다. 확정 전 내용을 검토해주세요.
        </p>
      </form>
    </div>
  )
}
