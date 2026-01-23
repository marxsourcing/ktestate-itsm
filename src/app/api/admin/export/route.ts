import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  exportToExcel,
  exportToExcelMultiSheet,
  ExportColumn,
  SheetData,
  STATUS_LABELS,
  PRIORITY_LABELS,
  CONVERSATION_STATUS_LABELS,
} from '@/lib/utils/excel-export'

// 요청 데이터 타입
interface RequestData {
  id: string
  title: string
  description: string
  status: string
  priority: string
  created_at: string
  updated_at: string
  requester: { full_name: string | null; email: string } | null
  manager: { full_name: string | null; email: string } | null
  system: { name: string } | null
  category_lv1: { name: string } | null
  category_lv2: { name: string } | null
}

// 채팅 데이터 타입
interface ChatData {
  id: string
  title: string
  status: string
  created_at: string
  updated_at: string
  user: { full_name: string | null; email: string } | null
  request: {
    id: string
    title: string
    status: string
    category_lv1: { name: string } | null
    category_lv2: { name: string } | null
  } | null
  message_count?: number
}

// 메시지 데이터 타입
interface MessageData {
  id: string
  role: string
  content: string
  created_at: string
  conversation_id: string
  conversation_title?: string
  user_name?: string
}

export async function GET(request: NextRequest) {
  const supabase = await createClient()

  // 인증 확인
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 권한 확인
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin' && profile?.role !== 'manager') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const exportType = searchParams.get('type') // 'requests' | 'chats' | 'messages'
  const conversationId = searchParams.get('conversationId')
  const ids = searchParams.get('ids') // 선택된 ID 목록 (콤마 구분)

  // 채팅 필터 파라미터
  const status = searchParams.get('status') || undefined
  const userId = searchParams.get('userId') || undefined
  const startDate = searchParams.get('startDate') || undefined
  const endDate = searchParams.get('endDate') || undefined

  try {
    let buffer: ArrayBuffer
    let filename: string

    switch (exportType) {
      case 'requests':
        const requestIds = ids ? ids.split(',').filter(Boolean) : undefined
        buffer = await exportRequests(supabase, requestIds)
        filename = `서비스요청_${formatDateForFilename()}.xlsx`
        break

      case 'chats':
        const chatIds = ids ? ids.split(',').filter(Boolean) : undefined
        buffer = await exportChats(supabase, { status, userId, startDate, endDate, ids: chatIds })
        filename = `채팅내역_${formatDateForFilename()}.xlsx`
        break

      case 'messages':
        if (!conversationId) {
          return NextResponse.json(
            { error: 'conversationId is required' },
            { status: 400 }
          )
        }
        buffer = await exportMessages(supabase, conversationId)
        filename = `채팅상세_${formatDateForFilename()}.xlsx`
        break

      default:
        return NextResponse.json(
          { error: 'Invalid export type' },
          { status: 400 }
        )
    }

    return new NextResponse(buffer, {
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
      },
    })
  } catch (error) {
    console.error('Export error:', error)
    return NextResponse.json(
      { error: 'Failed to export data' },
      { status: 500 }
    )
  }
}

