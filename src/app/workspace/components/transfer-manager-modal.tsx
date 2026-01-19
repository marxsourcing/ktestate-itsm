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
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ArrowLeftRight, Loader2 } from 'lucide-react'

interface TransferManagerModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (managerId: string) => Promise<void>
  managers: { id: string; full_name: string | null; email: string }[]
  currentManagerId?: string | null
}

export function TransferManagerModal({
  open,
  onOpenChange,
  onConfirm,
  managers,
  currentManagerId
}: TransferManagerModalProps) {
  const [selectedManagerId, setSelectedManagerId] = useState<string>('')
  const [isLoading, setIsLoading] = useState(false)

  const handleConfirm = async () => {
    if (!selectedManagerId) return
    setIsLoading(true)
    try {
      await onConfirm(selectedManagerId)
      onOpenChange(false)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowLeftRight className="size-5 text-amber-600" />
            담당자 이관
          </DialogTitle>
          <DialogDescription>
            이 요청을 처리할 새로운 담당자를 선택해주세요.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="manager">새로운 담당자</Label>
            <Select
              value={selectedManagerId}
              onValueChange={setSelectedManagerId}
            >
              <SelectTrigger>
                <SelectValue placeholder="담당자 선택" />
              </SelectTrigger>
              <SelectContent>
                {managers
                  .filter((m) => m.id !== currentManagerId)
                  .map((manager) => (
                    <SelectItem key={manager.id} value={manager.id}>
                      {manager.full_name || manager.email}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            취소
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isLoading || !selectedManagerId}
            className="bg-amber-600 hover:bg-amber-700"
          >
            {isLoading ? (
              <>
                <Loader2 className="size-4 mr-2 animate-spin" />
                이관 중...
              </>
            ) : (
              '담당자 이관'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
