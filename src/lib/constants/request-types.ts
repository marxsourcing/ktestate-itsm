// 요청 유형 (sr_type ENUM)
export const REQUEST_TYPES = {
  feature_add: '기능추가',
  feature_improve: '기능개선',
  bug_fix: '버그수정',
  other: '기타',
} as const

export type RequestType = keyof typeof REQUEST_TYPES

// 요청 상태 (sr_status ENUM) - 12개 상태 체계
// 코드: 00-draft, 10-requested, 20-approved, 25-consulting, 30-accepted,
//       40-processing, 50-test_requested, 55-test_completed, 60-deploy_requested,
//       70-deploy_approved, 80-completed, 99-rejected
export const REQUEST_STATUS = {
  draft: '작성중',
  requested: '요청',
  approved: '승인',
  consulting: '실무협의검토',
  accepted: '접수',
  processing: '처리중',
  test_requested: '테스트요청',
  test_completed: '테스트완료',
  deploy_requested: '배포요청',
  deploy_approved: '배포승인',
  completed: '완료',
  rejected: '반려',
} as const

export type RequestStatus = keyof typeof REQUEST_STATUS

// 상태 색상 (UI용)
export const REQUEST_STATUS_COLORS: Record<RequestStatus, { bg: string; text: string; border: string }> = {
  draft: { bg: 'bg-gray-100', text: 'text-gray-600', border: 'border-gray-200' },
  requested: { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-200' },
  approved: { bg: 'bg-sky-100', text: 'text-sky-700', border: 'border-sky-200' },
  consulting: { bg: 'bg-indigo-100', text: 'text-indigo-700', border: 'border-indigo-200' },
  accepted: { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-200' },
  processing: { bg: 'bg-violet-100', text: 'text-violet-700', border: 'border-violet-200' },
  test_requested: { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-200' },
  test_completed: { bg: 'bg-teal-100', text: 'text-teal-700', border: 'border-teal-200' },
  deploy_requested: { bg: 'bg-cyan-100', text: 'text-cyan-700', border: 'border-cyan-200' },
  deploy_approved: { bg: 'bg-lime-100', text: 'text-lime-700', border: 'border-lime-200' },
  completed: { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-200' },
  rejected: { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-200' },
}

// 상태 흐름 정의 (각 상태에서 전환 가능한 다음 상태들)
export const STATUS_TRANSITIONS: Record<RequestStatus, RequestStatus[]> = {
  draft: ['requested'],
  requested: ['approved', 'rejected'],
  approved: ['consulting', 'accepted', 'rejected'],
  consulting: ['accepted', 'rejected'],
  accepted: ['processing', 'rejected'],
  processing: ['test_requested', 'completed', 'rejected'],
  test_requested: ['test_completed', 'processing'],
  test_completed: ['deploy_requested', 'processing'],
  deploy_requested: ['deploy_approved', 'test_completed'],
  deploy_approved: ['completed', 'deploy_requested'],
  completed: [],
  rejected: [],
}

// 상태 그룹 (대시보드/통계용)
export const STATUS_GROUPS = {
  pending: ['draft', 'requested', 'approved', 'consulting'] as RequestStatus[],
  active: ['accepted', 'processing', 'test_requested', 'test_completed', 'deploy_requested', 'deploy_approved'] as RequestStatus[],
  done: ['completed', 'rejected'] as RequestStatus[],
}

// 우선순위 (sr_priority ENUM)
export const REQUEST_PRIORITY = {
  low: '낮음',
  medium: '보통',
  high: '높음',
  urgent: '긴급',
} as const

export type RequestPriority = keyof typeof REQUEST_PRIORITY

// 사용자 역할 (user_role ENUM)
export const USER_ROLES = {
  requester: '요청자',
  manager: '담당자',
  admin: '관리자',
} as const

export type UserRole = keyof typeof USER_ROLES

// 시스템 모듈 타입
export interface SystemModule {
  id: string
  system_id: string
  code: string
  name: string
  primary_manager_id: string | null
  secondary_manager_id: string | null
  is_active: boolean
  sort_order: number
  notify_primary: boolean
  delay_notification: boolean
  created_at: string
  updated_at: string
  // 조인된 데이터
  system?: {
    id: string
    name: string
    code: string
  }
  primary_manager?: {
    id: string
    full_name: string
    email: string
  }
  secondary_manager?: {
    id: string
    full_name: string
    email: string
  }
}
