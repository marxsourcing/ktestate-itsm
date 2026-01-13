'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function updateUserRole(userId: string, role: string) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '로그인이 필요합니다.' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return { error: '관리자만 사용자 역할을 변경할 수 있습니다.' }
  }

  // 자기 자신의 역할은 변경 불가
  if (userId === user.id) {
    return { error: '자신의 역할은 변경할 수 없습니다.' }
  }

  // 유효한 역할인지 확인
  if (!['requester', 'manager', 'admin'].includes(role)) {
    return { error: '유효하지 않은 역할입니다.' }
  }

  const { error } = await supabase
    .from('profiles')
    .update({ role })
    .eq('id', userId)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/admin/users')
  return { success: true }
}
