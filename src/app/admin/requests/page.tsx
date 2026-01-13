import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AdminRequestsClient } from './admin-requests-client'

export default async function AdminRequestsPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin' && profile?.role !== 'manager') {
    redirect('/')
  }

  const { data: requests } = await supabase
    .from('service_requests')
    .select(`
      *,
      requester:profiles!service_requests_requester_id_fkey(full_name, email),
      system:systems(name)
    `)
    .order('created_at', { ascending: false })

  return (
    <div className="container mx-auto py-10 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">전체 서비스 요청 관리</h1>
        <p className="text-muted-foreground">모든 부서의 IT 서비스 지원 요청을 관리합니다.</p>
      </div>

      <AdminRequestsClient requests={requests || []} />
    </div>
  )
}
