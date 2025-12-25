'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { updateProfile } from '../actions'
import { Loader2, CheckCircle } from 'lucide-react'
import type { Profile } from '../actions'

interface ProfileFormProps {
  profile: Profile
}

export function ProfileForm({ profile }: ProfileFormProps) {
  const [isPending, setIsPending] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  async function handleSubmit(formData: FormData) {
    setIsPending(true)
    setMessage(null)

    const result = await updateProfile(formData)

    if (result.error) {
      setMessage({ type: 'error', text: result.error })
    } else if (result.success) {
      setMessage({ type: 'success', text: result.success })
    }

    setIsPending(false)
  }

  return (
    <form action={handleSubmit} className="space-y-5">
      <div className="grid sm:grid-cols-2 gap-5">
        <div className="space-y-2">
          <Label htmlFor="full_name">이름</Label>
          <Input
            id="full_name"
            name="full_name"
            defaultValue={profile.full_name || ''}
            placeholder="이름을 입력하세요"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">이메일</Label>
          <Input
            id="email"
            type="email"
            value={profile.email}
            disabled
            className="bg-gray-50 text-gray-500"
          />
          <p className="text-xs text-gray-400">이메일은 변경할 수 없습니다.</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="department">부서</Label>
          <Input
            id="department"
            name="department"
            defaultValue={profile.department || ''}
            placeholder="소속 부서를 입력하세요"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="phone">연락처</Label>
          <Input
            id="phone"
            name="phone"
            type="tel"
            defaultValue={profile.phone || ''}
            placeholder="010-0000-0000"
          />
        </div>
      </div>

      {message && (
        <div
          className={`flex items-center gap-2 rounded-lg px-4 py-3 text-sm ${
            message.type === 'success'
              ? 'bg-green-50 text-green-700 border border-green-200'
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}
        >
          {message.type === 'success' && <CheckCircle className="size-4" />}
          {message.text}
        </div>
      )}

      <div className="flex justify-end">
        <Button type="submit" disabled={isPending} className="min-w-[120px]">
          {isPending ? (
            <>
              <Loader2 className="size-4 mr-2 animate-spin" />
              저장 중...
            </>
          ) : (
            '변경사항 저장'
          )}
        </Button>
      </div>
    </form>
  )
}

