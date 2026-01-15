import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

// SR 분류 체계 (DB request_categories_lv1, request_categories_lv2 기반)
const SR_CATEGORY_REFERENCE = `
SR 분류 체계 (반드시 이 목록에서 선택):

1. 개발요청: 성능개선, 시스템개선, 업무개선, 타 시스템 개선
2. 서비스 문의: 개발사전검토요청, 단순 문의, 사용법 문의, 서비스이상신고
3. 데이터요청: 데이터검증, 데이터변경, 데이터제공, 회계감사데이터요청
4. 업무지원: preConsultion, 사용자교육, 작업지원요청, 회의요청
5. infra작업: 보안변경, 인프라변경, 장애조치
6. IT보안매체: USB디스크, 외장하드
7. 배포관리: 배포요청
8. 배치/IF: 삭제, 수정, 신규
9. 보고관리: 성과보고, 월간보고, 이슈보고, 주간보고
10. 산출물관리: 산출물작성
11. 점검 및 모니터링: data 정합성검증, IF 모니터링, 배치 모니터링, 시스템 점검, 조근 점검
12. 방화벽 요청서: 방화벽 요청서
13. 장비 반입 반출확인서: 장비 반입 반출확인서
14. 작업계획 보고서: 작업계획 보고서
15. 작업 완료보고: 작업 완료보고
16. 장애 보고서: 장애 보고서
17. 보안 솔루션 점검: 보안 솔루션 점검
18. 클라우드 백업 점검: 클라우드 백업 점검
19. 침입차단시스템 점검: 침입차단시스템 점검
20. 협력사 현황 점검: 협력사 현황 점검
21. 시스템 보안점검: 시스템 보안점검
22. 신규 장비 보안점검: 신규 장비 보안점검
23. 침해 사고 대응 결과 보고서: 침해 사고 대응 결과 보고서
`

const REQUESTER_SYSTEM_PROMPT = `당신은 KT Estate의 IT 서비스 요구사항 접수를 도와주는 AI 어시스턴트입니다.

사용자의 요구사항을 대화를 통해 파악하세요.

대화를 통해 부족한 정보를 자연스럽게 물어보세요. 예를 들어:
- "현재 어떤 문제가 있으신가요?"
- "구체적으로 어떤 기능이 필요하신가요?"
- "지금은 이 작업을 어떻게 처리하고 계신가요?"
- "이 기능이 있으면 어떻게 달라질까요?"

주의: 시스템, 모듈, 분류에 대해서는 질문하지 마세요. 대화 내용을 바탕으로 AI가 자동으로 추론합니다.

충분한 정보가 모이면, 요구사항 카드를 생성하세요.

분류 참조 (내부용):
${SR_CATEGORY_REFERENCE}

응답 형식:
{
  "content": "사용자에게 보여줄 메시지",
  "metadata": {
    "requirementCard": {
      "system": "시스템명 또는 미지정",
      "module": "모듈명 또는 미지정",
      "category_lv1": "대분류 (위 분류 체계에서 선택)",
      "category_lv2": "소분류 (해당 대분류의 소분류에서 선택)",
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
  requestPriority: string
  requesterName?: string
  category_lv1_name?: string
  category_lv2_name?: string
}) {
  const categoryDisplay = context.category_lv1_name
    ? (context.category_lv2_name ? `${context.category_lv1_name} / ${context.category_lv2_name}` : context.category_lv1_name)
    : '미지정'

  return `당신은 KT Estate의 IT 서비스 담당자를 위한 AI 협업 어시스턴트입니다.

