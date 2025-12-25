import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/server'
import { MessageSquare, LayoutGrid, Zap, ArrowRight } from 'lucide-react'

export default async function Home() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // 로그인된 사용자는 채팅 페이지로 리다이렉트
  if (user) {
    redirect('/chat')
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-16 bg-gradient-to-b from-white to-gray-50">
      {/* Hero section */}
      <div className="max-w-3xl text-center">
        {/* KT Style Logo */}
        <div className="mb-8 inline-flex size-20 items-center justify-center rounded-3xl kt-gradient shadow-2xl kt-shadow">
          <span className="text-2xl font-bold text-white">KT</span>
        </div>

        <h1 className="mb-4 text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl md:text-6xl">
          AI와 함께하는
          <br />
          <span className="bg-gradient-to-r from-rose-500 to-red-600 bg-clip-text text-transparent">
            IT 서비스 관리
          </span>
        </h1>

        <p className="mx-auto mb-8 max-w-xl text-lg text-gray-600 leading-relaxed">
          자연어로 IT 요구사항을 설명하면 AI가 분석하고 정리해드립니다.
          <br />
          더 빠르고 정확한 IT 서비스 요청을 경험하세요.
        </p>

        <div className="flex flex-col gap-4 sm:flex-row sm:justify-center">
          <Button
            asChild
            size="lg"
            className="kt-gradient kt-shadow hover:opacity-90 text-white font-medium px-8 h-12"
          >
            <Link href="/login">
              시작하기
              <ArrowRight className="ml-2 size-5" />
            </Link>
          </Button>
        </div>
      </div>

      {/* Features */}
      <div className="mt-24 grid max-w-4xl gap-6 sm:grid-cols-3">
        <FeatureCard
          icon={<MessageSquare className="size-6" />}
          title="AI 채팅 접수"
          description="자연어로 요구사항을 설명하면 AI가 자동으로 분류하고 정리합니다."
        />
        <FeatureCard
          icon={<LayoutGrid className="size-6" />}
          title="실시간 현황"
          description="칸반 보드에서 모든 요청의 진행 상황을 한눈에 확인하세요."
        />
        <FeatureCard
          icon={<Zap className="size-6" />}
          title="스마트 처리"
          description="유사 사례 검색과 AI 답변 초안으로 빠른 처리가 가능합니다."
        />
      </div>
    </div>
  )
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode
  title: string
  description: string
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 transition-all hover:border-rose-200 hover:shadow-lg">
      <div className="mb-4 inline-flex size-12 items-center justify-center rounded-xl bg-rose-100 text-rose-600">
        {icon}
      </div>
      <h3 className="mb-2 font-semibold text-gray-900">{title}</h3>
      <p className="text-sm text-gray-600 leading-relaxed">{description}</p>
    </div>
  )
}
