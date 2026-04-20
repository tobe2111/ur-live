import type { ApiError } from './LiveTypes'

export function isApiError(error: unknown): error is ApiError {
  return typeof error === 'object' && error !== null && ('response' in error || 'message' in error)
}

export const usernames = [
  'minjae_92', 'yuna_shop', 'hyejin.k', 'joonho_lee', 'soyeon_99',
  'dohyun_park', 'seulgi.m', 'taehyung_fan', 'nayeon_j', 'woojin.c',
]

export const chatTexts = [
  '와 대박', '이거 진짜 좋아요', '가격 너무 착하다',
  '색상 이쁘다', '사이즈 추천해주세요!', '라이브 할인 최고',
  '지금 사야되나요?', '품절되기 전에 빨리!', '배송 얼마나 걸려요?',
  '후기 좋던데', '이거 선물용으로도 괜찮나요?', '재입고 언제 해요?',
]

export function getRandomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

export function formatViewers(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`
  return n.toString()
}

export function maskUserName(name: string): string {
  if (!name || name.length === 0) return '익명'
  if (name === '익명' || name === 'Anonymous') return name

  // 유저 설정: 마스킹 해제 시 원본 이름 반환
  if (typeof window !== 'undefined' && localStorage.getItem('chat_name_mask') === 'off') {
    return name
  }

  if (name.length === 1) {
    return name + '*'
  } else if (name.length === 2) {
    return name[0] + '*'
  } else if (name.length === 3) {
    return name[0] + '*' + name[2]
  } else {
    return name[0] + '*'.repeat(name.length - 2) + name[name.length - 1]
  }
}
