'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

interface ModuleData {
  system_id: string
  code: string
  name: string
  primary_manager_id?: string | null
  secondary_manager_id?: string | null
  is_active: boolean
  sort_order: number
  notify_primary: boolean
  delay_notification: boolean
}

export async function createModule(data: ModuleData) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '로그인이 필요합니다.' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return { error: '관리자만 모듈을 추가할 수 있습니다.' }
  }

  // 코드 중복 체크
  const { data: existing } = await supabase
    .from('system_modules')
    .select('id')
    .eq('code', data.code)
    .single()

  if (existing) {
    return { error: '이미 동일한 모듈 코드가 존재합니다.' }
  }

  const { error } = await supabase.from('system_modules').insert({
    system_id: data.system_id,
    code: data.code,
    name: data.name,
    primary_manager_id: data.primary_manager_id || null,
    secondary_manager_id: data.secondary_manager_id || null,
    is_active: data.is_active,
    sort_order: data.sort_order,
    notify_primary: data.notify_primary,
    delay_notification: data.delay_notification,
  })

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/admin/modules')
  return { success: true }
}

export async function updateModule(id: string, data: ModuleData) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '로그인이 필요합니다.' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return { error: '관리자만 모듈을 수정할 수 있습니다.' }
  }

  // 다른 모듈과 코드 중복 체크
  const { data: existing } = await supabase
    .from('system_modules')
    .select('id')
    .eq('code', data.code)
    .neq('id', id)
    .single()

  if (existing) {
    return { error: '이미 동일한 모듈 코드가 존재합니다.' }
  }

  const { error } = await supabase
    .from('system_modules')
    .update({
      system_id: data.system_id,
      code: data.code,
      name: data.name,
      primary_manager_id: data.primary_manager_id || null,
      secondary_manager_id: data.secondary_manager_id || null,
      is_active: data.is_active,
      sort_order: data.sort_order,
      notify_primary: data.notify_primary,
      delay_notification: data.delay_notification,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/admin/modules')
  return { success: true }
}

export async function deleteModule(id: string) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '로그인이 필요합니다.' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return { error: '관리자만 모듈을 삭제할 수 있습니다.' }
  }

  // 해당 모듈에 연결된 service_requests가 있는지 확인
  const { count } = await supabase
    .from('service_requests')
    .select('*', { count: 'exact', head: true })
    .eq('module_id', id)

  if (count && count > 0) {
    return { error: `이 모듈에 연결된 요청이 ${count}건 있어 삭제할 수 없습니다.` }
  }

  const { error } = await supabase
    .from('system_modules')
    .delete()
    .eq('id', id)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/admin/modules')
  return { success: true }
}
