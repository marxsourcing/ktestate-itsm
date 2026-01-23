import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateEmbedding, prepareRequestText } from '@/lib/ai/embeddings'

interface SimilarRequest {
  id: string
  title: string
  description: string
  status: string
  system_name: string | null
  created_at: string
  similarity: number
  category_lv1_name?: string | null
  category_lv2_name?: string | null
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
    }

    const body = await request.json()
    const { title, description, system, excludeId } = body

    if (!title && !description) {
      return NextResponse.json({ error: '제목 또는 설명이 필요합니다.' }, { status: 400 })
    }

    // 검색 텍스트 준비
    const searchText = prepareRequestText(title || '', description || '', system)

    // 벡터 임베딩 생성
    let queryEmbedding: number[]
    try {
      queryEmbedding = await generateEmbedding(searchText)
    } catch (embeddingError) {
      console.error('임베딩 생성 실패, 키워드 기반으로 폴백:', embeddingError)
      // 임베딩 실패 시 키워드 기반 검색으로 폴백
      return await fallbackKeywordSearch(supabase, title, description, system, excludeId)
    }

    // 벡터 유사도 검색 (pgvector 함수 사용)
    const { data: vectorResults, error: vectorError } = await supabase.rpc(
      'match_service_requests',
      {
        query_embedding: `[${queryEmbedding.join(',')}]`,
        match_threshold: 0.3, // 30% 이상 유사도
        match_count: 10,
        exclude_id: excludeId || null
      }
    )

    // 벡터 검색 결과가 없거나 에러 시 키워드 기반으로 폴백
    if (vectorError || !vectorResults || vectorResults.length === 0) {
      if (vectorError) {
        console.error('벡터 검색 오류:', vectorError)
      }
      return await fallbackKeywordSearch(supabase, title, description, system, excludeId)
    }

    // 벡터 검색 결과에 추가 정보 조회
    const requestIds = vectorResults.map((r: { id: string }) => r.id)
    const { data: detailedRequests } = await supabase
      .from('service_requests')
      .select(`
        id,
        title,
        description,
        status,
        created_at,
        systems:system_id (name),
        category_lv1:request_categories_lv1 (name),
        category_lv2:request_categories_lv2 (name)
      `)
      .in('id', requestIds)

    // 결과 매핑
    const similarRequests: SimilarRequest[] = vectorResults.map((vr: { id: string; similarity: number }) => {
      const detail = detailedRequests?.find(d => d.id === vr.id)
      if (!detail) return null

      const systemData = detail.systems as { name: string } | null | { name: string }[]
      const categoryLv1 = detail.category_lv1 as { name: string } | null | { name: string }[]
      const categoryLv2 = detail.category_lv2 as { name: string } | null | { name: string }[]

      return {
        id: detail.id,
        title: detail.title,
        description: detail.description?.slice(0, 200) || '',
        status: detail.status,
        system_name: systemData
          ? (Array.isArray(systemData) ? systemData[0]?.name : systemData?.name) || null
          : null,
        created_at: detail.created_at,
        similarity: Math.round(vr.similarity * 100), // 0-1 → 0-100 변환
        category_lv1_name: categoryLv1
          ? (Array.isArray(categoryLv1) ? categoryLv1[0]?.name : categoryLv1?.name) || null
          : null,
        category_lv2_name: categoryLv2
          ? (Array.isArray(categoryLv2) ? categoryLv2[0]?.name : categoryLv2?.name) || null
          : null,
      }
    }).filter(Boolean) as SimilarRequest[]

    // 유사도 순으로 정렬하고 상위 5개만 반환
    similarRequests.sort((a, b) => b.similarity - a.similarity)
    const topSimilar = similarRequests.slice(0, 5)

    // 80% 이상 유사도 = 중복 가능성 높음
    const hasDuplicate = topSimilar.some(r => r.similarity >= 80)

    return NextResponse.json({
      similarRequests: topSimilar,
      hasDuplicate,
      duplicateWarning: hasDuplicate ? '매우 유사한 요청이 이미 존재합니다.' : null,
      searchMethod: 'vector' // 검색 방식 표시
    })

  } catch (error) {
    console.error('Similar requests API error:', error)
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}

