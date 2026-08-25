/**
 * 📊 인플루언서 자동 수집 **결과 타입** — `influencer-auto-collect.ts` 에서 분리 (2026-07-29).
 *
 *   분리 이유: 관측 필드를 더할 때마다 본체가 600줄 캡에 닿는다. 타입은 본체 로직과 수명이 다르고
 *   (어드민 화면·테스트가 함께 읽는다) 서로를 안 부르므로, 캡을 리베이스라인으로 우회하는 대신 뗀다.
 *   기존 import 경로 호환을 위해 본체에서 재수출한다.
 */
import type { NaverEnrichDiag } from './influencer-performance'
import type { CollectFunnel } from './influencer-collect-funnel'

export interface DiscoveryKeyword { id: number; keyword: string; category: string | null; active: number; hits: number; source: string; created_at: string }
export interface AutoCollectStats {
  last_run: string; last_saved: number; last_keywords: string[]
  total_runs: number; total_saved: number
  promoted?: string[]; youtube_quota_hit?: boolean
  /**
   * 🎯 집중 축(마케팅대행사) 전용 슬롯의 이번 회차 배정 수.
   *   0 이면 **그 축이 고갈돼 슬롯을 반납한 것**이다(정상 동작 — 그 몫은 우선/일반이 가져간다).
   *   이 값이 없으면 "대행사를 돌고 있는가"를 밖에서 판정할 수 없다.
   *
   * 🗑️ 짝이던 `cursor`/`pri_cursor`/`focus_cursor` 는 2026-08-24 에 제거됐다 — 선택이 위치가 아니라
   *   나이(`pickStalest`)로 바뀌어 커서 자체가 없다. **관측용으로도 남기지 않는다**: 아무것도 조종하지
   *   않는 값이 화면에 남으면 다음 세션이 그걸 근거로 오진한다(이 레포의 "죽은 손잡이" 클래스).
   */
  focus_n?: number
  /**
   * 🌵 이번 회차에 **무판정 처리된 키워드 수**(2026-07-29). 0 이면 모든 키워드가 공정한 시도를 받았다는 뜻.
   *   이 값이 없어서, `isUnjudgedRound` 가 프로덕션에서 **아무도 안 부르는 고아 함수**로 남아 있던 걸
   *   몇 세션 동안 못 봤다(유닛은 순수함수를 직접 불러 초록이었다). 판정이 도는지는 밖에서 보여야 한다.
   */
  kw_unjudged?: number
  /**
   * 🌱 신규 키워드 승격 자리(2026-07-29) — `promoted: []` 가 "후보가 없어서"인지 **"자리가 없어서"**인지
   *   밖에서 갈리게. 이 값이 없어서 auto 승격이 영구 0 인 걸 몇 세션 동안 못 봤다(활성 210 > 상한 200).
   *   room 이 0 으로 붙박이면 발굴이 굶고 있는 것 — 수집은 도는데 풀이 안 크는 조용한 실패다.
   */
  kw_auto?: { active: number; room: number; cap: number }
  /**
   * 🎯 픽 소진 실태(2026-07-29) — **계획과 실행의 괴리를 보이게 한다.**
   *   `finalPicks` = `[성과가중 ytPicks(batch개), 커서픽(NAVER_EXTRA개)]` 인데 예산이 키워드 3~4개에서
   *   끝난다(키워드당 ~11 fetch) → **커서픽은 구조적으로 도달 못 함**(실측: `cursor` 6 고착, '네이버 볼륨
   *   확대 12개'는 한 번도 안 돎). 이게 결함인지 설계대로인지는 **점수가 신뢰 가능해진 뒤**라야 판단할 수
   *   있어(카운터가 07-29 까지 얼어 있었다) 고치기 전에 숫자로 남긴다 — 다음 세션이 추측 없이 결정하게.
   */
  picks?: { planned: number; processed: number; from_yt: number; from_cursor: number }
  /**
   * 📈 회차 퍼널 시계열(2026-08-11 대표 승인 "3번") — 이 blob 은 매 회차 덮어써지므로, 시계열을 **안에**
   *   얹지 않으면 "어제와 오늘이 왜 다른가"를 영영 못 본다. 근거·유튜브 관련 금지사항은
   *   `influencer-collect-funnel.ts` 헤더(⚠️ 대표가 유튜브 축소를 명시적으로 거부했다).
   */
  funnel?: CollectFunnel
  /** @deprecated 2026-07-28 — 링크인바이오/블로거 보강은 `influencer-enrich-lane.ts` 로 이전(스냅샷 `ads_influencer_enrich_last`).
   *  옛 실행이 남긴 값을 읽는 화면이 있어 타입은 유지(신규 실행은 안 채움). */
  bio_enriched?: number
  /** @deprecated 2026-07-28 — 성과 보강도 `influencer-enrich-lane.ts` 로 이전. 옛 스냅샷 호환용. */
  perf_enriched?: number
  /** 🔎 진단(2026-07-20 "신규 0건" 사후) — 0건의 원인을 밖에서 알 수 있게 플랫폼별 결과를 기록.
   *  configured=키 존재 여부(ur-ads env), found=발굴 합계, saved=신규 저장, error=첫 실패 사유. */
  diag?: {
    yt: { configured: boolean; found: number; saved: number; error?: string }
    naver: { configured: boolean; found: number; saved: number; error?: string }
    tistory?: { configured: boolean; found: number; saved: number; error?: string }
    /**
     * 🏘️ 카페 — **네이버 블로그와 분리해서 센다**(2026-07-29). 그전엔 카페 수확이 `diag.naver` 에 합산돼
     *   블로그 성과처럼 보였다. 카페는 성격이 다르다: 라이브 표본 200건에서 **연락 가능 2건**
     *   (이메일 0 · 인스타 0 · 외부링크 2)이고 보강 경로도 없다(`enrichNaverActivity` 는 blog 만 본다).
     *   즉 **연락 불가인데 키워드마다 예산을 쓴다.**
     *   ⇒ 끌지 말지는 수집 정책(대표 결정, `ADS_COLLECT_CAFE_ENABLED='false'`)이지만, **판단에 필요한
     *     비용/수확이 합산에 가려 안 보이던 것**은 결함이다. 결정하는 자리에 숫자를 놓는다.
     */
    /** `enabled` = 이 회차에 카페 트랙이 실제로 돌았나(원클릭 게이트 결과 — 화면이 스위치 상태를 실행으로 확인). */
    cafe?: { found: number; saved: number; enabled?: boolean }
    /** @deprecated 2026-07-28 — 블로거 보강은 전용 레인으로 이전. 옛 스냅샷 호환용. */
    naver_enrich?: NaverEnrichDiag
  }
  /** 🎯 YT 검색 예산(진짜 병목 = Search Queries/day, 기본 100회) — 어드민 "오늘 n/100" 표시용. */
  yt_budget?: { used: number; total: number; day: string }
  /** 📟 네이버 오픈API 일일 호출(KST 기준일). **자동 레인만 세므로 실사용의 하한** — `naver-api-usage.ts` 주석 참조. */
  /** 📟 네이버 오픈API 일일 사용량. `target`=90% 목표(22,500) · `left`=잔량(`null`=게이트 미장전). */
  naver_api?: { used: number; total: number; day: string; target?: number; left?: number | null }
  /** 🧾 소스별 서브리퀘스트 실사용(수집 회차) — 예산 병목을 재는 값. 합 ≈ spent 면 그 소스가 범인. */
  spend_by?: { yt: number; naver: number; cafe: number; tistory: number; save: number }
  /** 🔬 유튜브 서브리퀘스트 **내역** — 검색/채널/영상 중 어디가 배수인지(`DiscoverCalls`). */
  yt_calls?: DiscoverCalls
  /**
   * 🌱 **신선도 자동 조율 결정**(2026-08-17) — 왜 캡이 이 값인지를 밖에서 볼 수 있게 남긴다.
   *   이게 없으면 "발굴이 왜 안 늘지"를 다음 세션이 **추측**하게 된다(이 레포의 상습 오진).
   *   `reason` 해석: `blocked-freeze`=차단으로 동결 · `room-available`=자리 남음(캡이 병목 아님) ·
   *   `insufficient-evidence`=표본 부족 · `yield-declining`=하락 감지해 확장 · `at-ceiling`=상한 도달
   *   (여기 오면 **사람 판단 필요** — 캡 상한이나 후보 유입을 봐야 한다) · `stable`=유지.
   */
  freshness?: { cap: number; prev_cap: number; reason: string; yield_before: number; yield_after: number }
  /** 🔒 다른 실행이 진행 중이라 이번 호출은 아무것도 안 함(lease busy) — 체인/버스트는 yt_budget 부재로 자연 종료. */
  busy?: boolean
  /**
   * 🔒 서브리퀘스트 예산 — **정상 실행에도** 남긴다(2026-07-29).
   *   이 레인은 매시간 `Too many subrequests` 로 수확을 버리는데, 예산 수치는 **크래시 때만**(`crash_spent`)
   *   기록돼 왔다. 즉 *정작 실패하는 경로*에서 "얼마를 썼고 상한이 얼마였는지"가 화면에 안 보였다.
   *   보강 레인(`enrich_lane`)은 이미 spent/budget_total/limit_hit 를 남긴다 — 그 비대칭을 없앤다.
   */
  spent?: number
  budget_total?: number
  /** 관측된 학습 상한(0 = 미학습). 이 값이 계속 내려가면 한도가 실제로 낮다는 뜻. */
  learned_cap?: number
  /** 이번 실행에서 한도 신호를 봤나(레인이 fail-soft 로 삼켜도 여기서 드러난다). */
  limit_hit?: boolean
  /**
   * 예산을 다 썼는가 — **`limit_hit` 과 다른 값이다**(2026-08-04 라이브에서 잡음).
   *
   * `limit_hit` 은 *플랫폼 한도 에러를 맞았나* 이고, 예산은 에러 없이 **깨끗하게 소진**된다
   * (각 키워드 전에 `budget.left` 를 보고 멈추므로). 그래서 `spent 56 / budget_total 56` 인데
   * `limit_hit: false` 였고, 화면상 "한도 안 걸림" 으로 보여 **키워드 회전이 2일까지 늘어난 것을
   * 아무도 못 봤다**(활성 399 중 320 미실행 — 경보는 떴는데 확인처가 늘 정상이었다).
   *
   * ⚠️ **`limit_hit` 에 합치면 정반대로 악화된다** — `nextSubreqCap` 이 그 값을 받으면 상한을
   *   `spent × 0.8` 로 **축소**하는데 예산은 거의 매 회차 소진되므로 상한이 계속 깎인다.
   *   자가튜닝 입력(`hitLimit`)은 무접촉으로 두고 **보고용 값만 따로** 낸다.
   */
  budget_exhausted?: boolean
  /** 💥 이번 실행이 예외로 끝났다 — 원문/시각/그 시점 사용량. 성공하면 다음 스냅샷에서 사라진다. */
  crash?: string
  crash_at?: string
  crash_spent?: number
  crash_budget?: number
}

