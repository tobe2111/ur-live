/**
 * 🏛️ **공공데이터 계열 cron 게이트** — `index.ts` 에서 분리 (2026-08-03, 600줄 래칫).
 *
 *   왜 이 넷이 한 묶음인가: 전부 **data.go.kr 원부**를 훑는 레인이고, 성격이 같다 —
 *   원부는 정적에 가깝고(자주 안 바뀜), 요청 한도가 있으며, 실패해도 다른 축에 영향이 없다.
 *   그래서 주기가 **일 1회 / 짝수시** 로 성기고, 시각을 서로 겹치지 않게 흩뿌려 둔다.
 *
 *   ⚠️ **동작은 옮기기 전과 같다** — 게이트 조건·시각·경로·import 경로 전부 그대로다(위치만 이동).
 *     여기서 시각을 바꾸면 `dispatch-budget` 의 회차 예산 계산과 어긋날 수 있으니, 바꿀 땐
 *     그쪽 시험(`ads-lane-cadence`·`ads-dispatch-budget`)을 같이 볼 것.
 */
import type { Env } from '@/worker/types/env'
import type { makeHourGates } from './lane-cadence'

type Gates = ReturnType<typeof makeHourGates>

/** 게이트 env 키 — 전부 기본 OFF(명시적으로 켜야 돈다). */
interface PublicDataEnv {
  ADS_COMMERCE_ENABLED?: string
  ADS_FRANCHISE_ENABLED?: string
  ADS_MARKET_ENABLED?: string
  ADS_NOTICE_ENABLED?: string
}

/**
 * 공공데이터 레인 4종의 시각 게이트를 등록한다.
 * @param gates `makeHourGates(hourUTC, kick, registry)` 결과 — 발화하지 않는 시각에도 주기를 신고한다.
 */
export function registerPublicDataCrons(env: Env, gates: Gates): void {
  const e = env as unknown as PublicDataEnv
  // 🛒 통신판매사업자 — 짝수시(상가정보와 같은 창이나 별도 커서·예산). 최대 공급원이라 가장 잦다.
  if (e.ADS_COMMERCE_ENABLED === 'true') {
    gates.everyNHours(2, 0, '/__ads/collect-commerce', async () => { const { runCommerceCollect } = await import('@/features/marketing/api/commerce-notify-collect'); return runCommerceCollect(env) })
  }
  // 🏢 공정위 가맹 — 일 1회(주 1회 성격이지만 매일 소량 페이지로 커서를 흘린다).
  if (e.ADS_FRANCHISE_ENABLED === 'true') {
    gates.dailyAt(22, '/__ads/collect-franchise', async () => { const { runFranchiseCollect } = await import('@/features/marketing/api/franchise-collect'); return runFranchiseCollect(env) })
  }
  // 🏪 상권 축(전통시장 상인회) — 일 1회. 원부가 1,393건이라 회당 몇 페이지면 전량이 금방 돌고,
  //   표준데이터는 **개발계정 월 1,000요청**이라 매시간 돌리면 낭비다(정적에 가까운 원부).
  if (e.ADS_MARKET_ENABLED === 'true') {
    gates.dailyAt(20, '/__ads/collect-market', async () => { const { runMarketCollect } = await import('@/features/marketing/api/market-collect'); return runMarketCollect(env) })
  }
  // 📢 공고 스캐너 — 일 1회(hourUTC===21 = KST 06시).
  if (e.ADS_NOTICE_ENABLED === 'true') {
    gates.dailyAt(21, '/__ads/scan-notices', async () => { const { runNoticeScan } = await import('@/features/marketing/api/notice-scan'); return runNoticeScan(env) })
  }
}
