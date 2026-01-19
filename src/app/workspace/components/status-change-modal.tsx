'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { AlertTriangle, CheckCircle2, Loader2, Calculator, Upload, X, File } from 'lucide-react'

export interface EffortData {
  estimated_fp?: number | null
  actual_fp?: number | null
  estimated_md?: number | null
  actual_md?: number | null
}

interface StatusChangeModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  type: 'completed' | 'rejected'
  onConfirm: (reason: string, effort?: EffortData, files?: File[]) => Promise<void>
  isLoading?: boolean
  currentEffort?: EffortData
}

const CONFIG = {
  completed: {
    title: '처리 완료',
    description: '요청 처리가 완료되었습니다. 처리 결과와 증빙 자료를 입력해주세요.',
    placeholder: '처리 결과를 입력하세요...\n예: 기능 개발 완료 후 배포하였습니다. 해당 화면에서 확인 가능합니다.',
    icon: CheckCircle2,
    iconColor: 'text-emerald-600',
    buttonText: '완료 처리',
    buttonClass: 'bg-emerald-600 hover:bg-emerald-700',
    label: '처리 결과',
    required: false,
    hint: '처리 결과는 요청자에게 공개됩니다.'
  },
  rejected: {
    title: '요청 반려',
    description: '요청을 반려합니다. 반려 사유를 입력해주세요.',
    placeholder: '반려 사유를 입력하세요...\n예: 해당 기능은 보안 정책상 구현이 불가능합니다.',
    icon: AlertTriangle,
    iconColor: 'text-rose-600',
    buttonText: '반려 처리',
    buttonClass: 'bg-rose-600 hover:bg-rose-700',
    label: '반려 사유',
    required: true,
    hint: '반려 사유는 요청자에게 공개됩니다.'
  }
}

