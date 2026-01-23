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

  // 병렬로 모든 쿼리 실행
  const [myRequestsResult, testAssignedResult, deployAssignedResult] = await Promise.all([
    // 내게 배정된 요청 목록 조회 (진행중인 것들)
    supabase
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
      .order('created_at', { ascending: true }),

    // 테스트 담당으로 지정된 요청 조회 (test_manager_id가 나인 경우)
    supabase
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
      .neq('manager_id', user.id)
      .eq('status', 'test_requested')
      .order('created_at', { ascending: true }),

    // 배포 승인자로 지정된 요청 조회 (deploy_manager_id가 나인 경우)
    supabase
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
      .neq('manager_id', user.id)
      .eq('status', 'deploy_requested')
      .order('created_at', { ascending: true }),
  ])

  const myRequests = myRequestsResult.data
  const testAssignedRequests = testAssignedResult.data
  const deployAssignedRequests = deployAssignedResult.data

  return (
    <WorkspaceLayout>
      <RequestList
        myRequests={(myRequests as AssignedRequest[]) || []}
        testAssignedRequests={(testAssignedRequests as AssignedRequest[]) || []}
        deployAssignedRequests={(deployAssignedRequests as AssignedRequest[]) || []}
        currentUserId={user.id}
      />
    </WorkspaceLayout>
  )
}
