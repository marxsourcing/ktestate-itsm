'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { updateNotificationSettings, type NotificationSettings } from '../../actions'
import { Loader2, CheckCircle, FileText, UserCheck, RefreshCw, MessageSquare, CheckCircle2 } from 'lucide-react'

interface NotificationSettingsFormProps {
  initialSettings: NotificationSettings
}

const notificationTypes = [
  {
    key: 'request_created' as const,
    icon: FileText,
    title: '요청 생성',
    description: '새로운 IT 요청이 생성되었을 때',
  },
  {
    key: 'request_assigned' as const,
    icon: UserCheck,
    title: '요청 배정',
    description: '요청이 담당자에게 배정되었을 때',
  },
  {
    key: 'status_changed' as const,
    icon: RefreshCw,
    title: '상태 변경',
    description: '요청의 처리 상태가 변경되었을 때',
  },
  {
    key: 'comment_added' as const,
    icon: MessageSquare,
    title: '댓글 추가',
    description: '요청에 새로운 댓글이 달렸을 때',
  },
  {
    key: 'request_completed' as const,
    icon: CheckCircle2,
    title: '요청 완료',
    description: '요청 처리가 완료되었을 때',
  },
]

export function NotificationSettingsForm({ initialSettings }: NotificationSettingsFormProps) {
  const [settings, setSettings] = useState<NotificationSettings>(initialSettings)
  const [isPending, setIsPending] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  async function handleSave() {
    setIsPending(true)
    setMessage(null)

    const result = await updateNotificationSettings(settings)

    if (result.error) {
      setMessage({ type: 'error', text: result.error })
    } else if (result.success) {
      setMessage({ type: 'success', text: result.success })
    }

    setIsPending(false)
  }

  function toggleSetting(key: keyof NotificationSettings) {
    setSettings((prev) => ({
      ...prev,
      [key]: !prev[key],
    }))
  }

  function toggleAll(enabled: boolean) {
    setSettings({
      request_created: enabled,
      request_assigned: enabled,
      status_changed: enabled,
      comment_added: enabled,
      request_completed: enabled,
    })
  }

  return (
    <div className="space-y-6">
      {/* Quick actions */}
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => toggleAll(true)}
        >
          모두 켜기
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => toggleAll(false)}
        >
          모두 끄기
        </Button>
      </div>

      {/* Settings list */}
      <div className="space-y-1">
        {notificationTypes.map((type) => {
          const Icon = type.icon
          const isEnabled = settings[type.key]

          return (
            <button
              key={type.key}
              type="button"
              onClick={() => toggleSetting(type.key)}
              className="w-full flex items-center gap-4 p-4 rounded-lg hover:bg-gray-50 transition-colors text-left"
            >
              <div className={`flex size-10 items-center justify-center rounded-lg transition-colors ${
                isEnabled ? 'bg-primary/10' : 'bg-gray-100'
              }`}>
                <Icon className={`size-5 transition-colors ${
                  isEnabled ? 'text-primary' : 'text-gray-400'
                }`} />
              </div>
              <div className="flex-1">
                <p className="font-medium text-gray-900">{type.title}</p>
                <p className="text-sm text-gray-500">{type.description}</p>
              </div>
              <div 
                className={`relative w-11 h-6 rounded-full transition-colors ${
                  isEnabled ? 'bg-primary' : 'bg-gray-200'
                }`}
              >
                <div 
                  className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                    isEnabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </div>
            </button>
          )
        })}
      </div>

      {message && (
        <div
          className={`flex items-center gap-2 rounded-lg px-4 py-3 text-sm ${
            message.type === 'success'
              ? 'bg-green-50 text-green-700 border border-green-200'
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}
        >
          {message.type === 'success' && <CheckCircle className="size-4" />}
          {message.text}
        </div>
      )}

      <div className="flex justify-end pt-4 border-t border-gray-100">
        <Button onClick={handleSave} disabled={isPending} className="min-w-[120px]">
          {isPending ? (
            <>
              <Loader2 className="size-4 mr-2 animate-spin" />
              저장 중...
            </>
          ) : (
            '설정 저장'
          )}
        </Button>
      </div>
    </div>
  )
}

