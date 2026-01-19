import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

const BASE_SYSTEM_PROMPT = `당신은 KT Estate의 IT 서비스 요구사항 접수를 도와주는 AI 어시스턴트입니다.
... (생략) ...
일반적인 대화는 자연스럽게 하되, 요구사항 카드가 필요할 때만 위 JSON 블록을 포함하세요.`

// 시스템 및 모듈 목록 조회
async function getSystemModuleList(supabase: SupabaseClient) {
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
  for (const mod of modules || []) {
    const list = modulesBySystem.get(mod.system_id) || []
    list.push(mod.name)
    modulesBySystem.set(mod.system_id, list)
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
async function getCategoryList(supabase: SupabaseClient) {
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

    const chatHistory = messages.slice(-10).map((m: { role: string; content: string }) => ({
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
