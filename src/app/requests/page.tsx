import { createClient } from '@/lib/supabase/server'
import { KanbanBoard, type Request } from '@/components/requests/kanban-board'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { redirect } from 'next/navigation'

export default async function RequestsPage() {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  // 현재 사용자의 role 확인
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const isAdmin = profile?.role === 'admin'
  const isManagerOnly = profile?.role === 'manager'
  const isManager = isManagerOnly || isAdmin // UI용 (관리 권한 여부)

  // 요청 목록 조회 (관리자: 전체, 담당자: 배정된 건, 요청자: 본인 건)
  let query = supabase
    .from('service_requests')
    .select(`
      *,
      system:systems(name),
      module:system_modules(name),
      requester:profiles!service_requests_requester_id_fkey(full_name, email),
      manager:profiles!service_requests_manager_id_fkey(full_name, email),
      category_lv1:request_categories_lv1(id, name),
      category_lv2:request_categories_lv2(id, name)
    `)
    .order('created_at', { ascending: false })

  if (isAdmin) {
    // 모든 요청 노출
  } else if (isManagerOnly) {
    query = query.eq('manager_id', user.id)
  } else {
    query = query.eq('requester_id', user.id)
  }

  const { data: requests } = await query

  // 작성중인 대화(Conversations) 조회 (요청자 전용)
  let drafts: Request[] = []
  if (!isManager) {
    const { data: conversationDrafts } = await supabase
      .from('conversations')
      .select('*')
      .eq('user_id', user.id)
      .is('request_id', null) // 아직 요청으로 확정되지 않은 대화
      .order('created_at', { ascending: false })
    
    if (conversationDrafts) {
      drafts = conversationDrafts.map(d => ({
        id: d.id,
        title: d.title || '작성 중인 요청',
        description: '채팅을 통해 요청을 작성 중입니다.',
        status: 'draft_chat',
        priority: 'medium',
        created_at: d.created_at,
        is_chat_draft: true
      }))
    }
  }

  // 모든 데이터 통합 (기존 DB의 status: 'draft' 건 포함)
  const allRequests = [
    ...drafts,
    ...(requests || [])
  ]

  // 통계 계산
  const stats = {
    total: allRequests.length,
    requested: allRequests.filter(r => r.status === 'requested').length,
    processing: allRequests.filter(r => 
      !['draft', 'draft_chat', 'requested', 'completed', 'rejected'].includes(r.status)
    ).length,
    completed: allRequests.filter(r => r.status === 'completed').length,
  }

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] bg-gray-50">
      {/* Header */}
      <div className="shrink-0 bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          {/* Title & Stats */}
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-900">
              {isManager ? '요구사항 현황 보드' : '내 서비스 요청'}
            </h1>
            <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
              <span>전체 <strong className="text-gray-900">{stats.total}</strong></span>
              {!isManager && (
                <span>작성중 <strong className="text-gray-600">{allRequests.filter(r => r.status.includes('draft')).length}</strong></span>
              )}
              <span>대기 <strong className="text-amber-600">{stats.requested}</strong></span>
              <span>진행 <strong className="text-blue-600">{stats.processing}</strong></span>
              <span>완료 <strong className="text-emerald-600">{stats.completed}</strong></span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <Button asChild>
              <Link href="/requests/new">
                <Plus className="size-4 mr-2" />
                새 요청
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {/* Kanban Board - 조회 전용 (드래그앤드롭 상태 변경 비활성화) */}
      <div className="flex-1 overflow-hidden p-6">
        <KanbanBoard
          requests={(allRequests as Request[]) || []}
          isManager={isManager}
        />
      </div>
    </div>
  )
}
