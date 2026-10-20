// v4/tokens.jsx — 유어딜 실제 코드 기반 디자인 토큰
// 출처: src/index.css, tailwind.config.js, 실제 컴포넌트 사용례

const UD4 = {
  primary: '#FF4D6D',
  primaryHover: '#E63E5D',
  accentRed: '#EF4444',
  accentPink: '#EC4899',
  accentBlue: '#3B82F6',
  accentYellow: '#FEE500',
  accentGreen: '#10B981',
  accentOrange: '#F97316',
  gradient: {
    brand: 'linear-gradient(135deg, #EF4444 0%, #EC4899 100%)',
    sunset: 'linear-gradient(90deg, #F97316 0%, #EC4899 50%, #EF4444 100%)',
    map: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
    brandSoft: 'linear-gradient(135deg, rgba(239,68,68,.15) 0%, rgba(236,72,153,.15) 100%)',
  },
  shadow: {
    liveGlow: '0 4px 14px -2px rgba(239,68,68,0.45)',
    pinkGlow: '0 6px 20px -4px rgba(236,72,153,0.35)',
    card: '0 4px 6px rgba(0,0,0,0.07), 0 10px 20px rgba(0,0,0,0.04)',
    cardHover: '0 8px 12px rgba(0,0,0,0.1), 0 16px 32px rgba(0,0,0,0.07)',
    header: '0 1px 0 rgba(255,255,255,0.04), 0 2px 8px rgba(0,0,0,0.3)',
  },
  dark: {
    bg: '#020202', surface: '#121212', surface2: '#1A1A1A', surface3: '#0A0A0A',
    border: '#1F1F1F', border2: '#1A1A1A',
    text: '#FFFFFF', textMute: '#D1D5DB', textDim: '#9CA3AF', textDim2: '#6B7280', textDim3: '#4B5563',
  },
  white: {
    bg: '#FFFFFF', surface: '#FFFFFF', surface2: '#F9FAFB', surface3: '#F3F4F6',
    border: '#F3F4F6', border2: '#E5E7EB', border3: '#D1D5DB',
    text: '#111827', textMute: '#374151', textDim: '#4B5563', textDim2: '#6B7280', textDim3: '#9CA3AF', textDim4: '#D1D5DB',
  },
  light: {
    bg: '#F4F5F7', surface: '#FFFFFF', border: '#E5E7EB', text: '#111827', primary: '#2563EB',
  },
  font: { family: '"Pretendard Variable", Pretendard, -apple-system, BlinkMacSystemFont, system-ui, sans-serif', tracking: '-0.022em' },
  text: { xs9: '9px', xs10: '10px', xs11: '11px', xs12: '12px', sm13: '13px', sm14: '14px', base15: '15px', base16: '16px', lg18: '18px', xl20: '20px', xl22: '22px' },
  frame: { width: 430, headerH: 48, bottomNavH: 56 },
  radius: { sm: '6px', md: '8px', lg: '12px', xl: '16px', '2xl': '20px', '3xl': '24px', pill: '9999px' },
  status: {
    live: { bg: '#EF4444', fg: '#FFFFFF' },
    scheduled: { bg: '#3B82F6', fg: '#FFFFFF' },
    replay: { bg: 'rgba(75,85,99,0.8)', fg: '#FFFFFF' },
    discount: { bg: '#EF4444', fg: '#FFFFFF' },
    achieved: { bg: '#10B981', fg: '#FFFFFF' },
    coupon: { bg: '#EC4899', fg: '#FFFFFF' },
  },
};
