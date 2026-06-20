/** @type {import('tailwindcss').Config} */

// 🖤 2026-06-19 (대표 — "아예 흑백. 기능 빨강만 유지"): 모든 브랜드/장식 색조를 동일 명도의
//   그레이로 치환(파일 수정 0, 가역 — 이 블록만 지우면 원복). 소스 클래스명(blue-500 등)은
//   그대로라 대비 회귀 0 + 테마검사 영향 0. 유일 예외 = `red`(에러/삭제/마감임박/안읽음 = 기능 신호).
//   값 = Tailwind gray 스케일 hex(동일 shade = 동일 명도).
const MONO = {
  50: '#f9fafb', 100: '#f3f4f6', 200: '#e5e7eb', 300: '#d1d5db', 400: '#9ca3af',
  500: '#6b7280', 600: '#4b5563', 700: '#374151', 800: '#1f2937', 900: '#111827', 950: '#030712',
}

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
        // 🖤 전 색조 → 모노 그레이. `red` 만 제외(기능 빨강). gray/slate/zinc/stone/neutral 은 이미 중립.
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
