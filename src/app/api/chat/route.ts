import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

const BASE_SYSTEM_PROMPT = `당신은 KT Estate의 IT 서비스 요구사항 접수를 도와주는 AI 어시스턴트입니다.

사용자의 말을 분석하여 아래 정보를 추출하고, **반드시 응답 마지막에 \`\`\`requirement 형식의 JSON 블록으로 포함**시키세요.

사용자에게는 분석 결과를 제외한 친절한 답변만 제공하세요. 답변 내용에 어떠한 JSON 형식이나 기술적인 메타데이터 구조를 노출하지 마세요. 오직 친절한 안내와 추가 질문만 텍스트로 제공하세요.

**추출할 정보 키 명칭 (JSON 내에서 반드시 이 키를 사용하세요):**
- system: 관련 시스템명 (목록에서 선택)
- module: 관련 모듈명 (목록에서 선택)
- title: 요청 제목 (간결하게 요약)
- description: 요청 상세 내용 (사용자의 말을 정리)
- category_lv1: 대분류 (SR 구분 목록에서 선택)
- category_lv2: 소분류 (SR 상세 구분 목록에서 선택)

**유사 사례 참고 및 RAG 규칙:**
1. 하단에 제공되는 [유사 사례 검색 결과]가 있다면 이를 참고하여 답변하세요.
2. 만약 유사도가 80% 이상인 매우 유사한 사례가 있다면, 해당 사례의 '해결방법'을 바탕으로 사용자에게 즉시 해결책을 제시하세요.
   예: "매우 유사한 사례가 발견되었습니다. 보통 이 문제는 ~하게 해결되었습니다. 혹시 이 방법으로 해결이 가능한지 확인 부탁드립니다."
3. 만약 유사한 사례가 30%~80% 사이라면 "이전에도 비슷한 요청이 있었으며, 당시에는 ~하게 처리되었습니다"와 같이 자연스럽게 언급하여 참고 정보를 제공하세요.
4. 해결책을 제시하더라도, 사용자의 개별적인 상황이 다를 수 있으므로 '요청/문의사항 분석'은 계속 진행하여 정보를 추출하세요.
5. 중복된 요청이 이미 처리 중인 것 같으면 사용자에게 안내하세요.

**대화 유도 및 확정 규칙:**
1. 추출할 필수 정보(시스템, 제목, 내용 등)가 80% 이상 수집되었다고 판단되면, 답변 끝에 "내용이 충분히 정리되었습니다. 우측의 '요구사항 확정' 버튼을 눌러 접수를 완료하시겠습니까?"라는 문구를 포함하여 진행을 유도하세요.
2. 대화가 5회 이상 이어졌음에도 정보가 부족하다면, 사용자에게 구체적인 정보 입력을 정중히 요청하세요.

**중요 규칙:**
1. 제공된 목록에 있는 명칭을 정확하게 사용하세요.
2. 분석 데이터는 반드시 \`\`\`requirement ... \`\`\` 블록 안에 넣으세요.
3. 텍스트 답변에는 {}나 JSON 데이터를 절대 포함하지 마세요.

**시스템/모듈 목록:**
{SYSTEM_MODULE_LIST}

**분류 목록 (대분류: 소분류1, 소분류2...):**
{CATEGORY_LIST}

[유사 사례 검색 결과]
{SIMILAR_CASES}`

// 유사도 계산용 헬퍼 함수
function extractKeywords(text: string): string[] {
  const stopWords = new Set(['의', '가', '이', '은', '들', '는', '좀', '잘', '과', '도', '를', '으로', '에', '와', '한', '하다', '것', '수', '등', '및', '해주세요', '부탁', '드립니다'])
  return text.toLowerCase().replace(/[^\w\sㄱ-ㅎㅏ-ㅣ가-힣]/g, ' ').split(/\s+/).filter(word => word.length >= 2 && !stopWords.has(word))
}

function calculateSimilarity(keywords: string[], targetText: string): number {
  if (keywords.length === 0) return 0
  let matchCount = 0
  const targetLower = targetText.toLowerCase()
  for (const keyword of keywords) {
    if (targetLower.includes(keyword)) matchCount++
  }
  return (matchCount / keywords.length) * 100
}

