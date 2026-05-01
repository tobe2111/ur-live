/**
 * Restaurant Map 카테고리 / 지역 상수.
 * 🛡️ 2026-05-01: TD-018 1387줄 분할 — sub-component 추출.
 */

export const CATEGORIES: { key: string; emoji: string; label: string; keywords: string[] }[] = [
  { key: '', emoji: '🍽️', label: '전체', keywords: [] },
  { key: 'korean', emoji: '🍚', label: '한식', keywords: ['한식', '국밥', '비빔밥', '백반', '찌개', '삼겹살'] },
  { key: 'japanese', emoji: '🍱', label: '일식', keywords: ['일식', '스시', '돈까스', '라멘', '우동', '초밥'] },
  { key: 'chinese', emoji: '🍜', label: '중식', keywords: ['중식', '짜장', '짬뽕', '탕수육', '마라'] },
  { key: 'cafe', emoji: '☕', label: '카페', keywords: ['카페', '커피', '디저트', '베이커리'] },
  { key: 'western', emoji: '🥩', label: '양식', keywords: ['양식', '파스타', '스테이크', '피자', '버거'] },
  { key: 'snack', emoji: '🥟', label: '분식', keywords: ['분식', '떡볶이', '김밥', '튀김'] },
]

export const REGIONS = [
  { key: '', label: '전체', emoji: '📍', lat: 36.5, lng: 127.8, level: 13 },
  { key: '서울', label: '서울', emoji: '🏙️', lat: 37.5665, lng: 126.978, level: 8 },
  { key: '경기', label: '경기', emoji: '🌳', lat: 37.4138, lng: 127.5183, level: 10 },
  { key: '인천', label: '인천', emoji: '⚓', lat: 37.4563, lng: 126.7052, level: 9 },
  { key: '부산', label: '부산', emoji: '🌊', lat: 35.1796, lng: 129.0756, level: 8 },
  { key: '대구', label: '대구', emoji: '🍎', lat: 35.8714, lng: 128.6014, level: 8 },
  { key: '광주', label: '광주', emoji: '💡', lat: 35.1595, lng: 126.8526, level: 8 },
  { key: '대전', label: '대전', emoji: '🧪', lat: 36.3504, lng: 127.3845, level: 8 },
  { key: '제주', label: '제주', emoji: '🍊', lat: 33.4890, lng: 126.4983, level: 9 },
]
