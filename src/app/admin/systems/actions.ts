'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

interface SystemData {
  name: string
  description?: string
  code?: string
  status: string
  manager_id?: string | null
}

export async function createSystem(data: SystemData) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '로그인이 필요합니다.' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return { error: '관리자만 시스템을 추가할 수 있습니다.' }
  }

  const { error } = await supabase.from('systems').insert({
    name: data.name,
    description: data.description || null,
    code: data.code || null,
    status: data.status,
    manager_id: data.manager_id || null,
  })

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/admin/systems')
  return { success: true }
}

export async function updateSystem(id: string, data: SystemData) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '로그인이 필요합니다.' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return { error: '관리자만 시스템을 수정할 수 있습니다.' }
  }

  const { error } = await supabase
    .from('systems')
    .update({
      name: data.name,
      description: data.description || null,
      code: data.code || null,
      status: data.status,
      manager_id: data.manager_id || null,
    })
    .eq('id', id)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/admin/systems')
  return { success: true }
}

export async function deleteSystem(id: string) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '로그인이 필요합니다.' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return { error: '관리자만 시스템을 삭제할 수 있습니다.' }
  }

  // 해당 시스템에 연결된 service_requests가 있는지 확인
  const { count } = await supabase
    .from('service_requests')
    .select('*', { count: 'exact', head: true })
    .eq('system_id', id)

  if (count && count > 0) {
    return { error: `이 시스템에 연결된 요청이 ${count}건 있어 삭제할 수 없습니다.` }
  }

  const { error } = await supabase
    .from('systems')
    .delete()
    .eq('id', id)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/admin/systems')
  return { success: true }
}
