# PROGRESS: 작업 진행 상황

> Cursor는 이 파일을 기준으로 작업한다. 작업 완료 후 반드시 업데이트한다.

---

## 마지막 완료 작업

| 항목 | 내용 |
|------|------|
| 날짜 | 2025-12-26 |
| 모듈 | Phase 6 |
| 작업 | 프로필/사용자 설정 기능 구현 |
| 산출물 | 프로필 페이지, 드롭다운 메뉴, 비밀번호 변경, 알림 설정, 아바타 업로드 |

---

## 현재 TODO

### 🎨 UI 전면 개편: ChatGPT 스타일 AI 채팅 인터페이스

**핵심 컨셉**: 좌측 목록 패널 + 우측 AI 채팅 레이아웃

#### Phase 1: 기반 구조 구축 ✅
- [x] 새 레이아웃 컴포넌트 생성 (ChatLayout)
- [x] 사이드바 컴포넌트 (대화/요청 목록)
- [x] AI 채팅 컴포넌트 (메시지, 입력창)
- [x] 액션바 컴포넌트
- [x] DB: conversations, messages 테이블 생성
- [x] OpenAI API 연동 (더미 응답 포함)

#### Phase 2: 요청자 화면 (`/chat`) ✅
- [x] 대화 목록 CRUD (conversations 테이블)
- [x] AI 채팅 인터페이스 (OpenAI 연동)
- [x] 요구사항 카드 컴포넌트 (채팅 내 표시)
- [x] "요구사항 확정" 워크플로우
- [x] 실시간 스트리밍 응답
- [x] 파일 첨부 기능

#### Phase 3: 요구사항 현황 보드 (`/requests`) ✅
- [x] 칸반 스타일 보드 UI (상태별 5개 컬럼)
- [x] 요청 카드 컴포넌트 (우선순위, 유형, 시간 표시)
- [x] 드래그앤드롭 상태 변경 (관리자)
- [x] 요청 상세 + AI 채팅 화면 (3단 레이아웃)

#### Phase 4: 담당자 워크스페이스 (`/workspace`) ✅
- [x] 배정된 요청 목록 (우선순위 그룹핑)
- [x] AI 협업 채팅 (유사 사례, 답변 초안)
- [x] 처리 워크플로우 (배정, 상태 변경, 완료/반려)

#### Phase 5: 추가 기능 및 고도화 ✅
- [x] 파일 첨부 기능 (Supabase Storage)
- [x] 실시간 스트리밍 응답 (OpenAI)
- [x] 대시보드 (통계, 차트 - Recharts)
- [x] 알림 시스템 (실시간 Supabase Realtime)

#### Phase 6: 프로필/사용자 설정 ✅
- [x] 헤더 프로필 드롭다운 메뉴 (내 프로필/알림설정/계정설정/로그아웃)
- [x] 프로필 페이지 (`/profile`) - 내 정보 조회/수정
- [x] 비밀번호 변경 기능 (`/profile/settings`)
- [x] 알림 설정 기능 (`/profile/notifications`) - 알림 유형별 on/off
- [x] 프로필 이미지(아바타) 변경 - Supabase Storage 연동

#### Phase 7: 향후 작업 (선택)
- [ ] 이메일 알림 (Resend/SendGrid)
- [ ] RAG 기반 유사 사례 검색
- [ ] 전자결재 연동 (클라이언트 API 필요)
- [ ] 모바일 반응형 최적화

---

## 완료 이력

| 날짜 | 모듈 | 작업 내용 |
|------|------|----------|
| 2025-12-26 | Phase 6 | 프로필 기능 구현 (드롭다운 메뉴, 프로필 페이지, 비밀번호 변경, 알림 설정, 아바타) |
| 2025-12-26 | 문서화 | 프로필/내 정보 기능 문서 추가 (기능상세화, 유저플로우, ROADMAP) |
| 2025-12-26 | Phase 5 | 파일 첨부 (Storage), 스트리밍 응답, 대시보드, 알림 시스템 |
| 2025-12-26 | Phase 4 | 담당자 워크스페이스 (/workspace) 구현 |
| 2025-12-26 | Phase 3 | 칸반 보드 UI 및 요청 상세 AI 채팅 연동 |
| 2025-12-26 | UI | ChatGPT 스타일 AI 채팅 레이아웃 및 컴포넌트 구현 |
| 2025-12-26 | DB | conversations, messages 테이블 및 RLS 정책 |
| 2025-12-26 | API | /api/chat AI 응답 API (OpenAI 연동 + 더미 응답) |
| 2025-12-26 | 테마 | 다크 테마 전면 적용 (ChatGPT 스타일) |
| 2025-12-25 | 문서 | ChatGPT 스타일 UI 컨셉 문서화 |
| 2025-12-25 | M05 | SR 처리 이력 및 댓글/메모 기능 |
| 2025-12-25 | M04 | SR 관리 및 상태 변경 워크플로우 |
| 2025-12-25 | M03 | SR 프로세스 기초 설계 및 신청 기능 |
| 2025-12-25 | M02 | IT 시스템 및 자산 관리 기초 |
| 2025-12-25 | M01 | 인증 및 권한 시스템(RBAC) |
| 2025-12-25 | M00 | 프로젝트 셋업 |

---

## 주요 변경사항 (2025-12-26)

