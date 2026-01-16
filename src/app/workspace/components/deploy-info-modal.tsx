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
import { Rocket, Loader2, Calendar, CalendarClock, Zap, User, Users } from 'lucide-react'
import { cn } from '@/lib/utils'

interface DeployInfoModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (deployInfo: DeployInfo) => Promise<void>
  isLoading?: boolean
  managers: { id: string; full_name: string | null; email: string }[]
  currentUserId: string
  currentDeployInfo?: {
    deploy_type?: string | null
    deploy_manager_id?: string | null
    deploy_scheduled_at?: string | null
  }
}

export interface DeployInfo {
  deploy_type: 'scheduled' | 'unscheduled'
  deploy_manager_id: string | null // null이면 본인이 직접 배포 승인
  deploy_scheduled_at: string
}

export function DeployInfoModal({
  open,
  onOpenChange,
  onConfirm,
  isLoading = false,
  managers,
  currentUserId,
  currentDeployInfo
}: DeployInfoModalProps) {
  const [deployType, setDeployType] = useState<'scheduled' | 'unscheduled'>('scheduled')
  const [assignType, setAssignType] = useState<'self' | 'other'>('self')
  const [deployManagerId, setDeployManagerId] = useState('')
  const [deployScheduledAt, setDeployScheduledAt] = useState('')

  // 모달 열릴 때 초기화
  useEffect(() => {
    if (open) {
      if (currentDeployInfo) {
        if (currentDeployInfo.deploy_type) {
          setDeployType(currentDeployInfo.deploy_type as 'scheduled' | 'unscheduled')
        }
        if (currentDeployInfo.deploy_manager_id) {
          // 기존 배포 담당자가 있으면 해당 값으로 설정
          if (currentDeployInfo.deploy_manager_id === currentUserId) {
            setAssignType('self')
            setDeployManagerId('')
          } else {
            setAssignType('other')
            setDeployManagerId(currentDeployInfo.deploy_manager_id)
          }
        } else {
          setAssignType('self')
          setDeployManagerId('')
        }
        if (currentDeployInfo.deploy_scheduled_at) {
          const date = new Date(currentDeployInfo.deploy_scheduled_at)
          const localDateTime = date.toISOString().slice(0, 16)
          setDeployScheduledAt(localDateTime)
        }
      } else {
        // 초기화
        setDeployType('scheduled')
        setAssignType('self')
        setDeployManagerId('')
        setDeployScheduledAt('')
      }
    }
  }, [currentDeployInfo, currentUserId, open])

  const handleConfirm = async () => {
    if (assignType === 'other' && !deployManagerId) {
      return
    }
    if (!deployScheduledAt) {
      return
    }
    await onConfirm({
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

  const isValid = deployScheduledAt && (assignType === 'self' || (assignType === 'other' && deployManagerId))

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Rocket className="size-5 text-cyan-600" />
            배포 정보 입력
          </DialogTitle>
          <DialogDescription>
            배포 요청을 위한 정보를 입력해주세요.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-4">
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
                선택한 담당자의 워크스페이스에 배포 승인 요청이 표시됩니다.
              </p>
            </div>
          )}

          {assignType === 'self' && (
            <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
              본인이 직접 배포를 승인합니다. 배포 완료 후 &quot;배포 승인&quot; 버튼을 눌러주세요.
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
              '배포 요청'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
