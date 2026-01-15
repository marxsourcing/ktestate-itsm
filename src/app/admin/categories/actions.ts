'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// 대분류 CRUD
export async function createCategoryLv1(data: {
  code: string
  name: string
  sort_order: number
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: '로그인이 필요합니다.' }
  }

  // 관리자 권한 확인
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return { error: '권한이 없습니다.' }
  }

  const { data: category, error } = await supabase
    .from('request_categories_lv1')
    .insert({
      code: data.code,
      name: data.name,
      sort_order: data.sort_order,
    })
    .select()
    .single()

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/admin/categories')
  return { data: category }
}

export async function updateCategoryLv1(
  id: string,
  data: {
    code: string
    name: string
    sort_order: number
  }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: '로그인이 필요합니다.' }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return { error: '권한이 없습니다.' }
  }

  const { error } = await supabase
    .from('request_categories_lv1')
    .update({
      code: data.code,
      name: data.name,
      sort_order: data.sort_order,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/admin/categories')
  return { success: true }
}

export async function deleteCategoryLv1(id: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: '로그인이 필요합니다.' }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return { error: '권한이 없습니다.' }
  }

  // CASCADE로 소분류도 함께 삭제됨
  const { error } = await supabase
    .from('request_categories_lv1')
    .delete()
    .eq('id', id)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/admin/categories')
  return { success: true }
}

// 소분류 CRUD
export async function createCategoryLv2(data: {
  category_lv1_id: string
  code: string
  name: string
  sort_order: number
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: '로그인이 필요합니다.' }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return { error: '권한이 없습니다.' }
  }

  const { data: category, error } = await supabase
    .from('request_categories_lv2')
    .insert({
      category_lv1_id: data.category_lv1_id,
      code: data.code,
      name: data.name,
      sort_order: data.sort_order,
    })
    .select()
    .single()

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/admin/categories')
  return { data: category }
}

export async function updateCategoryLv2(
  id: string,
  data: {
    category_lv1_id: string
    code: string
    name: string
    sort_order: number
  }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: '로그인이 필요합니다.' }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return { error: '권한이 없습니다.' }
  }

  const { error } = await supabase
    .from('request_categories_lv2')
    .update({
      category_lv1_id: data.category_lv1_id,
      code: data.code,
      name: data.name,
      sort_order: data.sort_order,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/admin/categories')
  return { success: true }
}

export async function deleteCategoryLv2(id: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: '로그인이 필요합니다.' }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return { error: '권한이 없습니다.' }
  }

  const { error } = await supabase
    .from('request_categories_lv2')
    .delete()
    .eq('id', id)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/admin/categories')
  return { success: true }
}
