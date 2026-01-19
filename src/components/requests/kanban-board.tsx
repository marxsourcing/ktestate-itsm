'use client'

import { useState, useMemo } from 'react'
import { cn } from '@/lib/utils'
import { RequestCard } from './request-card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  FileEdit,
  Send,
  ThumbsUp,
  Users,
  ClipboardCheck,
  Loader2,
  TestTube2,
  CheckSquare,
  Rocket,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Search,
  Filter,
} from 'lucide-react'

// 상태별 컬럼 정의 (12개 상태 체계)
const STATUS_COLUMNS = [
  {
    id: 'draft',
    label: '작성중',
    icon: FileEdit,
    gradient: 'from-gray-400 to-gray-500',
    bgColor: 'bg-gray-50',
    borderColor: 'border-gray-200',
  },
  {
    id: 'requested',
    label: '요청',
    icon: Send,
    gradient: 'from-amber-500 to-orange-500',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
  },
  {
    id: 'approved',
    label: '승인',
    icon: ThumbsUp,
    gradient: 'from-sky-500 to-blue-500',
    bgColor: 'bg-sky-50',
    borderColor: 'border-sky-200',
  },
  {
    id: 'consulting',
    label: '실무협의',
    icon: Users,
    gradient: 'from-indigo-500 to-purple-500',
    bgColor: 'bg-indigo-50',
    borderColor: 'border-indigo-200',
  },
  {
    id: 'accepted',
    label: '접수',
    icon: ClipboardCheck,
    gradient: 'from-blue-500 to-cyan-500',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
  },
  {
    id: 'processing',
    label: '처리중',
    icon: Loader2,
    gradient: 'from-violet-500 to-purple-500',
    bgColor: 'bg-violet-50',
    borderColor: 'border-violet-200',
  },
  {
    id: 'test_requested',
    label: '테스트요청',
    icon: TestTube2,
    gradient: 'from-orange-500 to-red-500',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-200',
  },
  {
    id: 'test_completed',
    label: '테스트완료',
    icon: CheckSquare,
    gradient: 'from-teal-500 to-green-500',
    bgColor: 'bg-teal-50',
    borderColor: 'border-teal-200',
  },
  {
    id: 'deploy_requested',
    label: '배포요청',
    icon: Rocket,
    gradient: 'from-cyan-500 to-blue-500',
    bgColor: 'bg-cyan-50',
    borderColor: 'border-cyan-200',
  },
  {
    id: 'deploy_approved',
    label: '배포승인',
    icon: ShieldCheck,
    gradient: 'from-lime-500 to-green-500',
    bgColor: 'bg-lime-50',
    borderColor: 'border-lime-200',
  },
  {
    id: 'completed',
    label: '완료',
    icon: CheckCircle2,
    gradient: 'from-emerald-500 to-green-500',
    bgColor: 'bg-emerald-50',
    borderColor: 'border-emerald-200',
  },
  {
    id: 'rejected',
    label: '반려',
    icon: XCircle,
    gradient: 'from-rose-500 to-red-500',
    bgColor: 'bg-rose-50',
    borderColor: 'border-rose-200',
  },
]

// 요청자용 통합 컬럼 정의 (4단계)
const REQUESTER_COLUMNS = [
  {
    id: 'draft',
    label: '작성중',
    icon: FileEdit,
    gradient: 'from-gray-400 to-gray-500',
    bgColor: 'bg-gray-50',
    borderColor: 'border-gray-200',
    statuses: ['draft', 'draft_chat']
  },
  {
    id: 'in_progress',
    label: '진행중',
    icon: Loader2,
    gradient: 'from-blue-500 to-indigo-500',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    statuses: ['requested', 'approved', 'consulting', 'accepted', 'processing', 'test_requested', 'test_completed', 'deploy_requested', 'deploy_approved']
  },
  {
    id: 'completed',
    label: '완료',
    icon: CheckCircle2,
    gradient: 'from-emerald-500 to-green-500',
    bgColor: 'bg-emerald-50',
    borderColor: 'border-emerald-200',
    statuses: ['completed']
  },
  {
    id: 'rejected',
    label: '반려',
    icon: XCircle,
    gradient: 'from-rose-500 to-red-500',
    bgColor: 'bg-rose-50',
    borderColor: 'border-rose-200',
    statuses: ['rejected']
  },
]

export type Request = {
  id: string
  title: string
  description: string
  status: string
  priority: string
  created_at: string
  completed_at?: string
  requester?: { full_name?: string; email: string }
  manager?: { full_name?: string; email: string } | null
  system?: { name: string } | null
  module?: { name: string } | null
  category_lv1?: { id: string; name: string } | null  // 대분류 (SR 구분)
  category_lv2?: { id: string; name: string } | null  // 소분류 (SR 상세 구분)
  is_chat_draft?: boolean
  comments?: { count: number }[] | any
}

interface KanbanBoardProps {
  requests: Request[]
  isManager: boolean
}

