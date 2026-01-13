import Link from 'next/link'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/server'
import { MessageSquare, LayoutGrid, Briefcase, Settings, BarChart3, ChevronDown, MessagesSquare, Database, Users } from 'lucide-react'
import { NotificationBell } from '@/components/notifications/notification-bell'
import { ProfileDropdown } from './profile-dropdown'
import { AdminMenu } from './admin-menu'

export async function Header() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let profile = null
  if (user) {
    const { data } = await supabase
      .from('profiles')
      .select('role, full_name, avatar_url')
      .eq('id', user.id)
      .single()
    profile = data
  }

  const isManager = profile?.role === 'admin' || profile?.role === 'manager'

  return (
    <header className="sticky top-0 z-50 w-full h-14 border-b border-gray-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
      <div className="flex h-full items-center justify-between px-4">
        {/* Logo */}
        <Link 
          href={user ? '/chat' : '/'} 
          className="flex items-center gap-2.5 font-semibold text-gray-900 hover:opacity-80 transition-opacity"
        >
          <Image 
            src="/img/kt_logo.png" 
            alt="KT Logo" 
            width={32} 
            height={32}
            className="object-contain"
          />
          <span className="hidden sm:inline text-[15px]">estate IT</span>
        </Link>

        {/* Navigation */}
        {user && (
          <nav className="flex items-center gap-1">
            <NavLink href="/chat" icon={<MessageSquare className="size-4" />}>
              AI 채팅
            </NavLink>
            <NavLink href="/requests" icon={<LayoutGrid className="size-4" />}>
              요청 현황
            </NavLink>
            {isManager && (
              <>
                <NavLink href="/workspace" icon={<Briefcase className="size-4" />}>
                  워크스페이스
                </NavLink>
                <NavLink href="/dashboard" icon={<BarChart3 className="size-4" />}>
                  대시보드
                </NavLink>
                <AdminMenu />
              </>
            )}
          </nav>
        )}

        {/* User section */}
        <div className="flex items-center gap-3">
          {user ? (
            <>
              {/* Notification Bell */}
              <NotificationBell />
              
              {/* Profile Dropdown */}
              <ProfileDropdown 
                user={{
                  email: user.email || '',
                  fullName: profile?.full_name || null,
                  role: profile?.role || 'requester',
                  avatarUrl: profile?.avatar_url || null,
                }}
              />
            </>
          ) : (
            <Button variant="ghost" asChild size="sm" className="text-gray-600 hover:text-gray-900">
              <Link href="/login">로그인</Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  )
}

function NavLink({ 
  href, 
  icon, 
  children 
}: { 
  href: string
  icon: React.ReactNode
  children: React.ReactNode 
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:text-gray-900 hover:bg-gray-100"
    >
      {icon}
      <span className="hidden md:inline">{children}</span>
    </Link>
  )
}
