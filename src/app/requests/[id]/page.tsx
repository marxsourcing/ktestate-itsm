import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import {
  ChevronLeft,
  Calendar,
  User,
  Server,
  Clock,
  CheckCircle2,
  MessageCircle
} from 'lucide-react'
import { HistoryTimeline } from './components/history-timeline'
import { CommentsSection } from './components/comments-section'
import { RequestChatArea } from './components/request-chat-area'

const STATUS_CONFIG = {
  draft: { label: '작성중', color: 'bg-gray-100 text-gray-600 border-gray-200' },
  requested: { label: '요청', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  approved: { label: '승인', color: 'bg-sky-100 text-sky-700 border-sky-200' },
  consulting: { label: '실무협의', color: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
  accepted: { label: '접수', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  processing: { label: '처리중', color: 'bg-violet-100 text-violet-700 border-violet-200' },
  test_requested: { label: '테스트요청', color: 'bg-orange-100 text-orange-700 border-orange-200' },
  test_completed: { label: '테스트완료', color: 'bg-teal-100 text-teal-700 border-teal-200' },
  deploy_requested: { label: '배포요청', color: 'bg-cyan-100 text-cyan-700 border-cyan-200' },
  deploy_approved: { label: '배포승인', color: 'bg-lime-100 text-lime-700 border-lime-200' },
  completed: { label: '완료', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  rejected: { label: '반려', color: 'bg-red-100 text-red-700 border-red-200' },
}

const PRIORITY_CONFIG = {
  urgent: { label: '긴급', color: 'bg-red-100 text-red-700' },
  high: { label: '높음', color: 'bg-orange-100 text-orange-700' },
  medium: { label: '보통', color: 'bg-blue-100 text-blue-700' },
  low: { label: '낮음', color: 'bg-gray-100 text-gray-600' },
}

const TYPE_LABELS: Record<string, string> = {
  feature_add: '기능추가',
  feature_improve: '기능개선',
  bug_fix: '버그수정',
  other: '기타',
}

export default async function RequestDetailPage({ params }: { params: { id: string } }) {
  const { id } = await params
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: request } = await supabase
    .from('service_requests')
    .select(`
      *,
      requester:profiles!service_requests_requester_id_fkey(full_name, email),
      manager:profiles!service_requests_manager_id_fkey(full_name, email),
      system:systems(name),
      module:system_modules(name)
    `)
    .eq('id', id)
    .single()

  if (!request) notFound()

  // 히스토리 조회
  const { data: history } = await supabase
    .from('sr_history')
    .select(`
      *,
      actor:profiles!sr_history_actor_id_fkey(full_name, email)
    `)
    .eq('request_id', id)
    .order('created_at', { ascending: false })

  // 댓글 조회
  const { data: comments } = await supabase
    .from('sr_comments')
    .select(`
      *,
      author:profiles!sr_comments_author_id_fkey(full_name, email, role)
    `)
    .eq('request_id', id)
    .order('created_at', { ascending: true })

  // 연결된 대화 조회 (있다면)
  const { data: conversation } = await supabase
    .from('conversations')
    .select('id, title, messages(*)')
    .eq('request_id', id)
    .order('created_at', { ascending: true, referencedTable: 'messages' })
    .single()

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const isManager = profile?.role === 'manager' || profile?.role === 'admin'

  const statusConfig = STATUS_CONFIG[request.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.requested
  const priorityConfig = PRIORITY_CONFIG[request.priority as keyof typeof PRIORITY_CONFIG] || PRIORITY_CONFIG.medium
  
  const createdDate = new Date(request.created_at)
  const completedDate = request.completed_at ? new Date(request.completed_at) : null

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] bg-gray-50">
      {/* Header */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild className="text-gray-500 hover:text-gray-700">
            <Link href="/requests">
              <ChevronLeft className="size-4" />
              <span className="ml-1">목록</span>
            </Link>
          </Button>
          
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="outline" className={statusConfig.color}>
                {statusConfig.label}
              </Badge>
              <Badge variant="outline" className={priorityConfig.color}>
                {priorityConfig.label}
              </Badge>
              <span className="text-xs text-gray-400 px-2 py-0.5 rounded bg-gray-100">
                {TYPE_LABELS[request.type] || request.type}
              </span>
            </div>
            <h1 className="text-xl font-bold text-gray-900 line-clamp-1">
              {request.title}
            </h1>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Request Details & Comments */}
        <div className="w-[400px] flex-shrink-0 border-r border-gray-200 bg-white overflow-y-auto">
          {/* Request Info Card */}
          <div className="p-4 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-500 mb-3">요청 정보</h3>
            
            <div className="space-y-3">
              {/* Description */}
              <div className="p-3 rounded-lg bg-gray-50 text-sm text-gray-700 whitespace-pre-wrap">
                {request.description}
              </div>

              {/* Meta Info Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center gap-2 text-sm">
                  <User className="size-4 text-gray-400" />
                  <div>
                    <span className="text-xs text-gray-400 block">요청자</span>
                    <span className="text-gray-700">{request.requester?.full_name || request.requester?.email}</span>
                  </div>
                </div>
                
                <div className="flex items-center gap-2 text-sm">
                  <User className="size-4 text-gray-400" />
                  <div>
                    <span className="text-xs text-gray-400 block">담당자</span>
                    <span className="text-gray-700">{request.manager?.full_name || '미지정'}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="size-4 text-gray-400" />
                  <div>
                    <span className="text-xs text-gray-400 block">신청일</span>
                    <span className="text-gray-700">
                      {createdDate.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>

                {completedDate && (
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="size-4 text-emerald-500" />
                    <div>
                      <span className="text-xs text-gray-400 block">완료일</span>
                      <span className="text-gray-700">
                        {completedDate.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                )}

                {request.system && (
                  <div className="flex items-center gap-2 text-sm col-span-2">
                    <Server className="size-4 text-gray-400" />
                    <div>
                      <span className="text-xs text-gray-400 block">관련 시스템</span>
                      <span className="text-gray-700">
                        {request.system.name}
                        {request.module?.name && (
                          <span className="text-gray-500"> / {request.module.name}</span>
                        )}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* History Timeline */}
          <div className="p-4 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-500 mb-3 flex items-center gap-2">
              <Clock className="size-4" />
              처리 이력
            </h3>
            <HistoryTimeline history={history || []} compact />
          </div>

          {/* Comments Section */}
          <div className="p-4">
            <h3 className="text-sm font-semibold text-gray-500 mb-3 flex items-center gap-2">
              <MessageCircle className="size-4" />
              댓글 ({comments?.length || 0})
            </h3>
            <CommentsSection
              requestId={request.id}
              comments={comments || []}
              isManager={isManager}
            />
          </div>
        </div>

        {/* Right Panel - AI Chat */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <RequestChatArea 
            requestId={request.id}
            conversationId={conversation?.id}
            initialMessages={conversation?.messages || []}
            requestTitle={request.title}
            requestDescription={request.description}
          />
        </div>
      </div>
    </div>
  )
}
