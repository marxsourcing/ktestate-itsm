'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Settings, ChevronDown, MessagesSquare, Database, Users, FileSpreadsheet, Boxes, FolderTree, BrainCircuit } from 'lucide-react'
import { cn } from '@/lib/utils'

export function AdminMenu() {
  const pathname = usePathname()
  const isAdminPage = pathname.startsWith('/admin')

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            'flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:text-gray-900 hover:bg-gray-100',
            isAdminPage ? 'text-gray-900 bg-gray-100' : 'text-gray-600'
          )}
        >
          <Settings className="size-4" />
          <span className="hidden md:inline">관리</span>
          <ChevronDown className="size-3" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem asChild>
          <Link href="/admin/chats" className="flex items-center gap-2 cursor-pointer">
            <MessagesSquare className="size-4" />
            채팅 내역 조회
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/admin/requests" className="flex items-center gap-2 cursor-pointer">
            <FileSpreadsheet className="size-4" />
            전체 요청 관리
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/admin/systems" className="flex items-center gap-2 cursor-pointer">
            <Database className="size-4" />
            시스템 관리
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/admin/modules" className="flex items-center gap-2 cursor-pointer">
            <Boxes className="size-4" />
            모듈 관리
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/admin/categories" className="flex items-center gap-2 cursor-pointer">
            <FolderTree className="size-4" />
            분류 관리
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/admin/users" className="flex items-center gap-2 cursor-pointer">
            <Users className="size-4" />
            사용자 관리
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/admin/rag" className="flex items-center gap-2 cursor-pointer">
            <BrainCircuit className="size-4" />
            RAG 관리
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
