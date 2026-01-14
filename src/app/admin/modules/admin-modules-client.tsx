'use client'

import { useState, useMemo } from 'react'
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
import { Plus, Pencil, Trash2, Boxes, Filter } from 'lucide-react'
import { toast } from 'sonner'
import { createModule, updateModule, deleteModule } from './actions'

interface Manager {
  id: string
  full_name: string | null
  email: string
  role: string
}

interface System {
  id: string
  name: string
  code: string | null
}

interface Module {
  id: string
  system_id: string
  code: string
  name: string
  primary_manager_id: string | null
  secondary_manager_id: string | null
  is_active: boolean
  sort_order: number
  notify_primary: boolean
  delay_notification: boolean
  created_at: string
  updated_at: string
  system: { id: string; name: string; code: string } | null
  primary_manager: { id: string; full_name: string; email: string } | null
  secondary_manager: { id: string; full_name: string; email: string } | null
}

interface Props {
  modules: Module[]
  systems: System[]
  managers: Manager[]
}

const UNASSIGNED = '__unassigned__'
const ALL_SYSTEMS = '__all__'

export function AdminModulesClient({ modules, systems, managers }: Props) {
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [selectedModule, setSelectedModule] = useState<Module | null>(null)
  const [isPending, setIsPending] = useState(false)
  const [filterSystemId, setFilterSystemId] = useState<string>(ALL_SYSTEMS)

  // 폼 상태
  const [formData, setFormData] = useState({
    system_id: '',
    code: '',
    name: '',
    primary_manager_id: UNASSIGNED,
    secondary_manager_id: UNASSIGNED,
    is_active: true,
    sort_order: 1,
    notify_primary: true,
    delay_notification: true,
  })

  // 필터된 모듈 목록
  const filteredModules = useMemo(() => {
    if (filterSystemId === ALL_SYSTEMS) return modules
    return modules.filter((m) => m.system_id === filterSystemId)
  }, [modules, filterSystemId])

  const resetForm = () => {
    setFormData({
      system_id: systems[0]?.id || '',
      code: '',
      name: '',
      primary_manager_id: UNASSIGNED,
      secondary_manager_id: UNASSIGNED,
      is_active: true,
      sort_order: 1,
      notify_primary: true,
      delay_notification: true,
    })
  }

  const openEditDialog = (module: Module) => {
    setSelectedModule(module)
    setFormData({
      system_id: module.system_id,
      code: module.code,
      name: module.name,
      primary_manager_id: module.primary_manager_id || UNASSIGNED,
      secondary_manager_id: module.secondary_manager_id || UNASSIGNED,
      is_active: module.is_active,
      sort_order: module.sort_order,
      notify_primary: module.notify_primary,
      delay_notification: module.delay_notification,
    })
    setIsEditOpen(true)
  }

  const openDeleteDialog = (module: Module) => {
    setSelectedModule(module)
    setIsDeleteOpen(true)
  }

  const handleCreate = async () => {
    if (!formData.system_id) {
      toast.error('시스템을 선택해주세요.')
      return
    }
    if (!formData.code.trim()) {
      toast.error('모듈 코드를 입력해주세요.')
      return
    }
    if (!formData.name.trim()) {
      toast.error('모듈명을 입력해주세요.')
      return
    }

    setIsPending(true)
    const result = await createModule({
      system_id: formData.system_id,
      code: formData.code,
      name: formData.name,
      primary_manager_id: formData.primary_manager_id === UNASSIGNED ? null : formData.primary_manager_id,
      secondary_manager_id: formData.secondary_manager_id === UNASSIGNED ? null : formData.secondary_manager_id,
      is_active: formData.is_active,
      sort_order: formData.sort_order,
      notify_primary: formData.notify_primary,
      delay_notification: formData.delay_notification,
    })

    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success('모듈이 등록되었습니다.')
      setIsCreateOpen(false)
      resetForm()
    }
    setIsPending(false)
  }

  const handleUpdate = async () => {
    if (!selectedModule) return
    if (!formData.code.trim()) {
      toast.error('모듈 코드를 입력해주세요.')
      return
    }
    if (!formData.name.trim()) {
      toast.error('모듈명을 입력해주세요.')
      return
    }

    setIsPending(true)
    const result = await updateModule(selectedModule.id, {
      system_id: formData.system_id,
      code: formData.code,
      name: formData.name,
      primary_manager_id: formData.primary_manager_id === UNASSIGNED ? null : formData.primary_manager_id,
      secondary_manager_id: formData.secondary_manager_id === UNASSIGNED ? null : formData.secondary_manager_id,
      is_active: formData.is_active,
      sort_order: formData.sort_order,
      notify_primary: formData.notify_primary,
      delay_notification: formData.delay_notification,
    })

    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success('모듈이 수정되었습니다.')
      setIsEditOpen(false)
      setSelectedModule(null)
      resetForm()
    }
    setIsPending(false)
  }

  const handleDelete = async () => {
    if (!selectedModule) return

    setIsPending(true)
    const result = await deleteModule(selectedModule.id)

    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success('모듈이 삭제되었습니다.')
    }
    setIsDeleteOpen(false)
    setSelectedModule(null)
    setIsPending(false)
  }

  const moduleFormFields = (
    <div className="grid gap-4 py-4">
      <div className="grid grid-cols-4 items-center gap-4">
        <Label htmlFor="form-system" className="text-right">
          시스템 *
        </Label>
        <Select
          value={formData.system_id}
          onValueChange={(value) => setFormData((prev) => ({ ...prev, system_id: value }))}
        >
          <SelectTrigger className="col-span-3">
            <SelectValue placeholder="시스템 선택" />
          </SelectTrigger>
          <SelectContent>
            {systems.map((system) => (
              <SelectItem key={system.id} value={system.id}>
                {system.name} ({system.code || '-'})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-4 items-center gap-4">
        <Label htmlFor="form-code" className="text-right">
          모듈 코드 *
        </Label>
        <Input
          id="form-code"
          value={formData.code}
          onChange={(e) => setFormData((prev) => ({ ...prev, code: e.target.value }))}
          className="col-span-3"
          placeholder="예: Portal_1"
        />
      </div>
      <div className="grid grid-cols-4 items-center gap-4">
        <Label htmlFor="form-name" className="text-right">
          모듈명 *
        </Label>
        <Input
          id="form-name"
          value={formData.name}
          onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
          className="col-span-3"
          placeholder="예: 회사포탈"
        />
      </div>
      <div className="grid grid-cols-4 items-center gap-4">
        <Label htmlFor="form-sort" className="text-right">
          정렬순서
        </Label>
        <Input
          id="form-sort"
          type="number"
          value={formData.sort_order}
          onChange={(e) => setFormData((prev) => ({ ...prev, sort_order: parseInt(e.target.value) || 1 }))}
          className="col-span-3"
        />
      </div>
      <div className="grid grid-cols-4 items-center gap-4">
        <Label htmlFor="form-primary" className="text-right">
          1선 담당자
        </Label>
        <Select
          value={formData.primary_manager_id}
          onValueChange={(value) => setFormData((prev) => ({ ...prev, primary_manager_id: value }))}
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
        <Label htmlFor="form-secondary" className="text-right">
          2선 담당자
        </Label>
        <Select
          value={formData.secondary_manager_id}
          onValueChange={(value) => setFormData((prev) => ({ ...prev, secondary_manager_id: value }))}
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
        <Label htmlFor="form-active" className="text-right">
          사용 여부
        </Label>
        <Select
          value={formData.is_active ? 'yes' : 'no'}
          onValueChange={(value) => setFormData((prev) => ({ ...prev, is_active: value === 'yes' }))}
        >
          <SelectTrigger className="col-span-3">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="yes">예</SelectItem>
            <SelectItem value="no">아니오</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-4 items-center gap-4">
        <Label htmlFor="form-notify" className="text-right">
          1선 담당자 알림
        </Label>
        <Select
          value={formData.notify_primary ? 'yes' : 'no'}
          onValueChange={(value) => setFormData((prev) => ({ ...prev, notify_primary: value === 'yes' }))}
        >
          <SelectTrigger className="col-span-3">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="yes">예</SelectItem>
            <SelectItem value="no">아니오</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-4 items-center gap-4">
        <Label htmlFor="form-delay" className="text-right">
          접수지연 발송
        </Label>
        <Select
          value={formData.delay_notification ? 'yes' : 'no'}
          onValueChange={(value) => setFormData((prev) => ({ ...prev, delay_notification: value === 'yes' }))}
        >
          <SelectTrigger className="col-span-3">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="yes">예</SelectItem>
            <SelectItem value="no">아니오</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  )

  return (
    <>
      {/* 헤더 액션 */}
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-gray-500" />
          <Select value={filterSystemId} onValueChange={setFilterSystemId}>
            <SelectTrigger className="w-[250px]">
              <SelectValue placeholder="시스템 필터" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_SYSTEMS}>전체 시스템</SelectItem>
              {systems.map((system) => (
                <SelectItem key={system.id} value={system.id}>
                  {system.name} ({system.code || '-'})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-sm text-gray-500 ml-2">
            {filteredModules.length}개 모듈
          </span>
        </div>
        <Button onClick={() => { resetForm(); setIsCreateOpen(true) }}>
          <Plus className="mr-2 h-4 w-4" />
          모듈 추가
        </Button>
      </div>

      {/* 모듈 목록 테이블 */}
      <div className="rounded-md border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[60px]">순서</TableHead>
              <TableHead className="w-[150px]">시스템</TableHead>
              <TableHead className="w-[120px]">모듈 코드</TableHead>
              <TableHead className="w-[180px]">모듈명</TableHead>
              <TableHead className="w-[150px]">1선 담당자</TableHead>
              <TableHead className="w-[150px]">2선 담당자</TableHead>
              <TableHead className="w-[80px]">알림</TableHead>
              <TableHead className="w-[70px]">상태</TableHead>
              <TableHead className="w-[100px] text-right">관리</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredModules.length > 0 ? (
              filteredModules.map((module) => (
                <TableRow key={module.id}>
                  <TableCell className="text-gray-500 text-sm">
                    {module.sort_order}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Boxes className="h-4 w-4 text-gray-400" />
                      <span className="text-sm">{module.system?.name || '-'}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">
                      {module.code}
                    </code>
                  </TableCell>
                  <TableCell className="font-medium">
                    {module.name}
                  </TableCell>
                  <TableCell>
                    {module.primary_manager ? (
                      <div className="text-sm">
                        <div className="font-medium">{module.primary_manager.full_name || '이름없음'}</div>
                        <div className="text-gray-500 text-xs">{module.primary_manager.email}</div>
                      </div>
                    ) : (
                      <span className="text-gray-400">미지정</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {module.secondary_manager ? (
                      <div className="text-sm">
                        <div className="font-medium">{module.secondary_manager.full_name || '이름없음'}</div>
                        <div className="text-gray-500 text-xs">{module.secondary_manager.email}</div>
                      </div>
                    ) : (
                      <span className="text-gray-400">미지정</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      {module.notify_primary && (
                        <Badge variant="outline" className="text-xs">1선</Badge>
                      )}
                      {module.delay_notification && (
                        <Badge variant="outline" className="text-xs">지연</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={module.is_active ? 'default' : 'secondary'}>
                      {module.is_active ? '사용' : '중지'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditDialog(module)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openDeleteDialog(module)}
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
                <TableCell colSpan={9} className="h-24 text-center text-gray-500">
                  {filterSystemId === ALL_SYSTEMS
                    ? '등록된 모듈이 없습니다.'
                    : '해당 시스템에 등록된 모듈이 없습니다.'}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* 모듈 추가 다이얼로그 */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-[550px]">
          <DialogHeader>
            <DialogTitle>모듈 추가</DialogTitle>
            <DialogDescription>
              시스템에 새로운 모듈을 등록합니다.
            </DialogDescription>
          </DialogHeader>
          {moduleFormFields}
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

      {/* 모듈 수정 다이얼로그 */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-[550px]">
          <DialogHeader>
            <DialogTitle>모듈 수정</DialogTitle>
            <DialogDescription>
              모듈 정보를 수정합니다.
            </DialogDescription>
          </DialogHeader>
          {moduleFormFields}
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
            <AlertDialogTitle>모듈 삭제</AlertDialogTitle>
            <AlertDialogDescription>
              정말 &quot;{selectedModule?.name}&quot; 모듈을 삭제하시겠습니까?
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
