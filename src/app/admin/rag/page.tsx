import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AdminRagClient } from './admin-rag-client'

export default async function AdminRagPage() {
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

  return (
    <div className="container mx-auto py-10 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">RAG 관리</h1>
        <p className="text-muted-foreground">RAG 문서 현황을 확인하고 마이그레이션을 실행합니다.</p>
      </div>

      <AdminRagClient />
    </div>
  )
}
