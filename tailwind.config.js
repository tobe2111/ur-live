/** @type {import('tailwindcss').Config} */

// 🖤 2026-06-19 (대표 — "아예 흑백. 기능 빨강만 유지"): 모든 브랜드/장식 색조를 동일 명도의
//   그레이로 치환(파일 수정 0, 가역 — 이 블록만 지우면 원복). 소스 클래스명(blue-500 등)은
//   그대로라 대비 회귀 0 + 테마검사 영향 0. 유일 예외 = `red`(에러/삭제/마감임박/안읽음 = 기능 신호).
//   값 = Tailwind gray 스케일 hex(동일 shade = 동일 명도).
// 🎨 2026-07-19 브랜드 컬러 전면 적용 (대표 개발지시서 — 웜로즈 #1C69EF + 잉크):
// 🖤 2026-08-30 (대표 "완전 검정이면 좋겠어") — 잉크의 딥네이비(#1A2C42)를 **차콜 블랙 #16181C** 로.
//   그 값은 대표가 8/23 에 홈 색면으로 직접 고른 것이고, 이제 색면과 글자가 같은 검정을 쓴다.
//   500~950 의 파랑기를 뺀 중성 램프로 함께 옮겼다(명도 순서·대비 순서는 그대로 승계).
//   INK = Tailwind gray 스케일을 "웜 화이트~잉크 블랙" 스케일로 리매핑하는 단일 지점.
//   소스 클래스명(text-gray-900 등)은 불변 → 테마 가드(check-theme-consistency) 영향 0, 대비 순서 보존.
//   스펙 앵커: 50=--bg(#F8F7FC 웜화이트) · 200=--line(#EAE4E0) · 400=--ink-faint(#8A8580) ·
//   500=--ink-soft(#6E6B68 보조텍스트) · 900=--ink(#16181C 제목/본문/가격 = --home-field 와 동일).
//   MONO(과거 흑백 정체성의 16색계열 중화)도 같은 스케일 사용 → 전 장식색이 잉크 계열로 정렬.
const INK = {
  50: '#F8F7FC', 100: '#F3EEEA', 200: '#EAE4E0', 300: '#D8D2CC', 400: '#8A8580',
  500: '#6E6B68', 600: '#55534F', 700: '#3D3C3A', 800: '#2A2A2B', 900: '#16181C', 950: '#11141C',
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
        // ⚠️ 'Pretendard Variable' 이 먼저다 — index.html 이 CDN 에서 로드하는 실제 패밀리명이
        // 그것이고, 여기 'Pretendard' 만 있으면 `font-sans` 를 명시한 자리는 로드된 적 없는
        // 이름을 찾다 실패해 시스템 폰트로 떨어진다(본문은 index.css body 규칙이 덮어 무사했다).
        sans: ['Pretendard Variable', 'Pretendard', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
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
          DEFAULT: '#1C69EF',        // 브랜드 블루 (2026-09-02 대표 확정, 시안 실측) — '면'(버튼·밴드)일 때. 라이트/다크 동일 + 흰 글자. 구 로즈 #E0526B
          dark: '#1557CC',           // hover/pressed
          tint: 'var(--brand-tint)', // 옅은 로즈 배경 — 라이트 #EAF1FE / 다크 #16243D (index.css)
          text: 'var(--brand-text)', // 로즈 '글자·뱃지' — 라이트 #1C69EF / 다크 #4D8DF5 (§6 보정값)
        },
        ink: {
          DEFAULT: '#16181C',  // 차콜 블랙 — 제목/본문/가격 (= --home-field)
          soft: '#6E6B68',     // 보조 텍스트 (중성 그레이)
          faint: '#8A8580',    // 비활성/플레이스홀더
        },
        surface: '#FFFFFF',
        line: '#EAE4E0',
        // 🎫 2026-09-02 표면 체계 — 카드 안 구분선·outline 테두리는 이 둘로만(테마별 값은 index.css).
        rule: { DEFAULT: 'var(--rule)', strong: 'var(--rule-strong)' },
        warm: '#F8F7FC',       // 페이지 배경(웜 화이트)
        // 🎨 gray → 잉크 스케일 리매핑(위 INK 주석 참조). 클래스명 무변 — 값만 브랜드 정렬.
        gray: INK,
        // 🖤 전 장식 색조 → 잉크 스케일 중화. `red` 만 제외(기능 빨강). (2026-06-19 흑백 결정의 웜 승계)
        pink: MONO, rose: MONO, fuchsia: MONO,
        orange: MONO, amber: MONO, yellow: MONO, lime: MONO,
        green: MONO, emerald: MONO, teal: MONO, cyan: MONO,
        sky: MONO, blue: MONO, indigo: MONO, violet: MONO, purple: MONO,
      },
      // 📐 모서리 = **위계** (2026-08-30 — 대표 "테두리가 정말 AI스럽다")
      //
      //   실측하니 `rounded-lg`(2,217곳)와 `rounded-xl`(1,499곳)이 **둘 다 12px** 이었다.
      //   `--radius: 0.75rem` 이 lg 를 12px 로 올려 Tailwind 기본 xl(12px)과 겹친 것이다.
      //   즉 화면의 3,716개 요소가 **완전히 같은 곡률**로 그려지고 있었다 — 작은 칩도,
      //   버튼도, 카드도, 시트도. 사람이 만든 화면에는 위계가 있다(작은 것은 조이고 큰 것은
      //   푼다). 전부 같은 값이면 "기계가 한 번에 찍어낸" 인상이 된다. 그게 대표가 본 것이다.
      //
      //   ⚠️ **클래스 이름은 하나도 안 바뀐다** — 값만 다시 매긴다.
      //      2026-07-19 브랜드 컬러 롤아웃에서 검증된 단일지점 리매핑과 같은 방식이라
      //      가드·테스트·레이아웃에 영향이 없다(border-radius 는 박스 크기를 안 바꾼다).
      //      롤백도 `--radius` 를 0.75rem 으로 되돌리고 xl/2xl 두 줄을 지우면 끝이다.
      //
      //   sm 6 · md 8 · lg 10(컨트롤) · xl 14(카드) · 2xl 18(시트/모달) · 3xl 24(히어로)
      //   버튼(.ur-btn 12/10/8)은 컨트롤과 카드 사이에 놓인다 — 카드 안에 들어가는 요소가
      //   카드보다 더 둥글면 안 되기 때문이다(중첩 규칙: 안쪽 ≤ 바깥쪽).
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
        xl: '0.875rem',
        '2xl': '1.125rem',
      },
      // 🌑 그림자 = 잉크 색조 (2026-08-30)
      // 그간 커스텀 정의가 없어 368곳이 전부 Tailwind 기본 '순수 검정'이었다.
      // 웜 화이트(#F8F7FC) 바탕에 아무 색조 없는 검정을 얹으면 회색 때처럼 읽혀
      // 값싸 보인다 — **그림자는 잉크를 따라간다**(위 INK 900).
      // 처음엔 잉크가 딥네이비(#1A2C42 = 26 44 66)라 그 값이었는데, 같은 날 대표
      // 지시로 잉크가 차콜 블랙(#16181C = 22 24 28)이 되면서 여기도 따라왔다.
      // 잉크와 따로 놀면 검정 글자 옆에 네이비 그림자가 남는다.
      // 색조는 여전히 중성 — 웜 브라운으로 틀면 대시보드 쿨 그레이(#F4F5F7)에서 어긋난다.
      // ⚠️ 클래스명 불변 — `shadow-sm/md/lg/xl/2xl` 그대로. 값만 리매핑이라
      // 마크업 0줄 수정이고 테마 가드 영향 0 (브랜드 컬러 롤아웃과 동일 방식).
      boxShadow: {
        // 🎫 2026-09-02 표면 체계 — 소비자 카드 들림은 이 한 값(화이트 옅은 확산 · 다크 none). 새 카드에 sm~2xl 금지.
        lift: 'var(--lift)',
        sm: '0 1px 2px 0 rgb(22 24 28 / 0.06)',
        DEFAULT: '0 1px 3px 0 rgb(22 24 28 / 0.10), 0 1px 2px -1px rgb(22 24 28 / 0.08)',
        md: '0 4px 6px -1px rgb(22 24 28 / 0.09), 0 2px 4px -2px rgb(22 24 28 / 0.07)',
        lg: '0 10px 15px -3px rgb(22 24 28 / 0.09), 0 4px 6px -4px rgb(22 24 28 / 0.06)',
        xl: '0 20px 25px -5px rgb(22 24 28 / 0.10), 0 8px 10px -6px rgb(22 24 28 / 0.05)',
        '2xl': '0 25px 50px -12px rgb(22 24 28 / 0.22)',
        inner: 'inset 0 2px 4px 0 rgb(22 24 28 / 0.05)',
        none: 'none',
      },
    },
  },
  plugins: [],
};