function formatDateForFilename(): string {
  const now = new Date()
  return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`
}

function formatDateTime(dateString: string): string {
  return new Date(dateString).toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

async function exportRequests(
  supabase: Awaited<ReturnType<typeof createClient>>,
  ids?: string[]
): Promise<ArrayBuffer> {
  let query = supabase
    .from('service_requests')
    .select(
      `
      *,
      requester:profiles!service_requests_requester_id_fkey(full_name, email),
      manager:profiles!service_requests_manager_id_fkey(full_name, email),
      system:systems(name),
      category_lv1:request_categories_lv1(name),
      category_lv2:request_categories_lv2(name)
    `
    )

  // 특정 ID만 내보내기
  if (ids && ids.length > 0) {
    query = query.in('id', ids)
  }

  const { data: requests, error } = await query.order('created_at', { ascending: false })

  if (error) {
    console.error('Export requests error:', error)
  }

  const columns: ExportColumn<RequestData>[] = [
    { header: '상태', accessor: (r) => STATUS_LABELS[r.status] || r.status, width: 10 },
    { header: '제목', accessor: 'title', width: 40 },
    { header: 'SR 구분', accessor: (r) => r.category_lv1?.name || '-', width: 15 },
    { header: 'SR 상세 구분', accessor: (r) => r.category_lv2?.name || '-', width: 15 },
    { header: '우선순위', accessor: (r) => PRIORITY_LABELS[r.priority] || r.priority, width: 10 },
    { header: '요청자', accessor: (r) => r.requester?.full_name || r.requester?.email || '-', width: 15 },
    { header: '담당자', accessor: (r) => r.manager?.full_name || r.manager?.email || '-', width: 15 },
    { header: '시스템', accessor: (r) => r.system?.name || '-', width: 20 },
    { header: '생성일', accessor: (r) => formatDateTime(r.created_at), width: 18 },
    { header: '수정일', accessor: (r) => formatDateTime(r.updated_at), width: 18 },
    { header: '설명', accessor: 'description', width: 50 },
  ]

  return exportToExcel(requests || [], columns, {
    filename: '서비스요청',
    sheetName: '서비스요청',
  })
}

interface ChatFilters {
  status?: string
  userId?: string
  startDate?: string
  endDate?: string
  ids?: string[]
}

// 메시지 내보내기용 플랫 데이터 타입
interface FlatMessageData {
  conversation_title: string
  user_name: string
  role: string
  content: string
  created_at: string
}

async function exportChats(
  supabase: Awaited<ReturnType<typeof createClient>>,
  filters?: ChatFilters
): Promise<ArrayBuffer> {
  let query = supabase
    .from('conversations')
    .select(
      `
      *,
      user:profiles!conversations_user_id_fkey(id, full_name, email),
      request:service_requests(
        id, title, status,
        category_lv1:request_categories_lv1(name),
        category_lv2:request_categories_lv2(name)
      )
    `
    )

  // 특정 ID만 내보내기
  if (filters?.ids && filters.ids.length > 0) {
    query = query.in('id', filters.ids)
  }

  // 필터 적용
  if (filters?.status) {
    query = query.eq('status', filters.status)
  }
  if (filters?.userId) {
    query = query.eq('user_id', filters.userId)
  }
  if (filters?.startDate) {
    query = query.gte('created_at', filters.startDate)
  }
  if (filters?.endDate) {
    query = query.lte('created_at', filters.endDate + 'T23:59:59')
  }

  const { data: conversations } = await query.order('updated_at', { ascending: false })

  // 메시지 조회 (모든 대화의 메시지)
  const conversationIds = conversations?.map((c) => c.id) || []
  const { data: allMessages } = await supabase
    .from('messages')
    .select('*')
    .in('conversation_id', conversationIds)
    .order('created_at', { ascending: true })

  // 메시지 수 계산
  const countMap: Record<string, number> = {}
  allMessages?.forEach((m) => {
    countMap[m.conversation_id] = (countMap[m.conversation_id] || 0) + 1
  })

  // 대화 정보에 메시지 수 추가
  const enrichedConversations =
    conversations?.map((c) => ({
      ...c,
      message_count: countMap[c.id] || 0,
    })) || []

  // 시트 1: 채팅 목록
  const summaryColumns: ExportColumn<ChatData>[] = [
    { header: '상태', accessor: (c) => CONVERSATION_STATUS_LABELS[c.status] || c.status, width: 10 },
    { header: '대화 제목', accessor: 'title', width: 40 },
    { header: '사용자', accessor: (c) => c.user?.full_name || c.user?.email || '-', width: 20 },
    { header: '메시지 수', accessor: 'message_count', width: 10 },
    { header: '연결된 요청', accessor: (c) => c.request?.title || '-', width: 30 },
    { header: '요청 상태', accessor: (c) => (c.request ? STATUS_LABELS[c.request.status] || c.request.status : '-'), width: 10 },
    { header: 'SR 구분', accessor: (c) => c.request?.category_lv1?.name || '-', width: 15 },
    { header: 'SR 상세 구분', accessor: (c) => c.request?.category_lv2?.name || '-', width: 15 },
    { header: '생성일', accessor: (c) => formatDateTime(c.created_at), width: 18 },
    { header: '최종 업데이트', accessor: (c) => formatDateTime(c.updated_at), width: 18 },
  ]

  // 시트 2: 전체 메시지 상세 (모든 대화의 메시지를 하나의 시트에)
  const conversationMap = new Map<string, { title: string; userName: string }>()
  conversations?.forEach((c) => {
    const userData = c.user as { full_name: string | null; email: string } | { full_name: string | null; email: string }[] | null
    const userInfo = Array.isArray(userData) ? userData[0] : userData
    conversationMap.set(c.id, {
      title: c.title,
      userName: userInfo?.full_name || userInfo?.email || '-',
    })
  })

  const flatMessages: FlatMessageData[] = (allMessages || []).map((m) => {
    const convInfo = conversationMap.get(m.conversation_id)
    return {
      conversation_title: convInfo?.title || '',
      user_name: convInfo?.userName || '',
      role: m.role,
      content: m.content,
      created_at: m.created_at,
    }
  })

  const messageColumns: ExportColumn<FlatMessageData>[] = [
    { header: '대화 제목', accessor: 'conversation_title', width: 30 },
    { header: '사용자', accessor: 'user_name', width: 20 },
    { header: '발신자', accessor: (m) => (m.role === 'user' ? '사용자' : m.role === 'assistant' ? 'AI' : '시스템'), width: 10 },
    { header: '내용', accessor: 'content', width: 80 },
    { header: '시간', accessor: (m) => formatDateTime(m.created_at), width: 18 },
  ]

  // 다중 시트 Excel 생성
  const sheets: SheetData[] = [
    {
      name: '채팅목록',
      data: enrichedConversations,
      columns: summaryColumns,
    },
    {
      name: '메시지상세',
      data: flatMessages,
      columns: messageColumns,
    },
  ]

  return exportToExcelMultiSheet(sheets)
}

async function exportMessages(
  supabase: Awaited<ReturnType<typeof createClient>>,
  conversationId: string
): Promise<ArrayBuffer> {
  // 대화 정보 조회
  const { data: conversation } = await supabase
    .from('conversations')
    .select(
      `
      title,
      user:profiles!conversations_user_id_fkey(full_name, email)
    `
    )
    .eq('id', conversationId)
    .single()

  // 메시지 조회
  const { data: messages } = await supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })

  // user가 배열로 반환될 수 있음 - 첫 번째 요소 사용
  const userData = conversation?.user as { full_name: string | null; email: string } | { full_name: string | null; email: string }[] | null
  const userInfo = Array.isArray(userData) ? userData[0] : userData

  const enrichedMessages =
    messages?.map((m) => ({
      ...m,
      conversation_title: conversation?.title || '',
      user_name: userInfo?.full_name || userInfo?.email || '',
    })) || []

  const columns: ExportColumn<MessageData>[] = [
    { header: '대화 제목', accessor: 'conversation_title', width: 30 },
    { header: '사용자', accessor: 'user_name', width: 20 },
    { header: '발신자', accessor: (m) => (m.role === 'user' ? '사용자' : m.role === 'assistant' ? 'AI' : '시스템'), width: 10 },
    { header: '내용', accessor: 'content', width: 80 },
    { header: '시간', accessor: (m) => formatDateTime(m.created_at), width: 18 },
  ]

  return exportToExcel(enrichedMessages, columns, {
    filename: '채팅상세',
    sheetName: '메시지',
  })
}
