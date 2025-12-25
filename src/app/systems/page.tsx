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
import { CreateSystemDialog } from './components/create-system-dialog'

export default async function SystemsPage() {
  const supabase = await createClient()
  
  const { data: systems } = await supabase
    .from('systems')
    .select(`
      *,
      manager:profiles(full_name, email)
    `)
    .order('created_at', { ascending: false })

  return (
    <div className="container mx-auto py-10 px-4">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">IT 시스템 관리</h1>
          <p className="text-muted-foreground">KT Estate의 주요 IT 서비스 및 시스템 목록입니다.</p>
        </div>
        <CreateSystemDialog />
      </div>

      <div className="rounded-md border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>시스템명</TableHead>
              <TableHead>설명</TableHead>
              <TableHead>담당자</TableHead>
              <TableHead>상태</TableHead>
              <TableHead>등록일</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {systems && systems.length > 0 ? (
              systems.map((system) => (
                <TableRow key={system.id}>
                  <TableCell className="font-medium">{system.name}</TableCell>
                  <TableCell>{system.description || '-'}</TableCell>
                  <TableCell>
                    {system.manager 
                      ? `${system.manager.full_name || '이름없음'} (${system.manager.email})` 
                      : '미지정'}
                  </TableCell>
                  <TableCell>
                    <Badge variant={system.status === 'active' ? 'default' : 'secondary'}>
                      {system.status === 'active' ? '운영중' : '중지'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {new Date(system.created_at).toLocaleDateString()}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center">
                  등록된 IT 시스템이 없습니다.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

