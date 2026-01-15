'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import { Search, MessageSquare, CheckCircle2, ExternalLink, ChevronLeft, ChevronRight, Download, Loader2, X, Users, Shield } from 'lucide-react'
import Link from 'next/link'
import { ChatDetailModal } from '@/components/admin/chat-detail-modal'
import { ManagerChatDetailModal } from '@/components/admin/manager-chat-detail-modal'

interface RequesterConversation {
  id: string
  title: string
  status: 'active' | 'confirmed' | 'archived'
  type: 'requester' | 'manager'
  created_at: string
  updated_at: string
  user: {
    id: string
    full_name: string | null
    email: string
  } | null
  request: {
    id: string
    title: string
    status: string
    category_lv1: { name: string } | null
    category_lv2: { name: string } | null
  } | null
}

interface ManagerConversation {
  id: string
  title: string
  created_at: string
  updated_at: string
  manager: {
    id: string
    full_name: string | null
    email: string
  } | null
  request: {
    id: string
    title: string
    status: string
    category_lv1: { name: string } | null
    category_lv2: { name: string } | null
  } | null
}

interface User {
  id: string
  full_name: string | null
  email: string
  role?: string
}

interface AdminChatsClientProps {
  requesterConversations: RequesterConversation[]
  managerConversations: ManagerConversation[]
  users: User[]
  managers: User[]
}

const PAGE_SIZE = 20

const STATUS_OPTIONS = [
  { value: 'all', label: '전체 상태' },
  { value: 'active', label: '진행중' },
  { value: 'confirmed', label: '확정' },
  { value: 'archived', label: '보관' },
]

