'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { addComment } from '@/app/requests/actions'
import { MessageSquare, Lock, Send } from 'lucide-react'
import { toast } from 'sonner'
import ReactMarkdown from 'react-markdown'

interface Comment {
  id: string
  content: string
  is_internal: boolean
  created_at: string
  author: {
    full_name: string | null
    email: string
    role: string
  }
}

interface CommentsSectionProps {
  requestId: string
  comments: Comment[]
  isManager: boolean
}

export function CommentsSection({ requestId, comments, isManager }: CommentsSectionProps) {
  const [content, setContent] = useState('')
  const [isInternal, setIsInternal] = useState(false)
  const [isPending, startTransition] = useTransition()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!content.trim()) return

    startTransition(async () => {
      const result = await addComment(requestId, content, isInternal)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success('댓글이 추가되었습니다.')
        setContent('')
        setIsInternal(false)
      }
    })
  }

  return (
    <div className="space-y-4">
      {/* 댓글 목록 */}
      {comments && comments.length > 0 ? (
        <ul className="space-y-3">
          {comments.map((comment) => (
            <li key={comment.id} className={`p-4 rounded-lg border ${comment.is_internal ? 'bg-amber-50 border-amber-200' : 'bg-white'}`}>
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">
                    {comment.author?.full_name || comment.author?.email}
                  </span>
                  {comment.author?.role !== 'requester' && (
                    <Badge variant="outline" className="text-xs">
                      {comment.author?.role === 'admin' ? '관리자' : '담당자'}
                    </Badge>
                  )}
                  {comment.is_internal && (
                    <Badge variant="secondary" className="text-xs bg-amber-200 text-amber-800">
                      <Lock className="h-3 w-3 mr-1" />
                      내부 메모
                    </Badge>
                  )}
                </div>
                <span className="text-xs text-muted-foreground">
                  {new Date(comment.created_at).toLocaleString('ko-KR')}
                </span>
              </div>
              <div className="text-sm prose prose-sm max-w-none prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5">
                <ReactMarkdown>{comment.content}</ReactMarkdown>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="text-center py-8 text-muted-foreground">
          <MessageSquare className="h-10 w-10 mx-auto mb-2 opacity-50" />
          <p>댓글이 없습니다.</p>
        </div>
      )}

      {/* 댓글 작성 폼 */}
      <form onSubmit={handleSubmit} className="space-y-3 pt-4 border-t">
        <Textarea
          placeholder="댓글을 입력하세요..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={3}
          className="resize-none"
        />
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isManager && (
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={isInternal}
                  onChange={(e) => setIsInternal(e.target.checked)}
                  className="rounded border-gray-300"
                />
                <Lock className="h-3.5 w-3.5 text-amber-600" />
                <span className="text-amber-600">내부 메모로 작성</span>
              </label>
            )}
          </div>
          
          <Button type="submit" disabled={isPending || !content.trim()} size="sm">
            <Send className="h-4 w-4 mr-2" />
            {isPending ? '전송 중...' : '댓글 작성'}
          </Button>
        </div>
      </form>
    </div>
  )
}

