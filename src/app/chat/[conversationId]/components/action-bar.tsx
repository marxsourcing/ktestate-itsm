'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { CheckCircle, Loader2, AlertCircle } from 'lucide-react'
import { confirmRequirement } from '@/app/chat/actions'
import { createClient } from '@/lib/supabase/client'

interface ActionBarProps {
  conversationId: string
}

export function ActionBar({ conversationId }: ActionBarProps) {
  const router = useRouter()
  const [isConfirming, setIsConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleConfirm() {
    setIsConfirming(true)
    setError(null)

    try {
      const supabase = createClient()

      // 대화에서 마지막 요구사항 카드 찾기
      const { data: messages } = await supabase
        .from('messages')
        .select('metadata')
        .eq('conversation_id', conversationId)
        .not('metadata', 'is', null)
        .order('created_at', { ascending: false })
        .limit(10)

      const requirementCard = messages?.find(
        (m) => m.metadata?.requirementCard
      )?.metadata?.requirementCard

      if (!requirementCard || !requirementCard.title) {
        setError('요구사항 정보가 충분하지 않습니다. AI와 대화를 더 진행해주세요.')
        return
      }

      const result = await confirmRequirement(conversationId, {
        title: requirementCard.title,
        description: requirementCard.description || '',
        system: requirementCard.system,
        module: requirementCard.module,
        category_lv1: requirementCard.category_lv1,
        category_lv2: requirementCard.category_lv2,
      })

      if (result.error) {
        setError(result.error)
        return
      }

      // 요청 현황 페이지로 이동
      router.push(`/requests/${result.request.id}`)
    } catch (err) {
      setError('요구사항 확정 중 오류가 발생했습니다.')
      console.error(err)
    } finally {
      setIsConfirming(false)
    }
  }

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2 text-sm">
        {error && (
          <>
            <AlertCircle className="size-4 text-red-500" />
            <span className="text-red-600">{error}</span>
          </>
        )}
      </div>
      <Button
        onClick={handleConfirm}
        disabled={isConfirming}
        className="kt-gradient kt-shadow hover:opacity-90 text-white gap-2"
      >
        {isConfirming ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <CheckCircle className="size-4" />
        )}
        요구사항 확정
      </Button>
    </div>
  )
}
