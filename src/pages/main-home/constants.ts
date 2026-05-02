/**
 * 🛡️ 2026-05-02: TD-018 분할 — MainHomePage 지역/카테고리 상수 + 좌표 매핑.
 */

export const REGIONS = ['강남 · 역삼', '홍대 · 합정', '성수 · 건대', '여의도', '판교 · 분당', '부산', '대구', '제주']

// 좌표 → 가장 가까운 REGIONS 항목 매핑 (러프한 bounding box, 에너지 적게)
export const REGION_COORDS: Array<{ name: string; lat: number; lng: number }> = [
  { name: '강남 · 역삼', lat: 37.498, lng: 127.028 },
  { name: '홍대 · 합정', lat: 37.556, lng: 126.923 },
  { name: '성수 · 건대', lat: 37.544, lng: 127.056 },
  { name: '여의도', lat: 37.521, lng: 126.924 },
  { name: '판교 · 분당', lat: 37.395, lng: 127.110 },
  { name: '부산', lat: 35.180, lng: 129.075 },
  { name: '대구', lat: 35.872, lng: 128.601 },
  { name: '제주', lat: 33.499, lng: 126.531 },
]

export const CATEGORIES = [
  { k: 'fashion', l: '패션', i: '👗', bg: '#FCE7F3' },
  { k: 'beauty', l: '뷰티', i: '💄', bg: '#FEF3C7' },
  { k: 'food', l: '식품', i: '🍜', bg: '#FEE2E2' },
  { k: 'living', l: '리빙', i: '🏠', bg: '#DBEAFE' },
  { k: 'digital', l: '디지털', i: '📱', bg: '#E0E7FF' },
  { k: 'kids', l: '키즈', i: '🧸', bg: '#D1FAE5' },
  { k: 'sports', l: '스포츠', i: '⚽', bg: '#FEF3C7' },
  { k: 'culture', l: '문화', i: '🎫', bg: '#F3E8FF' },
  { k: 'travel', l: '여행', i: '✈️', bg: '#CFFAFE' },
  { k: 'pet', l: '반려', i: '🐕', bg: '#FED7AA' },
]
