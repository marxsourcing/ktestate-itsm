import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AdminCategoriesClient } from './admin-categories-client'

export default async function AdminCategoriesPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  // 관리자만 접근 가능
  if (profile?.role !== 'admin') {
    redirect('/')
  }

  // 대분류 목록 조회 - 코드 숫자 순서로 정렬
  const { data: categoriesLv1Raw } = await supabase
    .from('request_categories_lv1')
    .select('*')

  // 코드 숫자 순서로 정렬
  const categoriesLv1 = (categoriesLv1Raw || []).sort((a, b) => {
    const numA = parseInt(a.code, 10) || 0
    const numB = parseInt(b.code, 10) || 0
    return numA - numB
  })

  // 소분류 목록 조회 - 코드 숫자 순서로 정렬
  const { data: categoriesLv2Raw } = await supabase
    .from('request_categories_lv2')
    .select(`
      *,
      category_lv1:request_categories_lv1(id, name, code)
    `)

  // 코드 숫자 순서로 정렬
  const categoriesLv2 = (categoriesLv2Raw || []).sort((a, b) => {
    const numA = parseInt(a.code, 10) || 0
    const numB = parseInt(b.code, 10) || 0
    return numA - numB
  })

  return (
    <div className="container mx-auto py-10 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">분류 관리</h1>
        <p className="text-muted-foreground">요구사항 대분류와 소분류를 관리합니다.</p>
      </div>

      <AdminCategoriesClient
        categoriesLv1={categoriesLv1 || []}
        categoriesLv2={categoriesLv2 || []}
      />
    </div>
  )
}
