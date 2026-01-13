import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AdminUsersClient } from './admin-users-client'

export default async function AdminUsersPage() {
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

  // 전체 사용자 목록 조회
  const { data: users } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false })

  return (
    <div className="container mx-auto py-10 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">사용자 관리</h1>
        <p className="text-muted-foreground">사용자 역할을 관리하고 계정 정보를 확인합니다.</p>
      </div>

      <AdminUsersClient users={users || []} currentUserId={user.id} />
    </div>
  )
}
