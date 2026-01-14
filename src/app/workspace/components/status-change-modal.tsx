'use client'

import { useState } from 'react'
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
import { AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react'

interface StatusChangeModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  type: 'completed' | 'rejected'
  onConfirm: (reason: string) => Promise<void>
  isLoading?: boolean
}

const CONFIG = {
  completed: {
    title: '처리 완료',
    description: '요청 처리가 완료되었습니다. 처리 결과를 입력해주세요.',
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
  isLoading = false
}: StatusChangeModalProps) {
  const [reason, setReason] = useState('')
  const config = CONFIG[type]
  const Icon = config.icon

  const handleConfirm = async () => {
    if (config.required && !reason.trim()) {
      return
    }
    await onConfirm(reason.trim())
    setReason('')
  }

  const handleOpenChange = (newOpen: boolean) => {
    if (!isLoading) {
      onOpenChange(newOpen)
      if (!newOpen) {
        setReason('')
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
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
              rows={5}
              disabled={isLoading}
              className="resize-none"
            />
            <p className="text-xs text-gray-500">{config.hint}</p>
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
