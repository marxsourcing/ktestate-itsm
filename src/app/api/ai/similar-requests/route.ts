import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface SimilarRequest {
  id: string
  title: string
  description: string
  status: string
  type: string
  system_name: string | null
  created_at: string
  similarity: number
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

    // 검색어 구성
    const searchText = `${title || ''} ${description || ''}`.trim()
    const keywords = extractKeywords(searchText)

    if (keywords.length === 0) {
      return NextResponse.json({ similarRequests: [] })
    }

    // 유사 요청 검색 쿼리 - 키워드 기반 검색
    let query = supabase
      .from('service_requests')
      .select(`
        id,
        title,
        description,
        status,
        type,
        created_at,
        systems:system_id (name)
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
        similarRequests.push({
          id: req.id,
          title: req.title,
          description: req.description?.slice(0, 200) || '',
          status: req.status,
          type: req.type,
          system_name: (req.systems as { name: string } | null | { name: string }[])
            ? (Array.isArray(req.systems) ? req.systems[0]?.name : (req.systems as { name: string })?.name) || null
            : null,
          created_at: req.created_at,
          similarity: Math.round(similarity)
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
      duplicateWarning: hasDuplicate ? '매우 유사한 요청이 이미 존재합니다.' : null
    })

  } catch (error) {
    console.error('Similar requests API error:', error)
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
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
