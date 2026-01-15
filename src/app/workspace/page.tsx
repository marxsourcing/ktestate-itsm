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

  // 내게 배정된 요청 목록 조회 (진행중인 것들)
  const { data: myRequests } = await supabase
    .from('service_requests')
    .select(`
      *,
      system:systems(id, name),
      module:system_modules(id, name),
      requester:profiles!service_requests_requester_id_fkey(full_name, email),
      test_manager:profiles!service_requests_test_manager_id_fkey(full_name, email),
      deploy_manager:profiles!service_requests_deploy_manager_id_fkey(full_name, email),
      category_lv1:request_categories_lv1(id, name),
      category_lv2:request_categories_lv2(id, name)
    `)
    .eq('manager_id', user.id)
    .in('status', ['requested', 'approved', 'consulting', 'accepted', 'processing', 'test_requested', 'test_completed', 'deploy_requested', 'deploy_approved'])
    .order('priority', { ascending: false })
    .order('created_at', { ascending: true })

  // 테스트 담당으로 지정된 요청 조회 (test_manager_id가 나인 경우)
  const { data: testAssignedRequests } = await supabase
    .from('service_requests')
    .select(`
      *,
      system:systems(id, name),
      module:system_modules(id, name),
      requester:profiles!service_requests_requester_id_fkey(full_name, email),
      manager:profiles!service_requests_manager_id_fkey(full_name, email),
      category_lv1:request_categories_lv1(id, name),
      category_lv2:request_categories_lv2(id, name)
    `)
    .eq('test_manager_id', user.id)
    .neq('manager_id', user.id) // 본인이 담당자가 아닌 경우만
    .eq('status', 'test_requested')
    .order('created_at', { ascending: true })

  // 배포 승인자로 지정된 요청 조회 (deploy_manager_id가 나인 경우)
  const { data: deployAssignedRequests } = await supabase
    .from('service_requests')
    .select(`
      *,
      system:systems(id, name),
      module:system_modules(id, name),
      requester:profiles!service_requests_requester_id_fkey(full_name, email),
      manager:profiles!service_requests_manager_id_fkey(full_name, email),
      category_lv1:request_categories_lv1(id, name),
      category_lv2:request_categories_lv2(id, name)
    `)
    .eq('deploy_manager_id', user.id)
    .neq('manager_id', user.id) // 본인이 담당자가 아닌 경우만
    .eq('status', 'deploy_requested')
    .order('created_at', { ascending: true })

  // 배정 대기중인 요청 (manager_id가 null인 것)
  const { data: unassignedRequests } = await supabase
    .from('service_requests')
    .select(`
      *,
      system:systems(id, name),
      module:system_modules(id, name),
      requester:profiles!service_requests_requester_id_fkey(full_name, email),
      category_lv1:request_categories_lv1(id, name),
      category_lv2:request_categories_lv2(id, name)
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
      system:systems(id, name),
      module:system_modules(id, name),
      requester:profiles!service_requests_requester_id_fkey(full_name, email),
      category_lv1:request_categories_lv1(id, name),
      category_lv2:request_categories_lv2(id, name)
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
    testAssigned: testAssignedRequests?.length || 0,
    deployAssigned: deployAssignedRequests?.length || 0,
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
        testAssignedRequests={(testAssignedRequests as AssignedRequest[]) || []}
        deployAssignedRequests={(deployAssignedRequests as AssignedRequest[]) || []}
        currentUserId={user.id}
      />
    </WorkspaceLayout>
  )
}