export function AdminChatsClient({ requesterConversations, managerConversations, users, managers }: AdminChatsClientProps) {
  const [activeTab, setActiveTab] = useState<'requester' | 'manager'>('requester')
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedRequesterConv, setSelectedRequesterConv] = useState<RequesterConversation | null>(null)
  const [selectedManagerConv, setSelectedManagerConv] = useState<ManagerConversation | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isManagerModalOpen, setIsManagerModalOpen] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [isExporting, setIsExporting] = useState(false)

  // 필터 상태 - 요청자 탭
  const [statusFilter, setStatusFilter] = useState('all')
  const [userFilter, setUserFilter] = useState('all')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  // 필터 상태 - 담당자 탭
  const [managerFilter, setManagerFilter] = useState('all')
  const [managerStartDate, setManagerStartDate] = useState('')
  const [managerEndDate, setManagerEndDate] = useState('')
  const [managerSearchTerm, setManagerSearchTerm] = useState('')
  const [managerCurrentPage, setManagerCurrentPage] = useState(1)

  // 요청자 대화 필터링
  const filteredRequesterConversations = requesterConversations.filter((conv) => {
    const searchLower = searchTerm.toLowerCase()
    const matchesSearch =
      !searchTerm ||
      conv.title.toLowerCase().includes(searchLower) ||
      conv.user?.full_name?.toLowerCase().includes(searchLower) ||
      conv.user?.email?.toLowerCase().includes(searchLower) ||
      conv.request?.title?.toLowerCase().includes(searchLower)

    const matchesStatus = statusFilter === 'all' || conv.status === statusFilter
    const matchesUser = userFilter === 'all' || conv.user?.id === userFilter

    const convDate = new Date(conv.created_at)
    const matchesStartDate = !startDate || convDate >= new Date(startDate)
    const matchesEndDate = !endDate || convDate <= new Date(endDate + 'T23:59:59')

    return matchesSearch && matchesStatus && matchesUser && matchesStartDate && matchesEndDate
  })

  // 담당자 대화 필터링
  const filteredManagerConversations = managerConversations.filter((conv) => {
    const searchLower = managerSearchTerm.toLowerCase()
    const matchesSearch =
      !managerSearchTerm ||
      conv.title.toLowerCase().includes(searchLower) ||
      conv.manager?.full_name?.toLowerCase().includes(searchLower) ||
      conv.manager?.email?.toLowerCase().includes(searchLower) ||
      conv.request?.title?.toLowerCase().includes(searchLower)

    const matchesManager = managerFilter === 'all' || conv.manager?.id === managerFilter

    const convDate = new Date(conv.created_at)
    const matchesStartDate = !managerStartDate || convDate >= new Date(managerStartDate)
    const matchesEndDate = !managerEndDate || convDate <= new Date(managerEndDate + 'T23:59:59')

    return matchesSearch && matchesManager && matchesStartDate && matchesEndDate
  })

  // 요청자 페이지네이션 계산
  const requesterTotalPages = Math.ceil(filteredRequesterConversations.length / PAGE_SIZE)
  const requesterStartIndex = (currentPage - 1) * PAGE_SIZE
  const paginatedRequesterConversations = filteredRequesterConversations.slice(requesterStartIndex, requesterStartIndex + PAGE_SIZE)

  // 담당자 페이지네이션 계산
  const managerTotalPages = Math.ceil(filteredManagerConversations.length / PAGE_SIZE)
  const managerStartIndex = (managerCurrentPage - 1) * PAGE_SIZE
  const paginatedManagerConversations = filteredManagerConversations.slice(managerStartIndex, managerStartIndex + PAGE_SIZE)

  // 필터 변경 시 첫 페이지로 이동
  function handleFilterChange() {
    setCurrentPage(1)
  }

  function handleManagerFilterChange() {
    setManagerCurrentPage(1)
  }

  function handleSearchChange(value: string) {
    setSearchTerm(value)
    setCurrentPage(1)
  }

  function handleManagerSearchChange(value: string) {
    setManagerSearchTerm(value)
    setManagerCurrentPage(1)
  }

  function clearFilters() {
    setSearchTerm('')
    setStatusFilter('all')
    setUserFilter('all')
    setStartDate('')
    setEndDate('')
    setCurrentPage(1)
  }

  function clearManagerFilters() {
    setManagerSearchTerm('')
    setManagerFilter('all')
    setManagerStartDate('')
    setManagerEndDate('')
    setManagerCurrentPage(1)
  }

  const hasActiveFilters = searchTerm || statusFilter !== 'all' || userFilter !== 'all' || startDate || endDate
  const hasActiveManagerFilters = managerSearchTerm || managerFilter !== 'all' || managerStartDate || managerEndDate

  function formatDate(dateString: string) {
    return new Date(dateString).toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  function getStatusBadge(status: string) {
    switch (status) {
      case 'confirmed':
        return <Badge variant="default" className="bg-green-500">확정</Badge>
      case 'active':
        return <Badge variant="secondary">진행중</Badge>
      case 'archived':
        return <Badge variant="outline">보관</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  function handleRequesterRowClick(conversation: RequesterConversation) {
    setSelectedRequesterConv(conversation)
    setIsModalOpen(true)
  }

  function handleManagerRowClick(conversation: ManagerConversation) {
    setSelectedManagerConv(conversation)
    setIsManagerModalOpen(true)
  }

  async function handleExport() {
    setIsExporting(true)
    try {
      // 필터 파라미터 추가
      const params = new URLSearchParams({ type: 'chats' })
      if (statusFilter !== 'all') params.append('status', statusFilter)
      if (userFilter !== 'all') params.append('userId', userFilter)
      if (startDate) params.append('startDate', startDate)
      if (endDate) params.append('endDate', endDate)

      const response = await fetch(`/api/admin/export?${params.toString()}`)
      if (!response.ok) throw new Error('Export failed')

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `채팅내역_${new Date().toISOString().split('T')[0].replace(/-/g, '')}.xlsx`
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

  return (
    <div className="space-y-4">
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'requester' | 'manager')}>
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="requester" className="flex items-center gap-2">
            <Users className="size-4" />
            요청자 채팅
            <Badge variant="secondary" className="ml-1">{requesterConversations.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="manager" className="flex items-center gap-2">
            <Shield className="size-4" />
            담당자 내부 채팅
            <Badge variant="secondary" className="ml-1">{managerConversations.length}</Badge>
          </TabsTrigger>
        </TabsList>

        {/* 요청자 채팅 탭 */}
        <TabsContent value="requester" className="space-y-4 mt-4">
          {/* Filters */}
          <div className="bg-white rounded-lg border p-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
                <Input
                  placeholder="제목, 사용자, 요청 검색..."
                  value={searchTerm}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  className="pl-10 h-9"
                />
              </div>

              <Select
                value={statusFilter}
                onValueChange={(value) => {
                  setStatusFilter(value)
                  handleFilterChange()
                }}
              >
                <SelectTrigger className="w-[120px] h-9">
                  <SelectValue placeholder="상태" />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={userFilter}
                onValueChange={(value) => {
                  setUserFilter(value)
                  handleFilterChange()
                }}
              >
                <SelectTrigger className="w-[140px] h-9">
                  <SelectValue placeholder="사용자" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체 사용자</SelectItem>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.full_name || user.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="flex items-center gap-1">
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value)
                    handleFilterChange()
                  }}
                  className="w-[130px] h-9"
                />
                <span className="text-gray-400">~</span>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value)
                    handleFilterChange()
                  }}
                  className="w-[130px] h-9"
                />
              </div>

              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9 px-2 text-gray-500">
                  <X className="size-4" />
                </Button>
              )}

              <div className="flex-1" />

              <span className="text-sm text-gray-500">
                총 {filteredRequesterConversations.length}건
              </span>

              <Button
                variant="outline"
                size="sm"
                onClick={handleExport}
                disabled={isExporting || filteredRequesterConversations.length === 0}
                className="h-9"
              >
                {isExporting ? (
                  <Loader2 className="size-4 animate-spin mr-1.5" />
                ) : (
                  <Download className="size-4 mr-1.5" />
                )}
                Excel
              </Button>
            </div>
          </div>

          {/* Table */}
          <div className="rounded-md border bg-white">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[80px]">상태</TableHead>
                  <TableHead>대화 제목</TableHead>
                  <TableHead>요청자</TableHead>
                  <TableHead>연결된 요청</TableHead>
                  <TableHead>요청 상태</TableHead>
                  <TableHead>SR 구분</TableHead>
                  <TableHead>생성일</TableHead>
                  <TableHead>최종 업데이트</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedRequesterConversations.length > 0 ? (
                  paginatedRequesterConversations.map((conv) => (
                    <TableRow
                      key={conv.id}
                      className="cursor-pointer hover:bg-gray-50"
                      onClick={() => handleRequesterRowClick(conv)}
                    >
                      <TableCell>
                        {getStatusBadge(conv.status)}
                      </TableCell>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <MessageSquare className="size-4 text-gray-400" />
                          {conv.title}
                          {conv.status === 'confirmed' && (
                            <CheckCircle2 className="size-4 text-green-500" />
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div>{conv.user?.full_name || '-'}</div>
                          <div className="text-gray-400 text-xs">{conv.user?.email}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {conv.request ? (
                          <Link
                            href={`/requests/${conv.request.id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="text-blue-600 hover:underline flex items-center gap-1"
                          >
                            {conv.request.title}
                            <ExternalLink className="size-3" />
                          </Link>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-gray-500">
                        {conv.request?.status || '-'}
                      </TableCell>
                      <TableCell className="text-sm text-gray-500">
                        {conv.request?.category_lv1?.name
                          ? (conv.request.category_lv2?.name
                              ? `${conv.request.category_lv1.name} / ${conv.request.category_lv2.name}`
                              : conv.request.category_lv1.name)
                          : '-'}
                      </TableCell>
                      <TableCell className="text-sm text-gray-500">
                        {formatDate(conv.created_at)}
                      </TableCell>
                      <TableCell className="text-sm text-gray-500">
                        {formatDate(conv.updated_at)}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={8} className="h-24 text-center text-gray-500">
                      {hasActiveFilters ? '검색 결과가 없습니다.' : '요청자 채팅 내역이 없습니다.'}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {requesterTotalPages > 1 && (
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-500">
                {requesterStartIndex + 1}-{Math.min(requesterStartIndex + PAGE_SIZE, filteredRequesterConversations.length)} / {filteredRequesterConversations.length}건
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
                  {Array.from({ length: requesterTotalPages }, (_, i) => i + 1)
                    .filter((page) => {
                      return Math.abs(page - currentPage) <= 2 || page === 1 || page === requesterTotalPages
                    })
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
                  onClick={() => setCurrentPage((p) => Math.min(requesterTotalPages, p + 1))}
                  disabled={currentPage === requesterTotalPages}
                >
                  다음
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            </div>
          )}
        </TabsContent>

        {/* 담당자 내부 채팅 탭 */}
        <TabsContent value="manager" className="space-y-4 mt-4">
          {/* Filters */}
          <div className="bg-white rounded-lg border p-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
                <Input
                  placeholder="제목, 담당자, 요청 검색..."
                  value={managerSearchTerm}
                  onChange={(e) => handleManagerSearchChange(e.target.value)}
                  className="pl-10 h-9"
                />
              </div>

              <Select
                value={managerFilter}
                onValueChange={(value) => {
                  setManagerFilter(value)
                  handleManagerFilterChange()
                }}
              >
                <SelectTrigger className="w-[140px] h-9">
                  <SelectValue placeholder="담당자" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체 담당자</SelectItem>
                  {managers.map((manager) => (
                    <SelectItem key={manager.id} value={manager.id}>
                      {manager.full_name || manager.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="flex items-center gap-1">
                <Input
                  type="date"
                  value={managerStartDate}
                  onChange={(e) => {
                    setManagerStartDate(e.target.value)
                    handleManagerFilterChange()
                  }}
                  className="w-[130px] h-9"
                />
                <span className="text-gray-400">~</span>
                <Input
                  type="date"
                  value={managerEndDate}
                  onChange={(e) => {
                    setManagerEndDate(e.target.value)
                    handleManagerFilterChange()
                  }}
                  className="w-[130px] h-9"
                />
              </div>

              {hasActiveManagerFilters && (
                <Button variant="ghost" size="sm" onClick={clearManagerFilters} className="h-9 px-2 text-gray-500">
                  <X className="size-4" />
                </Button>
              )}

              <div className="flex-1" />

              <span className="text-sm text-gray-500">
                총 {filteredManagerConversations.length}건
              </span>
            </div>
          </div>

          {/* Table */}
          <div className="rounded-md border bg-white">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>대화 제목</TableHead>
                  <TableHead>담당자</TableHead>
                  <TableHead>연결된 요청</TableHead>
                  <TableHead>요청 상태</TableHead>
                  <TableHead>SR 구분</TableHead>
                  <TableHead>생성일</TableHead>
                  <TableHead>최종 업데이트</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedManagerConversations.length > 0 ? (
                  paginatedManagerConversations.map((conv) => (
                    <TableRow
                      key={conv.id}
                      className="cursor-pointer hover:bg-gray-50"
                      onClick={() => handleManagerRowClick(conv)}
                    >
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <Shield className="size-4 text-indigo-500" />
                          {conv.title}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div>{conv.manager?.full_name || '-'}</div>
                          <div className="text-gray-400 text-xs">{conv.manager?.email}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {conv.request ? (
                          <Link
                            href={`/requests/${conv.request.id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="text-blue-600 hover:underline flex items-center gap-1"
                          >
                            {conv.request.title}
                            <ExternalLink className="size-3" />
                          </Link>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-gray-500">
                        {conv.request?.status || '-'}
                      </TableCell>
                      <TableCell className="text-sm text-gray-500">
                        {conv.request?.category_lv1?.name
                          ? (conv.request.category_lv2?.name
                              ? `${conv.request.category_lv1.name} / ${conv.request.category_lv2.name}`
                              : conv.request.category_lv1.name)
                          : '-'}
                      </TableCell>
                      <TableCell className="text-sm text-gray-500">
                        {formatDate(conv.created_at)}
                      </TableCell>
                      <TableCell className="text-sm text-gray-500">
                        {formatDate(conv.updated_at)}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center text-gray-500">
                      {hasActiveManagerFilters ? '검색 결과가 없습니다.' : '담당자 내부 채팅 내역이 없습니다.'}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {managerTotalPages > 1 && (
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-500">
                {managerStartIndex + 1}-{Math.min(managerStartIndex + PAGE_SIZE, filteredManagerConversations.length)} / {filteredManagerConversations.length}건
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setManagerCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={managerCurrentPage === 1}
                >
                  <ChevronLeft className="size-4" />
                  이전
                </Button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: managerTotalPages }, (_, i) => i + 1)
                    .filter((page) => {
                      return Math.abs(page - managerCurrentPage) <= 2 || page === 1 || page === managerTotalPages
                    })
                    .map((page, idx, arr) => (
                      <span key={page}>
                        {idx > 0 && arr[idx - 1] !== page - 1 && (
                          <span className="px-1 text-gray-400">...</span>
                        )}
                        <Button
                          variant={managerCurrentPage === page ? 'default' : 'outline'}
                          size="sm"
                          className="w-8 h-8 p-0"
                          onClick={() => setManagerCurrentPage(page)}
                        >
                          {page}
                        </Button>
                      </span>
                    ))}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setManagerCurrentPage((p) => Math.min(managerTotalPages, p + 1))}
                  disabled={managerCurrentPage === managerTotalPages}
                >
                  다음
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Chat Detail Modal - 요청자 채팅 */}
      {selectedRequesterConv && (
        <ChatDetailModal
          conversationId={selectedRequesterConv.id}
          title={selectedRequesterConv.title}
          user={selectedRequesterConv.user}
          request={selectedRequesterConv.request}
          open={isModalOpen}
          onOpenChange={setIsModalOpen}
        />
      )}

      {/* Manager Chat Detail Modal - 담당자 내부 채팅 */}
      {selectedManagerConv && (
        <ManagerChatDetailModal
          conversationId={selectedManagerConv.id}
          title={selectedManagerConv.title}
          manager={selectedManagerConv.manager}
          request={selectedManagerConv.request}
          open={isManagerModalOpen}
          onOpenChange={setIsManagerModalOpen}
        />
      )}
    </div>
  )
}
