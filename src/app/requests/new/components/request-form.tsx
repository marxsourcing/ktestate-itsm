'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { createServiceRequest } from '@/app/requests/actions'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

interface RequestFormProps {
  systems: { id: string, name: string }[]
}

export function RequestForm({ systems }: RequestFormProps) {
  const [isPending, setIsPending] = useState(false)
  const router = useRouter()

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsPending(true)

    const formData = new FormData(event.currentTarget)
    const result = await createServiceRequest(formData)

    if (result?.error) {
      toast.error(result.error)
    } else {
      toast.success('서비스 요청이 등록되었습니다.')
      router.push('/requests')
    }
    
    setIsPending(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
      <div className="space-y-2">
        <Label htmlFor="title">제목</Label>
        <Input id="title" name="title" placeholder="요청 내용을 간략히 입력해주세요" required />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="type">요청 유형</Label>
          <Select name="type" defaultValue="other">
            <SelectTrigger>
              <SelectValue placeholder="유형 선택" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="account">계정/권한</SelectItem>
              <SelectItem value="software">소프트웨어</SelectItem>
              <SelectItem value="hardware">하드웨어</SelectItem>
              <SelectItem value="network">네트워크</SelectItem>
              <SelectItem value="other">기타</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="priority">우선순위</Label>
          <Select name="priority" defaultValue="medium">
            <SelectTrigger>
              <SelectValue placeholder="우선순위 선택" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="low">낮음</SelectItem>
              <SelectItem value="medium">보통</SelectItem>
              <SelectItem value="high">높음</SelectItem>
              <SelectItem value="urgent">긴급</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="system_id">관련 시스템 (선택)</Label>
        <Select name="system_id">
          <SelectTrigger>
            <SelectValue placeholder="시스템 선택" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">해당 없음</SelectItem>
            {systems.map((system) => (
              <SelectItem key={system.id} value={system.id}>
                {system.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">상세 내용</Label>
        <Textarea 
          id="description" 
          name="description" 
          placeholder="요청 사항을 상세히 기술해주세요." 
          className="min-h-[200px]"
          required 
        />
      </div>

      <div className="flex justify-end gap-4">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          취소
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? '등록 중...' : '요청하기'}
        </Button>
      </div>
    </form>
  )
}

