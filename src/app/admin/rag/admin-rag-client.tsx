'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { 
  Database, 
  FileCheck, 
  FileQuestion,
  MessageSquare,
  Play,
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertCircle
} from 'lucide-react'
import { toast } from 'sonner'

interface MigrationStatus {
  totalCompleted: number
  withRagDoc: number
  pending: number
  withCompletionComment: number
  percentage: number
}

interface MigrationResult {
  requestId: string
  title: string
  status: 'processed' | 'skipped' | 'failed'
  reason?: string
}

interface MigrationResponse {
  message: string
  dryRun?: boolean
  total?: number
  processed: number
  skipped: number
  failed: number
  remaining?: number
  results?: MigrationResult[]
  errors?: string[]
}

export function AdminRagClient() {
  const [status, setStatus] = useState<MigrationStatus | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isMigrating, setIsMigrating] = useState(false)
  const [limit, setLimit] = useState(50)
  const [migrationResult, setMigrationResult] = useState<MigrationResponse | null>(null)

  const fetchStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/rag-migration')
      if (response.ok) {
        const data = await response.json()
        setStatus(data)
      } else {
        toast.error('현황 조회 실패')
      }
    } catch (error) {
      console.error('Status fetch error:', error)
      toast.error('현황 조회 중 오류 발생')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchStatus()
  }, [fetchStatus])

  const runMigration = async (dryRun: boolean) => {
    setIsMigrating(true)
    setMigrationResult(null)

    try {
      const response = await fetch(
        `/api/admin/rag-migration?limit=${limit}&dryRun=${dryRun}`,
        { method: 'POST' }
      )

      if (response.ok) {
        const data: MigrationResponse = await response.json()
        setMigrationResult(data)
        
        if (dryRun) {
          toast.success(`시뮬레이션 완료: ${data.processed}건 처리 예정`)
        } else {
          toast.success(`마이그레이션 완료: ${data.processed}건 처리됨`)
          // 실제 마이그레이션 후 현황 갱신
          fetchStatus()
        }
      } else {
        const error = await response.json()
        toast.error(error.error || '마이그레이션 실패')
      }
    } catch (error) {
      console.error('Migration error:', error)
      toast.error('마이그레이션 중 오류 발생')
    } finally {
      setIsMigrating(false)
    }
  }

  const getStatusIcon = (resultStatus: string) => {
    switch (resultStatus) {
      case 'processed':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'skipped':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />
      default:
        return null
    }
  }

  const getStatusBadge = (resultStatus: string) => {
    switch (resultStatus) {
      case 'processed':
        return <Badge variant="default" className="bg-green-100 text-green-800">처리됨</Badge>
      case 'skipped':
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">스킵</Badge>
      case 'failed':
        return <Badge variant="destructive">실패</Badge>
      default:
        return <Badge variant="outline">{resultStatus}</Badge>
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 현황 카드 */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Database className="h-4 w-4" />
              전체 완료 요청
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{status?.totalCompleted || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <FileCheck className="h-4 w-4 text-green-500" />
              RAG 문서 생성 완료
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {status?.withRagDoc || 0}
              <span className="text-sm font-normal text-gray-500 ml-2">
                ({status?.percentage || 0}%)
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <FileQuestion className="h-4 w-4 text-yellow-500" />
              마이그레이션 대상
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {status?.pending || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-blue-500" />
              완료 댓글 있음
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {status?.withCompletionComment || 0}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              마이그레이션 가능
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 진행률 바 */}
      {status && status.totalCompleted > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">RAG 문서 생성 진행률</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="w-full bg-gray-200 rounded-full h-4">
              <div
                className="bg-green-500 h-4 rounded-full transition-all duration-500"
                style={{ width: `${status.percentage}%` }}
              />
            </div>
            <p className="text-sm text-gray-500 mt-2">
              {status.withRagDoc} / {status.totalCompleted} 완료 ({status.percentage}%)
            </p>
          </CardContent>
        </Card>
      )}

      {/* 마이그레이션 실행 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">마이그레이션 실행</CardTitle>
          <CardDescription>
            완료된 요청 중 RAG 문서가 없는 항목에 대해 댓글에서 완료 사유를 추출하여 RAG 문서를 생성합니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-end gap-4">
            <div className="space-y-2">
              <Label htmlFor="limit">처리 건수 (최대)</Label>
              <Input
                id="limit"
                type="number"
                value={limit}
                onChange={(e) => setLimit(parseInt(e.target.value) || 50)}
                className="w-32"
                min={1}
                max={500}
              />
            </div>

            <Button
              variant="outline"
              onClick={() => runMigration(true)}
              disabled={isMigrating || !status?.pending}
            >
              {isMigrating ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Play className="h-4 w-4 mr-2" />
              )}
              시뮬레이션 (Dry Run)
            </Button>

            <Button
              onClick={() => runMigration(false)}
              disabled={isMigrating || !status?.withCompletionComment}
            >
              {isMigrating ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Play className="h-4 w-4 mr-2" />
              )}
              마이그레이션 실행
            </Button>

            <Button
              variant="ghost"
              onClick={fetchStatus}
              disabled={isLoading}
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>

          {!status?.withCompletionComment && status?.pending ? (
            <p className="text-sm text-yellow-600 bg-yellow-50 p-3 rounded-md">
              마이그레이션 대상이 있지만 완료 댓글이 없는 요청입니다. 
              해당 요청들은 수동으로 완료 처리가 필요합니다.
            </p>
          ) : null}
        </CardContent>
      </Card>

      {/* 마이그레이션 결과 */}
      {migrationResult && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              {migrationResult.dryRun ? '시뮬레이션 결과' : '마이그레이션 결과'}
              {migrationResult.dryRun && (
                <Badge variant="outline">DRY RUN</Badge>
              )}
            </CardTitle>
            <CardDescription>
              처리: {migrationResult.processed}건 | 
              스킵: {migrationResult.skipped}건 | 
              실패: {migrationResult.failed}건
              {migrationResult.remaining !== undefined && migrationResult.remaining > 0 && (
                <span className="text-yellow-600"> | 남은 건수: {migrationResult.remaining}건</span>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {migrationResult.results && migrationResult.results.length > 0 && (
              <div className="rounded-md border max-h-96 overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12"></TableHead>
                      <TableHead>요청 ID</TableHead>
                      <TableHead>제목</TableHead>
                      <TableHead className="w-24">상태</TableHead>
                      <TableHead>비고</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {migrationResult.results.map((result, index) => (
                      <TableRow key={index}>
                        <TableCell>{getStatusIcon(result.status)}</TableCell>
                        <TableCell className="font-mono text-xs">
                          {result.requestId.substring(0, 8)}...
                        </TableCell>
                        <TableCell className="max-w-xs truncate">
                          {result.title}
                        </TableCell>
                        <TableCell>{getStatusBadge(result.status)}</TableCell>
                        <TableCell className="text-sm text-gray-500 max-w-xs truncate">
                          {result.reason || '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {migrationResult.errors && migrationResult.errors.length > 0 && (
              <div className="mt-4 p-3 bg-red-50 rounded-md">
                <p className="text-sm font-medium text-red-800 mb-2">오류 목록:</p>
                <ul className="text-xs text-red-600 space-y-1">
                  {migrationResult.errors.map((error, index) => (
                    <li key={index}>{error}</li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
