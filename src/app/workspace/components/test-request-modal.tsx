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
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { FlaskConical, Loader2, User, Users } from 'lucide-react'
import { cn } from '@/lib/utils'

interface TestRequestModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (testInfo: TestInfo) => Promise<void>
  isLoading?: boolean
  managers: { id: string; full_name: string | null; email: string }[]
  currentUserId: string
}

export interface TestInfo {
  test_manager_id: string | null // null이면 본인이 직접 테스트
}

export function TestRequestModal({
  open,
  onOpenChange,
  onConfirm,
  isLoading = false,
  managers,
  currentUserId
}: TestRequestModalProps) {
  const [assignType, setAssignType] = useState<'self' | 'other'>('self')
  const [testManagerId, setTestManagerId] = useState('')

  // 모달 열릴 때 초기화
  useEffect(() => {
    if (open) {
      setAssignType('self')
      setTestManagerId('')
    }
  }, [open])

  const handleConfirm = async () => {
    if (assignType === 'other' && !testManagerId) {
      return
    }
    await onConfirm({
      test_manager_id: assignType === 'self' ? null : testManagerId
    })
  }

  const handleOpenChange = (newOpen: boolean) => {
    if (!isLoading) {
      onOpenChange(newOpen)
    }
  }

  // 본인 제외한 담당자 목록
  const otherManagers = managers.filter(m => m.id !== currentUserId)

  const isValid = assignType === 'self' || (assignType === 'other' && testManagerId)

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FlaskConical className="size-5 text-purple-600" />
            테스트 요청
          </DialogTitle>
          <DialogDescription>
            테스트를 진행할 담당자를 선택해주세요.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-4">
          {/* 테스트 담당자 선택 유형 */}
          <div className="space-y-3">
            <Label>테스트 담당자</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setAssignType('self')}
                disabled={isLoading}
                className={cn(
                  'flex-1 gap-2',
                  assignType === 'self' && 'bg-purple-50 border-purple-500 text-purple-700'
                )}
              >
                <User className="size-4" />
                본인이 직접
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setAssignType('other')}
                disabled={isLoading}
                className={cn(
                  'flex-1 gap-2',
                  assignType === 'other' && 'bg-blue-50 border-blue-500 text-blue-700'
                )}
              >
                <Users className="size-4" />
                다른 담당자
              </Button>
            </div>
          </div>

          {/* 다른 담당자 선택 시 드롭다운 */}
          {assignType === 'other' && (
            <div className="space-y-2">
              <Label htmlFor="test-manager">
                테스트 담당자 선택 <span className="text-rose-500">*</span>
              </Label>
              <Select
                value={testManagerId}
                onValueChange={setTestManagerId}
                disabled={isLoading}
              >
                <SelectTrigger id="test-manager">
                  <SelectValue placeholder="담당자 선택" />
                </SelectTrigger>
                <SelectContent>
                  {otherManagers.map((manager) => (
                    <SelectItem key={manager.id} value={manager.id}>
                      {manager.full_name || manager.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500">
                선택한 담당자의 워크스페이스에 테스트 요청이 표시됩니다.
              </p>
            </div>
          )}

          {assignType === 'self' && (
            <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
              본인이 직접 테스트를 진행합니다. 테스트 완료 후 &quot;테스트 완료&quot; 버튼을 눌러주세요.
            </p>
          )}
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
            disabled={isLoading || !isValid}
            className="bg-purple-600 hover:bg-purple-700"
          >
            {isLoading ? (
              <>
                <Loader2 className="size-4 mr-2 animate-spin" />
                처리 중...
              </>
            ) : (
              '테스트 요청'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