export function StatusChangeModal({
  open,
  onOpenChange,
  type,
  onConfirm,
  isLoading = false,
  currentEffort
}: StatusChangeModalProps) {
  const [reason, setReason] = useState('')
  const [estimatedFp, setEstimatedFp] = useState('')
  const [actualFp, setActualFp] = useState('')
  const [estimatedMd, setEstimatedMd] = useState('')
  const [actualMd, setActualMd] = useState('')
  const [files, setFiles] = useState<File[]>([])

  const config = CONFIG[type]
  const Icon = config.icon

  // 모달 열릴 때 기존 값 로드
  useEffect(() => {
    if (open && currentEffort) {
      // Avoid synchronous setState warning in some environments
      const initForm = () => {
        setEstimatedFp(currentEffort.estimated_fp?.toString() || '')
        setActualFp(currentEffort.actual_fp?.toString() || '')
        setEstimatedMd(currentEffort.estimated_md?.toString() || '')
        setActualMd(currentEffort.actual_md?.toString() || '')
      }
      queueMicrotask(initForm)
    }
  }, [open, currentEffort])

  const handleConfirm = async () => {
    if (config.required && !reason.trim()) {
      return
    }

    // 완료 처리 시 공수 데이터 함께 전달
    const effortData: EffortData | undefined = type === 'completed' ? {
      estimated_fp: estimatedFp ? parseFloat(estimatedFp) : null,
      actual_fp: actualFp ? parseFloat(actualFp) : null,
      estimated_md: estimatedMd ? parseFloat(estimatedMd) : null,
      actual_md: actualMd ? parseFloat(actualMd) : null,
    } : undefined

    await onConfirm(reason.trim(), effortData, files)
    resetForm()
  }

  const resetForm = () => {
    setReason('')
    setEstimatedFp('')
    setActualFp('')
    setEstimatedMd('')
    setActualMd('')
    setFiles([])
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(prev => [...prev, ...Array.from(e.target.files!)])
    }
  }

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index))
  }

  const handleOpenChange = (newOpen: boolean) => {
    if (!isLoading) {
      onOpenChange(newOpen)
      if (!newOpen) {
        resetForm()
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon className={`size-5 ${config.iconColor}`} />
            {config.title}
          </DialogTitle>
          <DialogDescription>
            {config.description}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* 완료 처리 시 공수 입력 영역 */}
          {type === 'completed' && (
            <div className="space-y-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <Calculator className="size-4" />
                공수 관리 (선택사항)
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* FP 공수 */}
                <div className="space-y-3">
                  <p className="text-xs font-medium text-gray-500">Function Point (FP)</p>
                  <div className="space-y-2">
                    <div>
                      <Label htmlFor="estimated-fp" className="text-xs">예상 공수</Label>
                      <Input
                        id="estimated-fp"
                        type="number"
                        step="0.1"
                        min="0"
                        value={estimatedFp}
                        onChange={(e) => setEstimatedFp(e.target.value)}
                        placeholder="0.0"
                        disabled={isLoading}
                        className="h-8 text-sm"
                      />
                    </div>
                    <div>
                      <Label htmlFor="actual-fp" className="text-xs">실제 공수</Label>
                      <Input
                        id="actual-fp"
                        type="number"
                        step="0.1"
                        min="0"
                        value={actualFp}
                        onChange={(e) => setActualFp(e.target.value)}
                        placeholder="0.0"
                        disabled={isLoading}
                        className="h-8 text-sm"
                      />
                    </div>
                  </div>
                </div>

                {/* MD 공수 */}
                <div className="space-y-3">
                  <p className="text-xs font-medium text-gray-500">Man Day (MD)</p>
                  <div className="space-y-2">
                    <div>
                      <Label htmlFor="estimated-md" className="text-xs">예상 공수</Label>
                      <Input
                        id="estimated-md"
                        type="number"
                        step="0.1"
                        min="0"
                        value={estimatedMd}
                        onChange={(e) => setEstimatedMd(e.target.value)}
                        placeholder="0.0"
                        disabled={isLoading}
                        className="h-8 text-sm"
                      />
                    </div>
                    <div>
                      <Label htmlFor="actual-md" className="text-xs">실제 공수</Label>
                      <Input
                        id="actual-md"
                        type="number"
                        step="0.1"
                        min="0"
                        value={actualMd}
                        onChange={(e) => setActualMd(e.target.value)}
                        placeholder="0.0"
                        disabled={isLoading}
                        className="h-8 text-sm"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="reason">
              {config.label}
              {config.required && <span className="text-rose-500 ml-1">*</span>}
            </Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={config.placeholder}
              rows={4}
              disabled={isLoading}
              className="resize-none text-sm"
            />
            <p className="text-[11px] text-gray-500">{config.hint}</p>
          </div>

          {/* 첨부파일 영역 */}
          <div className="space-y-2">
            <Label>첨부파일</Label>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => document.getElementById('file-upload')?.click()}
                  disabled={isLoading}
                  className="h-8 gap-2 border-dashed border-gray-300"
                >
                  <Upload className="size-3.5" />
                  파일 선택
                </Button>
                <input
                  id="file-upload"
                  type="file"
                  multiple
                  onChange={handleFileChange}
                  className="hidden"
                />
                <span className="text-[11px] text-gray-400">
                  처리 결과에 대한 증빙 서류나 참고 파일을 첨부할 수 있습니다.
                </span>
              </div>

              {files.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {files.map((file, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-2 px-2 py-1 bg-gray-100 rounded text-xs text-gray-600 border border-gray-200"
                    >
                      <File className="size-3" />
                      <span className="max-w-[150px] truncate">{file.name}</span>
                      <button
                        type="button"
                        onClick={() => removeFile(index)}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        <X className="size-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isLoading}
          >
            취소
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isLoading || (config.required && !reason.trim())}
            className={config.buttonClass}
          >
            {isLoading ? (
              <>
                <Loader2 className="size-4 mr-2 animate-spin" />
                처리 중...
              </>
            ) : (
              config.buttonText
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
