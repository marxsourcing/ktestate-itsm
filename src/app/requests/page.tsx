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

  const isManager = profile?.role === 'manager' || profile?.role === 'admin'

  // 요청 목록 조회 (관리자는 전체, 일반 유저는 본인 것만)
  let query = supabase
    .from('service_requests')
    .select(`
      *,
      system:systems(name),
      requester:profiles!service_requests_requester_id_fkey(full_name, email),
      manager:profiles!service_requests_manager_id_fkey(full_name, email)
    `)
    .order('created_at', { ascending: false })

  if (!isManager) {
    query = query.eq('requester_id', user.id)
  }

  const { data: requests } = await query

  // 통계 계산
  const stats = {
    total: requests?.length || 0,
    requested: requests?.filter(r => r.status === 'requested').length || 0,
    processing: requests?.filter(r => r.status === 'reviewing' || r.status === 'processing').length || 0,
    completed: requests?.filter(r => r.status === 'completed').length || 0,
  }

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] bg-gray-50">
      {/* Header */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          {/* Title & Stats */}
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-900">
              {isManager ? '요구사항 현황 보드' : '내 서비스 요청'}
            </h1>
            <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
              <span>전체 <strong className="text-gray-900">{stats.total}</strong></span>
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
          requests={(requests as Request[]) || []}
        />
      </div>
    </div>
  )
}
