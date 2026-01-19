import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import {
  ChevronLeft,
  Calendar,
  User,
  Clock,
  MessageCircle,
  MessageSquare,
} from 'lucide-react'
import { HistoryTimeline } from './components/history-timeline'
import { CommentsSection } from './components/comments-section'
import { RequestChatArea } from './components/request-chat-area'
import { RequirementCard } from '@/components/chat/requirement-card'
import { AttachmentData } from '@/app/chat/attachments'

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
      module:system_modules(name),
      category_lv1:request_categories_lv1(id, name),
      category_lv2:request_categories_lv2(id, name)
    `)
    .eq('id', id)
    .single()

  if (!request) notFound()

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const isManager = profile?.role === 'manager' || profile?.role === 'admin'
  const isRequester = user.id === request.requester_id

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
  let commentsQuery = supabase
    .from('sr_comments')
    .select(`
      *,
      author:profiles!sr_comments_author_id_fkey(full_name, email, role),
      attachments(*)
    `)
    .eq('request_id', id)
    .order('created_at', { ascending: true })

  // 요청자는 내부 메모를 볼 수 없음
  if (!isManager) {
    commentsQuery = commentsQuery.eq('is_internal', false)
  }

  const { data: commentsRaw } = await commentsQuery

  // 댓글 첨부파일 Signed URL 생성
  const comments = await Promise.all((commentsRaw || []).map(async (comment) => {
    if (comment.attachments && comment.attachments.length > 0) {
      const attachmentsWithUrls = await Promise.all(comment.attachments.map(async (att: { storage_path: string } & Record<string, unknown>) => {
        const { data } = await supabase.storage
          .from('attachments')
          .createSignedUrl(att.storage_path, 3600)
        return { ...att, url: data?.signedUrl }
      }))
      return { ...comment, attachments: attachmentsWithUrls }
    }
    return comment
  }))

  // 대화 및 해당 대화의 첨부파일 조회
  const { data: conversation } = await supabase
    .from('conversations')
    .select('id, title, messages(*)')
    .eq('request_id', id)
    .maybeSingle()

  let conversationAttachments: AttachmentData[] = []

  // 1. 요청 ID(request_id)로 직접 연결된 첨부파일 조회 (확정 시 업데이트된 파일들)
  const { data: directAttachments } = await supabase
    .from('attachments')
    .select('*')
    .eq('request_id', id)

  // 2. 대화 ID(conversation_id)로 연결된 첨부파일 조회 (혹시 request_id가 업데이트 안 된 경우 대비)
  let convAttachments: AttachmentData[] = []
  if (conversation) {
    const { data: attachmentsByConv } = await supabase
      .from('attachments')
      .select('*')
      .eq('conversation_id', conversation.id)
    convAttachments = (attachmentsByConv as AttachmentData[]) || []
  }

  // 중복 제거 및 병합
  const allAttachments = [...((directAttachments as AttachmentData[]) || []), ...convAttachments]
  const uniqueAttachments = Array.from(
    new Map(allAttachments.map((item) => [item.id, item])).values()
  )

  if (uniqueAttachments.length > 0) {
    conversationAttachments = await Promise.all(uniqueAttachments.map(async (att) => {
      const { data } = await supabase.storage
        .from('attachments')
        .createSignedUrl(att.storage_path, 3600)
      return { ...att, url: data?.signedUrl }
    }))
  }

  // 대화 잠금 조건: 'accepted' (접수) 이후 단계이거나 반려/완료된 경우
  const isLocked = !['draft', 'draft_chat', 'requested', 'approved', 'consulting'].includes(request.status)
  const chatReadOnly = !isRequester || isLocked

  // 채팅 섹션 표시 여부: 요청자 본인이거나 관리자/담당자인 경우에만 표시
  const showChat = isRequester || isManager

  const statusConfig = STATUS_CONFIG[request.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.requested
  const priorityConfig = PRIORITY_CONFIG[request.priority as keyof typeof PRIORITY_CONFIG] || PRIORITY_CONFIG.medium
  
  const createdDate = new Date(request.created_at)

  // RequirementCard에 전달할 데이터 형식 변환
  const requirementData = {
    system: request.system?.name,
    module: request.module?.name,
    title: request.title,
    description: request.description,
    category_lv1: request.category_lv1?.name,
    category_lv2: request.category_lv2?.name,
    attachments: conversationAttachments
  }

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] bg-gray-50">
      {/* Header */}
      <div className="shrink-0 bg-white border-b border-gray-200 px-6 py-4">
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
              {/* SR 구분 (대분류/소분류) */}
              {request.category_lv1?.name && (
                <span className="text-xs px-2 py-0.5 rounded bg-rose-100 text-rose-700">
                  {request.category_lv1.name}
                  {request.category_lv2?.name && ` / ${request.category_lv2.name}`}
                </span>
              )}
            </div>
            <h1 className="text-xl font-bold text-gray-900 line-clamp-1">
              {request.title}
            </h1>
          </div>
        </div>
      </div>

      {/* Main Content: Responsive 3-Column Layout */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Column 1: Request Details & Comments (Left) - Hidden on mobile, visible from lg */}
        <div className="hidden lg:flex w-[280px] xl:w-[320px] shrink-0 border-r border-gray-200 bg-white flex-col overflow-hidden">
          {/* Request Info Card */}
          <div className="p-4 border-b border-gray-100 overflow-y-auto">
            <h3 className="text-sm font-semibold text-gray-500 mb-3">요청 정보</h3>
            
            <div className="space-y-3">
              {/* Description */}
              <div className="p-3 rounded-lg bg-gray-50 text-xs text-gray-700 whitespace-pre-wrap leading-relaxed">
                {request.description}
              </div>

              {/* Meta Info Grid */}
              <div className="grid grid-cols-1 gap-2.5">
                <div className="flex items-center gap-2 text-sm">
                  <User className="size-4 text-gray-400 shrink-0" />
                  <div className="min-w-0">
                    <span className="text-[11px] text-gray-400 block leading-none mb-1">요청자</span>
                    <span className="text-gray-700 truncate block text-xs">{request.requester?.full_name || request.requester?.email}</span>
                  </div>
                </div>
                
                <div className="flex items-center gap-2 text-sm">
                  <User className="size-4 text-gray-400 shrink-0" />
                  <div className="min-w-0">
                    <span className="text-[11px] text-gray-400 block leading-none mb-1">담당자</span>
                    <span className="text-gray-700 truncate block text-xs">{request.manager?.full_name || '미지정'}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="size-4 text-gray-400 shrink-0" />
                  <div className="min-w-0">
                    <span className="text-[11px] text-gray-400 block leading-none mb-1">신청일</span>
                    <span className="text-gray-700 text-xs">
                      {createdDate.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* History & Comments (Scrollable) */}
          <div className="flex-1 overflow-y-auto scrollbar-hide">
            {/* History Timeline */}
            <div className="p-4 border-b border-gray-100">
              <h3 className="text-xs font-semibold text-gray-500 mb-3 flex items-center gap-2">
                <Clock className="size-4" />
                처리 이력
              </h3>
              <HistoryTimeline history={history || []} compact />
            </div>

            {/* Comments Section */}
            <div className="p-4">
              <h3 className="text-xs font-semibold text-gray-500 mb-3 flex items-center gap-2">
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
        </div>

        {/* Column 2: AI Chat (Middle) - Main focal point */}
        {showChat ? (
          <div className="flex-1 min-w-[400px] flex flex-col overflow-hidden lg:border-r border-gray-200 bg-white">
            <RequestChatArea 
              requestId={request.id}
              conversationId={conversation?.id}
              initialMessages={conversation?.messages || []}
              requestTitle={request.title}
              requestDescription={request.description}
              readOnly={chatReadOnly}
              isLocked={isLocked}
            />
          </div>
        ) : (
          /* 채팅이 숨겨진 경우 (유사 요청 조회 등) 상세 정보를 더 넓게 표시 */
          <div className="flex-1 flex flex-col bg-gray-50 p-8 items-center justify-center text-center">
            <div className="max-w-md">
              <MessageSquare className="size-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">대화 내용 비공개</h3>
              <p className="text-sm text-gray-500">
                개인정보 보호를 위해 요청자와 AI 사이의 상세 대화 내용은 요청 당사자와 담당자만 확인할 수 있습니다.
              </p>
            </div>
          </div>
        )}

        {/* Column 3: Analysis Results (Right) - Keep visible as much as possible */}
        <div className="hidden lg:flex w-[320px] xl:w-[380px] shrink-0 bg-white flex-col overflow-hidden">
          <div className="p-4 border-b border-gray-200 bg-gray-50 shrink-0 flex items-center justify-between">
            <h3 className="font-bold text-gray-900 text-sm flex items-center gap-2">
              <div className="w-1 h-4 kt-gradient rounded-full" />
              요청 분석 결과
            </h3>
          </div>
          <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
            <RequirementCard 
              data={requirementData} 
              readOnly={true}
              excludeRequestId={id}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
