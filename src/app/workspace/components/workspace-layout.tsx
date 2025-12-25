'use client'

import { ReactNode } from 'react'
import { Badge } from '@/components/ui/badge'
import { 
  Briefcase, 
  AlertTriangle, 
  ArrowUp, 
  Inbox, 
  CheckCircle2,
  Sparkles
} from 'lucide-react'

interface WorkspaceLayoutProps {
  children: ReactNode
  stats: {
    myTotal: number
    urgent: number
    high: number
    unassigned: number
    recentCompleted: number
  }
  managerName: string
}

export function WorkspaceLayout({ children, stats, managerName }: WorkspaceLayoutProps) {
  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] bg-gradient-to-br from-slate-50 to-gray-100">
      {/* Header */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200 px-6 py-5">
        <div className="flex flex-col lg:flex-row lg:items-center gap-4">
          {/* Title Section */}
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/25">
                <Briefcase className="size-5 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  워크스페이스
                </h1>
                <p className="text-sm text-gray-500">
                  안녕하세요, <span className="font-medium text-gray-700">{managerName}</span>님! 오늘도 화이팅 💪
                </p>
              </div>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="flex flex-wrap gap-3">
            <StatCard
              icon={<Briefcase className="size-4" />}
              label="내 작업"
              value={stats.myTotal}
              gradient="from-indigo-500 to-indigo-600"
            />
            {stats.urgent > 0 && (
              <StatCard
                icon={<AlertTriangle className="size-4" />}
                label="긴급"
                value={stats.urgent}
                gradient="from-rose-500 to-red-600"
                highlight
              />
            )}
            {stats.high > 0 && (
              <StatCard
                icon={<ArrowUp className="size-4" />}
                label="높음"
                value={stats.high}
                gradient="from-orange-500 to-amber-600"
              />
            )}
            <StatCard
              icon={<Inbox className="size-4" />}
              label="배정 대기"
              value={stats.unassigned}
              gradient="from-gray-500 to-gray-600"
            />
            <StatCard
              icon={<CheckCircle2 className="size-4" />}
              label="최근 완료"
              value={stats.recentCompleted}
              gradient="from-emerald-500 to-green-600"
            />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        {children}
      </div>
    </div>
  )
}

function StatCard({
  icon,
  label,
  value,
  gradient,
  highlight = false,
}: {
  icon: ReactNode
  label: string
  value: number
  gradient: string
  highlight?: boolean
}) {
  return (
    <div 
      className={`
        flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-white border
        ${highlight ? 'border-red-200 animate-pulse' : 'border-gray-200'}
        shadow-sm
      `}
    >
      <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${gradient} flex items-center justify-center text-white shadow-sm`}>
        {icon}
      </div>
      <div>
        <p className="text-xs text-gray-500">{label}</p>
        <p className="text-lg font-bold text-gray-900">{value}</p>
      </div>
    </div>
  )
}

