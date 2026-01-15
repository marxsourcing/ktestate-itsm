'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Plus, Pencil, Trash2, Search, FolderTree, FolderOpen } from 'lucide-react'
import { toast } from 'sonner'
import {
  createCategoryLv1,
  updateCategoryLv1,
  deleteCategoryLv1,
  createCategoryLv2,
  updateCategoryLv2,
  deleteCategoryLv2,
} from './actions'

interface CategoryLv1 {
  id: string
  code: string
  name: string
  sort_order: number
  is_active: boolean
  created_at: string
}

interface CategoryLv2 {
  id: string
  category_lv1_id: string
  code: string
  name: string
  sort_order: number
  is_active: boolean
  created_at: string
  category_lv1: {
    id: string
    name: string
    code: string
  } | null
}

interface AdminCategoriesClientProps {
  categoriesLv1: CategoryLv1[]
  categoriesLv2: CategoryLv2[]
}

export function AdminCategoriesClient({
  categoriesLv1: initialLv1,
  categoriesLv2: initialLv2,
}: AdminCategoriesClientProps) {
  const [categoriesLv1, setCategoriesLv1] = useState(initialLv1)
  const [categoriesLv2, setCategoriesLv2] = useState(initialLv2)
  const [searchTerm, setSearchTerm] = useState('')
  const [activeTab, setActiveTab] = useState('lv1')

  // 대분류 모달 상태
  const [isLv1ModalOpen, setIsLv1ModalOpen] = useState(false)
  const [editingLv1, setEditingLv1] = useState<CategoryLv1 | null>(null)
  const [lv1Form, setLv1Form] = useState({ code: '', name: '', sort_order: 0 })

  // 소분류 모달 상태
  const [isLv2ModalOpen, setIsLv2ModalOpen] = useState(false)
  const [editingLv2, setEditingLv2] = useState<CategoryLv2 | null>(null)
  const [lv2Form, setLv2Form] = useState({ category_lv1_id: '', code: '', name: '', sort_order: 0 })

  // 삭제 확인 모달
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'lv1' | 'lv2'; item: CategoryLv1 | CategoryLv2 } | null>(null)

  // 대분류 필터링
  const filteredLv1 = categoriesLv1.filter(
    (cat) =>
      cat.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cat.code.toLowerCase().includes(searchTerm.toLowerCase())
  )

  // 소분류 필터링
  const filteredLv2 = categoriesLv2.filter(
    (cat) =>
      cat.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cat.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cat.category_lv1?.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  // 대분류 CRUD
  const handleOpenLv1Modal = (category?: CategoryLv1) => {
    if (category) {
      setEditingLv1(category)
      setLv1Form({ code: category.code, name: category.name, sort_order: category.sort_order })
    } else {
      setEditingLv1(null)
      setLv1Form({ code: '', name: '', sort_order: categoriesLv1.length + 1 })
    }
    setIsLv1ModalOpen(true)
  }

  const handleSaveLv1 = async () => {
    if (!lv1Form.code || !lv1Form.name) {
      toast.error('코드와 이름을 입력해주세요.')
      return
    }

    if (editingLv1) {
      const result = await updateCategoryLv1(editingLv1.id, lv1Form)
      if (result.error) {
        toast.error(result.error)
      } else {
        setCategoriesLv1((prev) =>
          prev.map((cat) => (cat.id === editingLv1.id ? { ...cat, ...lv1Form } : cat))
        )
        toast.success('대분류가 수정되었습니다.')
      }
    } else {
      const result = await createCategoryLv1(lv1Form)
      if (result.error) {
        toast.error(result.error)
      } else if (result.data) {
        setCategoriesLv1((prev) => [...prev, result.data])
        toast.success('대분류가 추가되었습니다.')
      }
    }
    setIsLv1ModalOpen(false)
  }

  const handleDeleteLv1 = async () => {
    if (!deleteTarget || deleteTarget.type !== 'lv1') return

    const result = await deleteCategoryLv1(deleteTarget.item.id)
    if (result.error) {
      toast.error(result.error)
    } else {
      setCategoriesLv1((prev) => prev.filter((cat) => cat.id !== deleteTarget.item.id))
      // 연관 소분류도 제거
      setCategoriesLv2((prev) => prev.filter((cat) => cat.category_lv1_id !== deleteTarget.item.id))
      toast.success('대분류가 삭제되었습니다.')
    }
    setDeleteTarget(null)
  }

  // 소분류 CRUD
  const handleOpenLv2Modal = (category?: CategoryLv2) => {
    if (category) {
      setEditingLv2(category)
      setLv2Form({
        category_lv1_id: category.category_lv1_id,
        code: category.code,
        name: category.name,
        sort_order: category.sort_order,
      })
    } else {
      setEditingLv2(null)
      setLv2Form({
        category_lv1_id: categoriesLv1[0]?.id || '',
        code: '',
        name: '',
        sort_order: categoriesLv2.length + 1,
      })
    }
    setIsLv2ModalOpen(true)
  }

  const handleSaveLv2 = async () => {
    if (!lv2Form.category_lv1_id || !lv2Form.code || !lv2Form.name) {
      toast.error('모든 필드를 입력해주세요.')
      return
    }

    if (editingLv2) {
      const result = await updateCategoryLv2(editingLv2.id, lv2Form)
      if (result.error) {
        toast.error(result.error)
      } else {
        setCategoriesLv2((prev) =>
          prev.map((cat) =>
            cat.id === editingLv2.id
              ? {
                  ...cat,
                  ...lv2Form,
                  category_lv1: categoriesLv1.find((lv1) => lv1.id === lv2Form.category_lv1_id) || null,
                }
              : cat
          )
        )
        toast.success('소분류가 수정되었습니다.')
      }
    } else {
      const result = await createCategoryLv2(lv2Form)
      if (result.error) {
        toast.error(result.error)
      } else if (result.data) {
        setCategoriesLv2((prev) => [
          ...prev,
          {
            ...result.data,
            category_lv1: categoriesLv1.find((lv1) => lv1.id === lv2Form.category_lv1_id) || null,
          },
        ])
        toast.success('소분류가 추가되었습니다.')
      }
    }
    setIsLv2ModalOpen(false)
  }

  const handleDeleteLv2 = async () => {
    if (!deleteTarget || deleteTarget.type !== 'lv2') return

    const result = await deleteCategoryLv2(deleteTarget.item.id)
    if (result.error) {
      toast.error(result.error)
    } else {
      setCategoriesLv2((prev) => prev.filter((cat) => cat.id !== deleteTarget.item.id))
      toast.success('소분류가 삭제되었습니다.')
    }
    setDeleteTarget(null)
  }

  return (
    <div className="space-y-6">
      {/* 검색 및 추가 버튼 */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="분류명 또는 코드로 검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button onClick={() => (activeTab === 'lv1' ? handleOpenLv1Modal() : handleOpenLv2Modal())}>
          <Plus className="size-4 mr-2" />
          {activeTab === 'lv1' ? '대분류 추가' : '소분류 추가'}
        </Button>
      </div>

      {/* 탭 */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="lv1" className="flex items-center gap-2">
            <FolderTree className="size-4" />
            대분류 ({categoriesLv1.length})
          </TabsTrigger>
          <TabsTrigger value="lv2" className="flex items-center gap-2">
            <FolderOpen className="size-4" />
            소분류 ({categoriesLv2.length})
          </TabsTrigger>
        </TabsList>

        {/* 대분류 테이블 */}
        <TabsContent value="lv1">
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-24">코드</TableHead>
                  <TableHead>분류명</TableHead>
                  <TableHead className="w-24 text-center">순서</TableHead>
                  <TableHead className="w-24 text-center">상태</TableHead>
                  <TableHead className="w-24 text-center">소분류 수</TableHead>
                  <TableHead className="w-32 text-center">관리</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLv1.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      등록된 대분류가 없습니다.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredLv1.map((cat) => {
                    const lv2Count = categoriesLv2.filter((lv2) => lv2.category_lv1_id === cat.id).length
                    return (
                      <TableRow key={cat.id}>
                        <TableCell className="font-mono text-sm">{cat.code}</TableCell>
                        <TableCell className="font-medium">{cat.name}</TableCell>
                        <TableCell className="text-center">{cat.sort_order}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant={cat.is_active ? 'default' : 'secondary'}>
                            {cat.is_active ? '활성' : '비활성'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">{lv2Count}</TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleOpenLv1Modal(cat)}
                            >
                              <Pencil className="size-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setDeleteTarget({ type: 'lv1', item: cat })}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* 소분류 테이블 */}
        <TabsContent value="lv2">
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-24">코드</TableHead>
                  <TableHead>소분류명</TableHead>
                  <TableHead>대분류</TableHead>
                  <TableHead className="w-24 text-center">순서</TableHead>
                  <TableHead className="w-24 text-center">상태</TableHead>
                  <TableHead className="w-32 text-center">관리</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLv2.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      등록된 소분류가 없습니다.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredLv2.map((cat) => (
                    <TableRow key={cat.id}>
                      <TableCell className="font-mono text-sm">{cat.code}</TableCell>
                      <TableCell className="font-medium">{cat.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{cat.category_lv1?.name || '-'}</Badge>
                      </TableCell>
                      <TableCell className="text-center">{cat.sort_order}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant={cat.is_active ? 'default' : 'secondary'}>
                          {cat.is_active ? '활성' : '비활성'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenLv2Modal(cat)}
                          >
                            <Pencil className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteTarget({ type: 'lv2', item: cat })}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      {/* 대분류 편집 모달 */}
      <Dialog open={isLv1ModalOpen} onOpenChange={setIsLv1ModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingLv1 ? '대분류 수정' : '대분류 추가'}</DialogTitle>
            <DialogDescription>요구사항 대분류 정보를 입력하세요.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">코드</label>
              <Input
                value={lv1Form.code}
                onChange={(e) => setLv1Form({ ...lv1Form, code: e.target.value })}
                placeholder="예: 400"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">분류명</label>
              <Input
                value={lv1Form.name}
                onChange={(e) => setLv1Form({ ...lv1Form, name: e.target.value })}
                placeholder="예: 개발요청"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">정렬 순서</label>
              <Input
                type="number"
                value={lv1Form.sort_order}
                onChange={(e) => setLv1Form({ ...lv1Form, sort_order: parseInt(e.target.value) || 0 })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsLv1ModalOpen(false)}>
              취소
            </Button>
            <Button onClick={handleSaveLv1}>저장</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 소분류 편집 모달 */}
      <Dialog open={isLv2ModalOpen} onOpenChange={setIsLv2ModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingLv2 ? '소분류 수정' : '소분류 추가'}</DialogTitle>
            <DialogDescription>요구사항 소분류 정보를 입력하세요.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">대분류</label>
              <select
                value={lv2Form.category_lv1_id}
                onChange={(e) => setLv2Form({ ...lv2Form, category_lv1_id: e.target.value })}
                className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">대분류 선택</option>
                {categoriesLv1.map((lv1) => (
                  <option key={lv1.id} value={lv1.id}>
                    [{lv1.code}] {lv1.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">코드</label>
              <Input
                value={lv2Form.code}
                onChange={(e) => setLv2Form({ ...lv2Form, code: e.target.value })}
                placeholder="예: 401"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">분류명</label>
              <Input
                value={lv2Form.name}
                onChange={(e) => setLv2Form({ ...lv2Form, name: e.target.value })}
                placeholder="예: 업무개선"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">정렬 순서</label>
              <Input
                type="number"
                value={lv2Form.sort_order}
                onChange={(e) => setLv2Form({ ...lv2Form, sort_order: parseInt(e.target.value) || 0 })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsLv2ModalOpen(false)}>
              취소
            </Button>
            <Button onClick={handleSaveLv2}>저장</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 삭제 확인 모달 */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>삭제 확인</DialogTitle>
            <DialogDescription>
              {deleteTarget?.type === 'lv1'
                ? '이 대분류를 삭제하면 연결된 소분류도 함께 삭제됩니다.'
                : '이 소분류를 삭제하시겠습니까?'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              취소
            </Button>
            <Button
              variant="destructive"
              onClick={deleteTarget?.type === 'lv1' ? handleDeleteLv1 : handleDeleteLv2}
            >
              삭제
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
