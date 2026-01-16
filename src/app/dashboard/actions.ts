'use server'

import { createClient } from '@/lib/supabase/server'

export interface DashboardStatsData {
  totalRequests: number
  pendingRequests: number
  completedRequests: number
  avgCompletionDays: number
  requestsChange: number
  completionRate: number
}

export async function getDashboardStats(): Promise<{ stats?: DashboardStatsData; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: '로그인이 필요합니다.' }
  }

  // 전체 요청 수
  const { count: totalRequests } = await supabase
    .from('service_requests')
    .select('*', { count: 'exact', head: true })

  // 대기 중인 요청 (draft, requested, approved, consulting)
  const { count: pendingRequests } = await supabase
    .from('service_requests')
    .select('*', { count: 'exact', head: true })
    .in('status', ['draft', 'requested', 'approved', 'consulting'])

  // 완료된 요청
  const { count: completedRequests } = await supabase
    .from('service_requests')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'completed')

  // 완료된 요청의 평균 처리 일수
  const { data: completedData } = await supabase
    .from('service_requests')
    .select('created_at, completed_at')
    .eq('status', 'completed')
    .not('completed_at', 'is', null)

  let avgCompletionDays = 0
  if (completedData && completedData.length > 0) {
    const totalDays = completedData.reduce((sum, req) => {
      const created = new Date(req.created_at)
      const completed = new Date(req.completed_at!)
      const days = Math.ceil((completed.getTime() - created.getTime()) / (1000 * 60 * 60 * 24))
      return sum + days
    }, 0)
    avgCompletionDays = Math.round(totalDays / completedData.length)
  }

  // 이번 주 요청 수 vs 지난 주 요청 수
  const now = new Date()
  const thisWeekStart = new Date(now)
  thisWeekStart.setDate(now.getDate() - 7)
  const lastWeekStart = new Date(thisWeekStart)
  lastWeekStart.setDate(thisWeekStart.getDate() - 7)

  const { count: thisWeekCount } = await supabase
    .from('service_requests')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', thisWeekStart.toISOString())

  const { count: lastWeekCount } = await supabase
    .from('service_requests')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', lastWeekStart.toISOString())
    .lt('created_at', thisWeekStart.toISOString())

  const requestsChange = lastWeekCount 
    ? Math.round(((thisWeekCount || 0) - lastWeekCount) / lastWeekCount * 100)
    : 0

  // 완료율
  const completionRate = totalRequests 
    ? Math.round((completedRequests || 0) / totalRequests * 100)
    : 0

  return {
    stats: {
      totalRequests: totalRequests || 0,
      pendingRequests: pendingRequests || 0,
      completedRequests: completedRequests || 0,
      avgCompletionDays,
      requestsChange,
      completionRate
    }
  }
}

export interface RequestsTrendData {
  date: string
  requests: number
  completed: number
}

export async function getRequestsTrend(): Promise<{ data?: RequestsTrendData[]; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: '로그인이 필요합니다.' }
  }

  // 최근 30일 데이터
  const days = 30
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days)

  const { data: requests } = await supabase
    .from('service_requests')
    .select('created_at, status, completed_at')
    .gte('created_at', startDate.toISOString())

  // 일별로 그룹핑
  const trendMap = new Map<string, { requests: number; completed: number }>()
  
  for (let i = 0; i < days; i++) {
    const date = new Date()
    date.setDate(date.getDate() - (days - 1 - i))
    const dateStr = date.toISOString().split('T')[0]
    trendMap.set(dateStr, { requests: 0, completed: 0 })
  }

  requests?.forEach(req => {
    const createdDate = req.created_at.split('T')[0]
    if (trendMap.has(createdDate)) {
      const current = trendMap.get(createdDate)!
      trendMap.set(createdDate, { ...current, requests: current.requests + 1 })
    }

    if (req.completed_at) {
      const completedDate = req.completed_at.split('T')[0]
      if (trendMap.has(completedDate)) {
        const current = trendMap.get(completedDate)!
        trendMap.set(completedDate, { ...current, completed: current.completed + 1 })
      }
    }
  })

  const trendData: RequestsTrendData[] = []
  trendMap.forEach((value, key) => {
    trendData.push({
      date: key,
      requests: value.requests,
      completed: value.completed
    })
  })

  return { data: trendData }
}

export interface StatusData {
  status: string
  count: number
  label: string
}

export async function getStatusDistribution(): Promise<{ data?: StatusData[]; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: '로그인이 필요합니다.' }
  }

  const statusLabels: Record<string, string> = {
    draft: '작성중',
    requested: '요청',
    approved: '승인',
    consulting: '실무협의',
    accepted: '접수',
    processing: '처리중',
    test_requested: '테스트요청',
    test_completed: '테스트완료',
    deploy_requested: '배포요청',
    deploy_approved: '배포승인',
    completed: '완료',
    rejected: '반려'
  }

  const statuses = Object.keys(statusLabels)
  const result: StatusData[] = []

  for (const status of statuses) {
    const { count } = await supabase
      .from('service_requests')
      .select('*', { count: 'exact', head: true })
      .eq('status', status)

    result.push({
      status,
      count: count || 0,
      label: statusLabels[status]
    })
  }

  return { data: result }
}

