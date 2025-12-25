# KT Estate IT 서비스 - 디자인 가이드

> AI 기반 IT 요구사항관리 시스템의 UI/UX 디자인 가이드라인

---

## 브랜드 아이덴티티

### KT 그룹 브랜드 컬러

| 컬러명 | HEX | 용도 |
|--------|-----|------|
| **KT Red** | `#E4002B` | 메인 브랜드 컬러, 주요 CTA 버튼 |
| **KT Black** | `#1A1A1A` | 진한 텍스트 |
| **KT Gray** | `#666666` | 보조 텍스트 |
| **KT Light Gray** | `#F5F5F5` | 배경색 |
| **White** | `#FFFFFF` | 카드 배경, 주요 영역 |

### 확장 팔레트 (라이트 테마)

```css
/* Primary - KT Red 계열 */
--primary-50: #FFF1F2;
--primary-100: #FFE4E6;
--primary-200: #FECDD3;
--primary-300: #FDA4AF;
--primary-400: #FB7185;
--primary-500: #F43F5E;   /* 메인 액센트 */
--primary-600: #E4002B;   /* KT Red - 브랜드 컬러 */
--primary-700: #BE123C;
--primary-800: #9F1239;
--primary-900: #881337;

/* Neutral - 라이트 테마 */
--neutral-50: #FAFAFA;    /* 배경 */
--neutral-100: #F5F5F5;   /* 사이드바 배경 */
--neutral-200: #E5E5E5;   /* 테두리 */
--neutral-300: #D4D4D4;
--neutral-400: #A3A3A3;   /* 비활성 텍스트 */
--neutral-500: #737373;   /* 보조 텍스트 */
--neutral-600: #525252;
--neutral-700: #404040;
--neutral-800: #262626;
--neutral-900: #171717;   /* 메인 텍스트 */

/* Semantic Colors */
--success: #10B981;       /* 완료, 성공 */
--warning: #F59E0B;       /* 경고, 주의 */
--error: #EF4444;         /* 오류, 삭제 */
--info: #3B82F6;          /* 정보, 링크 */
```

---

## 타이포그래피

### 폰트 패밀리

```css
/* 기본 폰트 */
font-family: 'Geist', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;

/* 코드/숫자 */
font-family: 'Geist Mono', 'SF Mono', 'Consolas', monospace;
```

### 폰트 스케일

| 용도 | 크기 | 굵기 | Line Height |
|------|------|------|-------------|
| Display | 48px / 3rem | 700 | 1.1 |
| H1 | 36px / 2.25rem | 700 | 1.2 |
| H2 | 28px / 1.75rem | 600 | 1.3 |
| H3 | 22px / 1.375rem | 600 | 1.4 |
| Body Large | 18px / 1.125rem | 400 | 1.6 |
| Body | 15px / 0.9375rem | 400 | 1.6 |
| Body Small | 14px / 0.875rem | 400 | 1.5 |
| Caption | 12px / 0.75rem | 400 | 1.4 |

---

## 컴포넌트 스타일

### 버튼

```css
/* Primary Button - KT Red */
.btn-primary {
  background: linear-gradient(135deg, #F43F5E 0%, #E4002B 100%);
  color: white;
  border-radius: 12px;
  font-weight: 500;
  box-shadow: 0 4px 14px rgba(228, 0, 43, 0.2);
}

.btn-primary:hover {
  opacity: 0.9;
  box-shadow: 0 6px 20px rgba(228, 0, 43, 0.3);
}

/* Secondary Button */
.btn-secondary {
  background: white;
  color: #374151;
  border: 1px solid #D1D5DB;
  border-radius: 12px;
}

.btn-secondary:hover {
  background: #F9FAFB;
  border-color: #9CA3AF;
}

/* Ghost Button */
.btn-ghost {
  background: transparent;
  color: #6B7280;
}

.btn-ghost:hover {
  background: #F3F4F6;
  color: #111827;
}
```

### 카드

```css
.card {
  background: white;
  border: 1px solid #E5E7EB;
  border-radius: 16px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.card:hover {
  border-color: #FECDD3;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}
```

### 입력 필드

```css
.input {
  background: white;
  border: 1px solid #D1D5DB;
  border-radius: 12px;
  color: #111827;
}

.input:focus {
  border-color: #F43F5E;
  box-shadow: 0 0 0 3px rgba(244, 63, 94, 0.1);
}

.input::placeholder {
  color: #9CA3AF;
}
```

### 뱃지

```css
/* Status Badges */
.badge-requested { background: #DBEAFE; color: #1D4ED8; }
.badge-reviewing { background: #FEF3C7; color: #B45309; }
.badge-processing { background: #FFE4E6; color: #E4002B; }
.badge-completed { background: #D1FAE5; color: #047857; }
.badge-rejected { background: #F3F4F6; color: #6B7280; }

/* Priority Badges */
.badge-urgent { background: #E4002B; color: white; }
.badge-high { background: #FFE4E6; color: #E4002B; }
.badge-medium { background: #FEF3C7; color: #B45309; }
.badge-low { background: #F3F4F6; color: #6B7280; }
```

---

## 레이아웃

### ChatGPT 스타일 레이아웃 (라이트 테마)

