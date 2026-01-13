import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { DashboardStats } from './components/dashboard-stats'
import { RequestsChart } from './components/requests-chart'
import { StatusDistribution } from './components/status-distribution'
import { RecentRequests } from './components/recent-requests'
import { TopSystems } from './components/top-systems'
import { ManagerStats } from './components/manager-stats'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // 사용자 프로필 조회
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  // 관리자만 접근 가능 (요구사항: 대시보드는 관리자 전용)
  if (!profile || profile.role !== 'admin') {
    redirect('/chat')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <h1 className="text-2xl font-bold text-gray-900">대시보드</h1>
          <p className="mt-1 text-sm text-gray-500">
            IT 요구사항 현황을 한눈에 확인하세요
          </p>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Overview */}
        <Suspense fallback={<StatsLoading />}>
          <DashboardStats />
        </Suspense>

        {/* Charts Row */}
        <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-8">
          <Suspense fallback={<ChartLoading title="요청 추이" />}>
            <RequestsChart />
          </Suspense>
          <Suspense fallback={<ChartLoading title="상태 분포" />}>
            <StatusDistribution />
          </Suspense>
        </div>

        {/* Bottom Row */}
        <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-8">
          <Suspense fallback={<ChartLoading title="최근 요청" />}>
            <RecentRequests />
          </Suspense>
          <Suspense fallback={<ChartLoading title="시스템별 현황" />}>
            <TopSystems />
          </Suspense>
        </div>

        {/* Manager Stats */}
        <div className="mt-8">
          <Suspense fallback={<ChartLoading title="담당자별 현황" />}>
            <ManagerStats />
          </Suspense>
        </div>
      </main>
    </div>
  )
}

function StatsLoading() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-24 mb-4"></div>
          <div className="h-8 bg-gray-200 rounded w-16"></div>
        </div>
      ))}
    </div>
  )
}

function ChartLoading({ title }: { title: string }) {
  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>
      <div className="h-64 bg-gray-100 rounded animate-pulse"></div>
    </div>
  )
}

