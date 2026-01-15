import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

const DRAFT_SYSTEM_PROMPT = `당신은 KT Estate의 IT 서비스 담당자를 위한 AI 어시스턴트입니다.
담당자가 AI와 나눈 대화 내용(문제 분석, 해결 방안 등)을 바탕으로 요청자에게 보낼 전문적이면서도 친근한 답변 초안을 작성해주세요.

작성 지침:
1. 요청자의 이름을 사용하여 친근하게 인사
2. 요청 내용을 요약하여 이해했음을 전달
3. 담당자와 AI의 대화에서 도출된 해결 방안/처리 결과를 명확하게 설명
4. 기술 용어는 사용자가 이해하기 쉬운 표현으로 변환
5. 추가 문의 가능함을 안내
6. 감사 인사로 마무리

어조:
- 전문적이면서도 친근하게
- 긍정적이고 협조적인 태도
- 해결 과정을 간결하게 요약

응답 형식:
답변 초안 텍스트만 반환 (JSON 없이 순수 텍스트)`

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface DraftRequest {
  requestId: string
  requestTitle: string
  requestDescription: string
  requestPriority: string
  requesterName?: string
  systemName?: string
  categoryLv1Name?: string  // SR 구분 (대분류)
  categoryLv2Name?: string  // SR 상세 구분 (소분류)
  chatHistory?: ChatMessage[]  // 담당자-AI 대화 내역
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
    }

    const body: DraftRequest = await request.json()
    const {
      requestTitle,
      requestDescription,
      requestPriority,
      requesterName,
      systemName,
      categoryLv1Name,
      categoryLv2Name,
      chatHistory
    } = body

    if (!requestTitle || !requestDescription) {
      return NextResponse.json({ error: '요청 정보가 필요합니다.' }, { status: 400 })
    }

    // 우선순위 라벨
    const priorityLabels: Record<string, string> = {
      urgent: '긴급',
      high: '높음',
      medium: '보통',
      low: '낮음'
    }

    // 대화 내역 포맷팅
    let chatSummary = ''
    if (chatHistory && chatHistory.length > 0) {
      chatSummary = `
담당자-AI 대화 내역:
${chatHistory.map(msg => `[${msg.role === 'user' ? '담당자' : 'AI'}]: ${msg.content}`).join('\n\n')}
`
    }

    // SR 구분 표시
    const categoryDisplay = categoryLv1Name
      ? (categoryLv2Name ? `${categoryLv1Name} / ${categoryLv2Name}` : categoryLv1Name)
      : '미지정'

    // 프롬프트 구성
    const requestInfo = `
요청 정보:
- 제목: ${requestTitle}
- SR 구분: ${categoryDisplay}
- 우선순위: ${priorityLabels[requestPriority] || requestPriority}
- 시스템: ${systemName || '미지정'}
- 요청자: ${requesterName || '사용자'}

요청 내용:
${requestDescription}
${chatSummary}
위 정보를 바탕으로 요청자(${requesterName || '사용자'})에게 보낼 답변 초안을 작성해주세요.
${chatHistory && chatHistory.length > 0 ? '특히 담당자와 AI의 대화에서 도출된 해결 방안을 중심으로 작성해주세요.' : ''}
`.trim()

    // Gemini API 호출
    const geminiApiKey = process.env.GEMINI_API_KEY

    if (!geminiApiKey) {
      // API 키가 없으면 더미 응답
      return NextResponse.json({
        draft: generateDummyDraft(requesterName, requestTitle, categoryDisplay)
      })
    }

    const genAI = new GoogleGenerativeAI(geminiApiKey)
    const model = genAI.getGenerativeModel({ model: 'gemini-3-flash-preview' })

    const chat = model.startChat({
      systemInstruction: {
        role: 'user',
        parts: [{ text: DRAFT_SYSTEM_PROMPT }],
      },
    })

    const result = await chat.sendMessage(requestInfo)
    const draftContent = result.response.text()

    return NextResponse.json({
      draft: draftContent.trim()
    })

  } catch (error) {
    console.error('Draft response API error:', error)
    return NextResponse.json(
      { error: '답변 초안 생성 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

function generateDummyDraft(
  requesterName: string | undefined,
  requestTitle: string,
  categoryDisplay: string
): string {
  const name = requesterName || '고객'

  return `${name}님, 안녕하세요.

IT 서비스팀입니다.

요청하신 "${requestTitle}" 건에 대해 확인하였습니다.

${categoryDisplay !== '미지정' ? `[${categoryDisplay}] 유형으로 ` : ''}접수되어 담당자가 내용을 검토 중에 있습니다.
처리가 완료되는 대로 결과를 안내드리겠습니다.

추가 문의사항이 있으시면 언제든 말씀해 주세요.

감사합니다.

IT 서비스팀 드림`
}