// 키워드 기반 검색 (폴백)
async function fallbackKeywordSearch(
  supabase: Awaited<ReturnType<typeof createClient>>,
  title: string | undefined,
  description: string | undefined,
  system: string | undefined,
  excludeId: string | undefined
) {
  const searchText = `${title || ''} ${description || ''}`.trim()
  const keywords = extractKeywords(searchText)

  if (keywords.length === 0) {
    return NextResponse.json({ similarRequests: [], searchMethod: 'keyword' })
  }

  // 유사 요청 검색 쿼리 - 키워드 기반 검색
  let query = supabase
    .from('service_requests')
    .select(`
      id,
      title,
      description,
      status,
      created_at,
      systems:system_id (name),
      category_lv1:request_categories_lv1 (name),
      category_lv2:request_categories_lv2 (name)
    `)
    .order('created_at', { ascending: false })
    .limit(50)

  // 시스템 필터 (있는 경우)
  if (system) {
    const { data: systemData } = await supabase
      .from('systems')
      .select('id')
      .or(`name.eq.${system},code.eq.${system},name.ilike.%${system}%`)
      .maybeSingle()

    if (systemData) {
      query = query.eq('system_id', systemData.id)
    }
  }

  const { data: requests, error } = await query

  if (error) {
    console.error('Similar requests query error:', error)
    return NextResponse.json({ error: '검색 중 오류가 발생했습니다.' }, { status: 500 })
  }

  // 유사도 계산 및 필터링
  const similarRequests: SimilarRequest[] = []

  for (const req of requests || []) {
    // 현재 요청 자체는 제외
    if (excludeId && req.id === excludeId) {
      continue
    }

    const reqText = `${req.title || ''} ${req.description || ''}`.toLowerCase()
    const similarity = calculateSimilarity(keywords, reqText)

    if (similarity >= 30) { // 30% 이상 유사도
      const systemData = req.systems as { name: string } | null | { name: string }[]
      const categoryLv1 = req.category_lv1 as { name: string } | null | { name: string }[]
      const categoryLv2 = req.category_lv2 as { name: string } | null | { name: string }[]

      similarRequests.push({
        id: req.id,
        title: req.title,
        description: req.description?.slice(0, 200) || '',
        status: req.status,
        system_name: systemData
          ? (Array.isArray(systemData) ? systemData[0]?.name : systemData?.name) || null
          : null,
        created_at: req.created_at,
        similarity: Math.round(similarity),
        category_lv1_name: categoryLv1
          ? (Array.isArray(categoryLv1) ? categoryLv1[0]?.name : categoryLv1?.name) || null
          : null,
        category_lv2_name: categoryLv2
          ? (Array.isArray(categoryLv2) ? categoryLv2[0]?.name : categoryLv2?.name) || null
          : null,
      })
    }
  }

  // 유사도 순으로 정렬하고 상위 5개만 반환
  similarRequests.sort((a, b) => b.similarity - a.similarity)
  const topSimilar = similarRequests.slice(0, 5)

  // 80% 이상 유사도 = 중복 가능성 높음
  const hasDuplicate = topSimilar.some(r => r.similarity >= 80)

  return NextResponse.json({
    similarRequests: topSimilar,
    hasDuplicate,
    duplicateWarning: hasDuplicate ? '매우 유사한 요청이 이미 존재합니다.' : null,
    searchMethod: 'keyword' // 폴백 검색 방식 표시
  })
}

// 키워드 추출 (불용어 제거)
function extractKeywords(text: string): string[] {
  const stopWords = new Set([
    '의', '가', '이', '은', '들', '는', '좀', '잘', '걍', '과', '도', '를', '으로',
    '자', '에', '와', '한', '하다', '것', '수', '등', '및', '더', '위', '때', '중',
    '그', '이런', '저런', '어떤', '무슨', '그런', '이것', '저것', '그것', '해주세요',
    '부탁', '드립니다', '합니다', '입니다', '있습니다', '없습니다', '싶습니다',
    'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should',
    'may', 'might', 'must', 'shall', 'can', 'need', 'dare', 'ought', 'used',
    'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as', 'into',
    'through', 'during', 'before', 'after', 'above', 'below', 'between'
  ])

  return text
    .toLowerCase()
    .replace(/[^\w\sㄱ-ㅎㅏ-ㅣ가-힣]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length >= 2 && !stopWords.has(word))
}

// 키워드 기반 유사도 계산
function calculateSimilarity(keywords: string[], targetText: string): number {
  if (keywords.length === 0) return 0

  let matchCount = 0
  const targetLower = targetText.toLowerCase()

  for (const keyword of keywords) {
    if (targetLower.includes(keyword)) {
      matchCount++
    }
  }

  return (matchCount / keywords.length) * 100
}
