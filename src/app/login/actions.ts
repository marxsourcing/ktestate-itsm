'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

// Supabase 에러 메시지를 한글로 변환
function translateAuthError(message: string): string {
  const errorMap: Record<string, string> = {
    'Invalid login credentials': '이메일 또는 비밀번호가 올바르지 않습니다.',
    'Email not confirmed': '이메일 인증에 문제가 발생했습니다. 관리자에게 문의해주세요.',
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
  const birthday = formData.get('birthday') as string

  if (!birthday) {
    return { error: '생년월일을 입력해주세요.' }
  }

  // 보안: admin 역할은 회원가입으로 선택 불가
  const validRole = role === 'manager' ? 'manager' : 'requester'

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
        role: validRole,
        birthday,
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
      .update({ role: validRole, birthday })
      .eq('id', data.user.id)
  }

  // autoconfirm 활성화 상태: 가입 즉시 세션이 생성되므로 바로 로그인 처리
  revalidatePath('/', 'layout')
  return { success: true }
}

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}

