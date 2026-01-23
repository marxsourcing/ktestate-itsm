'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Search, Download, Loader2, ChevronLeft, ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { REQUEST_STATUS, REQUEST_STATUS_COLORS, type RequestStatus } from '@/lib/constants/request-types'

interface Request {
  id: string
  title: string
  description: string
  status: string
  priority: string
  created_at: string
  requester: { full_name: string | null; email: string } | null
  system: { name: string } | null
  category_lv1?: { id: string; name: string } | null  // 대분류 (SR 구분)
  category_lv2?: { id: string; name: string } | null  // 소분류 (SR 상세 구분)
}

interface AdminRequestsClientProps {
  requests: Request[]
}

const PRIORITY_LABELS: Record<string, string> = {
  urgent: '긴급',
  high: '높음',
  medium: '보통',
  low: '낮음',
}

const PAGE_SIZE = 20

export function AdminRequestsClient({ requests }: AdminRequestsClientProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [isExporting, setIsExporting] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const filteredRequests = requests.filter((req) => {
    const searchLower = searchTerm.toLowerCase()
    return (
      req.title.toLowerCase().includes(searchLower) ||
      req.requester?.full_name?.toLowerCase().includes(searchLower) ||
      req.requester?.email?.toLowerCase().includes(searchLower) ||
      req.system?.name?.toLowerCase().includes(searchLower)
    )
  })

  const totalPages = Math.ceil(filteredRequests.length / PAGE_SIZE)
  const startIndex = (currentPage - 1) * PAGE_SIZE
  const paginatedRequests = filteredRequests.slice(startIndex, startIndex + PAGE_SIZE)

  // 현재 페이지의 모든 항목이 선택되었는지 확인
  const isAllCurrentPageSelected = paginatedRequests.length > 0 && 
    paginatedRequests.every((req) => selectedIds.has(req.id))
  
  // 필터링된 전체 항목이 선택되었는지 확인
  const isAllFilteredSelected = filteredRequests.length > 0 && 
    filteredRequests.every((req) => selectedIds.has(req.id))

  function handleSearchChange(value: string) {
    setSearchTerm(value)
    setCurrentPage(1)
    setSelectedIds(new Set()) // 검색 변경 시 선택 초기화
  }

  function handleSelectAll(checked: boolean) {
    if (checked) {
      // 현재 페이지의 모든 항목 선택
      const newSelected = new Set(selectedIds)
      paginatedRequests.forEach((req) => newSelected.add(req.id))
      setSelectedIds(newSelected)
    } else {
      // 현재 페이지의 모든 항목 선택 해제
      const newSelected = new Set(selectedIds)
      paginatedRequests.forEach((req) => newSelected.delete(req.id))
      setSelectedIds(newSelected)
    }
  }

  function handleSelectAllFiltered() {
    // 필터링된 전체 항목 선택
    const newSelected = new Set<string>()
    filteredRequests.forEach((req) => newSelected.add(req.id))
    setSelectedIds(newSelected)
  }

  function handleSelectOne(id: string, checked: boolean) {
    const newSelected = new Set(selectedIds)
    if (checked) {
      newSelected.add(id)
    } else {
      newSelected.delete(id)
    }
    setSelectedIds(newSelected)
  }

  function handleClearSelection() {
    setSelectedIds(new Set())
  }

  async function handleExport() {
    setIsExporting(true)
    try {
      // 선택된 항목이 있으면 선택된 항목만, 없으면 필터링된 전체 목록 내보내기
      const idsToExport = selectedIds.size > 0 
        ? Array.from(selectedIds) 
        : filteredRequests.map((req) => req.id)
      
      const params = new URLSearchParams({ type: 'requests' })
      if (idsToExport.length < filteredRequests.length || selectedIds.size > 0) {
        params.set('ids', idsToExport.join(','))
      }
      
      const response = await fetch(`/api/admin/export?${params.toString()}`)
      if (!response.ok) throw new Error('Export failed')

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `서비스요청_${new Date().toISOString().split('T')[0].replace(/-/g, '')}.xlsx`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      console.error('Export error:', error)
      alert('내보내기에 실패했습니다.')
    } finally {
      setIsExporting(false)
    }
  }

  function getStatusBadge(status: string) {
    const statusKey = status as RequestStatus
    const label = REQUEST_STATUS[statusKey] || status
    const colors = REQUEST_STATUS_COLORS[statusKey]
    
    if (colors) {
      return (
        <Badge variant="outline" className={`${colors.bg} ${colors.text} ${colors.border} border`}>
          {label}
        </Badge>
      )
    }
    
    return <Badge variant="outline">{label}</Badge>
  }

  return (
    <div className="space-y-4">
      {/* Search & Export */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
          <Input
            placeholder="제목, 요청자, 시스템으로 검색..."
            value={searchTerm}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="text-sm text-gray-500">
          총 {filteredRequests.length}건
          {selectedIds.size > 0 && (
            <span className="ml-2 text-blue-600 font-medium">
              ({selectedIds.size}건 선택됨)
            </span>
          )}
        </div>
        {selectedIds.size > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearSelection}
            className="text-gray-500"
          >
            선택 해제
          </Button>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={handleExport}
          disabled={isExporting || filteredRequests.length === 0}
        >
          {isExporting ? (
            <Loader2 className="size-4 animate-spin mr-2" />
          ) : (
            <Download className="size-4 mr-2" />
          )}
          {selectedIds.size > 0 
            ? `선택 항목 내보내기 (${selectedIds.size}건)` 
            : `Excel 내보내기 (${filteredRequests.length}건)`}
        </Button>
      </div>

      {/* 전체 선택 안내 */}
      {selectedIds.size > 0 && !isAllFilteredSelected && (
        <div className="flex items-center gap-2 text-sm bg-blue-50 text-blue-700 px-4 py-2 rounded-md">
          <span>현재 {selectedIds.size}건이 선택되었습니다.</span>
          <Button
            variant="link"
            size="sm"
            onClick={handleSelectAllFiltered}
            className="text-blue-700 h-auto p-0 underline"
          >
            필터링된 전체 {filteredRequests.length}건 모두 선택
          </Button>
        </div>
      )}

      {/* Table */}
      <div className="rounded-md border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]">
                <Checkbox
                  checked={isAllCurrentPageSelected}
                  onCheckedChange={handleSelectAll}
                  aria-label="현재 페이지 전체 선택"
                />
              </TableHead>
              <TableHead className="w-[100px]">상태</TableHead>
              <TableHead>제목</TableHead>
              <TableHead>요청자</TableHead>
              <TableHead>유형</TableHead>
              <TableHead>우선순위</TableHead>
              <TableHead>시스템</TableHead>
              <TableHead>신청일</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedRequests.length > 0 ? (
              paginatedRequests.map((request) => (
                <TableRow 
                  key={request.id}
                  className={selectedIds.has(request.id) ? 'bg-blue-50' : ''}
                >
                  <TableCell>
                    <Checkbox
                      checked={selectedIds.has(request.id)}
                      onCheckedChange={(checked) => handleSelectOne(request.id, checked as boolean)}
                      aria-label={`${request.title} 선택`}
                    />
                  </TableCell>
                  <TableCell>
                    {getStatusBadge(request.status)}
                  </TableCell>
                  <TableCell className="font-medium">
                    <Link href={`/requests/${request.id}`} className="hover:underline text-blue-600">
                      {request.title}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      <div>{request.requester?.full_name || '-'}</div>
                      <div className="text-gray-400 text-xs">{request.requester?.email}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {request.category_lv1?.name ? (
                      <span className="text-rose-600">
                        {request.category_lv1.name}
                        {request.category_lv2?.name && ` / ${request.category_lv2.name}`}
                      </span>
                    ) : '-'}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{PRIORITY_LABELS[request.priority] || request.priority}</Badge>
                  </TableCell>
                  <TableCell className="text-sm text-gray-500">
                    {request.system?.name || '-'}
                  </TableCell>
                  <TableCell className="text-sm text-gray-500">
                    {new Date(request.created_at).toLocaleDateString('ko-KR')}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center text-gray-500">
                  {searchTerm ? '검색 결과가 없습니다.' : '서비스 요청이 없습니다.'}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-500">
            {startIndex + 1}-{Math.min(startIndex + PAGE_SIZE, filteredRequests.length)} / {filteredRequests.length}건
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="size-4" />
              이전
            </Button>
            <div className="flex items-center gap-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((page) => Math.abs(page - currentPage) <= 2 || page === 1 || page === totalPages)
                .map((page, idx, arr) => (
                  <span key={page}>
                    {idx > 0 && arr[idx - 1] !== page - 1 && (
                      <span className="px-1 text-gray-400">...</span>
                    )}
                    <Button
                      variant={currentPage === page ? 'default' : 'outline'}
                      size="sm"
                      className="w-8 h-8 p-0"
                      onClick={() => setCurrentPage(page)}
                    >
                      {page}
                    </Button>
                  </span>
                ))}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              다음
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