export interface RecentRequestData {
  id: string
  title: string
  status: string
  priority: string
  requester_name: string
  created_at: string
}

export async function getRecentRequests(): Promise<{ data?: RecentRequestData[]; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: '로그인이 필요합니다.' }
  }

  const { data: requests, error } = await supabase
    .from('service_requests')
    .select(`
      id,
      title,
      status,
      priority,
      created_at,
      requester:profiles!service_requests_requester_id_fkey(full_name)
    `)
    .order('created_at', { ascending: false })
    .limit(5)

  if (error) {
    return { error: error.message }
  }

  const result: RecentRequestData[] = requests.map(req => {
    const requester = req.requester as unknown as { full_name: string | null } | null
    return {
      id: req.id,
      title: req.title,
      status: req.status,
      priority: req.priority,
      requester_name: requester?.full_name || '알 수 없음',
      created_at: req.created_at
    }
  })

  return { data: result }
}

export interface SystemStatsData {
  system_id: string
  system_name: string
  total: number
  pending: number
  completed: number
}

export async function getSystemStats(): Promise<{ data?: SystemStatsData[]; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: '로그인이 필요합니다.' }
  }

  // 시스템별 요청 현황
  const { data: systems } = await supabase
    .from('systems')
    .select('id, name')

  if (!systems) {
    return { data: [] }
  }

  const result: SystemStatsData[] = []

  for (const system of systems) {
    const { count: total } = await supabase
      .from('service_requests')
      .select('*', { count: 'exact', head: true })
      .eq('system_id', system.id)

    const { count: pending } = await supabase
      .from('service_requests')
      .select('*', { count: 'exact', head: true })
      .eq('system_id', system.id)
      .in('status', ['draft', 'requested', 'approved', 'consulting', 'accepted', 'processing', 'test_requested', 'test_completed', 'deploy_requested', 'deploy_approved'])

    const { count: completed } = await supabase
      .from('service_requests')
      .select('*', { count: 'exact', head: true })
      .eq('system_id', system.id)
      .eq('status', 'completed')

    if (total && total > 0) {
      result.push({
        system_id: system.id,
        system_name: system.name,
        total: total || 0,
        pending: pending || 0,
        completed: completed || 0
      })
    }
  }

  // 시스템 미지정 요청
  const { count: noSystemTotal } = await supabase
    .from('service_requests')
    .select('*', { count: 'exact', head: true })
    .is('system_id', null)

  if (noSystemTotal && noSystemTotal > 0) {
    const { count: noSystemPending } = await supabase
      .from('service_requests')
      .select('*', { count: 'exact', head: true })
      .is('system_id', null)
      .in('status', ['draft', 'requested', 'approved', 'consulting', 'accepted', 'processing', 'test_requested', 'test_completed', 'deploy_requested', 'deploy_approved'])

    const { count: noSystemCompleted } = await supabase
      .from('service_requests')
      .select('*', { count: 'exact', head: true })
      .is('system_id', null)
      .eq('status', 'completed')

    result.push({
      system_id: 'none',
      system_name: '미지정',
      total: noSystemTotal || 0,
      pending: noSystemPending || 0,
      completed: noSystemCompleted || 0
    })
  }

  // 총 요청 수 기준 정렬
  result.sort((a, b) => b.total - a.total)

  return { data: result.slice(0, 10) }
}

export interface ManagerStatsData {
  manager_id: string
  manager_name: string
  manager_email: string
  total: number
  pending: number
  processing: number
  completed: number
  rejected: number
  avg_days: number
}

