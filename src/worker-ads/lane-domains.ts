/**
 * 🧭 **레인은 어느 풀의 것인가** — 도메인별 예산 분리의 SSOT (2026-08-02 대표 지시).
 *
 * > *"업체 b2b db수집이랑 인플루언서 db 수집을 분리해서 생각할 필요가 있어"*
 *
 * ## 왜 (실측)
 * 그 전엔 20개 레인이 **회차 예산 8을 도메인-무지 라운드로빈**으로 나눠 썼다. 그래서 어느 풀이
 * 이번 회차에 몇 자리를 받는지가 **커서가 어디 떨어졌는지의 우연**이었다:
 *
 * ```
 *   02:00 UTC  인플루언서 1자리/8   (enrich-influencer-driver 미실행)
 *   04:00 UTC  인플루언서 3자리/8   (enrich-influencer-driver 또 미실행)
 * ```
 *
 * 더 나쁜 건 **결합**이다 — B2B 에 레인을 하나 더 붙이면 인플루언서 처리량이 자동으로 깎인다.
 * 두 도메인의 처리량을 따로 이야기할 수 없고, 한쪽을 키우면 다른 쪽이 조용히 줄어든다.
 *
 * ⇒ 레인마다 소속을 정하고 **도메인별로 몫을 따로 준다**(각자 자기 커서로 회전).
 *
 * ## ⚠️ 왜 호출부 20곳이 아니라 표 하나인가
 * `kick` 옵션으로 흩뿌리면 `gates.dailyAt`/`everyNHours`/`hourlySchedule` 세 겹을 전부 통과시켜야 하고,
 * 새 레인이 빠뜨려도 **조용히 아무 조에나 들어간다.** 표 하나면 유닛이 "등록된 레인 전부가 표에 있다"를
 * 직접 검사할 수 있다 — 이 레포가 반복해 만난 *"실패가 아니라 조용한 부재"* 를 여기서 만들지 않는다.
 *
 * ## 🧱 네 도메인 — 이건 서비스 경계이기도 하다
 * | 도메인 | 테이블 | 서비스 |
 * |---|---|---|
 * | `influencer` | `ad_influencer_leads` | 유어애즈 |
 * | `company` | `ad_company_leads` | 유어애즈 B2B |
 * | `prospect` | `store_prospects` | **소비자**(유어딜 셀러 영업 리드) |
 * | `wholesale` | 제조사·매수자 풀 | **도매몰(유통스타트)** |
 *
 * 뒤 둘은 유어애즈가 아니다. `CLAUDE.md` 의 "두 서비스 철저 분리" 가 코드 경계에서는 지켜지는데
 * **CPU 예산에서는 안 지켜지고 있었다** — 도매 수집이 인플루언서 수집을 굶길 수 있다(실제로
 * 2026-08-02 01:00 KST 에 CPU 한도로 죽은 3개는 전부 B2B 계열이었다).
 */

/** 레인이 속한 풀. 값을 늘리면 `DOMAIN_SHARE` 도 같이 늘려야 한다(유닛이 강제). */
export type AdsDomain = 'influencer' | 'company' | 'prospect' | 'wholesale'

/** 표시·순회 순서 고정(스냅샷 키 순서가 회차마다 흔들리면 눈으로 비교가 안 된다). */
export const ADS_DOMAINS: readonly AdsDomain[] = ['influencer', 'company', 'prospect', 'wholesale']

/**
 * 🍰 **도메인별 회차 몫** — 대표 확정 2026-08-02: **균등 3/3/1/1**.
 *
 * 두 유어애즈 풀을 대등하게 두고, 유어애즈가 아닌 두 레인(매장후보·도매)에는 최소 1자리씩.
 * ⚠️ 이건 **비율**이다 — 유료로 예산이 8→64 가 되면 24/24/8/8 로 **같은 비율로 자동 확대**된다
 *   (`domainBudgets` 가 비례 배분한다). 유료 전환에 이 표를 손댈 필요가 없다.
 *
 * ⚠️ 값을 바꾸면 **처리량이 바로 달라진다**(그게 이 표의 목적이다). 근거 없이 만지지 말 것 —
 *   판단 근거는 각 풀의 백로그와 유입이고, 둘 다 어드민 타임라인/stats 에서 실측된다.
 */
