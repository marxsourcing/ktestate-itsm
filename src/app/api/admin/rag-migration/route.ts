import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateRagDocument } from '@/lib/ai/rag'

/**
 * 완료 댓글에서 사유를 추출합니다.
 * 형식: ✅ **처리 완료**\n\n{reason}
 */
function extractCompletionReason(content: string): string | null {
  // 완료 댓글 패턴 매칭
  const completionPattern = /✅ \*\*처리 완료\*\*\n\n([\s\S]+)/
  const match = content.match(completionPattern)
  return match?.[1]?.trim() || null
}

/**
 * RAG 마이그레이션 현황 조회 API
 * GET /api/admin/rag-migration
 */
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
    }

    // 관리자 권한 확인
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 })
    }

    // 전체 완료 요청 수
    const { count: totalCompleted } = await supabase
      .from('service_requests')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'completed')

    // RAG 문서가 있는 완료 요청 수 (completion 타입)
    const { count: withRagDoc } = await supabase
      .from('rag_documents')
      .select('id', { count: 'exact', head: true })
      .eq('document_type', 'completion')

    // 미생성 요청 수 (마이그레이션 대상)
    // 완료 요청 중 rag_documents에 없는 것
    const { data: completedRequests } = await supabase
      .from('service_requests')
      .select('id')
      .eq('status', 'completed')

    const completedIds = (completedRequests || []).map(r => r.id)

    let pendingCount = 0
    let withCompletionComment = 0

    if (completedIds.length > 0) {
      // RAG 문서가 있는 요청 ID 목록
      const { data: ragDocs } = await supabase
        .from('rag_documents')
        .select('request_id')
        .eq('document_type', 'completion')
        .in('request_id', completedIds)

      const ragDocRequestIds = new Set((ragDocs || []).map(d => d.request_id))
      const pendingIds = completedIds.filter(id => !ragDocRequestIds.has(id))
      pendingCount = pendingIds.length

      // 완료 댓글이 있는 요청 수 확인 (미생성 요청 중)
      if (pendingIds.length > 0) {
        const { data: comments } = await supabase
          .from('sr_comments')
          .select('request_id, content')
          .in('request_id', pendingIds)
          .eq('is_internal', false)

        // 완료 댓글 패턴이 있는 요청 ID 수집
        const requestsWithCompletionComment = new Set<string>()
        for (const comment of comments || []) {
          if (extractCompletionReason(comment.content)) {
            requestsWithCompletionComment.add(comment.request_id)
          }
        }
        withCompletionComment = requestsWithCompletionComment.size
      }
    }

    return NextResponse.json({
      totalCompleted: totalCompleted || 0,
      withRagDoc: withRagDoc || 0,
      pending: pendingCount,
      withCompletionComment,
      percentage: totalCompleted 
        ? Math.round((withRagDoc || 0) / totalCompleted * 100) 
        : 0
    })

  } catch (error) {
    console.error('RAG migration status API error:', error)
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}

/**
 * RAG 마이그레이션 실행 API
 * POST /api/admin/rag-migration
 * 
 * Query params:
 * - limit: 처리할 최대 건수 (기본 50)
 * - dryRun: true면 실제 생성 없이 시뮬레이션만
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
    }

    // 관리자 권한 확인
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 })
    }

    // 쿼리 파라미터 파싱
    const url = new URL(request.url)
    const limit = parseInt(url.searchParams.get('limit') || '50')
    const dryRun = url.searchParams.get('dryRun') === 'true'

    // 완료된 요청 조회
    const { data: completedRequests } = await supabase
      .from('service_requests')
      .select('id, title')
      .eq('status', 'completed')
      .order('completed_at', { ascending: true })

    if (!completedRequests || completedRequests.length === 0) {
      return NextResponse.json({
        message: '완료된 요청이 없습니다.',
        processed: 0,
        skipped: 0,
        failed: 0
      })
    }

    // RAG 문서가 이미 있는 요청 필터링
    const completedIds = completedRequests.map(r => r.id)
    const { data: existingRagDocs } = await supabase
      .from('rag_documents')
      .select('request_id')
      .eq('document_type', 'completion')
      .in('request_id', completedIds)

    const existingRagDocIds = new Set((existingRagDocs || []).map(d => d.request_id))
    const pendingRequests = completedRequests.filter(r => !existingRagDocIds.has(r.id))

    if (pendingRequests.length === 0) {
      return NextResponse.json({
        message: '마이그레이션이 필요한 요청이 없습니다.',
        processed: 0,
        skipped: 0,
        failed: 0
      })
    }

    // limit 적용
    const targetRequests = pendingRequests.slice(0, limit)

    // 각 요청의 완료 댓글 조회
    const targetIds = targetRequests.map(r => r.id)
    const { data: comments } = await supabase
      .from('sr_comments')
      .select('request_id, content, created_at')
      .in('request_id', targetIds)
      .eq('is_internal', false)
      .order('created_at', { ascending: false })

    // 요청별 완료 사유 매핑
    const reasonByRequestId = new Map<string, string>()
    for (const comment of comments || []) {
      // 이미 사유가 있으면 스킵 (최신 댓글 우선)
      if (reasonByRequestId.has(comment.request_id)) continue
      
      const reason = extractCompletionReason(comment.content)
      if (reason) {
        reasonByRequestId.set(comment.request_id, reason)
      }
    }

    // 마이그레이션 실행
    let processed = 0
    let skipped = 0
    let failed = 0
    const errors: string[] = []
    const results: Array<{
      requestId: string
      title: string
      status: 'processed' | 'skipped' | 'failed'
      reason?: string
    }> = []

    for (const req of targetRequests) {
      const completionReason = reasonByRequestId.get(req.id)

      if (!completionReason) {
        skipped++
        results.push({
          requestId: req.id,
          title: req.title,
          status: 'skipped',
          reason: '완료 댓글 없음'
        })
        continue
      }

      if (dryRun) {
        // 시뮬레이션 모드: 실제 생성하지 않음
        processed++
        results.push({
          requestId: req.id,
          title: req.title,
          status: 'processed',
          reason: `[DRY RUN] 사유: ${completionReason.substring(0, 50)}...`
        })
        continue
      }

      try {
        // RAG 문서 생성
        const result = await generateRagDocument(supabase, req.id, completionReason)

        if (result) {
          processed++
          results.push({
            requestId: req.id,
            title: req.title,
            status: 'processed'
          })
        } else {
          failed++
          errors.push(`${req.id}: RAG 문서 생성 실패`)
          results.push({
            requestId: req.id,
            title: req.title,
            status: 'failed',
            reason: 'RAG 문서 생성 실패'
          })
        }

        // Rate limit 방지 딜레이
        await new Promise(resolve => setTimeout(resolve, 200))

      } catch (error) {
        failed++
        const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류'
        errors.push(`${req.id}: ${errorMessage}`)
        results.push({
          requestId: req.id,
          title: req.title,
          status: 'failed',
          reason: errorMessage
        })
      }
    }

    return NextResponse.json({
      message: dryRun ? '시뮬레이션 완료' : '마이그레이션 완료',
      dryRun,
      total: targetRequests.length,
      processed,
      skipped,
      failed,
      remaining: pendingRequests.length - targetRequests.length,
      results: results.slice(0, 20), // 최대 20개 결과만 반환
      errors: errors.slice(0, 10) // 최대 10개 에러만 반환
    })

  } catch (error) {
    console.error('RAG migration API error:', error)
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}
