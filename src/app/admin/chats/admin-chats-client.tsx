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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Search, MessageSquare, CheckCircle2, ExternalLink, ChevronLeft, ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { ChatDetailModal } from '@/components/admin/chat-detail-modal'

interface Conversation {
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
  } | null
}

interface AdminChatsClientProps {
  conversations: Conversation[]
}

const PAGE_SIZE = 20

export function AdminChatsClient({ conversations }: AdminChatsClientProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)

  const filteredConversations = conversations.filter((conv) => {
    const searchLower = searchTerm.toLowerCase()
    return (
      conv.title.toLowerCase().includes(searchLower) ||
      conv.user?.full_name?.toLowerCase().includes(searchLower) ||
      conv.user?.email?.toLowerCase().includes(searchLower) ||
      conv.request?.title?.toLowerCase().includes(searchLower)
    )
  })

  // 페이지네이션 계산
  const totalPages = Math.ceil(filteredConversations.length / PAGE_SIZE)
  const startIndex = (currentPage - 1) * PAGE_SIZE
  const paginatedConversations = filteredConversations.slice(startIndex, startIndex + PAGE_SIZE)

  // 검색 시 첫 페이지로 이동
  function handleSearchChange(value: string) {
    setSearchTerm(value)
    setCurrentPage(1)
  }

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

  function handleRowClick(conversation: Conversation) {
    setSelectedConversation(conversation)
    setIsModalOpen(true)
  }

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
          <Input
            placeholder="제목, 사용자, 요청으로 검색..."
            value={searchTerm}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="text-sm text-gray-500">
          총 {filteredConversations.length}건
        </div>
      </div>

      {/* Table */}
      <div className="rounded-md border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[80px]">상태</TableHead>
              <TableHead>대화 제목</TableHead>
              <TableHead>사용자</TableHead>
              <TableHead>연결된 요청</TableHead>
              <TableHead>생성일</TableHead>
              <TableHead>최종 업데이트</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedConversations.length > 0 ? (
              paginatedConversations.map((conv) => (
                <TableRow
                  key={conv.id}
                  className="cursor-pointer hover:bg-gray-50"
                  onClick={() => handleRowClick(conv)}
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
                    {formatDate(conv.created_at)}
                  </TableCell>
                  <TableCell className="text-sm text-gray-500">
                    {formatDate(conv.updated_at)}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-gray-500">
                  {searchTerm ? '검색 결과가 없습니다.' : '채팅 내역이 없습니다.'}
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
            {startIndex + 1}-{Math.min(startIndex + PAGE_SIZE, filteredConversations.length)} / {filteredConversations.length}건
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
                .filter((page) => {
                  // 현재 페이지 주변 2페이지만 표시
                  return Math.abs(page - currentPage) <= 2 || page === 1 || page === totalPages
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
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              다음
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Chat Detail Modal */}
      {selectedConversation && (
        <ChatDetailModal
          conversationId={selectedConversation.id}
          title={selectedConversation.title}
          user={selectedConversation.user}
          request={selectedConversation.request}
          open={isModalOpen}
          onOpenChange={setIsModalOpen}
        />
      )}
    </div>
  )
}
