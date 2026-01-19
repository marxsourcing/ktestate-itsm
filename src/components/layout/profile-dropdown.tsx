'use client'

import Link from 'next/link'
import Image from 'next/image'
import { User, Settings, Bell, LogOut } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { logout } from '@/app/login/actions'

interface ProfileDropdownProps {
  user: {
    email: string
    fullName: string | null
    role: string
    avatarUrl: string | null
  }
}

export function ProfileDropdown({ user }: ProfileDropdownProps) {
  const initials = (user.fullName || user.email || '?')[0].toUpperCase()
  
  const roleLabel = {
    admin: '관리자',
    manager: '담당자',
    requester: '요청자',
  }[user.role] || '사용자'

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-2 rounded-full p-1 hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20">
          {user.avatarUrl ? (
            <Image
              src={user.avatarUrl}
              alt={user.fullName || '프로필'}
              width={32}
              height={32}
              className="size-8 rounded-full object-cover"
            />
          ) : (
            <div className="flex size-8 items-center justify-center rounded-full bg-linear-to-br from-primary/80 to-primary text-sm font-medium text-white">
              {initials}
            </div>
          )}
          <span className="hidden sm:inline text-sm text-gray-700 max-w-[100px] truncate">
            {user.fullName || user.email?.split('@')[0]}
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" sideOffset={8}>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{user.fullName || '사용자'}</p>
            <p className="text-xs text-muted-foreground">{user.email}</p>
            <span className="inline-flex w-fit items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary mt-1">
              {roleLabel}
            </span>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem asChild>
            <Link href="/profile" className="cursor-pointer">
              <User className="mr-2 size-4" />
              <span>내 프로필</span>
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/profile/notifications" className="cursor-pointer">
              <Bell className="mr-2 size-4" />
              <span>알림 설정</span>
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/profile/settings" className="cursor-pointer">
              <Settings className="mr-2 size-4" />
              <span>계정 설정</span>
            </Link>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <form action={logout} className="w-full">
            <button type="submit" className="flex w-full items-center text-destructive cursor-pointer">
              <LogOut className="mr-2 size-4" />
              <span>로그아웃</span>
            </button>
          </form>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

