/**
 * 🏠 생활 이용권의 업종(2차 카테고리) SSOT — 2026-10-25 대표 *"업종만 붙히면 되는거 아니야?"* → 1번 방식
 * (사장님이 이용권을 등록할 때 업종을 고른다).
 *
 * - 홈 '생활' 탭 아래 칩 한 줄이 이 표를 그대로 그린다(시안 `docs/design/assets/life-tab-subcat-*`).
 * - 저장은 `product_supply_meta` 의 `life_subcat` 키(products 컬럼 예산제 — 새 컬럼 금지).
 * - 사장님이 아직 안 고른 이용권(옛 등록분)은 **이름으로 한 번 추정**한다(`guessLifeSubcat`).
 *   저장값이 있으면 언제나 저장값이 이긴다(`resolveLifeSubcat`) — 사장님이 고친 것이 진실이다.
 * - 1차 카테고리(`home_voucher`)는 그대로다. 업종은 **보는 사람이 거르는 손잡이**일 뿐이고
 *   매칭·결제·정산 어디에도 안 쓰인다.
 */

import type { HomeServiceCategory } from './home-service-categories'

export type LifeSubcat = 'move' | 'clean' | 'pest' | 'repair' | 'sign'

export interface LifeSubcatDef {
  key: LifeSubcat
  label: string
  /** 이름 추정용 낱말(추정 순서는 `GUESS_ORDER`). */
  words: readonly string[]
  /** 칩을 고르면 위 견적 배너가 이 문구로 바뀐다. */
  bannerTitle: string
  bannerSub: string
  /** 견적 요청서로 바로 보낼 생활 견적 카테고리(여럿이면 생활 페이지로). */
  request?: HomeServiceCategory
}

export const LIFE_SUBCATS: readonly LifeSubcatDef[] = [
  { key: 'move', label: '이사', words: ['이사', '용달', '포장이사', '짐보관'],
    bannerTitle: '이사도 무료 견적으로', bannerSub: '이사 날짜·짐 양만 적으면 근처 업체가 견적을 보내요', request: 'move' },
  { key: 'clean', label: '청소', words: ['청소', '입주', '세탁', '케어'],
    bannerTitle: '청소도 무료 견적으로', bannerSub: '입주·에어컨·가게 청소 견적 비교' },
  { key: 'pest', label: '방역·소독', words: ['방역', '소독', '해충', '방제', '바퀴'],
    bannerTitle: '방역도 무료 견적으로', bannerSub: '가게·집 방역 견적 비교' },
  { key: 'repair', label: '수리·설치', words: ['수리', '설치', '교체', '보수', '누수', '줄눈', '배관'],
    bannerTitle: '수리·설치도 무료 견적으로', bannerSub: '설비·배관·줄눈 견적 비교' },
  { key: 'sign', label: '간판', words: ['간판', '현수막', '사인물'],
    bannerTitle: '간판도 무료 견적으로', bannerSub: '새로 달기·교체·수리 견적 비교', request: 'signage' },
]

const KEYS: ReadonlySet<string> = new Set(LIFE_SUBCATS.map((s) => s.key))

/** 들어온 값이 업종 키면 그 키, 아니면 null(빈 값·모르는 값은 '안 고름'). */
export function normalizeLifeSubcat(raw: unknown): LifeSubcat | null {
  const s = String(raw ?? '').trim()
  return KEYS.has(s) ? (s as LifeSubcat) : null
}

/**
 * 추정 순서 — 좁은 말부터 본다(칩 순서와 다르다). "간판 LED 교체" 는 '교체'(수리) 보다 '간판' 이 먼저고,
 * "이사 청소" 는 이사다.
 */
const GUESS_ORDER: readonly LifeSubcat[] = ['sign', 'pest', 'move', 'clean', 'repair']

/** 이름으로 추정 — 옛 등록분용. 못 맞히면 null(그 이용권은 '전체' 칩에만 보인다). */
export function guessLifeSubcat(name: unknown): LifeSubcat | null {
  const n = String(name ?? '')
  if (!n) return null
  for (const k of GUESS_ORDER) if (lifeSubcatDef(k)!.words.some((w) => n.includes(w))) return k
  return null
}

/** 저장값이 먼저, 없으면 이름 추정. */
export function resolveLifeSubcat(stored: unknown, name: unknown): LifeSubcat | null {
  return normalizeLifeSubcat(stored) ?? guessLifeSubcat(name)
}

export function lifeSubcatDef(key: LifeSubcat | null | undefined): LifeSubcatDef | undefined {
  return key ? LIFE_SUBCATS.find((s) => s.key === key) : undefined
}

/** 생활 이용권의 저장 키(`product_supply_meta.key`). */
export const LIFE_SUBCAT_META_KEY = 'life_subcat'
