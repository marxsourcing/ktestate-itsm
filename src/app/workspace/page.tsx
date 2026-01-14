import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { WorkspaceLayout } from './components/workspace-layout'
import { RequestList, type AssignedRequest } from './components/request-list'

export default async function WorkspacePage() {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  // 현재 사용자의 role 확인
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name')
    .eq('id', user.id)
    .single()

  const isManager = profile?.role === 'manager' || profile?.role === 'admin'

  // 담당자가 아니면 /requests로 리다이렉트
  if (!isManager) {
    redirect('/requests')
  }

  // 내게 배정된 요청 목록 조회 (처리중인 것만)
  const { data: myRequests } = await supabase
    .from('service_requests')
    .select(`
      *,
      system:systems(name),
      module:system_modules(name),
      requester:profiles!service_requests_requester_id_fkey(full_name, email)
    `)
    .eq('manager_id', user.id)
    .in('status', ['reviewing', 'processing'])
    .order('priority', { ascending: false })
    .order('created_at', { ascending: true })

  // 배정 대기중인 요청 (manager_id가 null인 것)
  const { data: unassignedRequests } = await supabase
    .from('service_requests')
    .select(`
      *,
      system:systems(name),
      module:system_modules(name),
      requester:profiles!service_requests_requester_id_fkey(full_name, email)
    `)
    .is('manager_id', null)
    .in('status', ['requested', 'reviewing'])
    .order('priority', { ascending: false })
    .order('created_at', { ascending: true })

  // 최근 완료된 요청 (7일 이내)
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  
  const { data: recentCompletedRequests } = await supabase
    .from('service_requests')
    .select(`
      *,
      system:systems(name),
      module:system_modules(name),
      requester:profiles!service_requests_requester_id_fkey(full_name, email)
    `)
    .eq('manager_id', user.id)
    .eq('status', 'completed')
    .gte('completed_at', sevenDaysAgo.toISOString())
    .order('completed_at', { ascending: false })
    .limit(10)

  // 통계 계산
  const stats = {
    myTotal: myRequests?.length || 0,
    urgent: myRequests?.filter(r => r.priority === 'urgent').length || 0,
    high: myRequests?.filter(r => r.priority === 'high').length || 0,
    unassigned: unassignedRequests?.length || 0,
    recentCompleted: recentCompletedRequests?.length || 0,
  }

  return (
    <WorkspaceLayout 
      stats={stats}
      managerName={profile?.full_name || user.email?.split('@')[0] || '담당자'}
    >
      <RequestList 
        myRequests={(myRequests as AssignedRequest[]) || []}
        unassignedRequests={(unassignedRequests as AssignedRequest[]) || []}
        recentCompletedRequests={(recentCompletedRequests as AssignedRequest[]) || []}
        currentUserId={user.id}
      />
    </WorkspaceLayout>
  )
}