현재 처리 중인 서비스 요청 정보:
- 제목: ${context.requestTitle}
- SR 구분: ${categoryDisplay}
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

  // 키워드 기반 분류 매핑 (DB 분류 체계 기반)
  const categoryKeywords: Record<string, { keywords: string[]; subCategories: Record<string, string[]> }> = {
    '개발요청': {
      keywords: ['추가', '새로운', '기능', '개선', '수정', '변경', '확장', '개발', '구현'],
      subCategories: {
        '업무개선': ['업무', '프로세스', '워크플로우', '자동화'],
        '시스템개선': ['시스템', 'UI', '화면', '인터페이스'],
        '성능개선': ['성능', '속도', '느림', '최적화'],
        '타 시스템 개선': ['연동', '인터페이스', '연계'],
      },
    },
    '서비스 문의': {
      keywords: ['오류', '에러', '안됨', '안 됨', '버그', '문제', '사용법', '방법', '질문', '문의'],
      subCategories: {
        '서비스이상신고': ['오류', '에러', '버그', '안됨', '안 됨', '장애', '문제'],
        '사용법 문의': ['사용법', '방법', '어떻게', '사용'],
        '단순 문의': ['문의', '질문', '확인'],
        '개발사전검토요청': ['검토', '사전', '리뷰'],
      },
    },
    '데이터요청': {
      keywords: ['데이터', '추출', 'DB', '조회', '리포트', '통계'],
      subCategories: {
        '데이터제공': ['제공', '추출', '전달', '리포트'],
        '데이터변경': ['변경', '수정', '업데이트', '삭제'],
        '데이터검증': ['검증', '확인', '체크'],
        '회계감사데이터요청': ['감사', '회계', '재무'],
      },
    },
    '업무지원': {
      keywords: ['지원', '교육', '회의', '도움', '협조'],
      subCategories: {
        '작업지원요청': ['지원', '작업', '협조', '도움'],
        '사용자교육': ['교육', '트레이닝', '학습'],
        '회의요청': ['회의', '미팅', '협의'],
        'preConsultion': ['컨설팅', '상담', '자문'],
      },
    },
    'infra작업': {
      keywords: ['인프라', '서버', 'VPN', '네트워크', '보안', '장애'],
      subCategories: {
        '인프라변경': ['서버', '인프라', '구성', '설정'],
        '보안변경': ['보안', '방화벽', '접근'],
        '장애조치': ['장애', '복구', '긴급'],
      },
    },
    'IT보안매체': {
      keywords: ['USB', '외장하드', '저장매체', '보안매체'],
      subCategories: {
        'USB디스크': ['USB', '메모리'],
        '외장하드': ['외장하드', '하드디스크'],
      },
    },
    '점검 및 모니터링': {
      keywords: ['점검', '모니터링', '체크', '확인', '정기'],
      subCategories: {
        '시스템 점검': ['시스템', '서버'],
        '배치 모니터링': ['배치', '스케줄'],
        'IF 모니터링': ['IF', '인터페이스', '연동'],
        'data 정합성검증': ['데이터', '정합성'],
        '조근 점검': ['조근', '출근'],
      },
    },
    '배포관리': {
      keywords: ['배포', '릴리즈', '운영반영'],
      subCategories: { '배포요청': ['배포', '릴리즈', '반영'] },
    },
    '배치/IF': {
      keywords: ['배치', '인터페이스', 'IF', '스케줄'],
      subCategories: {
        '신규': ['신규', '새로운', '추가'],
        '수정': ['수정', '변경'],
        '삭제': ['삭제', '제거'],
      },
    },
    '보고관리': {
      keywords: ['보고', '리포트', '보고서'],
      subCategories: {
        '주간보고': ['주간'],
        '월간보고': ['월간'],
        '이슈보고': ['이슈'],
        '성과보고': ['성과'],
      },
    },
    '산출물관리': {
      keywords: ['산출물', '문서', '작성'],
      subCategories: { '산출물작성': ['산출물', '문서'] },
    },
  }

  // 시스템 키워드
  const systemKeywords = ['급여', 'ERP', '포탈', '메신저', '문서', 'EDMS', '인사', '회계', '그룹웨어']

  let detectedSystem = ''
  let detectedCategoryLv1 = '서비스 문의'
  let detectedCategoryLv2 = '단순 문의'

  // 시스템 감지
  for (const sys of systemKeywords) {
    if (message.includes(sys)) {
      detectedSystem = sys.includes('급여') || sys.includes('인사') ? '인사/급여 시스템' : sys + ' 시스템'
      break
    }
  }

  // 분류 감지 (키워드 매칭)
  const lowerMessage = message.toLowerCase()
  for (const [categoryLv1, config] of Object.entries(categoryKeywords)) {
    if (config.keywords.some((kw) => lowerMessage.includes(kw.toLowerCase()))) {
      detectedCategoryLv1 = categoryLv1
      // 소분류 결정
      for (const [subCat, subKeywords] of Object.entries(config.subCategories)) {
        if (subKeywords.some((kw) => lowerMessage.includes(kw.toLowerCase()))) {
          detectedCategoryLv2 = subCat
          break
        }
      }
      // 소분류 못 찾으면 첫 번째 소분류 사용
      if (!detectedCategoryLv2 || detectedCategoryLv2 === '단순 문의') {
        detectedCategoryLv2 = Object.keys(config.subCategories)[0]
      }
      break
    }
  }

  // 대화 단계에 따른 응답 (시스템/분류 질문 없이 내용만 질문)
  if (messageCount < 2) {
    return {
      content: `안녕하세요! IT 서비스 요구사항 접수를 도와드리겠습니다.\n\n말씀하신 내용을 분석해볼게요.\n\n좀 더 구체적으로 어떤 상황인지, 어떤 개선이나 기능이 필요하신지 설명해주시면 요구사항을 정리해드릴게요.`,
    }
  }

  if (messageCount < 4) {
    return {
      content: `네, 이해했습니다.\n\n몇 가지 더 확인드릴게요:\n- 이 기능이 필요한 구체적인 상황이 있으신가요?\n- 현재는 이 작업을 어떻게 처리하고 계신가요?`,
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
        category_lv1: detectedCategoryLv1,
        category_lv2: detectedCategoryLv2,
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
    requestPriority: string
    requesterName?: string
    category_lv1_name?: string
    category_lv2_name?: string
  }
) {
  const lowerMessage = message.toLowerCase()
  const categoryDisplay = context.category_lv1_name
    ? (context.category_lv2_name ? `${context.category_lv1_name} / ${context.category_lv2_name}` : context.category_lv1_name)
    : '일반'

  // 유사 사례 검색
  if (lowerMessage.includes('유사') || lowerMessage.includes('사례') || lowerMessage.includes('과거')) {
    return {
      content: `**"${context.requestTitle}"와 유사한 과거 사례 분석**

해당 요청 내용을 분석한 결과, 다음과 같은 유사 사례를 참고하실 수 있습니다:

📋 **유사 사례 1**: 동일 시스템 관련 [${categoryDisplay}] 요청
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
- SR 구분: ${categoryDisplay}
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
