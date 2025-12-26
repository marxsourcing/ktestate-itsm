'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import Image from 'next/image'
import { ChatInput } from '@/components/chat/chat-input'
import { createConversation } from '@/app/chat/actions'

export function EmptyChatArea() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  async function handleSend(message: string) {
    startTransition(async () => {
      // 새 대화 생성
      const result = await createConversation()
      if (result.id) {
        // 새 대화 페이지로 이동하고 첫 메시지 전송
        router.push(`/chat/${result.id}?message=${encodeURIComponent(message)}`)
      }
    })
  }

  return (
    <div className="flex h-full flex-col">
      {/* Empty state - centered */}
      <div className="flex flex-1 flex-col items-center justify-center px-4">
        <div className="max-w-md text-center">
          {/* KT Logo */}
          <div className="mb-6 flex justify-center">
            <Image 
              src="/img/kt_logo.png" 
              alt="KT Logo" 
              width={64} 
              height={64}
              className="object-contain"
            />
          </div>
          <h2 className="mb-3 text-2xl font-semibold text-gray-900">
            무엇을 도와드릴까요?
          </h2>
          <p className="text-gray-500 leading-relaxed">
            IT 시스템에 대한 요구사항이나 개선 사항을 자유롭게 말씀해주세요.
            <br />
            AI가 분석하여 요구사항을 정리해 드립니다.
          </p>
          <div className="mt-8 grid gap-3 text-left">
            {[
              '급여명세서 조회 기간을 전년도까지 확장해주세요',
              'ERP 시스템에서 엑셀 다운로드가 안 됩니다',
              '사내 포탈에 공지사항 알림 기능을 추가해주세요',
            ].map((example, i) => (
              <button
                key={i}
                onClick={() => handleSend(example)}
                disabled={isPending}
                className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-600 hover:bg-gray-50 hover:text-gray-900 hover:border-gray-300 cursor-pointer transition-colors text-left disabled:opacity-50 shadow-sm"
              >
                &ldquo;{example}&rdquo;
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Input at bottom */}
      <ChatInput 
        onSend={handleSend} 
        isLoading={isPending}
        placeholder="IT 시스템에 대한 요구사항을 입력하세요..."
      />
    </div>
  )
}
