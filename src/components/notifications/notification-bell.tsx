'use client'

import { useState, useEffect, useRef } from 'react'
import { Bell, Check, CheckCheck, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  deleteReadNotifications,
  type NotificationData
} from '@/app/notifications/actions'
import Link from 'next/link'
import { toast } from 'sonner'

const typeIcons: Record<string, string> = {
  request_created: '📝',
  request_assigned: '👤',
  status_changed: '🔄',
  comment_added: '💬',
  request_completed: '✅'
}

export function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false)
  const [notifications, setNotifications] = useState<NotificationData[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // 알림 데이터 로드
  const loadNotifications = async () => {
    setLoading(true)
    const [notifResult, countResult] = await Promise.all([
      getNotifications(20),
      getUnreadCount()
    ])
    
    if (notifResult.notifications) {
      setNotifications(notifResult.notifications)
    }
    if (countResult.count !== undefined) {
      setUnreadCount(countResult.count)
    }
    setLoading(false)
  }

  // 초기 로드 및 실시간 구독
  useEffect(() => {
    loadNotifications()

    // 실시간 구독
    const supabase = createClient()
    
    const setupRealtimeSubscription = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const channel = supabase
        .channel('notifications')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${user.id}`
          },
          (payload) => {
            const newNotification = payload.new as NotificationData
            setNotifications(prev => [newNotification, ...prev])
            setUnreadCount(prev => prev + 1)
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${user.id}`
          },
          (payload) => {
            const updatedNotification = payload.new as NotificationData
            setNotifications(prev => 
              prev.map(n => n.id === updatedNotification.id ? updatedNotification : n)
            )
            if (updatedNotification.is_read) {
              setUnreadCount(prev => Math.max(0, prev - 1))
            }
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'DELETE',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${user.id}`
          },
          (payload) => {
            const deleted = payload.old as NotificationData
            setNotifications(prev => prev.filter(n => n.id !== deleted.id))
            if (!deleted.is_read) {
              setUnreadCount(prev => Math.max(0, prev - 1))
            }
          }
        )
        .subscribe()

      return () => {
        supabase.removeChannel(channel)
      }
    }

    const cleanup = setupRealtimeSubscription()
    return () => {
      cleanup.then(fn => fn?.())
    }
  }, [])

  // 외부 클릭 감지
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleMarkAsRead = async (id: string) => {
    await markAsRead(id)
    setNotifications(prev => prev.map(n => 
      n.id === id ? { ...n, is_read: true } : n
    ))
    setUnreadCount(prev => Math.max(0, prev - 1))
  }

  const handleMarkAllAsRead = async () => {
    await markAllAsRead()
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
    setUnreadCount(0)
  }

  const handleDelete = async (id: string) => {
    const notification = notifications.find(n => n.id === id)
    await deleteNotification(id)
    setNotifications(prev => prev.filter(n => n.id !== id))
    if (notification && !notification.is_read) {
      setUnreadCount(prev => Math.max(0, prev - 1))
    }
  }

  const handleDeleteReadNotifications = async () => {
    const result = await deleteReadNotifications()
    if (result.success) {
      setNotifications(prev => prev.filter(n => !n.is_read))
      toast.success(`읽은 알림 ${result.deletedCount}개가 삭제되었습니다.`)
    }
  }

  // 읽은 알림 개수 계산
  const readCount = notifications.filter(n => n.is_read).length

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    
    const minutes = Math.floor(diff / (1000 * 60))
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))

    if (minutes < 1) return '방금 전'
    if (minutes < 60) return `${minutes}분 전`
    if (hours < 24) return `${hours}시간 전`
    if (days < 7) return `${days}일 전`
    
    return date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <Button
        variant="ghost"
        size="icon"
        className="relative"
        onClick={() => setIsOpen(!isOpen)}
      >
        <Bell className="size-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex size-5 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </Button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 rounded-xl bg-white shadow-lg border border-gray-200 z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
            <h3 className="font-semibold text-gray-900">알림</h3>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleMarkAllAsRead}
                  className="text-xs text-gray-500 hover:text-gray-700 h-7 px-2"
                >
                  <CheckCheck className="size-3.5 mr-1" />
                  모두 읽음
                </Button>
              )}
              {readCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDeleteReadNotifications}
                  className="text-xs text-gray-500 hover:text-red-600 h-7 px-2"
                >
                  <Trash2 className="size-3.5 mr-1" />
                  읽은 알림 삭제
                </Button>
              )}
            </div>
          </div>

          {/* Notifications List */}
          <div className="max-h-96 overflow-y-auto">
            {loading ? (
              <div className="p-4 space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="flex gap-3 animate-pulse">
                    <div className="size-10 bg-gray-200 rounded-full shrink-0"></div>
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                      <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-8 text-center text-gray-400">
                <Bell className="size-12 mx-auto mb-3 opacity-50" />
                <p>알림이 없습니다</p>
              </div>
            ) : (
              <div>
                {notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={cn(
                      'group relative flex items-start gap-3 px-4 py-3 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0',
                      !notification.is_read && 'bg-rose-50/50'
                    )}
                  >
                    {/* Icon */}
                    <div className="shrink-0 text-xl">
                      {typeIcons[notification.type] || '🔔'}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      {notification.link ? (
                        <Link
                          href={notification.link}
                          onClick={() => {
                            if (!notification.is_read) {
                              handleMarkAsRead(notification.id)
                            }
                            setIsOpen(false)
                          }}
                          className="block"
                        >
                          <p className={cn(
                            'text-sm text-gray-900',
                            !notification.is_read && 'font-medium'
                          )}>
                            {notification.title}
                          </p>
                          <p className="text-sm text-gray-500 truncate">
                            {notification.message}
                          </p>
                        </Link>
                      ) : (
                        <>
                          <p className={cn(
                            'text-sm text-gray-900',
                            !notification.is_read && 'font-medium'
                          )}>
                            {notification.title}
                          </p>
                          <p className="text-sm text-gray-500 truncate">
                            {notification.message}
                          </p>
                        </>
                      )}
                      <p className="mt-1 text-xs text-gray-400">
                        {formatTime(notification.created_at)}
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="shrink-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {!notification.is_read && (
                        <button
                          onClick={() => handleMarkAsRead(notification.id)}
                          className="p-1 rounded hover:bg-gray-200 text-gray-400 hover:text-gray-600"
                          title="읽음 처리"
                        >
                          <Check className="size-4" />
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(notification.id)}
                        className="p-1 rounded hover:bg-gray-200 text-gray-400 hover:text-red-500"
                        title="삭제"
                      >
                        <X className="size-4" />
                      </button>
                    </div>

                    {/* Unread indicator */}
                    {!notification.is_read && (
                      <div className="absolute left-1 top-1/2 -translate-y-1/2 size-2 rounded-full bg-rose-500"></div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      )}
    </div>
  )
}

