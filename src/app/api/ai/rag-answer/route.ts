import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { searchRagDocuments, RagSearchResult } from '@/lib/ai/rag'

const RAG_SYSTEM_PROMPT = `당신은 KT Estate의 IT 서비스 관리 시스템의 AI 어시스턴트입니다.
아래 제공되는 참고 문서들은 과거에 처리된 실제 서비스 요청과 해결 방법입니다.
이 정보를 기반으로 사용자의 질문에 답변해주세요.

## 지침
- 참고 문서의 내용을 기반으로 답변해주세요.
- 확실하지 않은 내용은 추측하지 말고, "관련 사례를 찾지 못했습니다"라고 안내해주세요.
- 답변은 구체적이고 실용적으로 작성해주세요.
- 한국어로 응답하세요.`

interface RagAnswerRequest {
  question: string
  systemId?: string
  matchCount?: number
}

interface SourceInfo {
  id: string
  title: string
  similarity: number
  requestId: string | null
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
    }

    const body: RagAnswerRequest = await request.json()
    const { question, systemId, matchCount = 5 } = body

    if (!question || !question.trim()) {
      return NextResponse.json({ error: '질문이 필요합니다.' }, { status: 400 })
    }

    // RAG 문서 검색
    let ragResults: RagSearchResult[] = []
    try {
      ragResults = await searchRagDocuments(supabase, question, {
        systemId: systemId || null,
        documentType: 'completion',
        matchThreshold: 0.3,
        matchCount,
      })
    } catch (searchError) {
      console.error('RAG 검색 실패:', searchError)
      // 검색 실패해도 계속 진행 (빈 결과로)
    }

    // 출처 정보 추출
    const sources: SourceInfo[] = ragResults.map(doc => ({
      id: doc.id,
      title: doc.title,
      similarity: Math.round(doc.similarity * 100),
      requestId: doc.request_id,
    }))

    // 검색 결과가 없는 경우
    if (ragResults.length === 0) {
      return NextResponse.json({
        answer: '질문과 관련된 과거 처리 사례를 찾지 못했습니다. 다른 키워드로 검색하시거나, 담당자에게 직접 문의해주세요.',
        sources: [],
        hasResults: false,
      })
    }

    // 프롬프트 구성
    const contextParts = ragResults.map((doc, index) => {
      return `[참고 ${index + 1}] (유사도: ${Math.round(doc.similarity * 100)}%)
제목: ${doc.title}
${doc.system_name ? `시스템: ${doc.system_name}` : ''}
내용:
${doc.content}
`
    })

    const fullPrompt = `${RAG_SYSTEM_PROMPT}

## 참고 문서
${contextParts.join('\n---\n')}

## 사용자 질문
${question}

위 참고 문서들을 기반으로 사용자의 질문에 답변해주세요.`

    // Gemini API 호출
    const geminiApiKey = process.env.GEMINI_API_KEY

    let answer: string

    if (!geminiApiKey) {
      // API 키가 없으면 참고 문서 요약으로 대체
      answer = generateFallbackAnswer(question, ragResults)
    } else {
      try {
        const genAI = new GoogleGenerativeAI(geminiApiKey)
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })

        const result = await model.generateContent(fullPrompt)
        answer = result.response.text()
      } catch (aiError) {
        console.error('Gemini API 오류:', aiError)
        answer = generateFallbackAnswer(question, ragResults)
      }
    }

    return NextResponse.json({
      answer,
      sources,
      hasResults: true,
    })

  } catch (error) {
    console.error('RAG Answer API error:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

// Gemini API 없을 때 폴백 답변 생성
function generateFallbackAnswer(question: string, results: RagSearchResult[]): string {
  if (results.length === 0) {
    return '관련된 과거 사례를 찾지 못했습니다.'
  }

  const topResult = results[0]
  const otherResults = results.slice(1, 3)

  let answer = `**"${question}"에 대한 유사 사례 분석**\n\n`
  
  answer += `**가장 유사한 사례** (유사도: ${Math.round(topResult.similarity * 100)}%)\n`
  answer += `- 제목: ${topResult.title}\n`
  if (topResult.system_name) {
    answer += `- 시스템: ${topResult.system_name}\n`
  }
  answer += `\n${topResult.content}\n`

  if (otherResults.length > 0) {
    answer += `\n**추가 참고 사례**\n`
    otherResults.forEach((r, i) => {
      answer += `${i + 1}. ${r.title} (유사도: ${Math.round(r.similarity * 100)}%)\n`
    })
  }

  return answer
}