```
┌─────────────────────────────────────────────────────────────┐
│ 헤더 (h-14, bg-white, border-b border-gray-200)             │
├────────────────┬────────────────────────────────────────────┤
│                │                                            │
│   사이드바      │        메인 콘텐츠 영역                      │
│   (w-72)       │        (flex-1)                            │
│   bg-white     │        bg-gray-50                          │
│                │                                            │
│  ┌──────────┐ │   ┌──────────────────────────────────┐    │
│  │ 새 대화   │ │   │  채팅/콘텐츠 영역                  │    │
│  ├──────────┤ │   │  (overflow-y-auto)               │    │
│  │ 항목들   │ │   │                                  │    │
│  │ ...      │ │   └──────────────────────────────────┘    │
│  └──────────┘ │   ┌──────────────────────────────────┐    │
│                │   │ 입력창 (sticky bottom)            │    │
│                │   └──────────────────────────────────┘    │
├────────────────┴────────────────────────────────────────────┤
│ 액션바 (선택적, bg-white, border-t border-gray-200)          │
└─────────────────────────────────────────────────────────────┘
```

### 색상 구성

| 영역 | 색상 |
|------|------|
| 헤더 배경 | `white` |
| 사이드바 배경 | `white` |
| 메인 영역 배경 | `gray-50` (#F9FAFB) |
| 카드/입력창 배경 | `white` |
| 테두리 | `gray-200` (#E5E7EB) |
| 메인 텍스트 | `gray-900` (#111827) |
| 보조 텍스트 | `gray-500` (#6B7280) |

### 반응형 브레이크포인트

| 브레이크포인트 | 크기 | 레이아웃 변경 |
|---------------|------|--------------|
| Mobile | < 768px | 사이드바 숨김 (토글), 풀스크린 채팅 |
| Tablet | 768px - 1024px | 좁은 사이드바 (아이콘만) |
| Desktop | > 1024px | 전체 레이아웃 표시 |

---

## 채팅 메시지 스타일

### 사용자 메시지

```css
.user-message {
  background: linear-gradient(135deg, #F43F5E 0%, #E4002B 100%);
  color: white;
  border-radius: 16px;
  padding: 12px 16px;
}
```

### AI 메시지

```css
.ai-message {
  background: white;
  color: #1F2937;
  border: 1px solid #E5E7EB;
  border-radius: 16px;
  padding: 12px 16px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}
```

### AI 아바타

```css
.ai-avatar {
  background: linear-gradient(135deg, #F43F5E 0%, #E4002B 100%);
  border-radius: 50%;
  width: 32px;
  height: 32px;
}
```

---

## 아이콘 & 로고

### KT 로고

```css
.kt-logo {
  background: linear-gradient(135deg, #F43F5E 0%, #E4002B 100%);
  border-radius: 8px;
  font-weight: 700;
  color: white;
}
```

### 사용 아이콘 라이브러리

- **Lucide React**: 일관된 스트로크 스타일
- 크기: `size-4` (16px), `size-5` (20px), `size-6` (24px)
- 색상: 컨텍스트에 맞게 텍스트 색상 상속

---

## 애니메이션 & 트랜지션

### 기본 트랜지션

```css
/* 기본 전환 */
transition: all 150ms ease;

/* 호버 효과 */
transition: all 200ms ease-out;

/* 모달/드로어 */
transition: all 300ms cubic-bezier(0.4, 0, 0.2, 1);
```

### 로딩 상태

```css
/* 타이핑 인디케이터 */
@keyframes bounce {
  0%, 80%, 100% { transform: translateY(0); }
  40% { transform: translateY(-6px); }
}

.typing-dot {
  animation: bounce 1.4s infinite ease-in-out;
}
```

---

## 라이트 테마 CSS 변수

```css
:root {
  /* Background */
  --background: #FAFAFA;
  --background-secondary: #F5F5F5;
  --background-card: #FFFFFF;
  
  /* Foreground */
  --foreground: #111827;
  --foreground-secondary: #6B7280;
  --foreground-muted: #9CA3AF;
  
  /* Border */
  --border: #E5E7EB;
  --border-hover: #D1D5DB;
  
  /* Primary (KT Red) */
  --primary: #E4002B;
  --primary-light: #F43F5E;
  --primary-dark: #BE123C;
  --primary-foreground: #FFFFFF;
  
  /* Accent */
  --accent: #F3F4F6;
  --accent-foreground: #111827;
  
  /* Ring (Focus) */
  --ring: rgba(244, 63, 94, 0.3);
}
```

---

## 접근성 가이드라인

### 색상 대비

- 일반 텍스트: 최소 4.5:1 대비율
- 큰 텍스트 (18px+): 최소 3:1 대비율
- 상호작용 요소: 최소 3:1 대비율

### 포커스 상태

모든 상호작용 요소에 명확한 포커스 링 제공:

```css
*:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px white, 0 0 0 4px #F43F5E;
}
```

---

## CSS 유틸리티 클래스

```css
/* KT Red 그라데이션 배경 */
.kt-gradient {
  background: linear-gradient(135deg, #F43F5E 0%, #E4002B 100%);
}

/* KT Red 그림자 */
.kt-shadow {
  box-shadow: 0 4px 14px rgba(228, 0, 43, 0.2);
}

/* 호버 시 강화된 그림자 */
.kt-shadow-hover:hover {
  box-shadow: 0 6px 20px rgba(228, 0, 43, 0.3);
}
```

---

## 파일 구조

```
src/
├── app/
│   └── globals.css          # 전역 스타일, CSS 변수
├── components/
│   └── ui/                  # shadcn/ui 기반 컴포넌트
│       ├── button.tsx
│       ├── card.tsx
│       ├── input.tsx
│       └── ...
└── lib/
    └── utils.ts             # cn() 헬퍼 함수
```

---

## 참고 자료

- [KT 그룹 브랜드 가이드라인](https://www.kt.com)
- [Tailwind CSS](https://tailwindcss.com)
- [shadcn/ui](https://ui.shadcn.com)
- [Lucide Icons](https://lucide.dev)
