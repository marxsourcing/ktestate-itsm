import { createClient } from '@/lib/supabase/server'
import { RequestForm } from './components/request-form'

export default async function NewRequestPage() {
  const supabase = await createClient()
  
  const { data: systems } = await supabase
    .from('systems')
    .select('id, name')
    .eq('status', 'active')
    .order('name')

  return (
    <div className="container mx-auto py-10 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">서비스 요청(SR) 신청</h1>
        <p className="text-muted-foreground">IT 서비스 지원이 필요한 내용을 입력해주세요.</p>
      </div>

      <div className="bg-white p-6 rounded-lg border">
        <RequestForm systems={systems || []} />
      </div>
    </div>
  )
}

