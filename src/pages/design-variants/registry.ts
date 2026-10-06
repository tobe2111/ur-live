/**
 * 🎨 시안 갤러리 — **무엇을 나란히 볼 수 있는가**의 SSOT (2026-09-15 신설).
 *
 * ## 왜 만들었나
 * 대표: *"각 페이지마다 이렇게 지금 UI들이 공통적으로 잡혀있는데 어떻게 다른 디자인 시안들로 더 받을 수 있을까?"*
 *
 * 그때까지 시안을 주고받는 길은 둘뿐이었고 둘 다 한계가 분명했다:
 *   · **글로 설명하고 알파벳으로 고르기**("안 B 로 하자") — 색·여백 같은 작은 변경엔 통하지만
 *     *레이아웃*은 글로 판단할 수 없다. "이 페이지 자체가 별로야" 에는 못 쓴다.
 *   · `scripts/visual-preview.mjs --css` — 실제 컴포넌트를 렌더하지만 **CSS 만** 바꾼다. 구조가 다른 안은 못 만든다.
 *
 * ⇒ **구조가 다른 여러 안을 같은 데이터로 같은 화면에서** 보게 한다. 그래야 고를 수 있다.
 *
 * ## 새 시안 세트 추가 — 파일 하나 + 이 파일 두 줄
 *   1. `sets/<이름>.tsx` 에 `VariantSet` 을 default export
 *   2. 아래 `SET_LOADERS` 에 한 줄 + `SET_INDEX` 에 한 줄
 *   ⚠️ 둘을 손으로 적는 이유: 목록 화면은 **불러오기 전에** 이름을 보여 줘야 한다(lazy 라 내용을 모른다).
 *      갈릴 수 있으므로 `design-variants-2026-09-15.test.ts` 가 두 목록의 키 일치를 고정한다.
 *
 * ## 🔒 이 화면의 규칙
 *   · **노출 금지** — 어디에서도 링크하지 않는다. `robots.txt` 가 막고 페이지가 `noindex` 를 선언한다.
 *   · **읽기 전용** — 시안은 가짜 데이터로만 그린다. API 호출·쓰기 금지(실수로 라이브를 건드릴 자리가 없어야 한다).
 *   · **lazy** — 소비자 첫 페인트에 한 바이트도 얹지 않는다.
 */
import type { ReactNode } from 'react'

/** 시안이 받는 것 — 데이터 상태 하나뿐이다(시안끼리 같은 데이터를 봐야 비교가 된다). */
export interface VariantCtx {
  /**
   * `full` = 장사가 되는 매장 · `empty` = 오늘 막 시작한 매장.
   * 🔑 **이 스위치가 이 도구의 핵심이다.** 대표가 불편해한 화면은 대부분 "데이터가 0일 때" 무너진다
   *    (숫자 넷이 전부 0 인데 그 앞뒤로 컨트롤이 세 줄). 데이터가 있을 때만 보면 그걸 못 본다.
   */
  data: 'full' | 'empty'
}

/** 시안 하나. `id` 는 URL(`?v=`)에 그대로 실린다 — 대표가 "안 b" 라고 말하면 그게 이 값이다. */
export interface Variant {
  id: string
  /** 대표에게 보일 이름. "안 A" 처럼 짧게. */
  label: string
  /** 이 안이 **무엇을 다르게 하는가** 한 줄. 모양만 보고는 의도를 모른다. */
  note: string
  render: (ctx: VariantCtx) => ReactNode
}

export interface VariantSet {
  /** URL(`?set=`) 에 실리는 값. */
  id: string
  /** 대표에게 보일 이름 — 어느 화면인가. */
  label: string
  /** 그 화면의 **실제 경로**. 무엇을 다시 그리는 중인지 헷갈리지 않게. */
  route: string
  /** 대표가 무엇을 불편해했는가 — 이게 판단 기준이 된다. */
  problem: string
  /** 대시보드 시안이면 그 스코프 클래스(없으면 소비자 표면). */
  themeClass?: 'seller-light-theme' | 'admin-light-theme'
  variants: Variant[]
}

/** 🎨 세트 본문 — 늦게 불러온다(각 세트가 자기 부품을 들고 온다). */
export const SET_LOADERS: Record<string, () => Promise<{ default: VariantSet }>> = {
  'seller-analytics': () => import('./sets/seller-analytics'),
  'partners-landing': () => import('./sets/partners-landing'),
  'seller-signup': () => import('./sets/seller-signup'),
}

/** 🎨 세트 목록 — 본문을 불러오기 전에 이름을 보여 주기 위한 최소 미러. */
export const SET_INDEX: { id: string; label: string; route: string }[] = [
  { id: 'seller-analytics', label: '셀러 매출 분석', route: '/seller/analytics' },
  { id: 'partners-landing', label: '입점 랜딩', route: '/partners' },
  { id: 'seller-signup', label: '사업자 유저 가입', route: '/seller/register/supplier' },
]
