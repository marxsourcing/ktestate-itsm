'use client'

import { useEffect, useState } from 'react'
import { getManagerStats, type ManagerStatsData } from '../actions'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { User, Clock, CheckCircle, XCircle, AlertCircle, Loader2, ArrowRight } from 'lucide-react'
import Link from 'next/link'

const MAX_DISPLAY = 5 // 대시보드에서 보여줄 최대 담당자 수

export function ManagerStats() {
  const [data, setData] = useState<ManagerStatsData[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      const result = await getManagerStats()
      if (result.data) {
        setTotalCount(result.data.length)
        setData(result.data.slice(0, MAX_DISPLAY)) // 상위 5명만 표시
      }
      setLoading(false)
    }
    fetchData()
  }, [])

  if (loading) {
    return (
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">담당자별 현황</h3>
        <div className="h-64 flex items-center justify-center">
          <Loader2 className="size-6 animate-spin text-gray-400" />
        </div>
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">담당자별 현황</h3>
        <div className="h-64 flex items-center justify-center text-gray-400">
          <div className="text-center">
            <User className="size-8 mx-auto mb-2 opacity-50" />
            <p>배정된 요청이 없습니다.</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">담당자별 현황</h3>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">
            {totalCount > MAX_DISPLAY ? `상위 ${MAX_DISPLAY}명` : `${totalCount}명`}
          </span>
          {totalCount > MAX_DISPLAY && (
            <Button variant="ghost" size="sm" asChild className="text-blue-600 hover:text-blue-700 h-auto p-0">
              <Link href="/admin/managers" className="flex items-center gap-1">
                전체 보기
                <ArrowRight className="size-3" />
              </Link>
            </Button>
          )}
        </div>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-[140px]">담당자</TableHead>
              <TableHead className="text-center w-[60px]">배정</TableHead>
              <TableHead className="text-center w-[60px]">대기</TableHead>
              <TableHead className="text-center w-[60px]">처리중</TableHead>
              <TableHead className="text-center w-[60px]">완료</TableHead>
              <TableHead className="text-center w-[60px]">반려</TableHead>
              <TableHead className="text-center w-[80px]">평균 처리일</TableHead>
              <TableHead className="text-center w-[80px]">완료율</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((manager) => {
              const completionRate = manager.total > 0
                ? Math.round((manager.completed / manager.total) * 100)
                : 0

              return (
                <TableRow key={manager.manager_id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="size-8 rounded-full bg-gray-100 flex items-center justify-center">
                        <User className="size-4 text-gray-500" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900 truncate">{manager.manager_name}</p>
                        <p className="text-xs text-gray-500 truncate">{manager.manager_email}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <span className="font-semibold text-gray-900">{manager.total}</span>
                  </TableCell>
                  <TableCell className="text-center">
                    {manager.pending > 0 ? (
                      <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                        {manager.pending}
                      </Badge>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {manager.processing > 0 ? (
                      <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                        {manager.processing}
                      </Badge>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {manager.completed > 0 ? (
                      <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                        {manager.completed}
                      </Badge>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {manager.rejected > 0 ? (
                      <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                        {manager.rejected}
                      </Badge>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Clock className="size-3 text-gray-400" />
                      <span className="text-gray-700">
                        {manager.avg_days > 0 ? `${manager.avg_days}일` : '-'}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <CompletionRateBadge rate={completionRate} />
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

function CompletionRateBadge({ rate }: { rate: number }) {
  if (rate >= 80) {
    return (
      <div className="inline-flex items-center gap-1 text-emerald-600">
        <CheckCircle className="size-3" />
        <span className="text-sm font-medium">{rate}%</span>
      </div>
    )
  }
  if (rate >= 50) {
    return (
      <div className="inline-flex items-center gap-1 text-amber-600">
        <AlertCircle className="size-3" />
        <span className="text-sm font-medium">{rate}%</span>
      </div>
    )
  }
  if (rate > 0) {
    return (
      <div className="inline-flex items-center gap-1 text-red-600">
        <XCircle className="size-3" />
        <span className="text-sm font-medium">{rate}%</span>
      </div>
    )
  }
  return <span className="text-gray-400">-</span>
}
