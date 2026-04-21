// tokens.jsx — 유어딜 디자인 토큰 (Claude Design에서 추출)
// 이 파일은 참조용입니다. 실제 적용은 tailwind.config.ts + src/index.css에서 합니다.

const UD_TOKENS = {
  brand: {
    50:  '#FFF1F4',
    100: '#FFDCE4',
    200: '#FFB8C9',
    300: '#FF8CA7',
    400: '#FF7591',
    500: '#FF4D6D',   // primary
    600: '#EF4444',   // red-500 (로고·라이브)
    700: '#DC2626',
    800: '#B91C1C',
    900: '#7F1D1D',
    gradient: 'linear-gradient(135deg, #FF4D6D 0%, #EF4444 100%)',
    gradientSoft: 'linear-gradient(135deg, #FFDCE4 0%, #FF7591 100%)',
    glow: '0 6px 20px -4px rgba(239,68,68,0.45), 0 2px 6px -2px rgba(255,77,109,0.35)',
  },
  dark: {
    bg: '#020202', surface: '#121212', surface2: '#1A1A1A', surface3: '#2A2A2A',
    border: '#1A1A1A', border2: '#2A2A2A',
    text: '#FFFFFF', textMute: '#D1D5DB', textDim: '#9CA3AF', textDim2: '#6B7280',
  },
  white: {
    bg: '#FFFFFF', surface: '#FFFFFF', surface2: '#F9FAFB',
    border: '#F3F4F6', border2: '#E5E7EB',
    text: '#111827', textMute: '#4B5563', textDim: '#6B7280',
  },
  light: {
    bg: '#F4F5F7', surface: '#FFFFFF', surface2: '#F9FAFB',
    border: '#E5E7EB', border2: '#F3F4F6',
    text: '#111827', textMute: '#374151', textDim: '#9CA3AF',
    primary: '#2563EB', primaryHover: '#1D4ED8',
  },
  sem: {
    live: '#EF4444', sale: '#EF4444', hot: '#F97316',
    success: '#10B981', warn: '#F59E0B', info: '#3B82F6',
    kakao: '#FEE500', kakaoInk: '#3C1E1E',
  },
  font: {
    sans: '"Pretendard Variable", Pretendard, -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
  },
  size: {
    display: { px: 40, lh: 1.1, w: 700 },
    h1: { px: 28, lh: 1.15, w: 700 },
    h2: { px: 22, lh: 1.25, w: 700 },
    h3: { px: 18, lh: 1.3, w: 600 },
    body: { px: 14, lh: 1.47, w: 500 },
    caption: { px: 12, lh: 1.4, w: 500 },
    micro: { px: 11, lh: 1.3, w: 600 },
  },
  radius: { xs: 6, sm: 8, md: 10, lg: 12, xl: 18, pill: 9999 },
  shadow: {
    xs: '0 1px 2px rgba(0,0,0,0.04)',
    sm: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
    md: '0 4px 6px rgba(0,0,0,0.07), 0 10px 20px rgba(0,0,0,0.04)',
    lg: '0 8px 12px rgba(0,0,0,0.1), 0 16px 32px rgba(0,0,0,0.07)',
    pop: '0 20px 48px rgba(239,68,68,0.18), 0 6px 14px rgba(0,0,0,0.1)',
  },
  layout: { mobileMax: 430, sidebarW: 208, headerH: 56, bottomNavH: 56 },
};
