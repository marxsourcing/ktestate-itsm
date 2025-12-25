import { createClient } from '@/lib/supabase/server'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { redirect } from 'next/navigation'

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

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'requested': return '요청'
      case 'reviewing': return '검토중'
      case 'processing': return '처리중'
      case 'completed': return '완료'
      case 'rejected': return '반려'
      default: return status
    }
  }

  return (
    <div className="container mx-auto py-10 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">전체 서비스 요청 관리</h1>
        <p className="text-muted-foreground">모든 부서의 IT 서비스 지원 요청을 관리합니다.</p>
      </div>

      <div className="rounded-md border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[100px]">상태</TableHead>
              <TableHead>제목</TableHead>
              <TableHead>요청자</TableHead>
              <TableHead>유형</TableHead>
              <TableHead>우선순위</TableHead>
              <TableHead>신청일</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {requests && requests.length > 0 ? (
              requests.map((request) => (
                <TableRow key={request.id}>
                  <TableCell>
                    <Badge 
                      variant={
                        request.status === 'completed' ? 'default' : 
                        request.status === 'rejected' ? 'destructive' : 
                        'secondary'
                      }
                    >
                      {getStatusLabel(request.status)}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium">
                    <Link href={`/requests/${request.id}`} className="hover:underline">
                      {request.title}
                    </Link>
                  </TableCell>
                  <TableCell>
                    {request.requester?.full_name || request.requester?.email}
                  </TableCell>
                  <TableCell>{request.type}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{request.priority}</Badge>
                  </TableCell>
                  <TableCell>
                    {new Date(request.created_at).toLocaleDateString()}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center">
                  처리할 서비스 요청이 없습니다.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

