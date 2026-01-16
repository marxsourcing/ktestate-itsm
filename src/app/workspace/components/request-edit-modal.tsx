'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Loader2 } from 'lucide-react'
import { getSystems, getModules, getCategories, updateRequestDetails } from '../actions'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

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
}

interface CategoryLv1 {
  id: string
  code: string
  name: string
}

interface CategoryLv2 {
  id: string
  category_lv1_id: string
  code: string
  name: string
}

interface RequestEditModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  requestId: string
  currentData: {
    system_id?: string | null
    module_id?: string | null
    category_lv1_id?: string | null
    category_lv2_id?: string | null
    priority?: string
  }
  onSuccess?: () => void
}

const PRIORITY_OPTIONS = [
  { value: 'urgent', label: '긴급' },
  { value: 'high', label: '높음' },
  { value: 'medium', label: '보통' },
  { value: 'low', label: '낮음' },
]

export function RequestEditModal({
  open,
  onOpenChange,
  requestId,
  currentData,
  onSuccess
}: RequestEditModalProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [isDataLoading, setIsDataLoading] = useState(true)

  // 폼 데이터
  const [systemId, setSystemId] = useState(currentData.system_id || '')
  const [moduleId, setModuleId] = useState(currentData.module_id || '')
  const [categoryLv1Id, setCategoryLv1Id] = useState(currentData.category_lv1_id || '')
  const [categoryLv2Id, setCategoryLv2Id] = useState(currentData.category_lv2_id || '')
  const [priority, setPriority] = useState(currentData.priority || 'medium')

  // 선택 옵션 데이터
  const [systems, setSystems] = useState<System[]>([])
  const [modules, setModules] = useState<Module[]>([])
  const [filteredModules, setFilteredModules] = useState<Module[]>([])
  const [categoriesLv1, setCategoriesLv1] = useState<CategoryLv1[]>([])
  const [categoriesLv2, setCategoriesLv2] = useState<CategoryLv2[]>([])
  const [filteredCategoriesLv2, setFilteredCategoriesLv2] = useState<CategoryLv2[]>([])

  // 데이터 로드
  useEffect(() => {
    if (open) {
      loadData()
    }
  }, [open])

  // 모달이 열릴 때 현재 데이터로 초기화
  useEffect(() => {
    if (open) {
      setSystemId(currentData.system_id || '')
      setModuleId(currentData.module_id || '')
      setCategoryLv1Id(currentData.category_lv1_id || '')
      setCategoryLv2Id(currentData.category_lv2_id || '')
      setPriority(currentData.priority || 'medium')
    }
  }, [open, currentData])

  // 시스템 선택 시 모듈 필터링
  useEffect(() => {
    if (systemId && modules.length > 0) {
      const filtered = modules.filter(m => m.system_id === systemId)
      setFilteredModules(filtered)
      // 현재 선택된 모듈이 필터링된 목록에 없으면 초기화
      if (moduleId && !filtered.some(m => m.id === moduleId)) {
        setModuleId('')
      }
    } else {
      setFilteredModules([])
    }
  }, [systemId, modules])

  // 대분류 선택 시 소분류 필터링
  useEffect(() => {
    if (categoryLv1Id && categoriesLv2.length > 0) {
      const filtered = categoriesLv2.filter(c => c.category_lv1_id === categoryLv1Id)
      setFilteredCategoriesLv2(filtered)
      // 현재 선택된 소분류가 필터링된 목록에 없으면 초기화
      if (categoryLv2Id && !filtered.some(c => c.id === categoryLv2Id)) {
        setCategoryLv2Id('')
      }
    } else {
      setFilteredCategoriesLv2([])
    }
  }, [categoryLv1Id, categoriesLv2])

  async function loadData() {
    setIsDataLoading(true)
    try {
      const [systemsResult, modulesResult, categoriesResult] = await Promise.all([
        getSystems(),
        getModules(),
        getCategories()
      ])

      setSystems(systemsResult.systems)
      setModules(modulesResult.modules)
      setCategoriesLv1(categoriesResult.categoriesLv1)
      setCategoriesLv2(categoriesResult.categoriesLv2)
    } catch (error) {
      console.error('데이터 로드 실패:', error)
      toast.error('데이터를 불러오는 데 실패했습니다.')
    } finally {
      setIsDataLoading(false)
    }
  }

  async function handleSave() {
    setIsLoading(true)
    try {
      const result = await updateRequestDetails(requestId, {
        system_id: systemId || null,
        module_id: moduleId || null,
        category_lv1_id: categoryLv1Id || null,
        category_lv2_id: categoryLv2Id || null,
        priority
      })

      if (result.error) {
        toast.error(result.error)
      } else if (result.message) {
        // 변경된 내용이 없는 경우
        toast.info(result.message)
      } else {
        toast.success('요청 정보가 수정되었습니다.')
        onOpenChange(false)
        onSuccess?.()
        router.refresh()
      }
    } catch (error) {
      console.error('수정 실패:', error)
      toast.error('수정 중 오류가 발생했습니다.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>요청 정보 수정</DialogTitle>
        </DialogHeader>

        {isDataLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="size-6 animate-spin text-gray-400" />
            <span className="ml-2 text-gray-500">데이터 로딩 중...</span>
          </div>
        ) : (
          <div className="space-y-4 py-4">
            {/* 시스템 선택 */}
            <div className="space-y-2">
              <Label htmlFor="system">시스템</Label>
              <select
                id="system"
                value={systemId}
                onChange={(e) => {
                  setSystemId(e.target.value)
                  setModuleId('')
                }}
                className="w-full h-10 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400"
              >
                <option value="">시스템 선택</option>
                {systems.map((system) => (
                  <option key={system.id} value={system.id}>
                    {system.name}
                  </option>
                ))}
              </select>
            </div>

            {/* 모듈 선택 */}
            <div className="space-y-2">
              <Label htmlFor="module">모듈</Label>
              <select
                id="module"
                value={moduleId}
                onChange={(e) => setModuleId(e.target.value)}
                disabled={!systemId || filteredModules.length === 0}
                className="w-full h-10 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 disabled:bg-gray-100 disabled:text-gray-400"
              >
                <option value="">
                  {!systemId ? '시스템을 먼저 선택하세요' : filteredModules.length === 0 ? '모듈 없음' : '모듈 선택'}
                </option>
                {filteredModules.map((module) => (
                  <option key={module.id} value={module.id}>
                    {module.name}
                  </option>
                ))}
              </select>
            </div>

            {/* SR 구분 (대분류) */}
            <div className="space-y-2">
              <Label htmlFor="categoryLv1">SR 구분 (대분류)</Label>
              <select
                id="categoryLv1"
                value={categoryLv1Id}
                onChange={(e) => {
                  setCategoryLv1Id(e.target.value)
                  setCategoryLv2Id('')
                }}
                className="w-full h-10 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400"
              >
                <option value="">대분류 선택</option>
                {categoriesLv1.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            {/* SR 상세 구분 (소분류) */}
            <div className="space-y-2">
              <Label htmlFor="categoryLv2">SR 상세 구분 (소분류)</Label>
              <select
                id="categoryLv2"
                value={categoryLv2Id}
                onChange={(e) => setCategoryLv2Id(e.target.value)}
                disabled={!categoryLv1Id || filteredCategoriesLv2.length === 0}
                className="w-full h-10 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 disabled:bg-gray-100 disabled:text-gray-400"
              >
                <option value="">
                  {!categoryLv1Id ? '대분류를 먼저 선택하세요' : filteredCategoriesLv2.length === 0 ? '소분류 없음' : '소분류 선택'}
                </option>
                {filteredCategoriesLv2.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            {/* 우선순위 */}
            <div className="space-y-2">
              <Label htmlFor="priority">우선순위</Label>
              <select
                id="priority"
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="w-full h-10 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400"
              >
                {PRIORITY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            취소
          </Button>
          <Button
            onClick={handleSave}
            disabled={isLoading || isDataLoading}
            className="bg-indigo-600 hover:bg-indigo-700"
          >
            {isLoading ? (
              <>
                <Loader2 className="size-4 mr-2 animate-spin" />
                저장 중...
              </>
            ) : (
              '저장'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
