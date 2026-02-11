import { SupabaseClient } from '@supabase/supabase-js'
import { generateEmbedding, vectorToPostgres } from './embeddings'

// RAG 문서 타입 정의
export type RagDocumentType = 'request' | 'completion' | 'faq' | 'manual'

// RAG 검색 결과 타입
export interface RagSearchResult {
  id: string
  request_id: string | null
  document_type: string
  title: string
  content: string
  system_name: string | null
  similarity: number
}

// RAG 문서 생성 결과 타입
export interface RagDocumentResult {
  id: string
  request_id: string
  document_type: RagDocumentType
}

/**
 * RAG 문서용 텍스트를 준비합니다.
 * 완료된 요청의 정보를 검색에 최적화된 형태로 변환합니다.
 * 
 * @param params 요청 정보
 * @returns RAG 검색에 최적화된 텍스트
 */
export function prepareRagDocumentText(params: {
  title: string
  description: string
  completionReason: string
  systemName?: string | null
  moduleName?: string | null
  categoryLv1Name?: string | null
  categoryLv2Name?: string | null
}): string {
  const {
    title,
    description,
    completionReason,
    systemName,
    moduleName,
    categoryLv1Name,
    categoryLv2Name,
  } = params

  const parts: string[] = []

  // 시스템/모듈 정보
  if (systemName) {
    const systemModulePart = moduleName 
      ? `[${systemName}] ${moduleName}` 
      : `[${systemName}]`
    parts.push(systemModulePart)
  }

  // 분류 정보
  if (categoryLv1Name || categoryLv2Name) {
    const categoryPart = [categoryLv1Name, categoryLv2Name]
      .filter(Boolean)
      .join(' > ')
    if (categoryPart) {
      parts.push(`분류: ${categoryPart}`)
    }
  }

  // 제목
  parts.push(`제목: ${title}`)

  // 문의 내용
  if (description) {
    parts.push(`문의 내용: ${description}`)
  }

  // 해결 방법
  parts.push(`해결 방법: ${completionReason}`)

  return parts.join('\n')
}

/**
 * 완료된 요청에 대한 RAG 문서를 생성합니다.
 * 
 * @param supabase Supabase 클라이언트
 * @param requestId 요청 ID
 * @param completionReason 완료 사유/해결 방법
 * @returns 생성된 RAG 문서 정보
 */
export async function generateRagDocument(
  supabase: SupabaseClient,
  requestId: string,
  completionReason: string
): Promise<RagDocumentResult | null> {
  // 요청 정보 조회
  const { data: request, error: fetchError } = await supabase
    .from('service_requests')
    .select(`
      id,
      title,
      description,
      system_id,
      module_id,
      category_lv1_id,
      category_lv2_id,
      system:systems(name),
      module:system_modules(name),
      category_lv1:request_categories_lv1(name),
      category_lv2:request_categories_lv2(name)
    `)
    .eq('id', requestId)
    .single()

  if (fetchError || !request) {
    console.error('RAG 문서 생성을 위한 요청 조회 실패:', fetchError)
    return null
  }

  // 관계 데이터 처리 (Supabase 반환 형태 정리)
  const systemName = Array.isArray(request.system) 
    ? request.system[0]?.name 
    : (request.system as { name: string } | null)?.name
  const moduleName = Array.isArray(request.module)
    ? request.module[0]?.name
    : (request.module as { name: string } | null)?.name
  const categoryLv1Name = Array.isArray(request.category_lv1)
    ? request.category_lv1[0]?.name
    : (request.category_lv1 as { name: string } | null)?.name
  const categoryLv2Name = Array.isArray(request.category_lv2)
    ? request.category_lv2[0]?.name
    : (request.category_lv2 as { name: string } | null)?.name

  // RAG 문서 텍스트 준비
  const documentText = prepareRagDocumentText({
    title: request.title,
    description: request.description || '',
    completionReason,
    systemName,
    moduleName,
    categoryLv1Name,
    categoryLv2Name,
  })

  // 임베딩 생성
  const embedding = await generateEmbedding(documentText)

  // 기존 RAG 문서가 있는지 확인 (중복 방지)
  const { data: existingDoc } = await supabase
    .from('rag_documents')
    .select('id')
    .eq('request_id', requestId)
    .eq('document_type', 'completion')
    .maybeSingle()

  if (existingDoc) {
    // 기존 문서 업데이트
    const { error: updateError } = await supabase
      .from('rag_documents')
      .update({
        title: request.title,
        content: documentText,
        system_id: request.system_id,
        module_id: request.module_id,
        category_lv1_id: request.category_lv1_id,
        category_lv2_id: request.category_lv2_id,
        embedding: vectorToPostgres(embedding),
        updated_at: new Date().toISOString(),
      })
      .eq('id', existingDoc.id)

    if (updateError) {
      console.error('RAG 문서 업데이트 실패:', updateError)
      return null
    }

    return {
      id: existingDoc.id,
      request_id: requestId,
      document_type: 'completion',
    }
  }

  // 새 RAG 문서 생성
  const { data: newDoc, error: insertError } = await supabase
    .from('rag_documents')
    .insert({
      request_id: requestId,
      document_type: 'completion',
      title: request.title,
      content: documentText,
      system_id: request.system_id,
      module_id: request.module_id,
      category_lv1_id: request.category_lv1_id,
      category_lv2_id: request.category_lv2_id,
      embedding: vectorToPostgres(embedding),
    })
    .select('id')
    .single()

  if (insertError) {
    console.error('RAG 문서 생성 실패:', insertError)
    return null
  }

  return {
    id: newDoc.id,
    request_id: requestId,
    document_type: 'completion',
  }
}