export const DOMAIN_SHARE: Record<AdsDomain, number> = {
  influencer: 3,
  company: 3,
  prospect: 1,
  wholesale: 1,
}

/**
 * 레인 이름(하트비트 beat, 쿼리 제외) → 도메인.
 *
 * ⚠️ **쿼리를 뗀 이름**을 키로 쓴다 — `maintenance?phase=merge` 와 `maintenance?phase=quality` 는
 *   같은 레인의 단계일 뿐이라 같은 조에 있어야 한다(`assignKey` 와 같은 규약).
 * ⚠️ 새 레인을 추가하면 **여기에 한 줄**. 빠뜨리면 유닛이 빨간불(조용히 아무 조에나 들어가지 않는다).
 */
export const LANE_DOMAIN: Record<string, AdsDomain> = {
  // ── 인플루언서 (ad_influencer_leads)
  'collect': 'influencer',              // collect-chain — 인플루언서 자동수집
  'collect-chain': 'influencer',
  'enrich-influencer-driver': 'influencer',
  'maintenance': 'influencer',          // 야간 풀 정비 12단계 순환
  'maintenance-rescan': 'influencer',
  'social-maintenance': 'influencer',
  'consented-reminder': 'influencer',
  'inbound-onboarding': 'influencer',
  'prefill-outreach-drafts': 'influencer',

  // ── 업체/파트너 B2B (ad_company_leads)
  'collect-company': 'company',
  'collect-commerce': 'company',
  'collect-storeinfo': 'company',
  'collect-franchise': 'company',
  'collect-nara-contract': 'company',
  'collect-market': 'company',   // 🏪 전통시장 상인회 — 같은 테이블(ad_company_leads)
  'collect-nps': 'company',
  'collect-work24': 'company',
  'enrich-company': 'company',
  'enrich-company-driver': 'company',
  'match-registry': 'company',
  'reclassify-company': 'company',
  'sweep-kakao-chain': 'company',
  // 🪦 'sweep-kakao-phone' 제거(2026-08-04) — 위 chain 이 같은 `runKakaoPhoneSweep` 을 돌린다.
  //   표에 남겨 두면 "알려진 레인"으로 잡혀 침묵 판정 대상이 되는데, 부르는 사람이 없어 영원히 stale 이다.
  'sweep-mx': 'company',
  'sweep-nts': 'company',
  'scan-notices': 'company',
  'daily-batch': 'company',             // 일 1회 묶음 — 업체 풀 부기/정리
  'silence-digest': 'company',          // 일 1회 침묵 요약 → 유어애즈 디스코드(silence-digest.ts)

  // ── 매장 후보 (store_prospects) — 소비자 셀러 영업 리드
  'collect-neis': 'prospect',
  'collect-hira': 'prospect',
  'collect-localdata': 'prospect',
  'collect-localdata-chain': 'prospect',
  'collect-store-kakao': 'prospect',
  'enrich-prospects': 'prospect',

  // ── 도매몰(유통스타트) — 제조사/매수자
  'collect-maker': 'wholesale',
}

/**
 * 표에 없는 레인이 갈 곳.
 *
 * 🔴 **`null` 을 쓰지 않는 이유**: 이번 회차에서 그 레인을 통째로 빼면 *"실패가 아니라 부재"* 가 된다
 *   — 배포는 초록이고 그 레인만 조용히 안 돈다. 이 레포가 가장 자주 당한 사고다.
 * ⇒ 돌기는 돌되(가장 큰 조에 얹는다) **스냅샷에 `unknown` 으로 이름을 남기고** 유닛이 CI 에서 막는다.
 *   즉 실수는 *보이게* 하고 파이프라인은 *안 멈춘다*.
 */
