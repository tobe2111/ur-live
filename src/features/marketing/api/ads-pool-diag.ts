/**
 * 📊 유어애즈 풀 진단 스탬프 조회 — `admin-ads-influencers.routes.ts` 에서 추출(2026-07-28).
 *
 * 왜 분리했나: 라우트 파일이 600줄 캡에 닿았다(CLAUDE.md "새 페이지 체크리스트" — 캡에 닿으면
 *   그 시점에 추출). 주석만 줄여 599줄로 맞추면 다음 사람이 한 줄 추가할 때 또 막힌다.
 *
 * 여기 모은 것 = **"자동화가 실제로 돌았나"를 어드민에 보여주기 위한 값들**(무음 실패 가시화).
 *   전부 platform_settings 스탬프 + lease 조회라 성격이 같고, 실패해도 화면이 죽지 않게 전부 fail-soft.
 */
import { isCollectRunning, isMaintainRunning } from './collect-lease'
import { INFLUENCER_ENRICH_SNAPSHOT_KEY } from './enrich-telemetry' // 키만(레인 코드 import 금지 — 메인 번들 경량)

const parseJson = (v?: string): unknown => { try { return v ? JSON.parse(v) : null } catch { return null } }

export interface AdsPoolDiag {
  /** 자동수집 통계 스탬프(`ads_autocollect_stats`) */
  run: unknown
  /** 🔒 수집 lease — 지금 돌고 있으면 true. 화면 로컬 state 로는 재진입 시 알 수 없다. */
  collect_running: boolean
  /**
   * 🔒 정비 lease. 2026-07-28 신설 — 수집엔 있었는데 정비엔 없어서 '전체 정비' 를 눌러도
   * 진행 중인지 끝났는지 화면에서 알 수 없었다(대표 신고).
   */
  maintain_running: boolean
  /** 📊 구글시트 마지막 동기화 결과 */
  sheets_sync: unknown
  /** 🌙 자동 정비 결과(`ads_maintenance_last`) */
  maintenance: unknown
  /** 🌙 라이브 재보정 결과(`ads_maintenance_rescan_last`) */
  maintenance_rescan: unknown
  /** 🪂 마지막 팬아웃 기록(`ads_enrich_fanout_last`) — 다음 회차가 착지 판정에 쓰는 기준값. */
  enrich_fanout: unknown
  /**
   * 🚦 이번 정각의 디스패치 선별 결과(`ads_dispatch_last`) — 무료 CPU 예산 분산(#919).
   * 미룬 레인이 있을 때만 기록된다(없으면 undefined = 전부 돌았다).
   * ⚠️ 이게 없으면 **미룬 것과 죽은 것이 똑같이 "기록 없음"** 으로 보인다 — 실제로 #919 첫 판정에서
   *   스냅샷을 쓰기만 하고 노출을 안 해 ran/deferred 를 못 봤다.
   */
  dispatch: unknown
  /** 📼 회차 이력(최근 24) — 최신값만 보관하는 저장소로는 못 만드는 시계열. */
  tick_history: unknown
  /**
   * 📝 인플루언서 풀 보강 레인 결과(`ads_influencer_enrich_last`). 2026-07-28 신설 —
   * 보강이 수집과 같은 인보케이션에 얹혀 **한 건도 못 돌던** 것을 전용 레인으로 분리하면서,
   * "이번 시간에 블로거를 몇 명 실제로 측정했나"가 화면에 없으면 또 무음으로 죽는다.
   */
  enrich_lane: unknown
  /**
   * 🕘 시트 미러 **cron 회차만**의 마지막 시각(`ads_sheets_last_cron`). 2026-07-29 신설 —
   * `sheets_sync` 는 수동 버튼이 덮어써서 "자동으로 돈 적이 있나"를 보존하지 못한다.
   * 게이트 값과 조합해 '고장'(켜졌는데 cron 기록 없음)과 '꺼짐'(설정)을 단정 없이 가른다.
   */
  sheets_cron: unknown
}

/** 진단용 스탬프·lease 를 한 번에 조회. 개별 실패는 null/false 로 떨어지고 throw 하지 않는다. */
export async function getAdsPoolDiag(DB: D1Database): Promise<AdsPoolDiag> {
  const [collect_running, maintain_running, stRow, sheetRow, mRows] = await Promise.all([
    isCollectRunning(DB).catch(() => false),
    isMaintainRunning(DB).catch(() => false),
    DB.prepare("SELECT value FROM platform_settings WHERE key = 'ads_autocollect_stats'")
      .first<{ value: string }>().catch(() => null),
    DB.prepare("SELECT value FROM platform_settings WHERE key = 'ads_sheets_last_sync'")
      .first<{ value: string }>().catch(() => null),
    DB.prepare(`SELECT key, value FROM platform_settings WHERE key IN ('ads_maintenance_last','ads_maintenance_rescan_last','ads_sheets_last_cron','ads_dispatch_last','ads_tick_history','ads_enrich_fanout_last','${INFLUENCER_ENRICH_SNAPSHOT_KEY}')`)
      .all<{ key: string; value: string }>().catch(() => null),
  ])
  const find = (k: string) => mRows?.results?.find(r => r.key === k)?.value
  return {
    run: parseJson(stRow?.value),
    collect_running,
    maintain_running,
    sheets_sync: parseJson(sheetRow?.value),
    // 🕘 cron 전용 마지막 시각 — 위 sheets_sync 는 수동 실행이 덮어쓰므로 "자동으로 돈 적 있나"를 못 답한다.
    sheets_cron: parseJson(find('ads_sheets_last_cron')),
    maintenance: parseJson(find('ads_maintenance_last')),
    maintenance_rescan: parseJson(find('ads_maintenance_rescan_last')),
    enrich_lane: parseJson(find(INFLUENCER_ENRICH_SNAPSHOT_KEY)),
    // 🚦 이번 회차가 무엇을 돌리고 무엇을 미뤘는가(예산 분산). 이걸 안 내보내면 **미룬 것과 죽은 것을
    //   구분할 수단이 없다** — 스냅샷을 쓰기만 하고 노출을 안 해서 첫 판정에서 실제로 못 봤다.
    dispatch: parseJson(find('ads_dispatch_last')),
    // 📼 지난 회차들의 [띄운수 ↔ ok ↔ fail ↔ 성공max ↔ 실패min]. `dispatch` 는 최신 1건뿐이라
    //   시계열 판정(예: 레인 수와 실패율의 관계)은 **이 배열로만** 가능하다.
    tick_history: parseJson(find('ads_tick_history')),
    // 🪂 팬아웃 자기신고 — "띄웠다"와 "착지했다"를 구분하는 유일한 기록.
    //   이게 안 보이면 하트비트 초록만 보고 '정상'으로 오판한다(2026-08-02 실측: 6시간 정지인데 ok).
    enrich_fanout: parseJson(find('ads_enrich_fanout_last')),
  }
}
