import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

const SYSTEM_PROMPT = `당신은 KT Estate의 IT 서비스 요구사항 접수를 도와주는 AI 어시스턴트입니다.

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

export async function POST(request: NextRequest) {
  try {
    // 인증 확인
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
    }

    const body = await request.json()
    const { message, messages } = body

    if (!message) {
      return NextResponse.json({ error: '메시지가 필요합니다.' }, { status: 400 })
    }

    // Gemini API 호출
    const geminiApiKey = process.env.GEMINI_API_KEY

    if (!geminiApiKey) {
      // API 키가 없으면 더미 응답
      return NextResponse.json(generateDummyResponse(message, messages))
    }

    const genAI = new GoogleGenerativeAI(geminiApiKey)
    const model = genAI.getGenerativeModel({ model: 'gemini-3-flash-preview' })

    // 대화 기록을 Gemini 형식으로 변환
    const chatHistory = messages.slice(-10).map((m: { role: string; content: string }) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }))

    const chat = model.startChat({
      history: chatHistory,
      systemInstruction: SYSTEM_PROMPT,
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
