import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

const BASE_SYSTEM_PROMPT = `당신은 KT Estate의 IT 서비스 요구사항 접수를 도와주는 AI 어시스턴트입니다.

사용자의 요구사항을 분석하여 다음 정보를 파악해야 합니다:
1. 시스템: 어떤 IT 시스템에 관한 요청인가
2. 모듈: 해당 시스템의 어떤 기능/모듈에 관한 것인가
3. 대분류(SR 구분): 요청의 대분류 카테고리
4. 소분류(SR 상세 구분): 대분류 내 세부 분류
5. 제목: 요구사항을 한 줄로 요약
6. 상세 내용: 구체적인 요구사항 설명

대화를 통해 부족한 정보를 자연스럽게 물어보세요.

사용자가 이미지를 첨부하면 이미지 내용을 분석하여 요구사항 파악에 활용하세요. 스크린샷이라면 UI 개선점이나 버그를 파악하고, 문서 이미지라면 요구사항을 추출해주세요.

**중요**: 시스템과 모듈은 반드시 아래 목록에서 선택해야 합니다.

{SYSTEM_MODULE_LIST}

**중요**: 대분류와 소분류는 반드시 아래 목록에서 선택해야 합니다.

{CATEGORY_LIST}

충분한 정보가 모이면, 응답 마지막에 다음 형식의 JSON 블록을 포함하세요:
\`\`\`requirement
{
  "system": "시스템명 (위 목록에서 선택)",
  "module": "모듈명 (위 목록에서 선택)",
  "category_lv1": "대분류명 (위 목록에서 선택)",
  "category_lv2": "소분류명 (위 목록에서 선택, 해당 대분류의 소분류 중 선택)",
  "title": "요구사항 제목",
  "description": "상세 설명"
}
\`\`\`

일반적인 대화는 자연스럽게 하되, 요구사항 카드가 필요할 때만 위 JSON 블록을 포함하세요.`

// 시스템 및 모듈 목록 조회
async function getSystemModuleList(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: systems } = await supabase
    .from('systems')
    .select('id, name, code')
    .eq('status', 'active')
    .order('name')

  const { data: modules } = await supabase
    .from('system_modules')
    .select('id, system_id, name')
    .eq('is_active', true)
    .order('sort_order')

  if (!systems || systems.length === 0) {
    return '시스템 목록을 불러올 수 없습니다.'
  }

  const modulesBySystem = new Map<string, string[]>()
  for (const module of modules || []) {
    const list = modulesBySystem.get(module.system_id) || []
    list.push(module.name)
    modulesBySystem.set(module.system_id, list)
  }

  const lines: string[] = []
  for (const system of systems) {
    const systemModules = modulesBySystem.get(system.id) || []
    if (systemModules.length > 0) {
      lines.push(`- ${system.name}: ${systemModules.join(', ')}`)
    } else {
      lines.push(`- ${system.name}`)
    }
  }

  return lines.join('\n')
}

// 대분류/소분류 목록 조회
async function getCategoryList(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: categoriesLv1 } = await supabase
    .from('request_categories_lv1')
    .select('id, code, name')
    .eq('is_active', true)
    .order('sort_order')

  const { data: categoriesLv2 } = await supabase
    .from('request_categories_lv2')
    .select('id, category_lv1_id, code, name')
    .eq('is_active', true)
    .order('sort_order')

  if (!categoriesLv1 || categoriesLv1.length === 0) {
    return '분류 목록을 불러올 수 없습니다.'
  }

  const lv2ByLv1 = new Map<string, string[]>()
  for (const lv2 of categoriesLv2 || []) {
    const list = lv2ByLv1.get(lv2.category_lv1_id) || []
    list.push(lv2.name)
    lv2ByLv1.set(lv2.category_lv1_id, list)
  }

  const lines: string[] = []
  for (const lv1 of categoriesLv1) {
    const subCategories = lv2ByLv1.get(lv1.id) || []
    if (subCategories.length > 0) {
      lines.push(`- ${lv1.name}: ${subCategories.join(', ')}`)
    } else {
      lines.push(`- ${lv1.name}`)
    }
  }

  return lines.join('\n')
}

