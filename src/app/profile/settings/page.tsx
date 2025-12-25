import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { PasswordForm } from './components/password-form'
import { Key, Shield, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return (
    <div className="min-h-screen bg-gray-50/50">
      <div className="container max-w-2xl py-8 px-4">
        {/* Back link */}
        <Link 
          href="/profile" 
          className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 mb-6 transition-colors"
        >
          <ArrowLeft className="size-4" />
          프로필로 돌아가기
        </Link>

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">계정 설정</h1>
          <p className="text-gray-500 mt-1">비밀번호 및 보안 설정을 관리합니다.</p>
        </div>

        <div className="grid gap-6">
          {/* Password Change Card */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
                <Key className="size-5 text-primary" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">비밀번호 변경</h3>
                <p className="text-sm text-gray-500">계정 보안을 위해 주기적으로 비밀번호를 변경하세요.</p>
              </div>
            </div>
            <PasswordForm />
          </div>

          {/* Security Info Card */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex size-10 items-center justify-center rounded-lg bg-green-100">
                <Shield className="size-5 text-green-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">보안 정보</h3>
                <p className="text-sm text-gray-500">계정 보안 상태</p>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between py-2 border-b border-gray-100">
                <span className="text-sm text-gray-600">이메일</span>
                <span className="text-sm font-medium text-gray-900">{user.email}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-gray-100">
                <span className="text-sm text-gray-600">마지막 로그인</span>
                <span className="text-sm font-medium text-gray-900">
                  {user.last_sign_in_at 
                    ? new Date(user.last_sign_in_at).toLocaleString('ko-KR')
                    : '정보 없음'
                  }
                </span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-sm text-gray-600">계정 생성일</span>
                <span className="text-sm font-medium text-gray-900">
                  {new Date(user.created_at).toLocaleDateString('ko-KR')}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

