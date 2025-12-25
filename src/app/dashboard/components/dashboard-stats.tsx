import { getDashboardStats } from '../actions'
import { TrendingUp, TrendingDown, Clock, CheckCircle, AlertCircle, BarChart3 } from 'lucide-react'
import { cn } from '@/lib/utils'

export async function DashboardStats() {
  const { stats, error } = await getDashboardStats()

  if (error || !stats) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
        통계를 불러오는 데 실패했습니다.
      </div>
    )
  }

  const statCards = [
    {
      title: '총 요청',
      value: stats.totalRequests,
      change: stats.requestsChange,
      changeLabel: '지난주 대비',
      icon: BarChart3,
      iconBg: 'bg-blue-100',
      iconColor: 'text-blue-600',
    },
    {
      title: '대기 중',
      value: stats.pendingRequests,
      icon: AlertCircle,
      iconBg: 'bg-amber-100',
      iconColor: 'text-amber-600',
    },
    {
      title: '완료',
      value: stats.completedRequests,
      suffix: `(${stats.completionRate}%)`,
      icon: CheckCircle,
      iconBg: 'bg-emerald-100',
      iconColor: 'text-emerald-600',
    },
    {
      title: '평균 처리일',
      value: stats.avgCompletionDays,
      suffix: '일',
      icon: Clock,
      iconBg: 'bg-violet-100',
      iconColor: 'text-violet-600',
    },
  ]

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
      {statCards.map((card) => (
        <div
          key={card.title}
          className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">{card.title}</p>
              <div className="mt-2 flex items-baseline gap-2">
                <p className="text-3xl font-bold text-gray-900">{card.value}</p>
                {card.suffix && (
                  <span className="text-sm text-gray-500">{card.suffix}</span>
                )}
              </div>
              {card.change !== undefined && (
                <div className="mt-2 flex items-center gap-1">
                  {card.change >= 0 ? (
                    <TrendingUp className="size-4 text-emerald-500" />
                  ) : (
                    <TrendingDown className="size-4 text-red-500" />
                  )}
                  <span
                    className={cn(
                      'text-sm font-medium',
                      card.change >= 0 ? 'text-emerald-600' : 'text-red-600'
                    )}
                  >
                    {card.change >= 0 ? '+' : ''}{card.change}%
                  </span>
                  <span className="text-xs text-gray-400">{card.changeLabel}</span>
                </div>
              )}
            </div>
            <div className={cn('rounded-xl p-3', card.iconBg)}>
              <card.icon className={cn('size-6', card.iconColor)} />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

