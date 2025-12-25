'use client'

import { useEffect, useState } from 'react'
import { getStatusDistribution, type StatusData } from '../actions'
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend
} from 'recharts'

const COLORS = {
  requested: '#f59e0b',
  reviewing: '#3b82f6',
  processing: '#8b5cf6',
  completed: '#10b981',
  rejected: '#ef4444'
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
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              data={data as any}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={90}
              paddingAngle={2}
              dataKey="count"
              nameKey="label"
              label={({ name, percent }: { name?: string; percent?: number }) => 
                `${name || ''} ${((percent || 0) * 100).toFixed(0)}%`
              }
              labelLine={false}
            >
              {data.map((entry) => (
                <Cell 
                  key={`cell-${entry.status}`} 
                  fill={COLORS[entry.status as keyof typeof COLORS]}
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
      <div className="mt-4 flex flex-wrap justify-center gap-4">
        {data.map((entry) => (
          <div key={entry.status} className="flex items-center gap-2">
            <div 
              className="size-3 rounded-full" 
              style={{ backgroundColor: COLORS[entry.status as keyof typeof COLORS] }}
            />
            <span className="text-sm text-gray-600">
              {entry.label}: {entry.count}건
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

