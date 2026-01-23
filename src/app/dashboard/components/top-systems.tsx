'use client'

import { useEffect, useState } from 'react'
import { getSystemStats, type SystemStatsData } from '../actions'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts'

export function TopSystems() {
  const [data, setData] = useState<SystemStatsData[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      const result = await getSystemStats()
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
        <h3 className="text-lg font-semibold text-gray-900 mb-4">시스템별 현황</h3>
        <div className="h-64 bg-gray-100 rounded animate-pulse"></div>
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">시스템별 현황</h3>
        <div className="h-64 flex items-center justify-center text-gray-400">
          아직 등록된 요청이 없습니다.
        </div>
      </div>
    )
  }

  // 데이터 개수에 따라 높이 동적 조정 (최소 400px, 항목당 45px)
  const chartHeight = Math.max(400, data.length * 45)

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">시스템별 현황 (Top 10)</h3>
      <div style={{ height: chartHeight }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart 
            data={data} 
            layout="vertical"
            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
            barCategoryGap="20%"
          >
            <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#e5e7eb" />
            <XAxis 
              type="number"
              tick={{ fontSize: 12, fill: '#6b7280' }}
              tickLine={false}
              axisLine={{ stroke: '#e5e7eb' }}
              allowDecimals={false}
            />
            <YAxis
              type="category"
              dataKey="system_name"
              tick={{ fontSize: 12, fill: '#374151' }}
              tickLine={false}
              axisLine={false}
              width={140}
            />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: '#fff', 
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
              }}
              formatter={(value, name) => {
                const labels: Record<string, string> = {
                  pending: '처리 중',
                  completed: '완료'
                }
                return [`${value}건`, labels[name as string] || name]
              }}
            />
            <Legend 
              verticalAlign="top" 
              height={36}
              iconType="circle"
              formatter={(value) => {
                const labels: Record<string, string> = {
                  pending: '처리 중',
                  completed: '완료'
                }
                return <span className="text-gray-600 text-sm">{labels[value] || value}</span>
              }}
            />
            <Bar dataKey="pending" name="pending" fill="#f59e0b" radius={[0, 4, 4, 0]} barSize={16} />
            <Bar dataKey="completed" name="completed" fill="#10b981" radius={[0, 4, 4, 0]} barSize={16} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

