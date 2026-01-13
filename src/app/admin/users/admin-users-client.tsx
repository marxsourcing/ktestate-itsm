'use client'

import { useState } from 'react'
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { User, Shield, UserCog } from 'lucide-react'
import { toast } from 'sonner'
import { updateUserRole } from './actions'

interface UserProfile {
  id: string
  email: string
  full_name: string | null
  department: string | null
  role: string
  avatar_url: string | null
  created_at: string
}

interface Props {
  users: UserProfile[]
  currentUserId: string
}

const ROLE_LABELS: Record<string, string> = {
  requester: '요청자',
  manager: '담당자',
  admin: '관리자',
}

const ROLE_COLORS: Record<string, 'default' | 'secondary' | 'destructive'> = {
  requester: 'secondary',
  manager: 'default',
  admin: 'destructive',
}

const ROLE_ICONS: Record<string, React.ReactNode> = {
  requester: <User className="h-3 w-3" />,
  manager: <UserCog className="h-3 w-3" />,
  admin: <Shield className="h-3 w-3" />,
}

export function AdminUsersClient({ users, currentUserId }: Props) {
  const [isRoleOpen, setIsRoleOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null)
  const [isPending, setIsPending] = useState(false)
  const [filter, setFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedRole, setSelectedRole] = useState('')

  const openRoleDialog = (user: UserProfile) => {
    setSelectedUser(user)
    setSelectedRole(user.role)
    setIsRoleOpen(true)
  }

  const handleUpdateRole = async () => {
    if (!selectedUser) return

    setIsPending(true)
    const result = await updateUserRole(selectedUser.id, selectedRole)

    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success('사용자 역할이 변경되었습니다.')
      setIsRoleOpen(false)
    }
    setIsPending(false)
  }

  // 필터링된 사용자 목록
  const filteredUsers = users.filter((user) => {
    // 역할 필터
    if (filter !== 'all' && user.role !== filter) return false

    // 검색어 필터
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      return (
        user.email.toLowerCase().includes(query) ||
        (user.full_name?.toLowerCase().includes(query) ?? false) ||
        (user.department?.toLowerCase().includes(query) ?? false)
      )
    }
    return true
  })

  // 역할별 통계
  const stats = {
    total: users.length,
    requester: users.filter((u) => u.role === 'requester').length,
    manager: users.filter((u) => u.role === 'manager').length,
    admin: users.filter((u) => u.role === 'admin').length,
  }

  return (
    <>
      {/* 통계 카드 */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg border p-4">
          <div className="text-sm text-gray-500">전체 사용자</div>
          <div className="text-2xl font-bold">{stats.total}</div>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <div className="text-sm text-gray-500">요청자</div>
          <div className="text-2xl font-bold text-gray-600">{stats.requester}</div>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <div className="text-sm text-gray-500">담당자</div>
          <div className="text-2xl font-bold text-blue-600">{stats.manager}</div>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <div className="text-sm text-gray-500">관리자</div>
          <div className="text-2xl font-bold text-red-600">{stats.admin}</div>
        </div>
      </div>

      {/* 필터 및 검색 */}
      <div className="flex gap-4 mb-4">
        <Input
          placeholder="이름, 이메일, 부서로 검색..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="max-w-sm"
        />
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="역할 필터" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체</SelectItem>
            <SelectItem value="requester">요청자</SelectItem>
            <SelectItem value="manager">담당자</SelectItem>
            <SelectItem value="admin">관리자</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* 사용자 목록 테이블 */}
      <div className="rounded-md border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[200px]">이메일</TableHead>
              <TableHead className="w-[120px]">이름</TableHead>
              <TableHead className="w-[120px]">부서</TableHead>
              <TableHead className="w-[100px]">역할</TableHead>
              <TableHead className="w-[120px]">가입일</TableHead>
              <TableHead className="w-[120px] text-right">관리</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredUsers.length > 0 ? (
              filteredUsers.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-sm font-medium text-gray-600">
                        {user.full_name?.[0] || user.email[0].toUpperCase()}
                      </div>
                      <span>{user.email}</span>
                      {user.id === currentUserId && (
                        <Badge variant="outline" className="text-xs">나</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {user.full_name || <span className="text-gray-400">-</span>}
                  </TableCell>
                  <TableCell>
                    {user.department || <span className="text-gray-400">-</span>}
                  </TableCell>
                  <TableCell>
                    <Badge variant={ROLE_COLORS[user.role]} className="gap-1">
                      {ROLE_ICONS[user.role]}
                      {ROLE_LABELS[user.role] || user.role}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-gray-500 text-sm">
                    {new Date(user.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openRoleDialog(user)}
                      disabled={user.id === currentUserId}
                      title="역할 변경"
                    >
                      <Shield className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-gray-500">
                  {searchQuery || filter !== 'all'
                    ? '검색 결과가 없습니다.'
                    : '등록된 사용자가 없습니다.'}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* 역할 변경 다이얼로그 */}
      <Dialog open={isRoleOpen} onOpenChange={setIsRoleOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>사용자 역할 변경</DialogTitle>
            <DialogDescription>
              {selectedUser?.email}의 역할을 변경합니다.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="role" className="text-right">
                역할
              </Label>
              <Select value={selectedRole} onValueChange={setSelectedRole}>
                <SelectTrigger className="col-span-3">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="requester">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      요청자
                    </div>
                  </SelectItem>
                  <SelectItem value="manager">
                    <div className="flex items-center gap-2">
                      <UserCog className="h-4 w-4" />
                      담당자
                    </div>
                  </SelectItem>
                  <SelectItem value="admin">
                    <div className="flex items-center gap-2">
                      <Shield className="h-4 w-4" />
                      관리자
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-4 text-sm text-gray-500 bg-gray-50 p-3 rounded-md">
              <strong>역할별 권한:</strong>
              <ul className="mt-2 space-y-1 text-xs">
                <li><strong>요청자:</strong> AI 채팅, 요청 현황 조회</li>
                <li><strong>담당자:</strong> + 워크스페이스 (배정된 요청 처리)</li>
                <li><strong>관리자:</strong> + 대시보드, 관리 페이지 전체</li>
              </ul>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRoleOpen(false)}>
              취소
            </Button>
            <Button onClick={handleUpdateRole} disabled={isPending}>
              {isPending ? '변경 중...' : '변경'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
