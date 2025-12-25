import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const SYSTEM_PROMPT = `당신은 KT Estate의 IT 서비스 요구사항 접수를 도와주는 AI 어시스턴트입니다.

사용자의 요구사항을 분석하여 다음 정보를 파악해야 합니다:
1. 시스템: 어떤 IT 시스템에 관한 요청인가
2. 모듈: 해당 시스템의 어떤 기능/모듈에 관한 것인가
3. 유형: 기능 추가(feature), 기능 개선(improvement), 버그 수정(bug), 기타(other) 중 하나
4. 제목: 요구사항을 한 줄로 요약
5. 상세 내용: 구체적인 요구사항 설명

대화를 통해 부족한 정보를 자연스럽게 물어보세요.

충분한 정보가 모이면, 응답 마지막에 다음 형식의 JSON 블록을 포함하세요:
\`\`\`requirement
{
  "system": "시스템명",
  "module": "모듈명",
  "type": "feature|improvement|bug|other",
  "title": "요구사항 제목",
  "description": "상세 설명"
}
\`\`\`

일반적인 대화는 자연스럽게 하되, 요구사항 카드가 필요할 때만 위 JSON 블록을 포함하세요.`

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

    const openaiApiKey = process.env.OPENAI_API_KEY

    if (!openaiApiKey) {
      // API 키가 없으면 더미 스트리밍 응답
      return createDummyStreamResponse(message, messages)
    }

    // 첨부파일 정보를 메시지에 추가
    let userMessage = message
    if (attachments && attachments.length > 0) {
      const fileInfo = attachments.map((a: { file_name: string; file_type: string }) => 
        `[첨부: ${a.file_name} (${a.file_type})]`
      ).join('\n')
      userMessage = `${fileInfo}\n\n${message}`
    }

    // OpenAI API 호출 (스트리밍)
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        stream: true,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          ...messages.slice(-10).map((m: { role: string; content: string }) => ({
            role: m.role,
            content: m.content,
          })),
          { role: 'user', content: userMessage }
        ],
        temperature: 0.7,
        max_tokens: 1000,
      }),
    })

    if (!response.ok) {
      console.error('OpenAI API error:', await response.text())
      return createDummyStreamResponse(message, messages)
    }

    // 스트림 변환
    const encoder = new TextEncoder()
    const decoder = new TextDecoder()

    const stream = new ReadableStream({
      async start(controller) {
        const reader = response.body?.getReader()
        if (!reader) {
          controller.close()
          return
        }

        let buffer = ''
        let fullContent = ''

        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break

            buffer += decoder.decode(value, { stream: true })
            const lines = buffer.split('\n')
            buffer = lines.pop() || ''

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6)
                if (data === '[DONE]') {
                  // 요구사항 카드 파싱
                  const metadata = parseRequirementCard(fullContent)
                  if (metadata) {
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'metadata', data: metadata })}\n\n`))
                  }
                  controller.enqueue(encoder.encode('data: [DONE]\n\n'))
                  continue
                }

                try {
                  const parsed = JSON.parse(data)
                  const content = parsed.choices?.[0]?.delta?.content || ''
                  if (content) {
                    fullContent += content
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'content', data: content })}\n\n`))
                  }
                } catch (e) {
                  // JSON 파싱 실패 무시
                }
              }
            }
          }
        } finally {
          reader.releaseLock()
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
function createDummyStreamResponse(message: string, messages: Array<{ role: string; content: string }>) {
  const messageCount = messages?.length || 0
  
  let response: string
  let metadata: { requirementCard?: Record<string, string> } | null = null

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
  let detectedType = 'other'

  for (const sys of keywords.systems) {
    if (message.includes(sys)) {
      detectedSystem = sys.includes('급여') || sys.includes('인사') ? '인사/급여 시스템' : sys + ' 시스템'
      break
    }
  }

  for (const [type, words] of Object.entries(keywords.types)) {
    if (words.some((w) => message.includes(w))) {
      detectedType = type
      break
    }
  }

  if (messageCount < 2) {
    response = `안녕하세요! IT 서비스 요구사항 접수를 도와드리겠습니다.\n\n말씀하신 내용을 분석해볼게요.\n\n${
      detectedSystem 
        ? `"${detectedSystem}"에 관한 요청으로 보입니다.` 
        : '어떤 시스템에 관한 요청인지 알려주시겠어요?'
    }\n\n좀 더 구체적으로 어떤 개선이나 기능이 필요하신지 설명해주시면 요구사항을 정리해드릴게요.`
  } else if (messageCount < 4) {
    response = `네, 이해했습니다.\n\n몇 가지 더 확인드릴게요:\n- 이 기능이 필요한 구체적인 상황이 있으신가요?\n- 현재는 이 작업을 어떻게 처리하고 계신가요?\n- 급한 정도는 어느 정도인가요?`
  } else {
    const allContent = messages.map((m: { content: string }) => m.content).join(' ')
    const title = message.length > 50 ? message.slice(0, 50) + '...' : message

    response = `요구사항을 분석했습니다! 아래 내용을 확인해주세요.\n\n수정이 필요하시면 카드에서 직접 수정하실 수 있습니다. 내용이 맞다면 하단의 "요구사항 확정" 버튼을 눌러주세요.`
    metadata = {
      requirementCard: {
        system: detectedSystem || '미지정',
        module: '미지정',
        type: detectedType,
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

