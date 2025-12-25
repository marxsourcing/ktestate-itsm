'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { Menu, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ChatLayoutProps {
  sidebar: React.ReactNode
  children: React.ReactNode
  actionBar?: React.ReactNode
}

export function ChatLayout({ sidebar, children, actionBar }: ChatLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true)

  return (
    <div className="flex h-[calc(100vh-3.5rem)] overflow-hidden bg-gray-50">
      {/* Mobile sidebar toggle */}
      <Button
        variant="ghost"
        size="icon-sm"
        className="fixed left-4 top-[4.25rem] z-50 md:hidden text-gray-600 hover:text-gray-900 hover:bg-gray-200"
        onClick={() => setSidebarOpen(!sidebarOpen)}
      >
        {sidebarOpen ? <X className="size-5" /> : <Menu className="size-5" />}
      </Button>

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-[3.5rem] left-0 z-40 w-[280px] flex-shrink-0 transform transition-transform duration-200 ease-in-out md:relative md:inset-y-0 md:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
          'bg-white border-r border-gray-200'
        )}
      >
        <div className="flex h-full flex-col">{sidebar}</div>
      </aside>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/20 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main content area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Chat area */}
        <main className="flex-1 overflow-y-auto">{children}</main>

        {/* Action bar */}
        {actionBar && (
          <div className="border-t border-gray-200 bg-white px-4 py-3">
            {actionBar}
          </div>
        )}
      </div>
    </div>
  )
}
