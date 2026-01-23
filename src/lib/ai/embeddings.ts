import { GoogleGenerativeAI } from '@google/generative-ai'

// Google AI 클라이언트 초기화
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')

// 임베딩 모델 (text-embedding-004는 768차원 벡터 생성)
const embeddingModel = genAI.getGenerativeModel({ model: 'text-embedding-004' })

/**
 * 텍스트를 벡터 임베딩으로 변환
 * @param text 임베딩할 텍스트
 * @returns 768차원 벡터 배열
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    // 텍스트 전처리 (빈 텍스트 방지)
    const cleanText = text.trim()
    if (!cleanText) {
      throw new Error('임베딩할 텍스트가 비어있습니다.')
    }

    // 텍스트가 너무 길면 잘라내기 (토큰 제한 대비)
    const maxLength = 10000 // 약 2500 토큰 정도
    const truncatedText = cleanText.length > maxLength 
      ? cleanText.slice(0, maxLength) 
      : cleanText

    // 임베딩 생성
    const result = await embeddingModel.embedContent(truncatedText)
    const embedding = result.embedding.values

    return embedding
  } catch (error) {
    console.error('임베딩 생성 오류:', error)
    throw error
  }
}

/**
 * 여러 텍스트를 일괄 임베딩 (배치 처리)
 * @param texts 임베딩할 텍스트 배열
 * @returns 벡터 배열들
 */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const embeddings: number[][] = []
  
  // 순차 처리 (Rate limit 방지)
  for (const text of texts) {
    try {
      const embedding = await generateEmbedding(text)
      embeddings.push(embedding)
      
      // Rate limit 방지를 위한 딜레이 (분당 1500 요청 한도)
      await new Promise(resolve => setTimeout(resolve, 50))
    } catch (error) {
      console.error('배치 임베딩 오류:', error)
      // 실패한 경우 빈 배열 추가 (또는 스킵)
      embeddings.push([])
    }
  }
  
  return embeddings
}

/**
 * 서비스 요청 텍스트를 임베딩용 문자열로 변환
 * @param title 제목
 * @param description 설명
 * @param systemName 시스템명 (선택)
 * @param moduleName 모듈명 (선택)
 * @returns 임베딩용 통합 텍스트
 */
export function prepareRequestText(
  title: string,
  description: string,
  systemName?: string | null,
  moduleName?: string | null
): string {
  const parts = [title, description]
  
  if (systemName) {
    parts.push(`시스템: ${systemName}`)
  }
  
  if (moduleName) {
    parts.push(`모듈: ${moduleName}`)
  }
  
  return parts.filter(Boolean).join('\n')
}

/**
 * 벡터를 PostgreSQL vector 타입 형식으로 변환
 * @param embedding 벡터 배열
 * @returns PostgreSQL vector 형식 문자열
 */
export function vectorToPostgres(embedding: number[]): string {
  return `[${embedding.join(',')}]`
}
