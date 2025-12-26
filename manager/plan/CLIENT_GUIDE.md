# CLIENT GUIDE: 클라이언트 협업 가이드

> 클라이언트와의 협업 사항을 정리합니다.
> 실제 요청 사항은 [REQUEST_TO_CLIENT.md](./REQUEST_TO_CLIENT.md) 참조

---

## 개발 및 배포 방식

### 개발 환경 (현재)

개발 완료 후 클라이언트가 원하는 환경으로 배포/이관 예정입니다.

| 항목 | 현재 (개발 환경) | 이관 시 |
|------|-----------------|--------|
| DB | 개발용 Supabase | 클라이언트 환경으로 이관 |
| 인증 | 이메일/비밀번호 | SSO 등 추후 협의 |
| 배포 | 개발 서버 (Vercel) | 클라이언트 원하는 환경 |
| AI | Gemini 3 Flash (개발 계정) | 클라이언트 계정으로 전환 |
| 전자결재 | POC 범위 외 | 추후 검토 |

### 클라이언트 제공 필요

| 항목 | 우선순위 | 상태 |
|------|---------|------|
| IT 시스템/모듈 목록 | 🔴 긴급 | ⬜ 대기 |
| 요구사항 분류 체계 확정 | 🔴 긴급 | ⬜ 대기 |
| 기존 요구사항 이력 데이터 | 🟡 중간 | ⬜ 대기 |

**→ 상세 내용은 [REQUEST_TO_CLIENT.md](./REQUEST_TO_CLIENT.md) 참조**

---

## 기술 스택 결정 사항

| 구분 | 선택 | 비고 |
|------|------|------|
| Frontend | Next.js 16 + React 19 | App Router |
| Backend | Supabase (PostgreSQL) | Edge Functions |
| AI | Google Gemini 3 Flash | 최신 추론 모델 |
| 배포 | Vercel | 개발용 → 추후 이관 |
| 스타일 | Tailwind CSS v4 | Radix UI 컴포넌트 |

---

## 환경 변수 설정

개발 환경에서 필요한 환경 변수:

```env
# Supabase (현재 개발 환경 / 이관 시 클라이언트 값으로 교체)
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx
SUPABASE_SERVICE_ROLE_KEY=xxx

# AI (현재 개발 환경 / 이관 시 클라이언트 계정으로 교체)
GEMINI_API_KEY=xxx
```

---

## 마일스톤 일정

| 주차 | 목표 | 클라이언트 데이터 필요 |
|------|------|---------------------|
| Week 1-2 | 기본 UI/인증 구현 | - |
| Week 2-3 | 요구사항 CRUD | 시스템 목록, 분류체계 |
| Week 3-4 | AI 채팅 통합 | - |
| Week 4-5 | 워크플로우/대시보드 | - |
| Week 5-6 | AI 고도화 | 이력 데이터 (선택) |
| Week 6+ | 테스트/이관 | - |

---

## 커뮤니케이션

- 정기 미팅: 주 1회 진행 상황 공유
- 긴급 문의: 이메일 또는 메신저
- 문서 공유: 본 폴더 (`manager/plan/`) 기준

---

## 변경 이력

| 날짜 | 내용 |
|------|------|
| 2024-12-26 | AI 모델 Gemini 3 Flash로 확정, 요청 사항 정리 |
