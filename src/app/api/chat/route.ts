import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

const REQUESTER_SYSTEM_PROMPT = `당신은 KT Estate의 IT 서비스 요구사항 접수를 도와주는 AI 어시스턴트입니다.

사용자의 요구사항을 분석하여 다음 정보를 파악해야 합니다:
1. 시스템: 어떤 IT 시스템에 관한 요청인가
2. 모듈: 해당 시스템의 어떤 기능/모듈에 관한 것인가
3. 유형: 기능 추가(feature), 기능 개선(improvement), 버그 수정(bug), 기타(other) 중 하나
4. 제목: 요구사항을 한 줄로 요약
5. 상세 내용: 구체적인 요구사항 설명

대화를 통해 부족한 정보를 자연스럽게 물어보세요. 예를 들어:
- "어떤 시스템에 관한 요청이신가요?"
- "현재 어떤 문제가 있으신가요?"
- "구체적으로 어떤 개선을 원하시나요?"

충분한 정보가 모이면, 요구사항 카드를 생성하세요.

응답 형식:
{
  "content": "사용자에게 보여줄 메시지",
  "metadata": {
    "requirementCard": {
      "system": "시스템명",
      "module": "모듈명",
      "type": "feature|improvement|bug|other",
      "title": "요구사항 제목",
      "description": "상세 설명"
    }
  }
}

요구사항 카드는 충분한 정보가 모였을 때만 포함하세요.
응답은 반드시 위의 JSON 형식으로 해주세요.`

// 담당자 워크스페이스용 시스템 프롬프트
function getManagerSystemPrompt(context: {
  requestTitle: string
  requestDescription: string
  requestType: string
  requestPriority: string
  requesterName?: string
}) {
  return `당신은 KT Estate의 IT 서비스 담당자를 위한 AI 협업 어시스턴트입니다.

현재 처리 중인 서비스 요청 정보:
- 제목: ${context.requestTitle}
- 유형: ${context.requestType}
- 우선순위: ${context.requestPriority}
- 요청자: ${context.requesterName || '알 수 없음'}
- 요청 내용: ${context.requestDescription}

담당자가 이 요청을 처리하는 데 도움을 주세요:
1. 유사 사례 검색 요청 시: 위 요청 내용을 기반으로 과거에 비슷한 요청이 있었을 것으로 가정하고, 어떻게 처리되었을지 예상 답변을 제공
2. 답변 초안 요청 시: 요청자에게 보낼 전문적이고 친근한 답변 초안 작성
3. 처리 계획 요청 시: 단계별 처리 방법과 예상 소요 시간 제안
4. 위험 요소 분석 요청 시: 주의해야 할 사항과 고려점 안내
5. 관련 문서 추천 요청 시: 참고할 만한 가이드 추천
6. 최적 해결책 요청 시: 장단점을 포함한 해결책 제안

응답은 담당자가 바로 활용할 수 있도록 구체적이고 실용적으로 작성하세요.
한국어로 응답하세요.`
}