### 새로운 파일 구조
```
src/
├── app/
│   ├── chat/
│   │   ├── page.tsx                    # 채팅 메인 (새 대화 시작)
│   │   ├── actions.ts                  # 대화/메시지 Server Actions
│   │   ├── attachments.ts              # 파일 첨부 Server Actions
│   │   └── [conversationId]/
│   │       ├── page.tsx                # 특정 대화 페이지
│   │       └── components/
│   │           ├── chat-area.tsx       # 채팅 영역 (스트리밍)
│   │           └── action-bar.tsx      # 요구사항 확정 버튼
│   ├── requests/
│   │   ├── page.tsx                    # 칸반 보드 (상태별 5개 컬럼)
│   │   └── [id]/
│   │       ├── page.tsx                # 요청 상세 (3단 레이아웃)
│   │       └── components/
│   │           └── request-chat-area.tsx # 요청별 AI 어시스턴트
│   ├── workspace/
│   │   ├── page.tsx                    # 담당자 워크스페이스 메인
│   │   ├── actions.ts                  # 배정/상태변경 Server Actions
│   │   └── components/
│   │       ├── workspace-layout.tsx    # 워크스페이스 레이아웃
│   │       ├── request-list.tsx        # 우선순위별 요청 목록
│   │       └── workspace-request-detail.tsx # 요청 상세 + AI 협업
│   ├── dashboard/
│   │   ├── page.tsx                    # 대시보드 메인
│   │   ├── actions.ts                  # 통계 Server Actions
│   │   └── components/
│   │       ├── dashboard-stats.tsx     # 주요 통계 카드
│   │       ├── requests-chart.tsx      # 요청 추이 차트
│   │       ├── status-distribution.tsx # 상태별 분포 파이차트
│   │       ├── recent-requests.tsx     # 최근 요청 목록
│   │       └── top-systems.tsx         # 시스템별 현황
│   ├── notifications/
│   │   └── actions.ts                  # 알림 Server Actions
│   ├── profile/
│   │   ├── page.tsx                    # 프로필 메인 페이지
│   │   ├── actions.ts                  # 프로필 Server Actions
│   │   ├── components/
│   │   │   ├── profile-form.tsx        # 정보 수정 폼
│   │   │   └── avatar-upload.tsx       # 아바타 업로드
│   │   ├── settings/
│   │   │   ├── page.tsx                # 계정 설정 (비밀번호)
│   │   │   └── components/
│   │   │       └── password-form.tsx   # 비밀번호 변경 폼
│   │   └── notifications/
│   │       ├── page.tsx                # 알림 설정
│   │       └── components/
│   │           └── notification-settings-form.tsx
│   └── api/
│       └── chat/
│           ├── route.ts                # AI 응답 API
│           └── stream/
│               └── route.ts            # AI 스트리밍 응답 API
├── components/
│   ├── chat/
│   │   ├── chat-layout.tsx             # 좌측 사이드바 + 우측 채팅 레이아웃
│   │   ├── conversation-list.tsx       # 대화 목록 (실시간 구독)
│   │   ├── chat-messages.tsx           # 메시지 버블 + 첨부파일
│   │   ├── chat-input.tsx              # 메시지 입력창 + 파일 첨부
│   │   └── requirement-card.tsx        # 요구사항 분석 카드
│   ├── notifications/
│   │   └── notification-bell.tsx       # 알림 벨 (실시간)
│   ├── layout/
│   │   ├── Header.tsx                  # 헤더 (프로필 드롭다운 포함)
│   │   └── profile-dropdown.tsx        # 프로필 드롭다운 메뉴
│   └── requests/
│       ├── kanban-board.tsx            # 칸반 보드 (드래그앤드롭)
│       └── request-card.tsx            # 요청 카드 컴포넌트
```

### 새로운 DB 테이블
- `conversations`: 사용자별 대화 목록
- `messages`: 대화별 메시지 (user/assistant/system)
- `attachments`: 첨부파일 정보 (Storage 연동)
- `notifications`: 실시간 알림

### profiles 테이블 확장 컬럼
- `department`: 소속 부서
- `phone`: 연락처
- `avatar_url`: 프로필 이미지 URL
- `notification_settings`: 알림 설정 (JSONB)

### 새로운 Storage 버킷
- `attachments`: 첨부파일 저장 (50MB 제한, 이미지/문서 허용)
- `avatars`: 프로필 이미지 저장 (5MB 제한, 이미지만 허용)

### 새로운 라우트
- `/chat` - AI 채팅 메인 (로그인 후 기본 페이지)
- `/chat/[conversationId]` - 특정 대화 보기
- `/requests` - 칸반 스타일 요구사항 현황 보드
- `/requests/[id]` - 요청 상세 (정보 + 이력 + AI 채팅)
- `/workspace` - 담당자 워크스페이스 (배정된 요청 + AI 협업)
- `/dashboard` - 관리자 대시보드 (통계, 차트)
- `/profile` - 내 프로필 (정보 조회/수정, 아바타 업로드)
- `/profile/settings` - 계정 설정 (비밀번호 변경)
- `/profile/notifications` - 알림 설정 (유형별 on/off)

---

## 이슈

| 날짜 | 이슈 | 상태 | 해결 |
|------|------|------|------|
| 2025-12-25 | 회원가입 DB 에러 | ✅ | search_path 설정으로 해결 |

---

## 참조

- [ROADMAP.md](./ROADMAP.md) - 전체 개발 방향 및 모듈 상세
- [requirements/](./requirements/) - 요구사항 문서
