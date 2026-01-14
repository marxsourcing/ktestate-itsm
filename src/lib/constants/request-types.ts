// 요청 유형 (sr_type ENUM)
export const REQUEST_TYPES = {
  feature_add: '기능추가',
  feature_improve: '기능개선',
  bug_fix: '버그수정',
  other: '기타',
} as const

export type RequestType = keyof typeof REQUEST_TYPES

// 요청 상태 (sr_status ENUM)
export const REQUEST_STATUS = {
  requested: '요청',
  reviewing: '검토중',
  processing: '처리중',
  completed: '완료',
  rejected: '반려',
} as const

export type RequestStatus = keyof typeof REQUEST_STATUS

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
