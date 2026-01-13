import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

const MANAGER_SYSTEM_PROMPT = `당신은 KT Estate의 IT 서비스 담당자를 위한 AI 협업 어시스턴트입니다.

담당자가 서비스 요청을 처리하는 데 도움을 주세요:
1. 유사 사례 검색 요청 시: 과거에 비슷한 요청이 있었을 것으로 가정하고, 어떻게 처리되었을지 예상 답변 제공
2. 답변 초안 요청 시: 요청자에게 보낼 전문적이고 친근한 답변 초안 작성
3. 처리 계획 요청 시: 단계별 처리 방법과 예상 소요 시간 제안
4. 위험 요소 분석 요청 시: 주의해야 할 사항과 고려점 안내
5. 관련 문서 추천 요청 시: 참고할 만한 가이드 추천
6. 최적 해결책 요청 시: 장단점을 포함한 해결책 제안

응답은 담당자가 바로 활용할 수 있도록 구체적이고 실용적으로 작성하세요.
한국어로 응답하세요.`

interface ManagerChatRequest {
  requestId: string
  message: string
  requestContext?: {
    title: string
    description: string
    type: string
    priority: string
    requesterName?: string
    systemName?: string
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
    }

    // 담당자/관리자 권한 확인
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || !['manager', 'admin'].includes(profile.role)) {
      return NextResponse.json({ error: '담당자 권한이 필요합니다.' }, { status: 403 })
    }

    const body: ManagerChatRequest = await request.json()
    const { requestId, message, requestContext } = body

    if (!requestId || !message) {
      return NextResponse.json({ error: '요청 ID와 메시지가 필요합니다.' }, { status: 400 })
    }

    // 해당 요청에 대한 기존 대화 조회 또는 생성
    let { data: conversation } = await supabase
      .from('manager_conversations')
      .select('id')
      .eq('request_id', requestId)
      .eq('manager_id', user.id)
      .maybeSingle()

    if (!conversation) {
      // 새 대화 생성
      const { data: newConversation, error: createError } = await supabase
        .from('manager_conversations')
        .insert({
          request_id: requestId,
          manager_id: user.id,
          title: requestContext?.title || 'AI 협업 채팅'
        })
        .select('id')
        .single()

      if (createError) {
        console.error('Conversation create error:', createError)
        return NextResponse.json({ error: '대화 생성 실패' }, { status: 500 })
      }
      conversation = newConversation
    }

    // 기존 메시지 조회 (최근 20개)
    const { data: existingMessages } = await supabase
      .from('manager_messages')
      .select('role, content')
      .eq('conversation_id', conversation.id)
      .order('created_at', { ascending: true })
      .limit(20)

    // 사용자 메시지 저장
    const { error: userMsgError } = await supabase
      .from('manager_messages')
      .insert({
        conversation_id: conversation.id,
        role: 'user',
        content: message
      })

    if (userMsgError) {
      console.error('User message save error:', userMsgError)
    }

    // 요청 컨텍스트가 있으면 시스템 프롬프트에 추가
    let contextPrompt = MANAGER_SYSTEM_PROMPT
    if (requestContext) {
      contextPrompt += `\n\n현재 처리 중인 서비스 요청 정보:
- 제목: ${requestContext.title}
- 유형: ${requestContext.type}
- 우선순위: ${requestContext.priority}
- 요청자: ${requestContext.requesterName || '알 수 없음'}
- 시스템: ${requestContext.systemName || '미지정'}
- 요청 내용: ${requestContext.description}`
    }

    // Gemini API 호출
    const geminiApiKey = process.env.GEMINI_API_KEY

    let aiContent: string

    if (!geminiApiKey) {
      // API 키가 없으면 더미 응답
      aiContent = generateDummyResponse(message, requestContext)
    } else {
      const genAI = new GoogleGenerativeAI(geminiApiKey)
      const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })

      // 대화 기록을 Gemini 형식으로 변환
      const chatHistory = (existingMessages || []).map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }))

      const chat = model.startChat({
        history: chatHistory,
        systemInstruction: {
          role: 'user',
          parts: [{ text: contextPrompt }],
        },
      })

      const result = await chat.sendMessage(message)
      aiContent = result.response.text()
    }

    // AI 응답 저장
    const { error: aiMsgError } = await supabase
      .from('manager_messages')
      .insert({
        conversation_id: conversation.id,
        role: 'assistant',
        content: aiContent
      })

    if (aiMsgError) {
      console.error('AI message save error:', aiMsgError)
    }

    return NextResponse.json({
      content: aiContent,
      conversationId: conversation.id
    })

  } catch (error) {
    console.error('Manager chat API error:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

// 대화 내역 조회 API
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const requestId = searchParams.get('requestId')

    if (!requestId) {
      return NextResponse.json({ error: '요청 ID가 필요합니다.' }, { status: 400 })
    }

    // 해당 요청에 대한 담당자의 대화 조회
    const { data: conversation } = await supabase
      .from('manager_conversations')
      .select('id')
      .eq('request_id', requestId)
      .eq('manager_id', user.id)
      .maybeSingle()

    if (!conversation) {
      return NextResponse.json({ messages: [] })
    }

    // 메시지 조회
    const { data: messages, error } = await supabase
      .from('manager_messages')
      .select('id, role, content, created_at')
      .eq('conversation_id', conversation.id)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('Messages fetch error:', error)
      return NextResponse.json({ error: '메시지 조회 실패' }, { status: 500 })
    }

    return NextResponse.json({ messages: messages || [] })

  } catch (error) {
    console.error('Manager chat GET error:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

// 더미 응답 생성
function generateDummyResponse(
  message: string,
  context?: {
    title: string
    description: string
    type: string
    priority: string
    requesterName?: string
  }
) {
  const lowerMessage = message.toLowerCase()
  const title = context?.title || '요청'

  if (lowerMessage.includes('유사') || lowerMessage.includes('사례') || lowerMessage.includes('과거')) {
    return `**"${title}"와 유사한 과거 사례 분석**

해당 요청 내용을 분석한 결과, 다음과 같은 유사 사례를 참고하실 수 있습니다:

📋 **유사 사례 1**: 동일 시스템 관련 ${context?.type === 'bug_fix' ? '버그 수정' : '기능 개선'} 요청
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
3. 요청자에게 처리 계획 안내`
  }

  if (lowerMessage.includes('답변') || lowerMessage.includes('초안')) {
    return `**요청자에게 보낼 답변 초안**

---

${context?.requesterName || '고객'}님, 안녕하세요.

요청하신 "${title}" 건에 대해 확인하였습니다.

현재 담당자가 해당 요청을 검토 중에 있으며, 빠른 시일 내에 처리할 수 있도록 하겠습니다.

처리 진행 상황은 시스템을 통해 확인하실 수 있으며, 추가 문의사항이 있으시면 언제든 말씀해 주세요.

감사합니다.

---

위 초안을 필요에 따라 수정하여 사용하세요.`
  }

  if (lowerMessage.includes('계획') || lowerMessage.includes('단계')) {
    return `**"${title}" 처리 계획**

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

⏱️ **예상 총 소요 시간**: 약 5-6일`
  }

  if (lowerMessage.includes('위험') || lowerMessage.includes('주의')) {
    return `**"${title}" 처리 시 주의사항**

⚠️ **주의 사항**:
1. 다른 기능에 영향을 줄 수 있으므로 영향도 분석 필수
2. 변경 전 백업 수행 권장
3. 운영 시간 외 배포 고려

🔍 **확인 필요 사항**:
- 요청 내용의 정확한 범위 확인
- 관련 담당자와 사전 협의
- 테스트 시나리오 준비

이 사항들을 고려하여 처리를 진행하세요.`
  }

  return `안녕하세요! "${title}" 요청에 대해 어떤 도움이 필요하신가요?

다음과 같은 도움을 드릴 수 있습니다:
- **유사 사례 검색**: "유사 사례 찾아줘"
- **답변 초안 작성**: "답변 초안 작성해줘"
- **처리 계획 수립**: "처리 계획 세워줘"
- **위험 요소 분석**: "주의사항 알려줘"

원하시는 내용을 말씀해주세요!`
}