/**
 * 🔬 **서브리퀘스트가 어디로 갔는가** (2026-08-04 신설 → 08-05 수확까지 확장).
 *
 *   라이브 실측: 유튜브 쿼터는 **90 중 24**만 쓰는데 서브리퀘스트 예산(56)은 **전부** 소진돼 회차가 끝난다
 *   (`picks: planned 16 → processed 6`). 병목이 구글 쿼터가 아니라 우리 요청 수다.
 *   내역 실측(08-05 03:00): `search 3 · channels 3 · **videos 24**`
 *   — 유튜브가 쓴 30개 중 **80%가 채널별 영상 스니펫**이다. 그런데 그 24개가 *무엇을 벌어오는지*는
 *   아무도 안 셌다. 찍어서 줄이면 수율이 같이 떨어지므로, 줄이기 전에 **수확부터 센다**.
 *
 * `videos_*` 는 전부 `videos` 의 부분집합이고 서로 배타가 아니다(한 콜이 이메일+카테고리를 동시에 벌 수 있다).
 * `videos_empty` 만 배타 — 아무것도 못 벌어온 콜이다. **그 비율이 곧 잘라도 되는 몫**이다.
 */
export interface DiscoverCalls {
  search: number; channels: number; videos: number
  /** 없던 이메일을 벌어온 콜(가장 값진 결과 — 목적함수가 '부를 수 있는 사람 수'다). */
  videos_email?: number
  /** 인스타/틱톡/링크를 벌어온 콜. */
  videos_contact?: number
  /** 영상 제목으로 분류 신호를 벌어온 콜. */
  videos_cat?: number
  /** 🪦 아무것도 못 벌어온 콜 — 이 비율이 높으면 그만큼이 순수 낭비다. */
  videos_empty?: number
}
