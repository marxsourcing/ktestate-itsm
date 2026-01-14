'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { ClipboardList, ChevronDown, Pencil, Check, Loader2 } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { createClient } from '@/lib/supabase/client'
import { DuplicateAlert } from './duplicate-alert'

interface SimilarRequest {
  id: string
  title: string
  description: string
  status: string
  type: string
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

interface RequirementData {
  system?: string
  module?: string
  type?: 'feature_add' | 'feature_improve' | 'bug_fix' | 'other' | 'feature' | 'improvement' | 'bug'
  title?: string
  description?: string
}

interface RequirementCardProps {
  data: RequirementData
  onUpdate?: (data: RequirementData) => void
  readOnly?: boolean
  excludeRequestId?: string  // 유사 요청 검색 시 제외할 요청 ID (이미 확정된 요청 조회 시)
}

const typeLabels: Record<string, { label: string; color: string }> = {
  // 새 유형 코드
  feature_add: { label: '기능추가', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  feature_improve: { label: '기능개선', color: 'bg-rose-100 text-rose-700 border-rose-200' },
  bug_fix: { label: '버그수정', color: 'bg-red-100 text-red-700 border-red-200' },
  other: { label: '기타', color: 'bg-gray-100 text-gray-700 border-gray-200' },
  // 구 유형 코드 호환성
  feature: { label: '기능추가', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  improvement: { label: '기능개선', color: 'bg-rose-100 text-rose-700 border-rose-200' },
  bug: { label: '버그수정', color: 'bg-red-100 text-red-700 border-red-200' },
}

// 새 유형만 표시 (편집 모드용)
const editableTypes = ['feature_add', 'feature_improve', 'bug_fix', 'other'] as const

export function RequirementCard({ data, onUpdate, readOnly = false, excludeRequestId }: RequirementCardProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editData, setEditData] = useState(data)
  const [isExpanded, setIsExpanded] = useState(true)
  const [systems, setSystems] = useState<System[]>([])
  const [modules, setModules] = useState<Module[]>([])
  const [filteredModules, setFilteredModules] = useState<Module[]>([])
  const [isLoadingSystems, setIsLoadingSystems] = useState(false)
  const [isLoadingModules, setIsLoadingModules] = useState(false)
  const [similarRequests, setSimilarRequests] = useState<SimilarRequest[]>([])
  const [hasDuplicate, setHasDuplicate] = useState(false)
  const [isCheckingDuplicates, setIsCheckingDuplicates] = useState(false)
  const [duplicatesDismissed, setDuplicatesDismissed] = useState(false)

  // 시스템 및 모듈 목록 로드
  useEffect(() => {
    if (isEditing && systems.length === 0) {
      loadSystems()
      loadModules()
    }
  }, [isEditing])

  // 시스템 선택 시 모듈 필터링
  useEffect(() => {
    if (editData.system && systems.length > 0 && modules.length > 0) {
      const selectedSystem = systems.find(
        s => s.name === editData.system || s.code === editData.system
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
  }, [editData.system, systems, modules])

  // 중복 요청 탐지
  useEffect(() => {
    if (data.title || data.description) {
      checkDuplicates()
    }
  }, [data.title, data.description, data.system])

  async function checkDuplicates() {
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
          excludeId: excludeRequestId  // 이미 확정된 요청 조회 시 해당 요청 제외
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
  }

  async function loadSystems() {
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
  }

  async function loadModules() {
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
  }

  function handleSave() {
    onUpdate?.(editData)
    setIsEditing(false)
  }

  const typeInfo = typeLabels[data.type || 'other']

  return (
    <div className="space-y-3">
      {/* 중복 요청 알림 */}
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

      {/* 중복 확인 중 로딩 */}
      {isCheckingDuplicates && (
        <div className="flex items-center gap-2 text-sm text-gray-500 px-2">
          <Loader2 className="size-4 animate-spin" />
          <span>유사 요청 확인 중...</span>
        </div>
      )}

      <div className="rounded-xl border border-rose-200 bg-rose-50 overflow-hidden">
        {/* Header */}
        <div
          className="flex items-center gap-3 px-4 py-3 bg-rose-100 cursor-pointer"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <ClipboardList className="size-5 text-rose-600" />
          <span className="flex-1 font-medium text-rose-700">요구사항 분석 결과</span>
          <ChevronDown
          className={cn(
            'size-5 text-rose-600 transition-transform',
            isExpanded ? 'rotate-180' : ''
          )}
        />
      </div>

      {/* Content */}
      {isExpanded && (
        <div className="p-4 space-y-4 bg-white">
          {isEditing ? (
            // Edit mode
            <>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">시스템</label>
                  <select
                    value={editData.system || ''}
                    onChange={(e) => setEditData({ ...editData, system: e.target.value, module: '' })}
                    className="w-full h-10 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-rose-100 focus:border-rose-400"
                    disabled={isLoadingSystems}
                  >
                    <option value="">시스템 선택</option>
                    {systems.map((system) => (
                      <option key={system.id} value={system.name}>
                        {system.name}
                      </option>
                    ))}
                  </select>
                  {isLoadingSystems && (
                    <p className="text-xs text-gray-400 mt-1">시스템 목록 로딩 중...</p>
                  )}
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">모듈</label>
                  {filteredModules.length > 0 ? (
                    <select
                      value={editData.module || ''}
                      onChange={(e) => setEditData({ ...editData, module: e.target.value })}
                      className="w-full h-10 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-rose-100 focus:border-rose-400"
                      disabled={isLoadingModules}
                    >
                      <option value="">모듈 선택</option>
                      {filteredModules.map((module) => (
                        <option key={module.id} value={module.name}>
                          {module.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <Input
                      value={editData.module || ''}
                      onChange={(e) => setEditData({ ...editData, module: e.target.value })}
                      className="bg-white border-gray-300 text-gray-900"
                      placeholder={editData.system ? '모듈 입력' : '시스템을 먼저 선택하세요'}
                      disabled={!editData.system}
                    />
                  )}
                  {isLoadingModules && (
                    <p className="text-xs text-gray-400 mt-1">모듈 목록 로딩 중...</p>
                  )}
                </div>
              </div>

              <div>
                <label className="text-xs text-gray-500 mb-2 block">유형</label>
                <div className="flex gap-2 flex-wrap">
                  {editableTypes.map((key) => {
                    const value = typeLabels[key]
                    // 현재 데이터의 유형이 구 코드인 경우 새 코드로 매핑
                    const normalizedType = editData.type === 'feature' ? 'feature_add'
                      : editData.type === 'improvement' ? 'feature_improve'
                      : editData.type === 'bug' ? 'bug_fix'
                      : editData.type
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setEditData({ ...editData, type: key })}
                        className={cn(
                          'px-3 py-1.5 rounded-lg text-sm border transition-all',
                          normalizedType === key
                            ? value.color
                            : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
                        )}
                      >
                        {value.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div>
                <label className="text-xs text-gray-500 mb-1 block">제목</label>
                <Input
                  value={editData.title || ''}
                  onChange={(e) => setEditData({ ...editData, title: e.target.value })}
                  className="bg-white border-gray-300 text-gray-900"
                  placeholder="요구사항 제목"
                />
              </div>

              <div>
                <label className="text-xs text-gray-500 mb-1 block">상세 내용</label>
                <textarea
                  value={editData.description || ''}
                  onChange={(e) => setEditData({ ...editData, description: e.target.value })}
                  className="w-full rounded-lg bg-white border border-gray-300 text-gray-900 px-3 py-2 text-sm min-h-[80px] resize-none focus:outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-100"
                  placeholder="상세 내용"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setEditData(data)
                    setIsEditing(false)
                  }}
                  className="text-gray-600 hover:text-gray-900"
                >
                  취소
                </Button>
                <Button
                  size="sm"
                  onClick={handleSave}
                  className="kt-gradient hover:opacity-90 text-white"
                >
                  <Check className="size-4 mr-1" />
                  저장
                </Button>
              </div>
            </>
          ) : (
            // View mode
            <>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <span className="text-xs text-gray-500">시스템</span>
                  <p className="text-sm text-gray-900">{data.system || '미지정'}</p>
                </div>
                <div className="space-y-1">
                  <span className="text-xs text-gray-500">모듈</span>
                  <p className="text-sm text-gray-900">{data.module || '미지정'}</p>
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-xs text-gray-500">유형</span>
                <div>
                  <span className={cn('inline-flex px-2 py-0.5 rounded text-xs border', typeInfo.color)}>
                    {typeInfo.label}
                  </span>
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-xs text-gray-500">제목</span>
                <p className="text-sm text-gray-900 font-medium">{data.title || '제목 없음'}</p>
              </div>

              {data.description && (
                <div className="space-y-1">
                  <span className="text-xs text-gray-500">상세 내용</span>
                  <div className="text-sm text-gray-700 markdown-content markdown-assistant">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {data.description}
                    </ReactMarkdown>
                  </div>
                </div>
              )}

              {!readOnly && (
                <div className="flex justify-end pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsEditing(true)}
                    className="text-gray-600 border-gray-300 hover:text-gray-900 hover:bg-gray-50"
                  >
                    <Pencil className="size-4 mr-1" />
                    수정하기
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      )}
      </div>
    </div>
  )
}
