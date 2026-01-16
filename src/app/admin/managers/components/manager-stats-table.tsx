'use client'

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
import {
  User,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown
} from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

interface ManagerStat {
  manager_id: string
  manager_name: string
  manager_email: string
  total: number
  pending: number
  processing: number
  completed: number
  rejected: number
  avg_days: number
  total_fp: number
  total_md: number
}

interface ManagerStatsTableProps {
  data: ManagerStat[]
  totalCount: number
  totalPages: number
  currentPage: number
  pageSize: number
  sortBy: string
  sortOrder: string
}

export function ManagerStatsTable({
  data,
  totalCount,
  totalPages,
  currentPage,
  pageSize,
  sortBy,
  sortOrder
}: ManagerStatsTableProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const handleSort = (column: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (sortBy === column) {
      // 같은 컬럼 클릭 시 순서 토글
      params.set('order', sortOrder === 'desc' ? 'asc' : 'desc')
    } else {
      // 다른 컬럼 클릭 시 내림차순으로 시작
      params.set('sort', column)
      params.set('order', 'desc')
    }
    params.set('page', '1') // 정렬 변경 시 첫 페이지로
    router.push(`/admin/managers?${params.toString()}`)
  }

  const handlePageChange = (page: number) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('page', page.toString())
    router.push(`/admin/managers?${params.toString()}`)
  }

  const SortIcon = ({ column }: { column: string }) => {
    if (sortBy !== column) {
      return <ArrowUpDown className="size-3 text-gray-400" />
    }
    return sortOrder === 'desc'
      ? <ArrowDown className="size-3 text-blue-600" />
      : <ArrowUp className="size-3 text-blue-600" />
  }

  const startIndex = (currentPage - 1) * pageSize + 1
  const endIndex = Math.min(currentPage * pageSize, totalCount)

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100">
      {/* Table Header */}
      <div className="px-6 py-4 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">담당자 목록</h2>
            <p className="text-sm text-gray-500">
              총 {totalCount}명의 담당자
            </p>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link href="/dashboard">대시보드로 돌아가기</Link>
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-[200px]">담당자</TableHead>
              <TableHead className="text-center">
                <button
                  onClick={() => handleSort('total')}
                  className="inline-flex items-center gap-1 hover:text-gray-900"
                >
                  배정
                  <SortIcon column="total" />
                </button>
              </TableHead>
              <TableHead className="text-center">
                <button
                  onClick={() => handleSort('pending')}
                  className="inline-flex items-center gap-1 hover:text-gray-900"
                >
                  대기
                  <SortIcon column="pending" />
                </button>
              </TableHead>
              <TableHead className="text-center">
                <button
                  onClick={() => handleSort('processing')}
                  className="inline-flex items-center gap-1 hover:text-gray-900"
                >
                  처리중
                  <SortIcon column="processing" />
                </button>
              </TableHead>
              <TableHead className="text-center">
                <button
                  onClick={() => handleSort('completed')}
                  className="inline-flex items-center gap-1 hover:text-gray-900"
                >
                  완료
                  <SortIcon column="completed" />
                </button>
              </TableHead>
              <TableHead className="text-center">
                <button
                  onClick={() => handleSort('rejected')}
                  className="inline-flex items-center gap-1 hover:text-gray-900"
                >
                  반려
                  <SortIcon column="rejected" />
                </button>
              </TableHead>
              <TableHead className="text-center">
                <button
                  onClick={() => handleSort('avg_days')}
                  className="inline-flex items-center gap-1 hover:text-gray-900"
                >
                  평균 처리일
                  <SortIcon column="avg_days" />
                </button>
              </TableHead>
              <TableHead className="text-center">완료율</TableHead>
              <TableHead className="text-center">
                <button
                  onClick={() => handleSort('total_fp')}
                  className="inline-flex items-center gap-1 hover:text-gray-900"
                >
                  총 FP
                  <SortIcon column="total_fp" />
                </button>
              </TableHead>
              <TableHead className="text-center">
                <button
                  onClick={() => handleSort('total_md')}
                  className="inline-flex items-center gap-1 hover:text-gray-900"
                >
                  총 MD
                  <SortIcon column="total_md" />
                </button>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="h-32 text-center text-gray-500">
                  배정된 요청이 있는 담당자가 없습니다.
                </TableCell>
              </TableRow>
            ) : (
              data.map((manager) => {
                const completionRate = manager.total > 0
                  ? Math.round((manager.completed / manager.total) * 100)
                  : 0

                return (
                  <TableRow key={manager.manager_id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="size-10 rounded-full bg-gray-100 flex items-center justify-center">
                          <User className="size-5 text-gray-500" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900">{manager.manager_name}</p>
                          <p className="text-sm text-gray-500 truncate">{manager.manager_email}</p>
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
                    <TableCell className="text-center">
                      {manager.total_fp > 0 ? (
                        <span className="text-emerald-700 font-medium">{manager.total_fp.toFixed(1)}</span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {manager.total_md > 0 ? (
                        <span className="text-violet-700 font-medium">{manager.total_md.toFixed(1)}</span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="px-6 py-4 border-t border-gray-100">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">
              {startIndex} - {endIndex} / 총 {totalCount}명
            </p>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                className="size-8"
                onClick={() => handlePageChange(1)}
                disabled={currentPage === 1}
              >
                <ChevronsLeft className="size-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="size-8"
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="size-4" />
              </Button>

              {/* 페이지 번호 */}
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(page => {
                  // 현재 페이지 주변 2개와 처음/끝 페이지 표시
                  return (
                    page === 1 ||
                    page === totalPages ||
                    Math.abs(page - currentPage) <= 1
                  )
                })
                .map((page, index, array) => {
                  // 페이지 사이에 ... 표시
                  const showEllipsis = index > 0 && page - array[index - 1] > 1
                  return (
                    <span key={page} className="flex items-center">
                      {showEllipsis && (
                        <span className="px-2 text-gray-400">...</span>
                      )}
                      <Button
                        variant={currentPage === page ? 'default' : 'outline'}
                        size="icon"
                        className="size-8"
                        onClick={() => handlePageChange(page)}
                      >
                        {page}
                      </Button>
                    </span>
                  )
                })}

              <Button
                variant="outline"
                size="icon"
                className="size-8"
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
              >
                <ChevronRight className="size-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="size-8"
                onClick={() => handlePageChange(totalPages)}
                disabled={currentPage === totalPages}
              >
                <ChevronsRight className="size-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
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