export async function POST(request: NextRequest) {
  try {
    // 인증 확인
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
    }

    const body = await request.json()
    const { message, messages, context } = body

    if (!message) {
      return NextResponse.json({ error: '메시지가 필요합니다.' }, { status: 400 })
    }

    // 담당자 워크스페이스 모드 확인
    const isManagerMode = context?.type === 'manager_workspace'

    // Gemini API 호출
    const geminiApiKey = process.env.GEMINI_API_KEY

    if (!geminiApiKey) {
      // API 키가 없으면 더미 응답
      if (isManagerMode) {
        return NextResponse.json(generateManagerDummyResponse(message, context))
      }
      return NextResponse.json(generateDummyResponse(message, messages))
    }

    const genAI = new GoogleGenerativeAI(geminiApiKey)
    const model = genAI.getGenerativeModel({ model: 'gemini-3-flash-preview' })

    // 시스템 프롬프트 선택
    const systemPrompt = isManagerMode
      ? getManagerSystemPrompt(context)
      : REQUESTER_SYSTEM_PROMPT

    // 대화 기록을 Gemini 형식으로 변환
    const chatHistory = messages.slice(-10).map((m: { role: string; content: string }) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }))

    const chat = model.startChat({
      history: chatHistory,
      systemInstruction: {
        role: 'user',
        parts: [{ text: systemPrompt }],
      },
    })

    const result = await chat.sendMessage(message)
    const aiContent = result.response.text()

    // JSON 파싱 시도
    try {
      // JSON 블록 추출 시도
      const jsonMatch = aiContent.match(/```json\s*([\s\S]*?)```/) || 
                        aiContent.match(/\{[\s\S]*"content"[\s\S]*\}/)
      
      if (jsonMatch) {
        const jsonStr = jsonMatch[1] || jsonMatch[0]
        const parsed = JSON.parse(jsonStr.trim())
        return NextResponse.json(parsed)
      }
      
      // 전체가 JSON인 경우
      const parsed = JSON.parse(aiContent)
      return NextResponse.json(parsed)
    } catch {
      // JSON이 아닌 경우 텍스트로 반환
      return NextResponse.json({
        content: aiContent,
      })
    }
  } catch (error) {
    console.error('Chat API error:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

// Gemini API 키가 없을 때 사용하는 더미 응답 생성
function generateDummyResponse(message: string, messages: Array<{ role: string; content: string }>) {
  const messageCount = messages?.length || 0

  // 키워드 기반 간단한 분석
  const keywords = {
    systems: ['급여', 'ERP', '포탈', '메신저', '문서', 'EDMS', '인사', '회계', '그룹웨어'],
    types: {
      bug: ['오류', '에러', '안됨', '안 됨', '버그', '문제'],
      improvement: ['개선', '수정', '변경', '확장'],
      feature: ['추가', '새로운', '기능'],
    },
  }

  let detectedSystem = ''
  let detectedType: 'feature' | 'improvement' | 'bug' | 'other' = 'other'

  // 시스템 감지
  for (const sys of keywords.systems) {
    if (message.includes(sys)) {
      detectedSystem = sys.includes('급여') || sys.includes('인사') ? '인사/급여 시스템' : sys + ' 시스템'
      break
    }
  }

  // 유형 감지
  for (const [type, words] of Object.entries(keywords.types)) {
    if (words.some((w) => message.includes(w))) {
      detectedType = type as 'feature' | 'improvement' | 'bug'
      break
    }
  }

  // 대화 단계에 따른 응답
  if (messageCount < 2) {
    return {
      content: `안녕하세요! IT 서비스 요구사항 접수를 도와드리겠습니다.\n\n말씀하신 내용을 분석해볼게요.\n\n${
        detectedSystem 
          ? `"${detectedSystem}"에 관한 요청으로 보입니다.` 
          : '어떤 시스템에 관한 요청인지 알려주시겠어요?'
      }\n\n좀 더 구체적으로 어떤 개선이나 기능이 필요하신지 설명해주시면 요구사항을 정리해드릴게요.`,
    }
  }

  if (messageCount < 4) {
    return {
      content: `네, 이해했습니다.\n\n몇 가지 더 확인드릴게요:\n- 이 기능이 필요한 구체적인 상황이 있으신가요?\n- 현재는 이 작업을 어떻게 처리하고 계신가요?\n- 급한 정도는 어느 정도인가요?`,
    }
  }

  // 충분한 대화 후 요구사항 카드 생성
  const allContent = messages.map((m: { content: string }) => m.content).join(' ')
  const title = message.length > 50 ? message.slice(0, 50) + '...' : message

  return {
    content: `요구사항을 분석했습니다! 아래 내용을 확인해주세요.\n\n수정이 필요하시면 카드에서 직접 수정하실 수 있습니다. 내용이 맞다면 하단의 "요구사항 확정" 버튼을 눌러주세요.`,
    metadata: {
      requirementCard: {
        system: detectedSystem || '미지정',
        module: '미지정',
        type: detectedType,
        title: title,
        description: allContent.slice(0, 500),
      },
    },
  }
}

// 담당자 워크스페이스용 더미 응답 생성
function generateManagerDummyResponse(
  message: string,
  context: {
    requestTitle: string
    requestDescription: string
    requestType: string
    requestPriority: string
    requesterName?: string
  }
) {
  const lowerMessage = message.toLowerCase()

  // 유사 사례 검색
  if (lowerMessage.includes('유사') || lowerMessage.includes('사례') || lowerMessage.includes('과거')) {
    return {
      content: `**"${context.requestTitle}"와 유사한 과거 사례 분석**

해당 요청 내용을 분석한 결과, 다음과 같은 유사 사례를 참고하실 수 있습니다:

📋 **유사 사례 1**: 동일 시스템 관련 ${context.requestType === 'bug_fix' ? '버그 수정' : '기능 개선'} 요청
- 처리 방법: 담당 개발자와 협의 후 패치 적용
- 소요 시간: 약 2-3일
- 결과: 정상 처리 완료

📋 **유사 사례 2**: 비슷한 요청 유형
- 처리 방법: 요청자와 추가 협의 후 범위 조정
- 소요 시간: 약 1주일
- 결과: 요청자 만족

💡 **권장 처리 방안**:
1. 요청 내용의 범위를 명확히 정의
2. 영향도 분석 후 일정 산정
3. 요청자에게 처리 계획 안내

이 정보를 바탕으로 처리를 진행하시면 됩니다.`,
    }
  }

  // 답변 초안
  if (lowerMessage.includes('답변') || lowerMessage.includes('초안')) {
    return {
      content: `**요청자에게 보낼 답변 초안**

---

${context.requesterName || '고객'}님, 안녕하세요.

요청하신 "${context.requestTitle}" 건에 대해 확인하였습니다.

현재 담당자가 해당 요청을 검토 중에 있으며, 빠른 시일 내에 처리할 수 있도록 하겠습니다.

처리 진행 상황은 시스템을 통해 확인하실 수 있으며, 추가 문의사항이 있으시면 언제든 말씀해 주세요.

감사합니다.

---

위 초안을 필요에 따라 수정하여 사용하세요.`,
    }
  }

  // 처리 계획
  if (lowerMessage.includes('계획') || lowerMessage.includes('단계')) {
    return {
      content: `**"${context.requestTitle}" 처리 계획**

📌 **1단계: 요청 분석** (1일)
- 요청 내용 상세 검토
- 영향도 분석
- 필요 리소스 파악

📌 **2단계: 설계 및 개발** (2-3일)
- 수정/개발 범위 확정
- 코드 수정 또는 설정 변경
- 단위 테스트 수행

📌 **3단계: 테스트** (1일)
- 통합 테스트
- 사용자 테스트 (필요시)

📌 **4단계: 배포 및 완료** (1일)
- 운영 환경 적용
- 요청자 확인 및 완료 처리

⏱️ **예상 총 소요 시간**: 약 5-6일

우선순위가 "${context.requestPriority}"이므로 일정을 조정하실 수 있습니다.`,
    }
  }

  // 위험 요소
  if (lowerMessage.includes('위험') || lowerMessage.includes('주의')) {
    return {
      content: `**"${context.requestTitle}" 처리 시 주의사항**

⚠️ **주의 사항**:
1. 다른 기능에 영향을 줄 수 있으므로 영향도 분석 필수
2. 변경 전 백업 수행 권장
3. 운영 시간 외 배포 고려

🔍 **확인 필요 사항**:
- 요청 내용의 정확한 범위 확인
- 관련 담당자와 사전 협의
- 테스트 시나리오 준비

이 사항들을 고려하여 처리를 진행하세요.`,
    }
  }

  // 기본 응답
  return {
    content: `**"${context.requestTitle}" 요청 분석**

요청 정보:
- 유형: ${context.requestType}
- 우선순위: ${context.requestPriority}
- 요청자: ${context.requesterName || '알 수 없음'}

요청 내용:
${context.requestDescription}

---

이 요청에 대해 어떤 도움이 필요하신가요?
- 유사 사례를 찾아볼까요?
- 답변 초안을 작성해 드릴까요?
- 처리 계획을 세워 드릴까요?`,
  }
}
