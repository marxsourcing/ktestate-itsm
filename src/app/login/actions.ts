'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

// Supabase 에러 메시지를 한글로 변환
function translateAuthError(message: string): string {
  const errorMap: Record<string, string> = {
    'Invalid login credentials': '이메일 또는 비밀번호가 올바르지 않습니다.',
    'Email not confirmed': '이메일 인증이 필요합니다. 이메일을 확인해주세요.',
    'User already registered': '이미 가입된 이메일입니다.',
    'Password should be at least 6 characters': '비밀번호는 최소 6자 이상이어야 합니다.',
    'Unable to validate email address: invalid format': '올바른 이메일 형식이 아닙니다.',
    'Signup requires a valid password': '비밀번호를 입력해주세요.',
  }
  return errorMap[message] || message
}

export async function login(formData: FormData) {
  const supabase = await createClient()

  const email = formData.get('email') as string
  const password = formData.get('password') as string

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    return { error: translateAuthError(error.message) }
  }

  revalidatePath('/', 'layout')
  return { success: true }
}

export async function signup(formData: FormData) {
  const supabase = await createClient()

  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const fullName = formData.get('full_name') as string
  const role = formData.get('role') as string

  // 보안: admin 역할은 회원가입으로 선택 불가
  const validRole = role === 'manager' ? 'manager' : 'requester'

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
        role: validRole,
      },
    },
  })

  if (error) {
    return { error: translateAuthError(error.message) }
  }

  // 프로필 테이블에 role 업데이트 (트리거가 기본값으로 생성하므로 업데이트 필요)
  if (data.user) {
    await supabase
      .from('profiles')
      .update({ role: validRole })
      .eq('id', data.user.id)
  }

  // 이메일 인증이 꺼져 있는 경우 바로 로그인을 시도하거나, 가입 완료 메시지를 띄웁니다.
  return { success: '가입이 완료되었습니다. 이제 로그인할 수 있습니다.' }
}

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}

