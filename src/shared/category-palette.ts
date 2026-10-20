/**
 * 🎨 카테고리 일러스트 팔레트 — 코레일 서비스 줄 실측 계열. 새 아이콘은 여기서 고른다(새 색 추가 금지).
 * 2026-10-19 `components/icons/category-icons.tsx` 에서 옮겼다 — 워커(블로그 첫 화면 커버 면 색)도 같은 값을 써야 해서
 * React 를 import 하지 않는 자리로 뺐다. 그 파일은 다시 내보낸다.
 */
export const CATEGORY_PALETTE = {
  red:    { main: '#E8433F', dark: '#A8262A' },
  pink:   { main: '#F0607A', dark: '#B93A55' },
  blue:   { main: '#3B82F6', dark: '#1F55B8' },
  yellow: { main: '#F5B63B', dark: '#B97E14' },
  orange: { main: '#F28C28', dark: '#B55F0F' },
  green:  { main: '#3CB371', dark: '#22794A' },
  teal:   { main: '#2BB3A3', dark: '#177A70' },
  purple: { main: '#8B6CF6', dark: '#5B41B8' },
} as const
export type CategoryHue = keyof typeof CATEGORY_PALETTE
