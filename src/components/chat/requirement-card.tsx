'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { ClipboardList, ChevronDown, Pencil, Check, Loader2, Paperclip, X, CheckCircle2, Download } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { createClient } from '@/lib/supabase/client'
import { DuplicateAlert } from './duplicate-alert'
import { uploadAttachment, deleteAttachment, AttachmentData } from '@/app/chat/attachments'
import { confirmRequirement } from '@/app/chat/actions'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { toast } from 'sonner'

interface SimilarRequest {
  id: string
  title: string
  description: string
  status: string
  system_name: string | null
  created_at: string
  similarity: number
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

export interface RequirementData {
  system?: string
  module?: string
  title?: string
  description?: string
  category_lv1?: string  // 대분류 (SR 구분)
  category_lv2?: string  // 소분류 (SR 상세 구분)
  attachments?: AttachmentData[]
}

interface RequirementCardProps {
  data: RequirementData
  conversationId?: string
  onUpdate?: (data: RequirementData) => void
  readOnly?: boolean
  excludeRequestId?: string  // 유사 요청 검색 시 제외할 요청 ID (이미 확정된 요청 조회 시)
}

export function RequirementCard({ data, conversationId, onUpdate, readOnly = false, excludeRequestId }: RequirementCardProps) {
  const [isEditing, setIsEditing] = useState(!readOnly) // 상시 수정 모드 제공
  const [editData, setEditData] = useState(data)
  const [isExpanded, setIsExpanded] = useState(true)
  const [systems, setSystems] = useState<System[]>([])
  const [modules, setModules] = useState<Module[]>([])
  const [filteredModules, setFilteredModules] = useState<Module[]>([])
  const [isLoadingSystems, setIsLoadingSystems] = useState(false)
  const [isLoadingModules, setIsLoadingModules] = useState(false)
  const [categoriesLv1, setCategoriesLv1] = useState<CategoryLv1[]>([])
  const [categoriesLv2, setCategoriesLv2] = useState<CategoryLv2[]>([])
  const [filteredCategoriesLv2, setFilteredCategoriesLv2] = useState<CategoryLv2[]>([])
  const [isLoadingCategories, setIsLoadingCategories] = useState(false)
  const [similarRequests, setSimilarRequests] = useState<SimilarRequest[]>([])
  const [hasDuplicate, setHasDuplicate] = useState(false)
  const [isCheckingDuplicates, setIsCheckingDuplicates] = useState(false)
  const [duplicatesDismissed, setDuplicatesDismissed] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [isConfirming, setIsConfirming] = useState(false)
  const router = useRouter()

  // 데이터 변경 시 로컬 상태 업데이트
  useEffect(() => {
    setEditData(data)
  }, [data])

  const loadSystems = useCallback(async () => {
    setIsLoadingSystems(true)
    try {
      const supabase = createClient()
      const { data: systemsData, error } = await supabase
        .from('systems')
        .select('id, name, code')
        .eq('status', 'active')
        .order('name')

      if (error) {
        console.error('Failed to load systems:', error)
      } else {
        setSystems(systemsData || [])
      }
    } catch (err) {
      console.error('Error loading systems:', err)
    } finally {
      setIsLoadingSystems(false)
    }
  }, [])

  const loadModules = useCallback(async () => {
    setIsLoadingModules(true)
    try {
      const supabase = createClient()
      const { data: modulesData, error } = await supabase
        .from('system_modules')
        .select('id, system_id, code, name')
        .eq('is_active', true)
        .order('sort_order')

      if (error) {
        console.error('Failed to load modules:', error)
      } else {
        setModules(modulesData || [])
      }
    } catch (err) {
      console.error('Error loading modules:', err)
    } finally {
      setIsLoadingModules(false)
    }
  }, [])

  const loadCategories = useCallback(async () => {
    setIsLoadingCategories(true)
    try {
      const supabase = createClient()

      // 대분류 로드
      const { data: lv1Data, error: lv1Error } = await supabase
        .from('request_categories_lv1')
        .select('id, code, name')
        .eq('is_active', true)
        .order('sort_order')

      if (lv1Error) {
        console.error('Failed to load categories lv1:', lv1Error)
      } else {
        setCategoriesLv1(lv1Data || [])
      }

      // 소분류 로드
      const { data: lv2Data, error: lv2Error } = await supabase
        .from('request_categories_lv2')
        .select('id, category_lv1_id, code, name')
        .eq('is_active', true)
        .order('sort_order')

      if (lv2Error) {
        console.error('Failed to load categories lv2:', lv2Error)
      } else {
        setCategoriesLv2(lv2Data || [])
      }
    } catch (err) {
      console.error('Error loading categories:', err)
    } finally {
      setIsLoadingCategories(false)
    }
  }, [])

  const checkDuplicates = useCallback(async () => {
    if (duplicatesDismissed) return

    setIsCheckingDuplicates(true)
    try {
      const response = await fetch('/api/ai/similar-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: data.title,
          description: data.description,
          system: data.system,
          excludeId: excludeRequestId
        })
      })

      if (response.ok) {
        const result = await response.json()
        setSimilarRequests(result.similarRequests || [])
        setHasDuplicate(result.hasDuplicate || false)
      }
    } catch (error) {
      console.error('Failed to check duplicates:', error)
    } finally {
      setIsCheckingDuplicates(false)
    }
  }, [data.title, data.description, data.system, duplicatesDismissed, excludeRequestId])

  // 시스템, 모듈, 분류 목록 로드
  useEffect(() => {
    if (isEditing) {
      if (systems.length === 0) {
        loadSystems()
        loadModules()
      }
      if (categoriesLv1.length === 0) {
        loadCategories()
      }
    }
  }, [isEditing, systems.length, categoriesLv1.length, loadSystems, loadModules, loadCategories])

  // 대분류 선택 시 소분류 필터링
  useEffect(() => {
    const categoryLv1Name = editData.category_lv1 || data.category_lv1
    if (categoryLv1Name && categoriesLv1.length > 0 && categoriesLv2.length > 0) {
      const selectedLv1 = categoriesLv1.find(
        c => c.name === categoryLv1Name || c.code === categoryLv1Name
      )
      if (selectedLv1) {
        const lv2Categories = categoriesLv2.filter(c => c.category_lv1_id === selectedLv1.id)
        setFilteredCategoriesLv2(lv2Categories)
      } else {
        setFilteredCategoriesLv2([])
      }
    } else {
      setFilteredCategoriesLv2([])
    }
  }, [editData.category_lv1, data.category_lv1, categoriesLv1, categoriesLv2])

  // 시스템 선택 시 모듈 필터링
  useEffect(() => {
    const systemName = editData.system || data.system
    if (systemName && systems.length > 0 && modules.length > 0) {
      const selectedSystem = systems.find(
        s => s.name === systemName || s.code === systemName
      )
      if (selectedSystem) {
        const systemModules = modules.filter(m => m.system_id === selectedSystem.id)
        setFilteredModules(systemModules)
      } else {
        setFilteredModules([])
      }
    } else {
      setFilteredModules([])
    }
  }, [editData.system, data.system, systems, modules])

  // 중복 요청 탐지
  useEffect(() => {
    if (data.title || data.description) {
      checkDuplicates()
    }
  }, [data.title, data.description, checkDuplicates])

  function handleSave() {
    onUpdate?.(editData)
    setIsEditing(false)
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !conversationId) return

    setIsUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      
      const { attachment, error } = await uploadAttachment(formData, undefined, undefined, undefined, conversationId)
      
      if (error) {
        alert(error)
        return
      }

      if (attachment) {
        const updatedAttachments = [...(editData.attachments || []), attachment]
        const newData = { ...editData, attachments: updatedAttachments }
        setEditData(newData)
        onUpdate?.(newData)
      }
    } catch (err) {
      console.error('File upload error:', err)
      alert('파일 업로드 중 오류가 발생했습니다.')
    } finally {
      setIsUploading(false)
      if (e.target) e.target.value = ''
    }
  }

  const handleRemoveAttachment = async (id: string) => {
    if (!confirm('파일을 삭제하시겠습니까?')) return

    try {
      const { success, error } = await deleteAttachment(id)
      if (error) {
        alert(error)
        return
      }

      if (success) {
        const updatedAttachments = (editData.attachments || []).filter(a => a.id !== id)
        const newData = { ...editData, attachments: updatedAttachments }
        setEditData(newData)
        onUpdate?.(newData)
      }
    } catch (err) {
      console.error('File delete error:', err)
    }
  }

  const handleConfirm = async () => {
    if (!conversationId) return
    if (!editData.title || !editData.description) {
      toast.error('제목과 상세 내용을 입력해주세요.')
      return
    }

    setIsConfirming(true)
    try {
      const result = await confirmRequirement(conversationId, {
        title: editData.title,
        description: editData.description,
        system: editData.system,
        module: editData.module,
        category_lv1: editData.category_lv1,
        category_lv2: editData.category_lv2,
      })

      if (result.error) {
        toast.error(result.error)
        return
      }

      toast.success('요구사항이 성공적으로 확정되었습니다.')
      router.push(`/requests/${result.request.id}`)
    } catch (err) {
      console.error('Confirm error:', err)
      toast.error('요구사항 확정 중 오류가 발생했습니다.')
    } finally {
      setIsConfirming(false)
    }
  }

  return (
    <div className="space-y-3">
      {!duplicatesDismissed && similarRequests.length > 0 && (
        <DuplicateAlert
          similarRequests={similarRequests}
          hasDuplicate={hasDuplicate}
          onDismiss={() => {
            setDuplicatesDismissed(true)
            setSimilarRequests([])
          }}
        />
      )}

      {isCheckingDuplicates && (
        <div className="flex items-center gap-2 text-sm text-gray-500 px-2">
          <Loader2 className="size-4 animate-spin" />
          <span>유사 요청 확인 중...</span>
        </div>
      )}

      <div className="rounded-xl border border-rose-200 bg-rose-50 overflow-hidden shadow-sm">
        <div
          className="flex items-center gap-3 px-4 py-3 bg-rose-100 cursor-pointer"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <ClipboardList className="size-5 text-rose-600" />
          <span className="flex-1 font-medium text-rose-700 text-sm">요청/문의사항 분석</span>
          <ChevronDown
            className={cn(
              'size-5 text-rose-600 transition-transform',
              isExpanded ? 'rotate-180' : ''
            )}
          />
        </div>

        {isExpanded && (
          <div className="p-4 space-y-4 bg-white">
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-[13px] font-medium text-gray-700">시스템</label>
                  {isEditing ? (
                    <select
                      value={editData.system || ''}
                      onChange={(e) => setEditData({ ...editData, system: e.target.value, module: '' })}
                      className="w-full h-9 rounded-md border border-gray-300 bg-white px-3 py-1 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-rose-100 focus:border-rose-400"
                      disabled={isLoadingSystems}
                    >
                      <option value="">시스템 선택</option>
                      {systems.map((system) => (
                        <option key={system.id} value={system.name}>{system.name}</option>
                      ))}
                    </select>
                  ) : (
                    <p className="text-sm text-gray-900 px-1">{data.system || '미지정'}</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <label className="text-[13px] font-medium text-gray-700">모듈</label>
                  {isEditing ? (
                    filteredModules.length > 0 ? (
                      <select
                        value={editData.module || ''}
                        onChange={(e) => setEditData({ ...editData, module: e.target.value })}
                        className="w-full h-9 rounded-md border border-gray-300 bg-white px-3 py-1 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-rose-100 focus:border-rose-400"
                        disabled={isLoadingModules}
                      >
                        <option value="">모듈 선택</option>
                        {filteredModules.map((module) => (
                          <option key={module.id} value={module.name}>{module.name}</option>
                        ))}
                      </select>
                    ) : (
                      <Input
                        value={editData.module || ''}
                        onChange={(e) => setEditData({ ...editData, module: e.target.value })}
                        className="h-9 bg-white border-gray-300 text-sm"
                        placeholder={editData.system ? '모듈 입력' : '시스템 먼저 선택'}
                        disabled={!editData.system}
                      />
                    )
                  ) : (
                    <p className="text-sm text-gray-900 px-1">{data.module || '미지정'}</p>
                  )}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-[13px] font-medium text-gray-700">SR 구분</label>
                  {isEditing ? (
                    <select
                      value={editData.category_lv1 || ''}
                      onChange={(e) => setEditData({ ...editData, category_lv1: e.target.value, category_lv2: '' })}
                      className="w-full h-9 rounded-md border border-gray-300 bg-white px-3 py-1 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-rose-100 focus:border-rose-400"
                      disabled={isLoadingCategories}
                    >
                      <option value="">대분류 선택</option>
                      {categoriesLv1.map((cat) => (
                        <option key={cat.id} value={cat.name}>{cat.name}</option>
                      ))}
                    </select>
                  ) : (
                    <p className="text-sm text-gray-900 px-1">{data.category_lv1 || '미지정'}</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <label className="text-[13px] font-medium text-gray-700">SR 상세 구분</label>
                  {isEditing ? (
                    <select
                      value={editData.category_lv2 || ''}
                      onChange={(e) => setEditData({ ...editData, category_lv2: e.target.value })}
                      className="w-full h-9 rounded-md border border-gray-300 bg-white px-3 py-1 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-rose-100 focus:border-rose-400"
                      disabled={!editData.category_lv1 || filteredCategoriesLv2.length === 0}
                    >
                      <option value="">소분류 선택</option>
                      {filteredCategoriesLv2.map((cat) => (
                        <option key={cat.id} value={cat.name}>{cat.name}</option>
                      ))}
                    </select>
                  ) : (
                    <p className="text-sm text-gray-900 px-1">{data.category_lv2 || '미지정'}</p>
                  )}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[13px] font-medium text-gray-700">제목</label>
                {isEditing ? (
                  <Input
                    value={editData.title || ''}
                    onChange={(e) => setEditData({ ...editData, title: e.target.value })}
                    className="h-9 bg-white border-gray-300 text-sm"
                    placeholder="요청 제목"
                  />
                ) : (
                  <p className="text-sm font-medium text-gray-900 px-1">{data.title || '제목 없음'}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-[13px] font-medium text-gray-700">상세 내용</label>
                {isEditing ? (
                  <textarea
                    value={editData.description || ''}
                    onChange={(e) => setEditData({ ...editData, description: e.target.value })}
                    className="w-full rounded-md bg-white border border-gray-300 text-sm px-3 py-2 min-h-[120px] resize-none focus:outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-100"
                    placeholder="상세 내용을 입력하세요..."
                  />
                ) : (
                  <div className="text-sm text-gray-700 px-1 leading-relaxed">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {data.description || '내용 없음'}
                    </ReactMarkdown>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[13px] font-medium text-gray-700">첨부파일</label>
                  {!readOnly && (
                    <div className="relative">
                      <input
                        type="file"
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        onChange={handleFileUpload}
                        disabled={isUploading}
                      />
                      <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
                        {isUploading ? <Loader2 className="size-3 animate-spin" /> : <Paperclip className="size-3" />}
                        파일 추가
                      </Button>
                    </div>
                  )}
                </div>
                
                <div className="space-y-1.5">
                  {(editData.attachments || []).length > 0 ? (
                    <div className="grid gap-2">
                      {editData.attachments?.map((file) => (
                        <div key={file.id} className="flex items-center justify-between p-2 rounded-lg bg-gray-50 border border-gray-100 group">
                          <a 
                            href={file.url || '#'} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 min-w-0 flex-1 hover:opacity-70 transition-opacity"
                          >
                            {file.file_type.startsWith('image/') ? (
                              <div className="relative w-8 h-8 rounded border bg-white overflow-hidden shrink-0">
                                <Image src={file.url || ''} alt="" fill className="object-cover" />
                              </div>
                            ) : (
                              <div className="w-8 h-8 rounded border bg-white flex items-center justify-center shrink-0">
                                <Paperclip className="size-4 text-gray-400" />
                              </div>
                            )}
                            <div className="min-w-0">
                              <p className="text-xs font-medium text-gray-700 truncate">{file.file_name}</p>
                              <p className="text-[10px] text-gray-400">{(file.file_size / 1024 / 1024).toFixed(2)} MB</p>
                            </div>
                          </a>
                          <div className="flex items-center gap-1">
                            <a
                              href={file.url || '#'}
                              download={file.file_name}
                              className="p-1 text-gray-400 hover:text-rose-600 transition-colors"
                              title="다운로드"
                            >
                              <Download className="size-4" />
                            </a>
                            {!readOnly && (
                              <button
                                onClick={(e) => {
                                  e.preventDefault();
                                  handleRemoveAttachment(file.id);
                                }}
                                className="p-1 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <X className="size-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400 text-center py-4 border-2 border-dashed rounded-lg">
                      첨부된 파일이 없습니다.
                    </p>
                  )}
                </div>
              </div>

              {!readOnly && (
                <div className="flex justify-end gap-2 pt-2">
                  {isEditing ? (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditData(data)
                          setIsEditing(false)
                        }}
                        className="h-9 text-gray-600"
                      >
                        취소
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleSave}
                        className="h-9 px-4 kt-gradient text-white shadow-sm"
                      >
                        <Check className="size-4 mr-1.5" />
                        분석 결과 저장
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsEditing(true)}
                        className="h-9 gap-1.5 text-gray-600 border-gray-300"
                      >
                        <Pencil className="size-3.5" />
                        내용 수정하기
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleConfirm}
                        disabled={isConfirming}
                        className="h-9 px-4 bg-rose-600 hover:bg-rose-700 text-white shadow-sm gap-1.5"
                      >
                        {isConfirming ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <CheckCircle2 className="size-4" />
                        )}
                        요구사항 확정
                      </Button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
