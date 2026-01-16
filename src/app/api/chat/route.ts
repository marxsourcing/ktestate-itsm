import { NextRequest, NextResponse } from 'next/server'
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
async function getSystemModuleList(supabase: any) {
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
async function getCategoryList(supabase: any) {
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
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
    }

    const body = await request.json()
    const { message, messages } = body

    const geminiApiKey = process.env.GEMINI_API_KEY
    if (!geminiApiKey) {
      return NextResponse.json({ error: 'AI API 키가 설정되지 않았습니다.' }, { status: 500 })
    }

    // 최신 시스템/분류 목록 조회
    const systemModuleList = await getSystemModuleList(supabase)
    const categoryList = await getCategoryList(supabase)
    
    const SYSTEM_PROMPT = BASE_SYSTEM_PROMPT
      .replace('{SYSTEM_MODULE_LIST}', systemModuleList)
      .replace('{CATEGORY_LIST}', categoryList)

    const genAI = new GoogleGenerativeAI(geminiApiKey)
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })

    const chatHistory = messages.slice(-10).map((m: any) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }))

    const chat = model.startChat({
      history: chatHistory,
      systemInstruction: {
        role: 'user',
        parts: [{ text: SYSTEM_PROMPT }],
      },
    })

    const result = await chat.sendMessage(message)
    const aiContent = result.response.text()

    // 요구사항 카드 파싱
    const match = aiContent.match(/```requirement\s*([\s\S]*?)```/)
    let metadata = {}
    let cleanContent = aiContent

    if (match) {
      try {
        const cardData = JSON.parse(match[1].trim())
        metadata = { requirementCard: cardData }
        cleanContent = aiContent.replace(/```requirement[\s\S]*?```/g, '').trim()
      } catch (e) {
        console.error('Requirement card parsing error:', e)
      }
    }

    return NextResponse.json({
      content: cleanContent,
      metadata: metadata
    })

  } catch (error) {
    console.error('Chat API error:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
