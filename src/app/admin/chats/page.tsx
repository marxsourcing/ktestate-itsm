import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AdminChatsClient } from './admin-chats-client'

export default async function AdminChatsPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  // 관리자만 접근 가능 (요구사항: 전체 채팅 내역 조회는 관리자 전용)
  if (profile?.role !== 'admin') {
    redirect('/')
  }

  // 요청자 대화 목록 조회 (모든 사용자)
  const { data: requesterConversations } = await supabase
    .from('conversations')
    .select(`
      *,
      user:profiles!conversations_user_id_fkey(id, full_name, email),
      request:service_requests(id, title, status)
    `)
    .order('updated_at', { ascending: false })

  // 담당자 내부 대화 목록 조회
  const { data: managerConversations } = await supabase
    .from('manager_conversations')
    .select(`
      *,
      manager:profiles!manager_conversations_manager_id_fkey(id, full_name, email),
      request:service_requests(id, title, status)
    `)
    .order('updated_at', { ascending: false })

  // 사용자 목록 조회 (필터용)
  const { data: users } = await supabase
    .from('profiles')
    .select('id, full_name, email, role')
    .order('full_name', { ascending: true })

  // 담당자 목록 (필터용)
  const managers = users?.filter(u => u.role === 'manager' || u.role === 'admin') || []

  return (
    <div className="container mx-auto py-10 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">전체 채팅 내역 조회</h1>
        <p className="text-muted-foreground">모든 사용자의 AI 채팅 내역을 조회하고 관리합니다. (감사/증적용)</p>
      </div>

      <AdminChatsClient
        requesterConversations={requesterConversations || []}
        managerConversations={managerConversations || []}
        users={users || []}
        managers={managers}
      />
    </div>
  )
}