export async function POST(request: NextRequest) {
  try {
    // 인증 확인
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return new Response(JSON.stringify({ error: '인증이 필요합니다.' }), { 
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const body = await request.json()
    const { message, messages, attachments } = body

    if (!message && !attachments?.length) {
      return new Response(JSON.stringify({ error: '메시지가 필요합니다.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const geminiApiKey = process.env.GEMINI_API_KEY

    // DB에서 시스템/모듈 목록 및 분류 목록 조회
    const systemModuleList = await getSystemModuleList(supabase)
    const categoryList = await getCategoryList(supabase)
    const SYSTEM_PROMPT = BASE_SYSTEM_PROMPT
      .replace('{SYSTEM_MODULE_LIST}', systemModuleList)
      .replace('{CATEGORY_LIST}', categoryList)

    if (!geminiApiKey) {
      // API 키가 없으면 더미 스트리밍 응답
      return createDummyStreamResponse(message, messages, systemModuleList)
    }

    // Gemini API 호출 (스트리밍)
    const genAI = new GoogleGenerativeAI(geminiApiKey)
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })

    // 대화 기록을 Gemini 형식으로 변환
    const chatHistory = messages.slice(-10).map((m: { role: string; content: string }) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }))

    // 메시지 파트 구성 (텍스트 + 이미지)
    const messageParts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = []

    // 이미지 첨부파일 처리
    if (attachments && attachments.length > 0) {
      for (const attachment of attachments) {
        if (attachment.file_type?.startsWith('image/') && attachment.url) {
          try {
            // 이미지 다운로드 및 base64 변환
            const imageResponse = await fetch(attachment.url)
            if (imageResponse.ok) {
              const imageBuffer = await imageResponse.arrayBuffer()
              const base64Data = Buffer.from(imageBuffer).toString('base64')
              messageParts.push({
                inlineData: {
                  mimeType: attachment.file_type,
                  data: base64Data
                }
              })
            }
          } catch (error) {
            console.error('Failed to fetch image:', error)
          }
        }
      }
    }

    // 텍스트 메시지 추가
    if (message) {
      messageParts.push({ text: message })
    } else if (messageParts.length > 0) {
      // 이미지만 있을 경우 기본 텍스트 추가
      messageParts.push({ text: '이 이미지를 분석해주세요.' })
    }

    const chat = model.startChat({
      history: chatHistory,
      systemInstruction: {
        role: 'user',
        parts: [{ text: SYSTEM_PROMPT }],
      },
    })

    const result = await chat.sendMessageStream(messageParts)

    // 스트림 변환
    const encoder = new TextEncoder()

    const stream = new ReadableStream({
      async start(controller) {
        let fullContent = ''

        try {
          for await (const chunk of result.stream) {
            const text = chunk.text()
            if (text) {
              fullContent += text
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'content', data: text })}\n\n`))
            }
          }

          // 요구사항 카드 파싱
          const metadata = parseRequirementCard(fullContent)
          if (metadata) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'metadata', data: metadata })}\n\n`))
          }
          
          controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        } catch (error) {
          console.error('Stream error:', error)
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', data: '스트리밍 오류가 발생했습니다.' })}\n\n`))
        } finally {
          controller.close()
        }
      }
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })
  } catch (error) {
    console.error('Chat Stream API error:', error)
    return new Response(JSON.stringify({ error: '서버 오류가 발생했습니다.' }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// 요구사항 카드 JSON 파싱
function parseRequirementCard(content: string) {
  const match = content.match(/```requirement\s*([\s\S]*?)```/)
  if (match) {
    try {
      const cardData = JSON.parse(match[1].trim())
      return { requirementCard: cardData }
    } catch (e) {
      console.error('Requirement card parsing error:', e)
    }
  }
  return null
}

// 더미 스트리밍 응답
function createDummyStreamResponse(
  message: string,
  messages: Array<{ role: string; content: string }>,
  systemModuleList: string
) {
  const messageCount = messages?.length || 0

  let response: string
  let metadata: { requirementCard?: Record<string, string> } | null = null

  // DB 시스템 목록에서 시스템명 추출
  const systemNames: string[] = []
  const systemModuleMap: Map<string, string[]> = new Map()

  for (const line of systemModuleList.split('\n')) {
    const match = line.match(/^- (.+?)(?:: (.+))?$/)
    if (match) {
      const systemName = match[1]
      const modules = match[2] ? match[2].split(', ') : []
      systemNames.push(systemName)
      systemModuleMap.set(systemName, modules)
    }
  }

  // 대분류 키워드 매핑 (키워드 → 대분류/소분류)
  const categoryKeywords: Record<string, { lv1: string; lv2: string }> = {
    '오류': { lv1: '서비스 문의', lv2: '서비스이상신고' },
    '에러': { lv1: '서비스 문의', lv2: '서비스이상신고' },
    '안됨': { lv1: '서비스 문의', lv2: '서비스이상신고' },
    '버그': { lv1: '서비스 문의', lv2: '서비스이상신고' },
    '문의': { lv1: '서비스 문의', lv2: '단순 문의' },
    '사용법': { lv1: '서비스 문의', lv2: '사용법 문의' },
    '개선': { lv1: '개발요청', lv2: '시스템개선' },
    '수정': { lv1: '개발요청', lv2: '시스템개선' },
    '추가': { lv1: '개발요청', lv2: '업무개선' },
    '기능': { lv1: '개발요청', lv2: '업무개선' },
    '데이터': { lv1: '데이터요청', lv2: '데이터제공' },
    '배포': { lv1: '배포관리', lv2: '배포요청' },
  }

  let detectedSystem = ''
  let detectedModule = ''
  let detectedCategoryLv1 = '서비스 문의'
  let detectedCategoryLv2 = '단순 문의'

  // 메시지에서 시스템명 매칭
  for (const sysName of systemNames) {
    // 시스템명 또는 괄호 안 코드로 매칭
    const codeMatch = sysName.match(/\(([^)]+)\)/)
    const code = codeMatch ? codeMatch[1] : ''
    const baseName = sysName.replace(/\([^)]+\)/, '').trim()

    if (message.includes(sysName) ||
        message.includes(baseName) ||
        (code && message.toUpperCase().includes(code.toUpperCase()))) {
      detectedSystem = sysName
      // 해당 시스템의 첫 번째 모듈 선택 (기본값)
      const modules = systemModuleMap.get(sysName)
      if (modules && modules.length > 0) {
        detectedModule = modules[0]
      }
      break
    }
  }

  // 대분류/소분류 감지
  for (const [keyword, category] of Object.entries(categoryKeywords)) {
    if (message.includes(keyword)) {
      detectedCategoryLv1 = category.lv1
      detectedCategoryLv2 = category.lv2
      break
    }
  }

  if (messageCount < 2) {
    const systemListStr = systemNames.length > 0
      ? systemNames.slice(0, 5).join(', ') + (systemNames.length > 5 ? ' 등' : '')
      : '시스템 목록'

    response = `안녕하세요! IT 서비스 요구사항 접수를 도와드리겠습니다.\n\n말씀하신 내용을 분석해볼게요.\n\n${
      detectedSystem
        ? `"${detectedSystem}"에 관한 요청으로 보입니다.`
        : `어떤 시스템에 관한 요청인지 알려주시겠어요?\n(예: ${systemListStr})`
    }\n\n좀 더 구체적으로 어떤 개선이나 기능이 필요하신지 설명해주시면 요구사항을 정리해드릴게요.`
  } else if (messageCount < 4) {
    response = `네, 이해했습니다.\n\n몇 가지 더 확인드릴게요:\n- 이 기능이 필요한 구체적인 상황이 있으신가요?\n- 현재는 이 작업을 어떻게 처리하고 계신가요?\n- 급한 정도는 어느 정도인가요?`
  } else {
    const allContent = messages.map((m: { content: string }) => m.content).join(' ')
    const title = message.length > 50 ? message.slice(0, 50) + '...' : message

    response = `요구사항을 분석했습니다! 아래 내용을 확인해주세요.\n\n수정이 필요하시면 카드에서 직접 수정하실 수 있습니다. 내용이 맞다면 하단의 "요구사항 확정" 버튼을 눌러주세요.`
    metadata = {
      requirementCard: {
        system: detectedSystem || (systemNames[0] || '미지정'),
        module: detectedModule || '',
        category_lv1: detectedCategoryLv1,
        category_lv2: detectedCategoryLv2,
        title: title,
        description: allContent.slice(0, 500),
      }
    }
  }

  // 더미 스트리밍 (글자 단위로 전송)
  const encoder = new TextEncoder()
  const chars = response.split('')
  
  const stream = new ReadableStream({
    async start(controller) {
      for (const char of chars) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'content', data: char })}\n\n`))
        await new Promise(resolve => setTimeout(resolve, 20)) // 타이핑 효과
      }
      
      if (metadata) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'metadata', data: metadata })}\n\n`))
      }
      
      controller.enqueue(encoder.encode('data: [DONE]\n\n'))
      controller.close()
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}
