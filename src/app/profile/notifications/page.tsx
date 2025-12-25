import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { NotificationSettingsForm } from './components/notification-settings-form'
import { Bell, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export default async function NotificationsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('notification_settings')
    .eq('id', user.id)
    .single()

  const defaultSettings = {
    request_created: true,
    request_assigned: true,
    status_changed: true,
    comment_added: true,
    request_completed: true,
  }

  const settings = profile?.notification_settings || defaultSettings

  return (
    <div className="min-h-screen bg-gray-50/50">
      <div className="container max-w-2xl py-8 px-4">
        {/* Back link */}
        <Link 
          href="/profile" 
          className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 mb-6 transition-colors"
        >
          <ArrowLeft className="size-4" />
          프로필로 돌아가기
        </Link>

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">알림 설정</h1>
          <p className="text-gray-500 mt-1">알림 수신 여부를 설정합니다.</p>
        </div>

        {/* Settings Card */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
              <Bell className="size-5 text-primary" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">알림 유형별 설정</h3>
              <p className="text-sm text-gray-500">각 알림 유형별로 수신 여부를 선택하세요.</p>
            </div>
          </div>
          
          <NotificationSettingsForm initialSettings={settings} />
        </div>
      </div>
    </div>
  )
}

