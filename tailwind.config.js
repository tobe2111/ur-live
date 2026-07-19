/** @type {import('tailwindcss').Config} */

// 🖤 2026-06-19 (대표 — "아예 흑백. 기능 빨강만 유지"): 모든 브랜드/장식 색조를 동일 명도의
//   그레이로 치환(파일 수정 0, 가역 — 이 블록만 지우면 원복). 소스 클래스명(blue-500 등)은
//   그대로라 대비 회귀 0 + 테마검사 영향 0. 유일 예외 = `red`(에러/삭제/마감임박/안읽음 = 기능 신호).
//   값 = Tailwind gray 스케일 hex(동일 shade = 동일 명도).
// 🎨 2026-07-19 브랜드 컬러 전면 적용 (대표 개발지시서 — 웜로즈 #E0526B + 딥네이비 잉크 #1A2C42):
//   INK = Tailwind gray 스케일을 "웜 화이트~딥네이비 잉크" 스케일로 리매핑하는 단일 지점.
//   소스 클래스명(text-gray-900 등)은 불변 → 테마 가드(check-theme-consistency) 영향 0, 대비 순서 보존.
//   스펙 앵커: 50=--bg(#FAF7F5 웜화이트) · 200=--line(#EAE4E0) · 400=--ink-faint(#8A8580) ·
//   500=--ink-soft(#5F6B7A 보조텍스트) · 900=--ink(#1A2C42 제목/본문/가격).
//   MONO(과거 흑백 정체성의 16색계열 중화)도 같은 스케일 사용 → 전 장식색이 잉크 계열로 정렬.
const INK = {
  50: '#FAF7F5', 100: '#F3EEEA', 200: '#EAE4E0', 300: '#D8D2CC', 400: '#8A8580',
  500: '#5F6B7A', 600: '#4A576A', 700: '#35455B', 800: '#24364D', 900: '#1A2C42', 950: '#10202F',
}
const MONO = INK

export default {
  // 🛡️ 2026-05-02: 화이트 테마 페이지 사용자 토글 다크 모드 (CLAUDE.md A안).
  //   `dark` 클래스는 useTheme 스토어에서 <html> 에 적용. 시스템 기본값 = system 모드.
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Pretendard', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
      },
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        // 🎨 브랜드 토큰 (2026-07-19 지시서) — 로즈는 "행동과 강조" 10% 이하에만.
        brand: {
          DEFAULT: '#E0526B',  // 웜 로즈 — 주요 행동 버튼·강조·활성
          dark: '#C43D55',     // hover/pressed
          tint: '#FBEDF0',     // 옅은 로즈 배경 — 뱃지·선택됨
        },
        ink: {
          DEFAULT: '#1A2C42',  // 딥네이비 — 제목/본문/가격
          soft: '#5F6B7A',     // 보조 텍스트
          faint: '#8A8580',    // 비활성/플레이스홀더
        },
        surface: '#FFFFFF',
        line: '#EAE4E0',
        warm: '#FAF7F5',       // 페이지 배경(웜 화이트)
        // 🎨 gray → 잉크 스케일 리매핑(위 INK 주석 참조). 클래스명 무변 — 값만 브랜드 정렬.
        gray: INK,
        // 🖤 전 장식 색조 → 잉크 스케일 중화. `red` 만 제외(기능 빨강). (2026-06-19 흑백 결정의 웜 승계)
        pink: MONO, rose: MONO, fuchsia: MONO,
        orange: MONO, amber: MONO, yellow: MONO, lime: MONO,
        green: MONO, emerald: MONO, teal: MONO, cyan: MONO,
        sky: MONO, blue: MONO, indigo: MONO, violet: MONO, purple: MONO,
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
    },
  },
  plugins: [],
};
