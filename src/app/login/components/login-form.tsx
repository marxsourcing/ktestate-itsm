'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { login, signup } from '../actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

export function LoginForm() {
  const [isPending, setIsPending] = useState(false)
  const [isSignup, setIsSignup] = useState(false)
  const router = useRouter()

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsPending(true)

    const formData = new FormData(event.currentTarget)
    
    if (isSignup) {
      const result = await signup(formData)
      if (result?.error) {
        toast.error(result.error)
      } else if (result?.success) {
        toast.success('가입이 완료되었습니다.')
        router.push('/')
      }
    } else {
      const result = await login(formData)
      if (result?.error) {
        toast.error(result.error)
      } else if (result?.success) {
        router.push('/')
      }
    }
    
    setIsPending(false)
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-semibold text-gray-900">
          {isSignup ? '회원가입' : '로그인'}
        </h1>
        <p className="mt-2 text-sm text-gray-500">
          {isSignup 
            ? '계정을 생성하여 IT 서비스를 이용해보세요.' 
            : 'AI 기반 IT 서비스 관리 시스템에 오신 것을 환영합니다.'}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {isSignup && (
          <>
            <div className="space-y-2">
              <Label htmlFor="full_name" className="text-gray-700">이름</Label>
              <Input 
                id="full_name" 
                name="full_name" 
                placeholder="홍길동" 
                required 
                className="h-11 bg-white border-gray-300 text-gray-900 placeholder:text-gray-400 focus:border-rose-500 focus:ring-rose-100"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role" className="text-gray-700">역할</Label>
              <Select name="role" defaultValue="requester">
                <SelectTrigger className="h-11 bg-white border-gray-300 text-gray-900 focus:border-rose-500 focus:ring-rose-100">
                  <SelectValue placeholder="역할을 선택하세요" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="requester">요청자 (IT 서비스 요청)</SelectItem>
                  <SelectItem value="manager">담당자 (요청 처리)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-400">요청자: IT 서비스를 요청하는 일반 사용자 / 담당자: 요청을 처리하는 IT 담당자</p>
            </div>
          </>
        )}
        <div className="space-y-2">
          <Label htmlFor="email" className="text-gray-700">이메일</Label>
          <Input 
            id="email" 
            name="email" 
            type="email" 
            placeholder="name@example.com" 
            required 
            className="h-11 bg-white border-gray-300 text-gray-900 placeholder:text-gray-400 focus:border-rose-500 focus:ring-rose-100"
          />
        </div>
        {isSignup && (
          <div className="space-y-2">
            <Label htmlFor="birthday" className="text-gray-700">생년월일</Label>
            <Input 
              id="birthday" 
              name="birthday" 
              type="date" 
              required 
              className="h-11 bg-white border-gray-300 text-gray-900 placeholder:text-gray-400 focus:border-rose-500 focus:ring-rose-100"
            />
          </div>
        )}
        <div className="space-y-2">
          <Label htmlFor="password" className="text-gray-700">비밀번호</Label>
          <Input 
            id="password" 
            name="password" 
            type="password" 
            required 
            className="h-11 bg-white border-gray-300 text-gray-900 placeholder:text-gray-400 focus:border-rose-500 focus:ring-rose-100"
          />
        </div>

        <Button 
          type="submit" 
          className="w-full h-11 kt-gradient kt-shadow hover:opacity-90 text-white font-medium" 
          disabled={isPending}
        >
          {isPending ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" />
              처리 중...
            </>
          ) : (
            isSignup ? '가입하기' : '로그인'
          )}
        </Button>
      </form>

      <div className="mt-6 text-center">
        <button 
          type="button" 
          className="text-sm text-gray-500 hover:text-rose-600 transition-colors"
          onClick={() => setIsSignup(!isSignup)}
        >
          {isSignup ? '이미 계정이 있으신가요? 로그인' : '계정이 없으신가요? 회원가입'}
        </button>
      </div>
    </div>
  )
}
