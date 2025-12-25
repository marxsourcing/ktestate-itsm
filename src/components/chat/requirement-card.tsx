'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { ClipboardList, ChevronDown, Pencil, Check } from 'lucide-react'

interface RequirementData {
  system?: string
  module?: string
  type?: 'feature' | 'improvement' | 'bug' | 'other'
  title?: string
  description?: string
}

interface RequirementCardProps {
  data: RequirementData
  onUpdate?: (data: RequirementData) => void
  readOnly?: boolean
}

const typeLabels = {
  feature: { label: '기능 추가', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  improvement: { label: '기능 개선', color: 'bg-rose-100 text-rose-700 border-rose-200' },
  bug: { label: '버그 수정', color: 'bg-red-100 text-red-700 border-red-200' },
  other: { label: '기타', color: 'bg-gray-100 text-gray-700 border-gray-200' },
}

export function RequirementCard({ data, onUpdate, readOnly = false }: RequirementCardProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editData, setEditData] = useState(data)
  const [isExpanded, setIsExpanded] = useState(true)

  function handleSave() {
    onUpdate?.(editData)
    setIsEditing(false)
  }

  const typeInfo = typeLabels[data.type || 'other']

  return (
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
                  <Input
                    value={editData.system || ''}
                    onChange={(e) => setEditData({ ...editData, system: e.target.value })}
                    className="bg-white border-gray-300 text-gray-900"
                    placeholder="시스템 선택"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">모듈</label>
                  <Input
                    value={editData.module || ''}
                    onChange={(e) => setEditData({ ...editData, module: e.target.value })}
                    className="bg-white border-gray-300 text-gray-900"
                    placeholder="모듈 선택"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-gray-500 mb-2 block">유형</label>
                <div className="flex gap-2 flex-wrap">
                  {Object.entries(typeLabels).map(([key, value]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setEditData({ ...editData, type: key as RequirementData['type'] })}
                      className={cn(
                        'px-3 py-1.5 rounded-lg text-sm border transition-all',
                        editData.type === key
                          ? value.color
                          : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
                      )}
                    >
                      {value.label}
                    </button>
                  ))}
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
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{data.description}</p>
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
  )
}
