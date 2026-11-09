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
import { HOME_NEAR_SEED_ID, HOME_SHORTS_SEED_ID, HOME_BANNERS_SEED_ID } from '../../shared/home-near-seed-read'
import { BANNERS_SEED_PATH } from '../../shared/home-strip-banners'
import type { SsrTarget, SsrPayloadResult } from './ssr-payload'

/** 거리순 피드 시드를 기다리는 최대 시간. 넘으면 HTML 을 먼저 보낸다. */
export const HOME_NEAR_SEED_DEADLINE_MS = 200 // 2026-11-09 대표 "0.2초로 줄여줘" — 차가운 위치 키가 HTML 을 최대 0.4초 붙잡았다(첫 접속 검은 화면)

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

/**
 * 🎬 2026-11-09 홈 유어쇼츠 줄 시드 — 대표 캡처에서 첫 화면 맨 위 유어쇼츠 칸이 빈 회색으로 남아 있었다.
 *   목록(`/api/urshorts`, 4KB · 10개)은 앱이 화면 근처에서 관측한 뒤에야 받았다(앱 부팅 + 한국→LA 왕복).
 *   이 경로는 cron 예열(HOT_PATHS)에 이미 있어 엣지·KV 에서 바로 나온다 — 같은 마감으로 함께 싣는다.
 *   화면 쪽: `UrShortsRail` 이 첫 렌더에 이 시드로 그린다(`readHomeShortsSeed`).
 */
export const HOME_SHORTS_SEED_TARGET: SsrTarget = { slot: 'HOMESHORTS', path: '/api/urshorts' }
export function homeShortsSeedScript(payload: string): string {
  return `<script id="${HOME_SHORTS_SEED_ID}" type="application/json">${payload}</script>`
}

/**
 * 🖼️ 2026-11-09 홈 배너 전체 시드 — PC 홈 맨 위 큰 배너(가장 큰 그림)가 앱이 켜진 **뒤** `/api/banners` 를 물어(PC 실측 2.9s 출발)
 *   가장 늦게 떴다. 섹션 시드엔 상단 띠 배너만 있다. 같은 경로(cron 예열 키)를 같은 마감으로 함께 싣는다.
 *   화면 쪽: `useHomeBanners` 가 첫 렌더에 이 시드를 자리 표시값으로 쓴다(`readHomeBannersSeed`).
 */
export const HOME_BANNERS_SEED_TARGET: SsrTarget = { slot: 'HOMEBANNERS', path: BANNERS_SEED_PATH }
export function homeBannersSeedScript(payload: string): string {
  return `<script id="${HOME_BANNERS_SEED_ID}" type="application/json">${payload}</script>`
}
