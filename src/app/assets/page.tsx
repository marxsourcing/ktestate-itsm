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
import { CreateAssetDialog } from './components/create-asset-dialog'

export default async function AssetsPage() {
  const supabase = await createClient()
  
  const { data: assets } = await supabase
    .from('assets')
    .select(`
      *,
      user:profiles(full_name, email),
      system:systems(name)
    `)
    .order('created_at', { ascending: false })

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'hardware': return '하드웨어'
      case 'software': return '소프트웨어'
      case 'license': return '라이선스'
      default: return type
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'in_use': return '사용중'
      case 'available': return '보유'
      case 'disposed': return '폐기'
      case 'maintenance': return '수리중'
      default: return status
    }
  }

  return (
    <div className="container mx-auto py-10 px-4">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">IT 자산 관리</h1>
          <p className="text-muted-foreground">PC, 노트북, 소프트웨어 라이선스 등 IT 자산 현황입니다.</p>
        </div>
        <CreateAssetDialog />
      </div>

      <div className="rounded-md border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>자산명</TableHead>
              <TableHead>분류</TableHead>
              <TableHead>시리얼 번호</TableHead>
              <TableHead>상태</TableHead>
              <TableHead>사용자/시스템</TableHead>
              <TableHead>등록일</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {assets && assets.length > 0 ? (
              assets.map((asset) => (
                <TableRow key={asset.id}>
                  <TableCell className="font-medium">{asset.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{getTypeLabel(asset.type)}</Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{asset.serial_number || '-'}</TableCell>
                  <TableCell>
                    <Badge 
                      variant={
                        asset.status === 'in_use' ? 'default' : 
                        asset.status === 'available' ? 'secondary' : 
                        'destructive'
                      }
                    >
                      {getStatusLabel(asset.status)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">
                    {asset.user ? (
                      <span className="text-blue-600">👤 {asset.user.full_name || asset.user.email}</span>
                    ) : asset.system ? (
                      <span className="text-green-600">⚙️ {asset.system.name}</span>
                    ) : (
                      <span className="text-muted-foreground">공용/미할당</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">
                    {new Date(asset.created_at).toLocaleDateString()}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center">
                  등록된 IT 자산이 없습니다.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