/**
 * RAG 문서를 검색합니다.
 * Phase 1에서 생성한 search_rag_documents RPC 함수를 사용합니다.
 * 
 * @param supabase Supabase 클라이언트
 * @param queryText 검색할 텍스트
 * @param options 검색 옵션
 * @returns 유사한 RAG 문서 목록
 */
export async function searchRagDocuments(
  supabase: SupabaseClient,
  queryText: string,
  options?: {
    systemId?: string | null
    documentType?: RagDocumentType | null
    matchThreshold?: number
    matchCount?: number
  }
): Promise<RagSearchResult[]> {
  const {
    systemId = null,
    documentType = null,
    matchThreshold = 0.3,
    matchCount = 5,
  } = options || {}

  // 쿼리 텍스트 임베딩 생성
  const queryEmbedding = await generateEmbedding(queryText)

  // RPC 함수 호출
  const { data, error } = await supabase.rpc('search_rag_documents', {
    query_embedding: vectorToPostgres(queryEmbedding),
    match_threshold: matchThreshold,
    match_count: matchCount,
    filter_system_id: systemId,
    filter_document_type: documentType,
  })

  if (error) {
    console.error('RAG 문서 검색 실패:', error)
    return []
  }

  return (data || []) as RagSearchResult[]
}

/**
 * 기존 RAG 문서의 임베딩을 갱신합니다.
 * 요청 정보가 수정되었을 때 호출합니다.
 * 
 * @param supabase Supabase 클라이언트
 * @param requestId 요청 ID
 * @returns 업데이트 성공 여부
 */
