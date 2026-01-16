import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AdminModulesClient } from './admin-modules-client'

export default async function AdminModulesPage() {
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

  // 시스템 목록 조회
  const { data: systems } = await supabase
    .from('systems')
    .select('id, name, code')
    .eq('status', 'active')
    .order('name', { ascending: true })

  // 모듈 목록 조회 (시스템 정보 포함)
  const { data: modules } = await supabase
    .from('system_modules')
    .select(`
      *,
      system:systems(id, name, code),
      primary_manager:profiles!system_modules_primary_manager_id_fkey(id, full_name, email),
      secondary_manager:profiles!system_modules_secondary_manager_id_fkey(id, full_name, email)
    `)
    .order('sort_order', { ascending: true })

  // 담당자 목록 조회 (manager, admin 역할만)
  const { data: managers } = await supabase
    .from('profiles')
    .select('id, full_name, email, role')
    .in('role', ['manager', 'admin'])
    .order('full_name', { ascending: true })

  return (
    <div className="container mx-auto py-10 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">모듈 관리</h1>
        <p className="text-muted-foreground">시스템별 모듈을 관리하고 담당자를 지정합니다.</p>
      </div>

      <AdminModulesClient
        modules={modules || []}
        systems={systems || []}
        managers={managers || []}
      />
    </div>
  )
}
