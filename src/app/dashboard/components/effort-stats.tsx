'use client'

import { useEffect, useState } from 'react'
import { getEffortStats, type EffortStatsData } from '../actions'
import { Calculator, TrendingUp, TrendingDown, Minus, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export function EffortStats() {
  const [data, setData] = useState<EffortStatsData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      const result = await getEffortStats()
      if (result.data) {
        setData(result.data)
      }
      setLoading(false)
    }
    fetchData()
  }, [])

  if (loading) {
    return (
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">공수 현황</h3>
        <div className="h-32 flex items-center justify-center">
          <Loader2 className="size-6 animate-spin text-gray-400" />
        </div>
      </div>
    )
  }

  if (!data || data.totalCompleted === 0) {
    return (
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">공수 현황</h3>
        <div className="h-32 flex items-center justify-center text-gray-400">
          <div className="text-center">
            <Calculator className="size-8 mx-auto mb-2 opacity-50" />
            <p>완료된 요청이 없거나 공수 데이터가 없습니다.</p>
          </div>
        </div>
      </div>
    )
  }

  // 예상 대비 실제 공수 차이 계산
  const fpDiff = data.avgActualFp - data.avgEstimatedFp
  const mdDiff = data.avgActualMd - data.avgEstimatedMd

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <Calculator className="size-5 text-emerald-600" />
          공수 현황
        </h3>
        <span className="text-sm text-gray-500">
          완료 {data.totalCompleted}건 중 {data.withEffortData}건 입력
        </span>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* FP 통계 */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700">Function Point (FP)</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-lg bg-gray-50">
              <p className="text-xs text-gray-500 mb-1">평균 예상</p>
              <p className="text-xl font-bold text-gray-900">
                {data.avgEstimatedFp.toFixed(1)}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-emerald-50">
              <p className="text-xs text-emerald-600 mb-1">평균 실제</p>
              <p className="text-xl font-bold text-emerald-700">
                {data.avgActualFp.toFixed(1)}
              </p>
            </div>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">총 실제 FP</span>
            <span className="font-medium text-gray-900">{data.totalActualFp.toFixed(1)}</span>
          </div>
          <DiffIndicator diff={fpDiff} label="예상 대비" />
        </div>

        {/* MD 통계 */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700">Man Day (MD)</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-lg bg-gray-50">
              <p className="text-xs text-gray-500 mb-1">평균 예상</p>
              <p className="text-xl font-bold text-gray-900">
                {data.avgEstimatedMd.toFixed(1)}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-violet-50">
              <p className="text-xs text-violet-600 mb-1">평균 실제</p>
              <p className="text-xl font-bold text-violet-700">
                {data.avgActualMd.toFixed(1)}
              </p>
            </div>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">총 실제 MD</span>
            <span className="font-medium text-gray-900">{data.totalActualMd.toFixed(1)}</span>
          </div>
          <DiffIndicator diff={mdDiff} label="예상 대비" />
        </div>
      </div>
    </div>
  )
}

function DiffIndicator({ diff, label }: { diff: number; label: string }) {
  if (Math.abs(diff) < 0.1) {
    return (
      <div className="flex items-center gap-1 text-sm text-gray-500">
        <Minus className="size-4" />
        <span>{label} 동일</span>
      </div>
    )
  }

  const isOver = diff > 0
  return (
    <div
      className={cn(
        'flex items-center gap-1 text-sm',
        isOver ? 'text-rose-600' : 'text-emerald-600'
      )}
    >
      {isOver ? (
        <TrendingUp className="size-4" />
      ) : (
        <TrendingDown className="size-4" />
      )}
      <span>
        {label} {isOver ? '+' : ''}{diff.toFixed(1)} ({isOver ? '초과' : '절감'})
      </span>
    </div>
  )
}
