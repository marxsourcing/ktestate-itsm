'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { updatePassword } from '../../actions'
import { Loader2, CheckCircle, Eye, EyeOff } from 'lucide-react'

export function PasswordForm() {
  const [isPending, setIsPending] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  async function handleSubmit(formData: FormData) {
    setIsPending(true)
    setMessage(null)

    const result = await updatePassword(formData)

    if (result.error) {
      setMessage({ type: 'error', text: result.error })
    } else if (result.success) {
      setMessage({ type: 'success', text: result.success })
      // 폼 리셋
      const form = document.getElementById('password-form') as HTMLFormElement
      form?.reset()
    }

    setIsPending(false)
  }

  return (
    <form id="password-form" action={handleSubmit} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="current_password">현재 비밀번호</Label>
        <div className="relative">
          <Input
            id="current_password"
            name="current_password"
            type={showCurrentPassword ? 'text' : 'password'}
            required
            placeholder="현재 비밀번호를 입력하세요"
            className="pr-10"
          />
          <button
            type="button"
            onClick={() => setShowCurrentPassword(!showCurrentPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            {showCurrentPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="new_password">새 비밀번호</Label>
        <div className="relative">
          <Input
            id="new_password"
            name="new_password"
            type={showNewPassword ? 'text' : 'password'}
            required
            minLength={6}
            placeholder="새 비밀번호를 입력하세요 (6자 이상)"
            className="pr-10"
          />
          <button
            type="button"
            onClick={() => setShowNewPassword(!showNewPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            {showNewPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirm_password">비밀번호 확인</Label>
        <div className="relative">
          <Input
            id="confirm_password"
            name="confirm_password"
            type={showConfirmPassword ? 'text' : 'password'}
            required
            minLength={6}
            placeholder="새 비밀번호를 다시 입력하세요"
            className="pr-10"
          />
          <button
            type="button"
            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            {showConfirmPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
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
              변경 중...
            </>
          ) : (
            '비밀번호 변경'
          )}
        </Button>
      </div>
    </form>
  )
}

