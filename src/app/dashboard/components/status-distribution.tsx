'use client'

import { useEffect, useState } from 'react'
import { getStatusDistribution, type StatusData } from '../actions'
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip
} from 'recharts'

// 12개 상태에 모두 고유한 색상 지정
const COLORS: Record<string, string> = {
  draft: '#9ca3af',         // 회색 - 작성중
  requested: '#f59e0b',     // 주황색 - 요청
  approved: '#3b82f6',      // 파란색 - 승인
  consulting: '#06b6d4',    // 시안색 - 실무협의
  accepted: '#6366f1',      // 인디고색 - 접수
  processing: '#8b5cf6',    // 보라색 - 처리중
  test_requested: '#ec4899', // 핑크색 - 테스트요청
  test_completed: '#d946ef', // 자홍색 - 테스트완료
  deploy_requested: '#14b8a6', // 틸색 - 배포요청
  deploy_approved: '#0ea5e9', // 하늘색 - 배포승인
  completed: '#10b981',     // 초록색 - 완료
  rejected: '#ef4444'       // 빨간색 - 반려
}

export function StatusDistribution() {
  const [data, setData] = useState<StatusData[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      const result = await getStatusDistribution()
      if (result.data) {
        setData(result.data.filter(d => d.count > 0))
      }
      setLoading(false)
    }
    fetchData()
  }, [])

  if (loading) {
    return (
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">상태별 분포</h3>
        <div className="h-64 bg-gray-100 rounded animate-pulse"></div>
      </div>
    )
  }

  const total = data.reduce((sum, d) => sum + d.count, 0)

  if (total === 0) {
    return (
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">상태별 분포</h3>
        <div className="h-64 flex items-center justify-center text-gray-400">
          아직 등록된 요청이 없습니다.
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">상태별 분포</h3>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              data={data as any}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={95}
              paddingAngle={2}
              dataKey="count"
              nameKey="label"
            >
              {data.map((entry) => (
                <Cell 
                  key={`cell-${entry.status}`} 
                  fill={COLORS[entry.status] || '#6b7280'}
                  stroke="none"
                />
              ))}
            </Pie>
            <Tooltip 
              formatter={(value, name) => [`${value}건`, name as string]}
              contentStyle={{ 
                backgroundColor: '#fff', 
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      
      {/* Legend */}
      <div className="mt-4 flex flex-wrap justify-center gap-3">
        {data.map((entry) => (
          <div key={entry.status} className="flex items-center gap-1.5">
            <div 
              className="size-2.5 rounded-full" 
              style={{ backgroundColor: COLORS[entry.status] || '#6b7280' }}
            />
            <span className="text-xs text-gray-600">
              {entry.label}: {entry.count}건
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

