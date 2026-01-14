import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface RouteContext {
  params: Promise<{ requestId: string }>
}

export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
    }

    const { requestId } = await context.params

    // 댓글 조회 (외부 공개 댓글만)
    const { data: comments, error } = await supabase
      .from('sr_comments')
      .select(`
        id,
        content,
        is_internal,
        created_at,
        author:author_id (
          full_name,
          email
        )
      `)
      .eq('request_id', requestId)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('Comments fetch error:', error)
      return NextResponse.json({ error: '댓글 조회 실패' }, { status: 500 })
    }

    // 댓글 포맷 변환
    const formattedComments = (comments || []).map((comment) => {
      const author = comment.author as unknown as { full_name?: string; email: string } | null
      return {
        id: comment.id,
        content: comment.content,
        is_internal: comment.is_internal,
        created_at: comment.created_at,
        author_name: author?.full_name || author?.email || '알 수 없음'
      }
    })

    return NextResponse.json({ comments: formattedComments })

  } catch (error) {
    console.error('Comments API error:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
