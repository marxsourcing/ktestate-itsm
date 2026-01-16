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
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Rocket,
  Loader2,
  Calendar,
  CalendarClock,
  Zap,
  User,
  Users,
  Package,
  X,
  AlertTriangle
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { AssignedRequest } from './request-list'

interface BatchDeployModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (deployInfo: BatchDeployInfo) => Promise<void>
  isLoading?: boolean
  managers: { id: string; full_name: string | null; email: string }[]
  currentUserId: string
  selectedRequests: AssignedRequest[]
  onRemoveRequest: (requestId: string) => void
}

export interface BatchDeployInfo {
  deploy_batch_name: string
  deploy_type: 'scheduled' | 'unscheduled'
  deploy_manager_id: string | null
  deploy_scheduled_at: string
}

export function BatchDeployModal({
  open,
  onOpenChange,
  onConfirm,
  isLoading = false,
  managers,
  currentUserId,
  selectedRequests,
  onRemoveRequest
}: BatchDeployModalProps) {
  const [deployBatchName, setDeployBatchName] = useState('')
  const [deployType, setDeployType] = useState<'scheduled' | 'unscheduled'>('scheduled')
  const [assignType, setAssignType] = useState<'self' | 'other'>('self')
  const [deployManagerId, setDeployManagerId] = useState('')
  const [deployScheduledAt, setDeployScheduledAt] = useState('')

  // 모달 열릴 때 초기화
  useEffect(() => {
    if (open) {
      // 기본 배포 그룹 이름 생성 (현재 날짜 기준)
      const today = new Date()
      const defaultName = `${today.getFullYear()}년 ${today.getMonth() + 1}월 정기배포`
      setDeployBatchName(defaultName)
      setDeployType('scheduled')
      setAssignType('self')
      setDeployManagerId('')
      setDeployScheduledAt('')
    }
  }, [open])

  const handleConfirm = async () => {
    if (!deployBatchName.trim()) return
    if (assignType === 'other' && !deployManagerId) return
    if (!deployScheduledAt) return

    await onConfirm({
      deploy_batch_name: deployBatchName.trim(),
      deploy_type: deployType,
      deploy_manager_id: assignType === 'self' ? null : deployManagerId,
      deploy_scheduled_at: new Date(deployScheduledAt).toISOString()
    })
  }

  const handleOpenChange = (newOpen: boolean) => {
    if (!isLoading) {
      onOpenChange(newOpen)
    }
  }

  // 본인 제외한 담당자 목록
  const otherManagers = managers.filter(m => m.id !== currentUserId)

  // 테스트 완료 상태가 아닌 요청 체크
  const invalidRequests = selectedRequests.filter(r => r.status !== 'test_completed')
  const hasInvalidRequests = invalidRequests.length > 0

  const isValid =
    deployBatchName.trim() &&
    deployScheduledAt &&
    (assignType === 'self' || (assignType === 'other' && deployManagerId)) &&
    selectedRequests.length > 0 &&
    !hasInvalidRequests

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="size-5 text-cyan-600" />
            일괄 배포 요청
          </DialogTitle>
          <DialogDescription>
            선택한 {selectedRequests.length}개 요청을 묶어서 배포 요청합니다.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-4">
          {/* 선택된 요청 목록 */}
          <div className="space-y-2">
            <Label>선택된 요청 ({selectedRequests.length}건)</Label>
            <div className="max-h-[150px] overflow-y-auto border rounded-lg divide-y">
              {selectedRequests.map(request => (
                <div
                  key={request.id}
                  className={cn(
                    'flex items-center justify-between p-2 text-sm',
                    request.status !== 'test_completed' && 'bg-rose-50'
                  )}
                >
                  <div className="flex-1 min-w-0">
                    <p className="truncate font-medium">{request.title}</p>
                    <p className="text-xs text-gray-500">
                      {request.system?.name || '시스템 미지정'}
                      {request.module?.name && ` / ${request.module.name}`}
                    </p>
                  </div>
                  {request.status !== 'test_completed' && (
                    <span className="flex items-center gap-1 text-xs text-rose-600 mr-2">
                      <AlertTriangle className="size-3" />
                      테스트 미완료
                    </span>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => onRemoveRequest(request.id)}
                    disabled={isLoading}
                    className="size-6 p-0 hover:bg-gray-200"
                  >
                    <X className="size-4" />
                  </Button>
                </div>
              ))}
            </div>
            {hasInvalidRequests && (
              <p className="text-xs text-rose-600 flex items-center gap-1">
                <AlertTriangle className="size-3" />
                테스트가 완료되지 않은 요청이 있습니다. 해당 요청을 제외하거나 테스트를 완료해주세요.
              </p>
            )}
          </div>

          {/* 배포 그룹 이름 */}
          <div className="space-y-2">
            <Label htmlFor="batch-name">
              배포 그룹 이름 <span className="text-rose-500">*</span>
            </Label>
            <Input
              id="batch-name"
              value={deployBatchName}
              onChange={(e) => setDeployBatchName(e.target.value)}
              placeholder="예: 2025년 1월 정기배포"
              disabled={isLoading}
            />
            <p className="text-xs text-gray-500">
              같은 그룹 이름으로 묶인 요청들은 함께 배포됩니다.
            </p>
          </div>

          {/* 배포 유형 */}
          <div className="space-y-3">
            <Label>배포 유형 <span className="text-rose-500">*</span></Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDeployType('scheduled')}
                disabled={isLoading}
                className={cn(
                  'flex-1 gap-2',
                  deployType === 'scheduled' && 'bg-cyan-50 border-cyan-500 text-cyan-700'
                )}
              >
                <CalendarClock className="size-4" />
                정기 배포
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDeployType('unscheduled')}
                disabled={isLoading}
                className={cn(
                  'flex-1 gap-2',
                  deployType === 'unscheduled' && 'bg-orange-50 border-orange-500 text-orange-700'
                )}
              >
                <Zap className="size-4" />
                비정기 배포
              </Button>
            </div>
          </div>

          {/* 배포 승인자 선택 유형 */}
          <div className="space-y-3">
            <Label>배포 승인자</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setAssignType('self')}
                disabled={isLoading}
                className={cn(
                  'flex-1 gap-2',
                  assignType === 'self' && 'bg-cyan-50 border-cyan-500 text-cyan-700'
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
              <Label htmlFor="deploy-manager">
                배포 승인자 선택 <span className="text-rose-500">*</span>
              </Label>
              <Select
                value={deployManagerId}
                onValueChange={setDeployManagerId}
                disabled={isLoading}
              >
                <SelectTrigger id="deploy-manager">
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
                선택한 담당자의 워크스페이스에 일괄 배포 승인 요청이 표시됩니다.
              </p>
            </div>
          )}

          {assignType === 'self' && (
            <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
              본인이 직접 배포를 승인합니다. 배포 완료 후 &quot;일괄 배포 승인&quot; 버튼을 눌러주세요.
            </p>
          )}

          {/* 배포 예정일 */}
          <div className="space-y-2">
            <Label htmlFor="deploy-date" className="flex items-center gap-1">
              <Calendar className="size-4" />
              배포 예정일 <span className="text-rose-500">*</span>
            </Label>
            <input
              type="datetime-local"
              id="deploy-date"
              value={deployScheduledAt}
              onChange={(e) => setDeployScheduledAt(e.target.value)}
              disabled={isLoading}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            />
            <p className="text-xs text-gray-500">배포가 진행될 예정 일시를 입력하세요.</p>
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
            disabled={isLoading || !isValid}
            className="bg-cyan-600 hover:bg-cyan-700"
          >
            {isLoading ? (
              <>
                <Loader2 className="size-4 mr-2 animate-spin" />
                처리 중...
              </>
            ) : (
              <>
                <Rocket className="size-4 mr-2" />
                {selectedRequests.length}건 일괄 배포 요청
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
