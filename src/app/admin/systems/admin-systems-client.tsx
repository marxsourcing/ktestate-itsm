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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Plus, Pencil, Trash2, Server } from 'lucide-react'
import { toast } from 'sonner'
import { createSystem, updateSystem, deleteSystem } from './actions'

interface Manager {
  id: string
  full_name: string | null
  email: string
  role: string
}

interface System {
  id: string
  name: string
  description: string | null
  code: string | null
  status: string
  manager_id: string | null
  manager: Manager | null
  created_at: string
}

interface Props {
  systems: System[]
  managers: Manager[]
}

export function AdminSystemsClient({ systems, managers }: Props) {
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [selectedSystem, setSelectedSystem] = useState<System | null>(null)
  const [isPending, setIsPending] = useState(false)

  const UNASSIGNED = '__unassigned__'

  // 폼 상태
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    code: '',
    status: 'active',
    manager_id: UNASSIGNED,
  })

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      code: '',
      status: 'active',
      manager_id: UNASSIGNED,
    })
  }

  const openEditDialog = (system: System) => {
    setSelectedSystem(system)
    setFormData({
      name: system.name,
      description: system.description || '',
      code: system.code || '',
      status: system.status,
      manager_id: system.manager_id || UNASSIGNED,
    })
    setIsEditOpen(true)
  }

  const openDeleteDialog = (system: System) => {
    setSelectedSystem(system)
    setIsDeleteOpen(true)
  }

  const handleCreate = async () => {
    if (!formData.name.trim()) {
      toast.error('시스템명을 입력해주세요.')
      return
    }

    setIsPending(true)
    const result = await createSystem({
      name: formData.name,
      description: formData.description || undefined,
      code: formData.code || undefined,
      status: formData.status,
      manager_id: formData.manager_id === UNASSIGNED ? null : formData.manager_id,
    })

    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success('시스템이 등록되었습니다.')
      setIsCreateOpen(false)
      resetForm()
    }
    setIsPending(false)
  }

  const handleUpdate = async () => {
    if (!selectedSystem) return
    if (!formData.name.trim()) {
      toast.error('시스템명을 입력해주세요.')
      return
    }

    setIsPending(true)
    const result = await updateSystem(selectedSystem.id, {
      name: formData.name,
      description: formData.description || undefined,
      code: formData.code || undefined,
      status: formData.status,
      manager_id: formData.manager_id === UNASSIGNED ? null : formData.manager_id,
    })

    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success('시스템이 수정되었습니다.')
      setIsEditOpen(false)
      setSelectedSystem(null)
      resetForm()
    }
    setIsPending(false)
  }

  const handleDelete = async () => {
    if (!selectedSystem) return

    setIsPending(true)
    const result = await deleteSystem(selectedSystem.id)

    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success('시스템이 삭제되었습니다.')
    }
    setIsDeleteOpen(false)
    setSelectedSystem(null)
    setIsPending(false)
  }

  return (
    <>
      {/* 헤더 액션 */}
      <div className="flex justify-end mb-4">
        <Button onClick={() => { resetForm(); setIsCreateOpen(true) }}>
          <Plus className="mr-2 h-4 w-4" />
          시스템 추가
        </Button>
      </div>

      {/* 시스템 목록 테이블 */}
      <div className="rounded-md border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[150px]">시스템명</TableHead>
              <TableHead className="w-[100px]">코드</TableHead>
              <TableHead>설명</TableHead>
              <TableHead className="w-[180px]">담당자</TableHead>
              <TableHead className="w-[80px]">상태</TableHead>
              <TableHead className="w-[100px]">등록일</TableHead>
              <TableHead className="w-[100px] text-right">관리</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {systems.length > 0 ? (
              systems.map((system) => (
                <TableRow key={system.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <Server className="h-4 w-4 text-gray-400" />
                      {system.name}
                    </div>
                  </TableCell>
                  <TableCell>
                    <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">
                      {system.code || '-'}
                    </code>
                  </TableCell>
                  <TableCell className="text-gray-600">
                    {system.description || '-'}
                  </TableCell>
                  <TableCell>
                    {system.manager ? (
                      <div className="text-sm">
                        <div className="font-medium">{system.manager.full_name || '이름없음'}</div>
                        <div className="text-gray-500 text-xs">{system.manager.email}</div>
                      </div>
                    ) : (
                      <span className="text-gray-400">미지정</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={system.status === 'active' ? 'default' : 'secondary'}>
                      {system.status === 'active' ? '운영중' : '중지'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-gray-500 text-sm">
                    {new Date(system.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditDialog(system)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openDeleteDialog(system)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-gray-500">
                  등록된 IT 시스템이 없습니다.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* 시스템 추가 다이얼로그 */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>IT 시스템 추가</DialogTitle>
            <DialogDescription>
              새로운 IT 서비스나 시스템 정보를 입력하세요.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="create-name" className="text-right">
                시스템명 *
              </Label>
              <Input
                id="create-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="col-span-3"
                placeholder="예: 전자결재 시스템"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="create-code" className="text-right">
                시스템 코드
              </Label>
              <Input
                id="create-code"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                className="col-span-3"
                placeholder="예: EAPPROVAL"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="create-description" className="text-right">
                설명
              </Label>
              <Input
                id="create-description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="col-span-3"
                placeholder="시스템에 대한 간단한 설명"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="create-manager" className="text-right">
                담당자
              </Label>
              <Select
                value={formData.manager_id}
                onValueChange={(value) => setFormData({ ...formData, manager_id: value })}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="담당자 선택" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={UNASSIGNED}>미지정</SelectItem>
                  {managers.map((manager) => (
                    <SelectItem key={manager.id} value={manager.id}>
                      {manager.full_name || '이름없음'} ({manager.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="create-status" className="text-right">
                상태
              </Label>
              <Select
                value={formData.status}
                onValueChange={(value) => setFormData({ ...formData, status: value })}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">운영중</SelectItem>
                  <SelectItem value="inactive">중지</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
              취소
            </Button>
            <Button onClick={handleCreate} disabled={isPending}>
              {isPending ? '저장 중...' : '추가'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 시스템 수정 다이얼로그 */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>시스템 수정</DialogTitle>
            <DialogDescription>
              시스템 정보를 수정합니다.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-name" className="text-right">
                시스템명 *
              </Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-code" className="text-right">
                시스템 코드
              </Label>
              <Input
                id="edit-code"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-description" className="text-right">
                설명
              </Label>
              <Input
                id="edit-description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-manager" className="text-right">
                담당자
              </Label>
              <Select
                value={formData.manager_id}
                onValueChange={(value) => setFormData({ ...formData, manager_id: value })}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="담당자 선택" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={UNASSIGNED}>미지정</SelectItem>
                  {managers.map((manager) => (
                    <SelectItem key={manager.id} value={manager.id}>
                      {manager.full_name || '이름없음'} ({manager.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-status" className="text-right">
                상태
              </Label>
              <Select
                value={formData.status}
                onValueChange={(value) => setFormData({ ...formData, status: value })}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">운영중</SelectItem>
                  <SelectItem value="inactive">중지</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>
              취소
            </Button>
            <Button onClick={handleUpdate} disabled={isPending}>
              {isPending ? '저장 중...' : '저장'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 삭제 확인 다이얼로그 */}
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>시스템 삭제</AlertDialogTitle>
            <AlertDialogDescription>
              정말 &quot;{selectedSystem?.name}&quot; 시스템을 삭제하시겠습니까?
              <br />
              이 작업은 되돌릴 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isPending}
              className="bg-red-600 hover:bg-red-700"
            >
              {isPending ? '삭제 중...' : '삭제'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