export function KanbanBoard({ requests, isManager }: KanbanBoardProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [priorityFilter, setPriorityFilter] = useState<string>('all')
  const [systemFilter, setSystemFilter] = useState<string>('all')

  // 시스템 목록 추출 (중복 제거)
  const systems = useMemo(() => {
    const s = new Set<string>()
    requests.forEach(r => {
      if (r.system?.name) s.add(r.system.name)
    })
    return Array.from(s).sort()
  }, [requests])

  // 필터링된 요청 목록
  const filteredRequests = useMemo(() => {
    return requests.filter(r => {
      const matchesSearch = 
        r.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.requester?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.requester?.email?.toLowerCase().includes(searchQuery.toLowerCase())
      
      const matchesPriority = priorityFilter === 'all' || r.priority === priorityFilter
      const matchesSystem = systemFilter === 'all' || r.system?.name === systemFilter

      return matchesSearch && matchesPriority && matchesSystem
    })
  }, [requests, searchQuery, priorityFilter, systemFilter])

  const getRequestsByCombinedStatus = (statuses: string[]) => {
    return filteredRequests.filter((r) => statuses.includes(r.status))
  }

  const columns = isManager 
    ? STATUS_COLUMNS.map(col => ({ 
        ...col, 
        statuses: col.id === 'draft' ? ['draft', 'draft_chat'] : [col.id] 
      })) 
    : REQUESTER_COLUMNS

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Filters Area */}
      <div className="flex flex-wrap items-center gap-3 bg-white p-3 rounded-xl border border-gray-200 shadow-sm">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
          <Input
            placeholder="제목, 내용, 요청자 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
        
        <div className="flex items-center gap-2">
          <Filter className="size-4 text-gray-400" />
          <Select value={priorityFilter} onValueChange={setPriorityFilter}>
            <SelectTrigger className="w-[120px] h-9 text-xs">
              <SelectValue placeholder="우선순위" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">모든 우선순위</SelectItem>
              <SelectItem value="urgent">긴급</SelectItem>
              <SelectItem value="high">높음</SelectItem>
              <SelectItem value="medium">보통</SelectItem>
              <SelectItem value="low">낮음</SelectItem>
            </SelectContent>
          </Select>

          <Select value={systemFilter} onValueChange={setSystemFilter}>
            <SelectTrigger className="w-[150px] h-9 text-xs">
              <SelectValue placeholder="시스템" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">모든 시스템</SelectItem>
              {systems.map(system => (
                <SelectItem key={system} value={system}>{system}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {(searchQuery || priorityFilter !== 'all' || systemFilter !== 'all') && (
          <Badge 
            variant="outline" 
            className="text-[10px] text-rose-500 border-rose-100 cursor-pointer hover:bg-rose-50"
            onClick={() => {
              setSearchQuery('')
              setPriorityFilter('all')
              setSystemFilter('all')
            }}
          >
            필터 초기화
          </Badge>
        )}
      </div>

      {/* Kanban Columns */}
      <div className="flex-1 flex gap-2 overflow-x-auto pb-4 px-1 min-h-0">
        {columns.map((column) => {
          const columnRequests = getRequestsByCombinedStatus(column.statuses)
          const Icon = column.icon

          return (
            <div
              key={column.id}
              className={cn(
                'shrink-0 flex flex-col rounded-xl',
                isManager ? 'w-[240px]' : 'flex-1 min-w-[280px]',
                'bg-white border border-gray-200'
              )}
            >
              {/* Column Header */}
              <div className={cn('p-3 rounded-t-xl', column.bgColor)}>
                <div className="flex items-center gap-2">
                  <div className={cn(
                    'w-7 h-7 rounded-lg flex items-center justify-center bg-linear-to-br text-white',
                    column.gradient
                  )}>
                    <Icon className={cn("size-3.5", column.id === 'in_progress' && "animate-spin-slow")} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-800 text-sm truncate">{column.label}</h3>
                  </div>
                  <Badge
                    variant="secondary"
                    className="bg-white/80 text-gray-700 text-xs px-1.5"
                  >
                    {columnRequests.length}
                  </Badge>
                </div>
              </div>

              {/* Column Content */}
              <div className="flex-1 p-2 space-y-2 overflow-y-auto min-h-[200px] max-h-[calc(100vh-320px)]">
                {columnRequests.length === 0 ? (
                  <div className={cn(
                    'flex flex-col items-center justify-center py-6 rounded-lg border-2 border-dashed',
                    column.borderColor
                  )}>
                    <Icon className="size-6 text-gray-300 mb-1" />
                    <p className="text-xs text-gray-400">없음</p>
                  </div>
                ) : (
                  columnRequests.map((request) => (
                    <RequestCard
                      key={request.id}
                      request={request}
                      compact
                      isManager={isManager}
                      showDetailedStatus={!isManager && column.id === 'in_progress'}
                    />
                  ))
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