export async function updateRagDocument(
  supabase: SupabaseClient,
  requestId: string
): Promise<boolean> {
  // 요청의 RAG 문서 조회
  const { data: ragDoc, error: fetchError } = await supabase
    .from('rag_documents')
    .select('id, content')
    .eq('request_id', requestId)
    .eq('document_type', 'completion')
    .maybeSingle()

  if (fetchError) {
    console.error('RAG 문서 조회 실패:', fetchError)
    return false
  }

  if (!ragDoc) {
    // RAG 문서가 없으면 갱신할 것이 없음
    return true
  }

  // 요청 정보 다시 조회
  const { data: request, error: requestError } = await supabase
    .from('service_requests')
    .select(`
      id,
      title,
      description,
      system_id,
      module_id,
      category_lv1_id,
      category_lv2_id,
      system:systems(name),
      module:system_modules(name),
      category_lv1:request_categories_lv1(name),
      category_lv2:request_categories_lv2(name)
    `)
    .eq('id', requestId)
    .single()

  if (requestError || !request) {
    console.error('요청 정보 조회 실패:', requestError)
    return false
  }

  // 관계 데이터 처리
  const systemName = Array.isArray(request.system)
    ? request.system[0]?.name
    : (request.system as { name: string } | null)?.name
  const moduleName = Array.isArray(request.module)
    ? request.module[0]?.name
    : (request.module as { name: string } | null)?.name
  const categoryLv1Name = Array.isArray(request.category_lv1)
    ? request.category_lv1[0]?.name
    : (request.category_lv1 as { name: string } | null)?.name
  const categoryLv2Name = Array.isArray(request.category_lv2)
    ? request.category_lv2[0]?.name
    : (request.category_lv2 as { name: string } | null)?.name

  // 기존 content에서 완료 사유 추출 (해결 방법: 이후 텍스트)
  const completionReasonMatch = ragDoc.content.match(/해결 방법: ([\s\S]*)$/)
  const completionReason = completionReasonMatch?.[1]?.trim() || ''

  if (!completionReason) {
    console.warn('RAG 문서에서 완료 사유를 찾을 수 없음:', requestId)
    return false
  }

  // 새로운 문서 텍스트 생성
  const newDocumentText = prepareRagDocumentText({
    title: request.title,
    description: request.description || '',
    completionReason,
    systemName,
    moduleName,
    categoryLv1Name,
    categoryLv2Name,
  })

  // 새 임베딩 생성
  const newEmbedding = await generateEmbedding(newDocumentText)

  // RAG 문서 업데이트
  const { error: updateError } = await supabase
    .from('rag_documents')
    .update({
      title: request.title,
      content: newDocumentText,
      system_id: request.system_id,
      module_id: request.module_id,
      category_lv1_id: request.category_lv1_id,
      category_lv2_id: request.category_lv2_id,
      embedding: vectorToPostgres(newEmbedding),
      updated_at: new Date().toISOString(),
    })
    .eq('id', ragDoc.id)

  if (updateError) {
    console.error('RAG 문서 갱신 실패:', updateError)
    return false
  }

  return true
}

/**
 * 서비스 요청의 임베딩을 갱신합니다.
 * 요청 정보(시스템, 모듈 등)가 변경되었을 때 호출합니다.
 * 
 * @param supabase Supabase 클라이언트
 * @param requestId 요청 ID
 * @returns 업데이트 성공 여부
 */
export async function updateRequestEmbedding(
  supabase: SupabaseClient,
  requestId: string
): Promise<boolean> {
  // 요청 정보 조회
  const { data: request, error: fetchError } = await supabase
    .from('service_requests')
    .select(`
      id,
      title,
      description,
      system:systems(name),
      module:system_modules(name)
    `)
    .eq('id', requestId)
    .single()

  if (fetchError || !request) {
    console.error('임베딩 갱신을 위한 요청 조회 실패:', fetchError)
    return false
  }

  // 관계 데이터 처리
  const systemName = Array.isArray(request.system)
    ? request.system[0]?.name
    : (request.system as { name: string } | null)?.name
  const moduleName = Array.isArray(request.module)
    ? request.module[0]?.name
    : (request.module as { name: string } | null)?.name

  // 임베딩용 텍스트 준비 (기존 prepareRequestText 로직과 유사)
  const parts = [request.title, request.description]
  if (systemName) parts.push(`시스템: ${systemName}`)
  if (moduleName) parts.push(`모듈: ${moduleName}`)
  const embeddingText = parts.filter(Boolean).join('\n')

  // 새 임베딩 생성
  const newEmbedding = await generateEmbedding(embeddingText)

  // 요청 임베딩 업데이트
  const { error: updateError } = await supabase
    .from('service_requests')
    .update({
      embedding: vectorToPostgres(newEmbedding),
    })
    .eq('id', requestId)

  if (updateError) {
    console.error('요청 임베딩 갱신 실패:', updateError)
    return false
  }

  return true
}
