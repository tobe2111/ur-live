/**
 * 📍 홈 거리순 피드 시드 (2026-11-09 대표 *"아직 많이 느리네.. 최적화 계속 해"* — 위치 저장한 손님 화면이 '불러오는 중').
 *
 * ## 무엇이 느렸나
 *   위치를 저장한 손님은 홈 피드가 거리순(`&near=격자키`)이다(`MobileHomePage` `homeStartLoc()` → sort='near').
 *   워커가 싣는 MAIN 시드는 **인기순**이라 그 피드가 못 쓰고(`GroupBuyFeed` `initialData: nearKey ? undefined`),
 *   앱 부팅(폰 2~3초) 뒤에야 한국→LA 로 다시 받았다. 그동안 화면은 '불러오는 중…'.
 *
 * ## 무엇을 하나
 *   워커는 이미 위치 쿠키(`ur_loc`, 0.02° 격자)를 읽어 섹션 시드를 같은 위치로 받는다(`shared/home-near.ts`).
 *   같은 키로 거리순 피드를 **별도 슬롯**(`__SSR_INITIAL_MAINNEAR__`, `data-near=키`)에 함께 싣는다.
 *   MAIN 은 그대로 둔다 — 지도(`useMapProducts`)·히어로 사진(`useHeroPhoto`)도 MAIN 을 읽기 때문이다.
 *   화면은 자기 격자 키가 `data-near` 와 **같을 때만** 쓴다(다르면 종전처럼 받는다 — 틀린 목록을 그리지 않는다).
 *
 * ## HTML 을 붙잡지 않는다
 *   거리순 피드는 위치마다 키가 달라 엣지 캐시가 차갑기 쉽다. 그래서 {@link HOME_NEAR_SEED_DEADLINE_MS} 안에 못 오면
 *   **버리고** HTML 을 보낸다(화면이 종전처럼 받는다). 늦게 온 결과는 직전 사본(stale)으로 남아 다음 방문부터 바로 쓰인다.
 */
import { MAIN_SEED_PATH } from '../../shared/seo/region-seed'
import { nearKeyFromCookieHeader } from '../../shared/home-near'
import { HOME_NEAR_SEED_ID } from '../../shared/home-near-seed-read'
import type { SsrTarget, SsrPayloadResult } from './ssr-payload'

/** 거리순 피드 시드를 기다리는 최대 시간. 넘으면 HTML 을 먼저 보낸다. */
export const HOME_NEAR_SEED_DEADLINE_MS = 400

/** 화면 요청과 **글자 하나 다르지 않은** 경로 — `GroupBuyFeed` 의 `/api/group-buy/products?status=active&category=all&near=키`. */
export function homeNearSeedPath(key: string): string {
  return `${MAIN_SEED_PATH}&near=${key}`
}

/** 위치 쿠키가 있으면 시드 대상. 없으면 null(종전과 같다). */
export function homeNearSeedTarget(cookieHeader: string | null | undefined): { key: string; target: SsrTarget } | null {
  const key = nearKeyFromCookieHeader(cookieHeader)
  if (!key) return null
  return { key, target: { slot: 'MAINNEAR', path: homeNearSeedPath(key) } }
}

/** `<script>` 한 줄. 키는 격자 형식(`37.56,126.98`)이라 속성에 그대로 넣어도 안전하다(정규화된 숫자·쉼표만). */
export function homeNearSeedScript(key: string, payload: string): string {
  if (!/^-?\d{1,3}\.\d{2},-?\d{1,3}\.\d{2}$/.test(key)) return ''
  return `<script id="${HOME_NEAR_SEED_ID}" type="application/json" data-near="${key}">${payload}</script>`
}

/** 마감 안에 오면 그 결과, 아니면 null. 원래 요청은 끊지 않는다(직전 사본을 채운다). */
export function withSeedDeadline(p: Promise<SsrPayloadResult>, ms: number): Promise<SsrPayloadResult | null> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const late = new Promise<null>((res) => { timer = setTimeout(() => res(null), ms) })
  return Promise.race([p.catch(() => null), late]).finally(() => { if (timer) clearTimeout(timer) })
}
