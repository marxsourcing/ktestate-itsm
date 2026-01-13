import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AdminSystemsClient } from './admin-systems-client'

export default async function AdminSystemsPage() {
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
    .select(`
      *,
      manager:profiles!systems_manager_id_fkey(id, full_name, email)
    `)
    .order('created_at', { ascending: false })

  // 담당자 목록 조회 (manager, admin 역할만)
  const { data: managers } = await supabase
    .from('profiles')
    .select('id, full_name, email, role')
    .in('role', ['manager', 'admin'])
    .order('full_name', { ascending: true })

  return (
    <div className="container mx-auto py-10 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">시스템 관리</h1>
        <p className="text-muted-foreground">IT 시스템을 추가, 수정, 삭제하고 담당자를 지정합니다.</p>
      </div>

      <AdminSystemsClient systems={systems || []} managers={managers || []} />
    </div>
  )
}
