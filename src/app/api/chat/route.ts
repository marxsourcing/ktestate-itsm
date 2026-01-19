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

**중요 규칙:**
1. 제공된 목록에 있는 명칭을 정확하게 사용하세요.
2. 분석 데이터는 반드시 \`\`\`requirement ... \`\`\` 블록 안에 넣으세요.
3. 텍스트 답변에는 {}나 JSON 데이터를 절대 포함하지 마세요.

**시스템/모듈 목록:**
{SYSTEM_MODULE_LIST}

**분류 목록 (대분류: 소분류1, 소분류2...):**
{CATEGORY_LIST}`

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

    const { message, messages } = await request.json()
    const geminiApiKey = process.env.GEMINI_API_KEY
    if (!geminiApiKey) return NextResponse.json({ error: 'API 키 누락' }, { status: 500 })

    const systemModuleList = await getSystemModuleList(supabase)
    const categoryList = await getCategoryList(supabase)
    
    const SYSTEM_PROMPT = BASE_SYSTEM_PROMPT
      .replace('{SYSTEM_MODULE_LIST}', systemModuleList)
      .replace('{CATEGORY_LIST}', categoryList)

    const genAI = new GoogleGenerativeAI(geminiApiKey)
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })

    const chatHistory = messages.slice(-10).map((m: { role: string; content: string }) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }))

    const chat = model.startChat({
      history: chatHistory,
      systemInstruction: { role: 'user', parts: [{ text: SYSTEM_PROMPT }] },
    })

    const result = await chat.sendMessage(message)
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
