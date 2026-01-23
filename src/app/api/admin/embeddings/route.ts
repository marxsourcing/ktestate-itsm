import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateEmbedding, prepareRequestText } from '@/lib/ai/embeddings'

/**
 * 기존 서비스 요청에 대한 임베딩 일괄 생성 API
 * POST /api/admin/embeddings
 * 
 * Query params:
 * - limit: 처리할 최대 건수 (기본 50)
 * - force: true면 이미 임베딩이 있는 건도 재생성
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
    const force = url.searchParams.get('force') === 'true'

    // 임베딩이 없는 요청 조회
    let query = supabase
      .from('service_requests')
      .select(`
        id,
        title,
        description,
        system:systems(name),
        module:system_modules(name)
      `)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (!force) {
      query = query.is('embedding', null)
    }

    const { data: requests, error: queryError } = await query

    if (queryError) {
      return NextResponse.json({ error: queryError.message }, { status: 500 })
    }

    if (!requests || requests.length === 0) {
      return NextResponse.json({
        message: '처리할 요청이 없습니다.',
        processed: 0,
        failed: 0
      })
    }

    // 임베딩 생성 및 저장
    let processed = 0
    let failed = 0
    const errors: string[] = []

    for (const req of requests) {
      try {
        // 시스템/모듈 이름 추출
        const systemName = req.system
          ? (Array.isArray(req.system) ? req.system[0]?.name : (req.system as { name: string })?.name)
          : null
        const moduleName = req.module
          ? (Array.isArray(req.module) ? req.module[0]?.name : (req.module as { name: string })?.name)
          : null

        // 임베딩 텍스트 준비
        const text = prepareRequestText(
          req.title || '',
          req.description || '',
          systemName,
          moduleName
        )

        if (!text.trim()) {
          failed++
          errors.push(`${req.id}: 텍스트가 비어있음`)
          continue
        }

        // 임베딩 생성
        const embedding = await generateEmbedding(text)

        // DB에 저장
        const { error: updateError } = await supabase
          .from('service_requests')
          .update({ embedding: `[${embedding.join(',')}]` })
          .eq('id', req.id)

        if (updateError) {
          failed++
          errors.push(`${req.id}: ${updateError.message}`)
        } else {
          processed++
        }

        // Rate limit 방지 딜레이
        await new Promise(resolve => setTimeout(resolve, 100))

      } catch (embeddingError) {
        failed++
        const errorMessage = embeddingError instanceof Error ? embeddingError.message : '알 수 없는 오류'
        errors.push(`${req.id}: ${errorMessage}`)
      }
    }

    return NextResponse.json({
      message: `임베딩 생성 완료`,
      total: requests.length,
      processed,
      failed,
      errors: errors.slice(0, 10) // 최대 10개 에러만 반환
    })

  } catch (error) {
    console.error('Embeddings API error:', error)
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}

/**
 * 임베딩 현황 조회 API
 * GET /api/admin/embeddings
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

    // 전체 요청 수
    const { count: totalCount } = await supabase
      .from('service_requests')
      .select('id', { count: 'exact', head: true })

    // 임베딩이 있는 요청 수
    const { count: embeddedCount } = await supabase
      .from('service_requests')
      .select('id', { count: 'exact', head: true })
      .not('embedding', 'is', null)

    // 임베딩이 없는 요청 수
    const { count: pendingCount } = await supabase
      .from('service_requests')
      .select('id', { count: 'exact', head: true })
      .is('embedding', null)

    return NextResponse.json({
      total: totalCount || 0,
      embedded: embeddedCount || 0,
      pending: pendingCount || 0,
      percentage: totalCount ? Math.round((embeddedCount || 0) / totalCount * 100) : 0
    })

  } catch (error) {
    console.error('Embeddings status API error:', error)
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}