async function getSimilarCases(supabase: SupabaseClient, message: string) {
  const keywords = extractKeywords(message)
  if (keywords.length === 0) return '없음'

  const { data: requests } = await supabase
    .from('service_requests')
    .select('id, title, description, status, systems:system_id(name)')
    .limit(50)

  const similar = (requests || [])
    .map(req => ({
      ...req,
      similarity: calculateSimilarity(keywords, `${req.title} ${req.description}`)
    }))
    .filter(req => req.similarity >= 30)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 3)

  if (similar.length === 0) return '없음'

  // 각 유사 사례에 대해 최신 댓글(해결 방법) 조회
  const casesWithResolution = await Promise.all(similar.map(async s => {
    const { data: comments } = await supabase
      .from('sr_comments')
      .select('content')
      .eq('request_id', s.id)
      .order('created_at', { ascending: false })
      .limit(1)
    
    const resolution = comments?.[0]?.content || '해결 방법 정보 없음'
    const systemName = (s.systems as { name?: string } | null)?.name || '미지정'
    return `- 제목: ${s.title} (${Math.round(s.similarity)}% 유사)\n  시스템: ${systemName}\n  상태: ${s.status}\n  내용: ${s.description?.slice(0, 100)}...\n  해결방법: ${resolution}`
  }))

  return casesWithResolution.join('\n\n')
}

async function getSystemModuleList(supabase: SupabaseClient) {
  const { data: systems } = await supabase.from('systems').select('id, name').eq('status', 'active')
  const { data: modules } = await supabase.from('system_modules').select('system_id, name').eq('is_active', true)
  
  const modulesBySystem = new Map<string, string[]>()
  for (const mod of modules || []) {
    const list = modulesBySystem.get(mod.system_id) || []
    list.push(mod.name)
    modulesBySystem.set(mod.system_id, list)
  }

  return (systems || []).map(s => `- ${s.name}: ${(modulesBySystem.get(s.id) || []).join(', ')}`).join('\n')
}

async function getCategoryList(supabase: SupabaseClient) {
  const { data: lv1 } = await supabase.from('request_categories_lv1').select('id, name').eq('is_active', true)
  const { data: lv2 } = await supabase.from('request_categories_lv2').select('category_lv1_id, name').eq('is_active', true)
  
  const lv2ByLv1 = new Map<string, string[]>()
  for (const item of lv2 || []) {
    const list = lv2ByLv1.get(item.category_lv1_id) || []
    list.push(item.name)
    lv2ByLv1.set(item.category_lv1_id, list)
  }

  return (lv1 || []).map(l => `- ${l.name}: ${(lv2ByLv1.get(l.id) || []).join(', ')}`).join('\n')
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

    const { message, messages, attachments } = await request.json()
    const geminiApiKey = process.env.GEMINI_API_KEY
    if (!geminiApiKey) return NextResponse.json({ error: 'API 키 누락' }, { status: 500 })

    const systemModuleList = await getSystemModuleList(supabase)
    const categoryList = await getCategoryList(supabase)
    const similarCases = await getSimilarCases(supabase, message || '')
    
    const SYSTEM_PROMPT = BASE_SYSTEM_PROMPT
      .replace('{SYSTEM_MODULE_LIST}', systemModuleList)
      .replace('{CATEGORY_LIST}', categoryList)
      .replace('{SIMILAR_CASES}', similarCases)

    const genAI = new GoogleGenerativeAI(geminiApiKey)
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })

    // 대화 기록에서 첫 번째가 'model'이면 필터링
    const filteredMessages = messages.slice(-10)
    let chatHistory = filteredMessages.map((m: { role: string; content: string }) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }))
    
    // Gemini는 첫 번째 메시지가 user여야 함
    while (chatHistory.length > 0 && chatHistory[0].role === 'model') {
      chatHistory = chatHistory.slice(1)
    }

    // 메시지 파트 구성 (텍스트 + 이미지)
    const messageParts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = []

    // 이미지 첨부파일 처리
    if (attachments && attachments.length > 0) {
      for (const attachment of attachments) {
        if (attachment.file_type?.startsWith('image/') && attachment.url) {
          try {
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
      messageParts.push({ text: '이 이미지를 분석해주세요.' })
    }

    const chat = model.startChat({
      history: chatHistory,
      systemInstruction: { role: 'user', parts: [{ text: SYSTEM_PROMPT }] },
    })

    const result = await chat.sendMessage(messageParts)
    const aiResponse = result.response.text()

    // 데이터 파싱
    const match = aiResponse.match(/```requirement\s*([\s\S]*?)```/)
    let metadata = {}
    let cleanContent = aiResponse

    if (match) {
      try {
        const cardData = JSON.parse(match[1].trim())
        metadata = { requirementCard: cardData }
        // 텍스트에서 JSON 블록 제거
        cleanContent = aiResponse.replace(/```requirement[\s\S]*?```/g, '').trim()
      } catch (e) {
        console.error('JSON Parsing Error:', e)
      }
    }

    return NextResponse.json({ content: cleanContent, metadata })

  } catch (error) {
    console.error('Chat error:', error)
    return NextResponse.json({ error: '서버 오류' }, { status: 500 })
  }
}
