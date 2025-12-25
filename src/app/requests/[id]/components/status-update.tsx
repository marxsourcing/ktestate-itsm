'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { updateRequestStatus } from '../../actions'
import { toast } from 'sonner'

interface StatusUpdateProps {
  requestId: string
  currentStatus: string
  isManager: boolean
}

const getStatusLabel = (status: string) => {
  switch (status) {
    case 'requested': return '요청'
    case 'reviewing': return '검토중'
    case 'processing': return '처리중'
    case 'completed': return '완료'
    case 'rejected': return '반려'
    default: return status
  }
}

export function StatusUpdate({ requestId, currentStatus, isManager }: StatusUpdateProps) {
  const [isPending, setIsPending] = useState(false)
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)

  function handleStatusSelect(newStatus: string) {
    if (newStatus === currentStatus) return
    setSelectedStatus(newStatus)
    setNote('')
    setDialogOpen(true)
  }

  async function handleConfirm() {
    if (!selectedStatus) return
    
    setIsPending(true)
    const result = await updateRequestStatus(requestId, selectedStatus, note || undefined)
    
    if (result?.error) {
      toast.error(result.error)
    } else {
      toast.success('상태가 변경되었습니다.')
      setDialogOpen(false)
      setSelectedStatus(null)
      setNote('')
    }
    setIsPending(false)
  }

  if (!isManager) return null

  return (
    <>
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">상태 변경:</span>
        <Select 
          value={currentStatus}
          onValueChange={handleStatusSelect}
          disabled={isPending}
        >
          <SelectTrigger className="w-[130px]">
            <SelectValue placeholder="상태 선택" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="requested">요청</SelectItem>
            <SelectItem value="reviewing">검토중</SelectItem>
            <SelectItem value="processing">처리중</SelectItem>
            <SelectItem value="completed">완료</SelectItem>
            <SelectItem value="rejected">반려</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>상태 변경 확인</DialogTitle>
            <DialogDescription>
              상태를 <span className="font-medium">{getStatusLabel(currentStatus)}</span>에서{' '}
              <span className="font-medium text-primary">{selectedStatus ? getStatusLabel(selectedStatus) : ''}</span>로 변경합니다.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-3">
            <Label htmlFor="note">변경 사유 (선택)</Label>
            <Textarea
              id="note"
              placeholder="상태 변경 사유를 입력하세요..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              className="resize-none"
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={isPending}>
              취소
            </Button>
            <Button onClick={handleConfirm} disabled={isPending}>
              {isPending ? '처리 중...' : '확인'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

