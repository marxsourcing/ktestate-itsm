import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateEmbedding, prepareRequestText } from '@/lib/ai/embeddings'
import { searchRagDocuments } from '@/lib/ai/rag'

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
  hasAnswer?: boolean  // RAG 문서에서 온 경우 처리 답변 있음
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

    // 시스템 ID 조회 (있는 경우)
    let systemId: string | null = null
    if (system) {
      const { data: systemData } = await supabase
        .from('systems')
        .select('id')
        .or(`name.eq.${system},code.eq.${system},name.ilike.%${system}%`)
        .maybeSingle()
      if (systemData) {
        systemId = systemData.id
      }
    }

    // 1단계: RAG 문서 벡터 검색 (완료된 요청의 처리 결과 포함)
    try {
      const ragResults = await searchRagDocuments(supabase, searchText, {
        systemId,
        documentType: 'completion',
        matchThreshold: 0.3,
        matchCount: 10,
      })

      if (ragResults.length > 0) {
        // RAG 결과가 있으면 해당 request 정보로 변환
        const ragRequestIds = ragResults
          .filter(r => r.request_id)
          .map(r => r.request_id as string)

        if (ragRequestIds.length > 0) {
          // excludeId 필터링
          const filteredIds = excludeId 
            ? ragRequestIds.filter(id => id !== excludeId)
            : ragRequestIds

          if (filteredIds.length > 0) {
            // 요청 상세 정보 조회
            const { data: requests } = await supabase
              .from('service_requests')
              .select(`
                id, title, description, status, created_at,
                system:systems(name),
                category_lv1:request_categories_lv1(name),
                category_lv2:request_categories_lv2(name)
              `)
              .in('id', filteredIds)

            if (requests && requests.length > 0) {
              const similarRequests: SimilarRequest[] = requests.map(req => {
                const ragDoc = ragResults.find(r => r.request_id === req.id)
                const systemName = Array.isArray(req.system)
                  ? req.system[0]?.name
                  : (req.system as { name: string } | null)?.name
                const catLv1 = Array.isArray(req.category_lv1)
                  ? req.category_lv1[0]?.name
                  : (req.category_lv1 as { name: string } | null)?.name
                const catLv2 = Array.isArray(req.category_lv2)
                  ? req.category_lv2[0]?.name
                  : (req.category_lv2 as { name: string } | null)?.name

                return {
                  id: req.id,
                  title: req.title,
                  description: req.description?.slice(0, 200) || '',
                  status: req.status,
                  system_name: systemName || null,
                  created_at: req.created_at,
                  similarity: Math.round((ragDoc?.similarity || 0) * 100),
                  category_lv1_name: catLv1 || null,
                  category_lv2_name: catLv2 || null,
                  hasAnswer: true, // RAG 문서 = 처리 답변 있음
                }
              })

              // 유사도 순 정렬
              similarRequests.sort((a, b) => b.similarity - a.similarity)
              const topSimilar = similarRequests.slice(0, 5)
              const hasDuplicate = topSimilar.some(r => r.similarity >= 80)

              return NextResponse.json({
                similarRequests: topSimilar,
                hasDuplicate,
                duplicateWarning: hasDuplicate ? '매우 유사한 요청이 이미 존재합니다.' : null,
                searchMethod: 'rag'
              })
            }
          }
        }
      }
    } catch (ragError) {
      console.error('RAG 검색 실패, 벡터 검색으로 폴백:', ragError)
    }

    // 2단계: 기존 service_requests 벡터 검색 (폴백)
    let queryEmbedding: number[]
    try {
      queryEmbedding = await generateEmbedding(searchText)
    } catch (embeddingError) {
      console.error('임베딩 생성 실패, 키워드 기반으로 폴백:', embeddingError)
      return await fallbackKeywordSearch(supabase, title, description, system, excludeId)
    }

    const { data: vectorResults, error: vectorError } = await supabase.rpc(
      'match_service_requests',
      {
        query_embedding: `[${queryEmbedding.join(',')}]`,
        match_threshold: 0.3,
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

    // 벡터 검색 결과 직접 사용
    interface VectorResult {
      id: string
      title: string
      description: string | null
      status: string
      system_name: string | null
      category_lv1_name: string | null
      category_lv2_name: string | null
      created_at: string
      similarity: number
    }

    const similarRequests: SimilarRequest[] = vectorResults.map((vr: VectorResult) => ({
      id: vr.id,
      title: vr.title,
      description: vr.description?.slice(0, 200) || '',
      status: vr.status,
      system_name: vr.system_name || null,
      created_at: vr.created_at,
      similarity: Math.round(vr.similarity * 100),
      category_lv1_name: vr.category_lv1_name || null,
      category_lv2_name: vr.category_lv2_name || null,
      hasAnswer: vr.status === 'completed', // 완료된 경우만 답변 있을 수 있음
    }))

    similarRequests.sort((a, b) => b.similarity - a.similarity)
    const topSimilar = similarRequests.slice(0, 5)
    const hasDuplicate = topSimilar.some(r => r.similarity >= 80)

    return NextResponse.json({
      similarRequests: topSimilar,
      hasDuplicate,
      duplicateWarning: hasDuplicate ? '매우 유사한 요청이 이미 존재합니다.' : null,
      searchMethod: 'vector'
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

  // 시스템 ID 조회 (있는 경우)
  let systemId: string | null = null
  if (system) {
    const { data: systemData } = await supabase
      .from('systems')
      .select('id')
      .or(`name.eq.${system},code.eq.${system},name.ilike.%${system}%`)
      .maybeSingle()

    if (systemData) {
      systemId = systemData.id
    }
  }

  // SECURITY DEFINER 함수를 사용하여 RLS 우회
  const { data: requests, error } = await supabase.rpc(
    'search_service_requests_for_similarity',
    {
      search_system_id: systemId,
      exclude_id: excludeId || null,
      result_limit: 50
    }
  )

  if (error) {
    console.error('Similar requests query error:', error)
    return NextResponse.json({ error: '검색 중 오류가 발생했습니다.' }, { status: 500 })
  }

  // 유사도 계산 및 필터링
  interface KeywordResult {
    id: string
    title: string
    description: string | null
    status: string
    system_name: string | null
    category_lv1_name: string | null
    category_lv2_name: string | null
    created_at: string
  }

  const similarRequests: SimilarRequest[] = []

  for (const req of (requests as KeywordResult[]) || []) {
    const reqText = `${req.title || ''} ${req.description || ''}`.toLowerCase()
    const similarity = calculateSimilarity(keywords, reqText)

    if (similarity >= 30) { // 30% 이상 유사도
      similarRequests.push({
        id: req.id,
        title: req.title,
        description: req.description?.slice(0, 200) || '',
        status: req.status,
        system_name: req.system_name || null,
        created_at: req.created_at,
        similarity: Math.round(similarity),
        category_lv1_name: req.category_lv1_name || null,
        category_lv2_name: req.category_lv2_name || null,
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