export const FALLBACK_DOMAIN: AdsDomain = 'company'

/** 쿼리를 뗀 레인 이름. (`dispatch-budget.assignKey` 와 같은 규약 — 두 벌로 두면 갈라진다.) */
export const laneKey = (beat: string): string => String(beat).split('?')[0]

/** 레인의 도메인. 표에 없으면 `FALLBACK_DOMAIN`(그리고 `isKnownLane` 이 false). */
export function laneDomain(beat: string): AdsDomain {
  return LANE_DOMAIN[laneKey(beat)] ?? FALLBACK_DOMAIN
}

/** 표에 등재된 레인인가 — 스냅샷/유닛이 드리프트를 보는 데 쓴다. */
export function isKnownLane(beat: string): boolean {
  return laneKey(beat) in LANE_DOMAIN
}

/**
 * 🍰 도메인별 이번 회차 몫. 합이 `perTick` 을 넘지 않는다.
 *
 * **최대잉여법**(largest remainder)으로 비례 배분한다 — 반올림만 하면 합이 예산을 넘거나 모자란다.
 * ⚠️ **레인이 있는 도메인은 최소 1자리**를 받는다. 안 그러면 몫이 작은 도메인(매장후보·도매)이
 *   반올림에서 0 이 되어 **영원히 안 돈다**(부재 사고의 교과서적 형태).
 * ⚠️ 예산이 도메인 수보다 작으면 전원 1자리를 줄 수 없다 — 그때는 `tick` 으로 **회전**시켜
 *   매 회차 다른 도메인이 자리를 받게 한다(고정 우선순위로 두면 뒤쪽이 영구히 굶는다).
 *
 * @param perTick 이번 회차 총 예산
 * @param active  이번 회차에 실제로 후보가 있는 도메인(없는 도메인에 자리를 주면 낭비다)
 * @param tick    회전 기준값(보통 hourUTC) — 예산이 부족할 때만 쓰인다
 */
export function domainBudgets(perTick: number, active: readonly AdsDomain[], tick = 0): Record<AdsDomain, number> {
  const out = { influencer: 0, company: 0, prospect: 0, wholesale: 0 } as Record<AdsDomain, number>
  const list = ADS_DOMAINS.filter(d => active.includes(d))
  if (!list.length || perTick < 1) return out

  // 예산 < 도메인 수 → 전원에게 1을 못 준다. 회전으로 굶는 도메인이 고정되지 않게 한다.
  if (perTick < list.length) {
    for (let i = 0; i < perTick; i++) out[list[(Math.abs(tick) + i) % list.length]] = 1
    return out
  }

  const shareTotal = list.reduce((a, d) => a + DOMAIN_SHARE[d], 0) || 1
  const exact = list.map(d => ({ d, v: (perTick * DOMAIN_SHARE[d]) / shareTotal }))
  let used = 0
  for (const e of exact) { out[e.d] = Math.max(1, Math.floor(e.v)); used += out[e.d] }
  // 최소 1 보장 때문에 예산을 넘겼으면 몫이 큰 쪽에서 되돌린다(작은 조를 다시 0 으로 만들지 않는다).
  for (let i = exact.length - 1; used > perTick && i >= 0; i--) {
    const order = [...exact].sort((a, b) => out[b.d] - out[a.d])
    for (const e of order) { if (used <= perTick) break; if (out[e.d] > 1) { out[e.d]--; used-- } }
    break
  }
  // 남은 자리는 잉여(소수부)가 큰 순서로 — 같은 잉여면 고정 순서라 회차마다 흔들리지 않는다.
  const rest = [...exact].sort((a, b) => (b.v - Math.floor(b.v)) - (a.v - Math.floor(a.v)))
  for (let i = 0; used < perTick; i = (i + 1) % rest.length) { out[rest[i].d]++; used++ }
  return out
}