export async function getManagerStats(): Promise<{ data?: ManagerStatsData[]; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: '로그인이 필요합니다.' }
  }

  // 담당자 역할의 사용자 목록 조회
  const { data: managers } = await supabase
    .from('profiles')
    .select('id, full_name, email')
    .in('role', ['manager', 'admin'])

  if (!managers) {
    return { data: [] }
  }

  const result: ManagerStatsData[] = []

  for (const manager of managers) {
    // 해당 담당자의 전체 요청 수
    const { count: total } = await supabase
      .from('service_requests')
      .select('*', { count: 'exact', head: true })
      .eq('manager_id', manager.id)

    if (!total || total === 0) continue

    // 대기 중 (draft, requested, approved, consulting, accepted)
    const { count: pending } = await supabase
      .from('service_requests')
      .select('*', { count: 'exact', head: true })
      .eq('manager_id', manager.id)
      .in('status', ['draft', 'requested', 'approved', 'consulting', 'accepted'])

    // 처리 중
    const { count: processing } = await supabase
      .from('service_requests')
      .select('*', { count: 'exact', head: true })
      .eq('manager_id', manager.id)
      .eq('status', 'processing')

    // 완료
    const { count: completed } = await supabase
      .from('service_requests')
      .select('*', { count: 'exact', head: true })
      .eq('manager_id', manager.id)
      .eq('status', 'completed')

    // 반려
    const { count: rejected } = await supabase
      .from('service_requests')
      .select('*', { count: 'exact', head: true })
      .eq('manager_id', manager.id)
      .eq('status', 'rejected')

    // 평균 처리일 계산 (완료된 요청만)
    const { data: completedData } = await supabase
      .from('service_requests')
      .select('created_at, completed_at')
      .eq('manager_id', manager.id)
      .eq('status', 'completed')
      .not('completed_at', 'is', null)

    let avgDays = 0
    if (completedData && completedData.length > 0) {
      const totalDays = completedData.reduce((sum, req) => {
        const created = new Date(req.created_at)
        const completedAt = new Date(req.completed_at!)
        const days = Math.ceil((completedAt.getTime() - created.getTime()) / (1000 * 60 * 60 * 24))
        return sum + days
      }, 0)
      avgDays = Math.round((totalDays / completedData.length) * 10) / 10
    }

    result.push({
      manager_id: manager.id,
      manager_name: manager.full_name || '이름 없음',
      manager_email: manager.email,
      total: total || 0,
      pending: pending || 0,
      processing: processing || 0,
      completed: completed || 0,
      rejected: rejected || 0,
      avg_days: avgDays
    })
  }

  // 배정된 요청 수 기준 정렬
  result.sort((a, b) => b.total - a.total)

  return { data: result }
}

export interface EffortStatsData {
  totalCompleted: number
  withEffortData: number
  avgEstimatedFp: number
  avgActualFp: number
  totalActualFp: number
  avgEstimatedMd: number
  avgActualMd: number
  totalActualMd: number
}

export async function getEffortStats(): Promise<{ data?: EffortStatsData; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: '로그인이 필요합니다.' }
  }

  // 완료된 요청 중 공수 데이터가 있는 것만 조회
  const { data: completedRequests, count: totalCompleted } = await supabase
    .from('service_requests')
    .select('estimated_fp, actual_fp, estimated_md, actual_md', { count: 'exact' })
    .eq('status', 'completed')

  if (!completedRequests || completedRequests.length === 0) {
    return {
      data: {
        totalCompleted: 0,
        withEffortData: 0,
        avgEstimatedFp: 0,
        avgActualFp: 0,
        totalActualFp: 0,
        avgEstimatedMd: 0,
        avgActualMd: 0,
        totalActualMd: 0
      }
    }
  }

  // 공수 데이터가 있는 요청만 필터링
  const withEffort = completedRequests.filter(
    r => r.estimated_fp != null || r.actual_fp != null || r.estimated_md != null || r.actual_md != null
  )

  if (withEffort.length === 0) {
    return {
      data: {
        totalCompleted: totalCompleted || 0,
        withEffortData: 0,
        avgEstimatedFp: 0,
        avgActualFp: 0,
        totalActualFp: 0,
        avgEstimatedMd: 0,
        avgActualMd: 0,
        totalActualMd: 0
      }
    }
  }

  // FP 통계 계산
  const fpData = withEffort.filter(r => r.estimated_fp != null || r.actual_fp != null)
  let totalEstimatedFp = 0
  let totalActualFp = 0
  let fpCount = 0

  fpData.forEach(r => {
    if (r.estimated_fp != null) totalEstimatedFp += r.estimated_fp
    if (r.actual_fp != null) totalActualFp += r.actual_fp
    if (r.estimated_fp != null || r.actual_fp != null) fpCount++
  })

  // MD 통계 계산
  const mdData = withEffort.filter(r => r.estimated_md != null || r.actual_md != null)
  let totalEstimatedMd = 0
  let totalActualMd = 0
  let mdCount = 0

  mdData.forEach(r => {
    if (r.estimated_md != null) totalEstimatedMd += r.estimated_md
    if (r.actual_md != null) totalActualMd += r.actual_md
    if (r.estimated_md != null || r.actual_md != null) mdCount++
  })

  return {
    data: {
      totalCompleted: totalCompleted || 0,
      withEffortData: withEffort.length,
      avgEstimatedFp: fpCount > 0 ? totalEstimatedFp / fpCount : 0,
      avgActualFp: fpCount > 0 ? totalActualFp / fpCount : 0,
      totalActualFp,
      avgEstimatedMd: mdCount > 0 ? totalEstimatedMd / mdCount : 0,
      avgActualMd: mdCount > 0 ? totalActualMd / mdCount : 0,
      totalActualMd
    }
  }
}
