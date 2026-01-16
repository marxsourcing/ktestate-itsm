import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ManagerStatsTable } from './components/manager-stats-table'

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 10

interface PageProps {
  searchParams: Promise<{ page?: string; sort?: string; order?: string }>
}

export default async function ManagersPage({ searchParams }: PageProps) {
  const params = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // 관리자만 접근 가능
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'admin') {
    redirect('/dashboard')
  }

  // 페이지네이션 파라미터
  const currentPage = parseInt(params.page || '1', 10)
  const sortBy = params.sort || 'total'
  const sortOrder = params.order || 'desc'

  // 담당자 목록 조회 (manager, admin 역할)
  const { data: managers } = await supabase
    .from('profiles')
    .select('id, full_name, email')
    .in('role', ['manager', 'admin'])

  if (!managers) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-2xl font-bold text-gray-900">담당자 현황</h1>
          <p className="text-gray-500 mt-2">데이터를 불러올 수 없습니다.</p>
        </div>
      </div>
    )
  }

  // 각 담당자별 통계 조회
  const managerStats = await Promise.all(
    managers.map(async (manager) => {
      const { count: total } = await supabase
        .from('service_requests')
        .select('*', { count: 'exact', head: true })
        .eq('manager_id', manager.id)

      const { count: pending } = await supabase
        .from('service_requests')
        .select('*', { count: 'exact', head: true })
        .eq('manager_id', manager.id)
        .in('status', ['draft', 'requested', 'approved', 'consulting', 'accepted'])

      const { count: processing } = await supabase
        .from('service_requests')
        .select('*', { count: 'exact', head: true })
        .eq('manager_id', manager.id)
        .in('status', ['processing', 'test_requested', 'test_completed', 'deploy_requested', 'deploy_approved'])

      const { count: completed } = await supabase
        .from('service_requests')
        .select('*', { count: 'exact', head: true })
        .eq('manager_id', manager.id)
        .eq('status', 'completed')

      const { count: rejected } = await supabase
        .from('service_requests')
        .select('*', { count: 'exact', head: true })
        .eq('manager_id', manager.id)
        .eq('status', 'rejected')

      // 평균 처리일 계산
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

      // 공수 통계 계산
      const { data: effortData } = await supabase
        .from('service_requests')
        .select('actual_fp, actual_md')
        .eq('manager_id', manager.id)
        .eq('status', 'completed')

      let totalFp = 0
      let totalMd = 0
      if (effortData) {
        effortData.forEach(r => {
          if (r.actual_fp != null) totalFp += r.actual_fp
          if (r.actual_md != null) totalMd += r.actual_md
        })
      }

      return {
        manager_id: manager.id,
        manager_name: manager.full_name || '이름 없음',
        manager_email: manager.email,
        total: total || 0,
        pending: pending || 0,
        processing: processing || 0,
        completed: completed || 0,
        rejected: rejected || 0,
        avg_days: avgDays,
        total_fp: totalFp,
        total_md: totalMd
      }
    })
  )

  // 배정된 요청이 있는 담당자만 필터링
  const filteredStats = managerStats.filter(m => m.total > 0)

  // 정렬
  const sortedStats = [...filteredStats].sort((a, b) => {
    const aValue = a[sortBy as keyof typeof a] as number
    const bValue = b[sortBy as keyof typeof b] as number
    return sortOrder === 'desc' ? bValue - aValue : aValue - bValue
  })

  // 페이지네이션
  const totalCount = sortedStats.length
  const totalPages = Math.ceil(totalCount / PAGE_SIZE)
  const startIndex = (currentPage - 1) * PAGE_SIZE
  const paginatedStats = sortedStats.slice(startIndex, startIndex + PAGE_SIZE)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <h1 className="text-2xl font-bold text-gray-900">담당자별 현황</h1>
          <p className="mt-1 text-sm text-gray-500">
            담당자별 요청 처리 현황 및 공수 통계를 확인하세요
          </p>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <ManagerStatsTable
          data={paginatedStats}
          totalCount={totalCount}
          totalPages={totalPages}
          currentPage={currentPage}
          pageSize={PAGE_SIZE}
          sortBy={sortBy}
          sortOrder={sortOrder}
        />
      </main>
    </div>
  )
}
