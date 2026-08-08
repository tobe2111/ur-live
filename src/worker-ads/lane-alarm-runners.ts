/**
 * 🗂️ **알람이 모는 레인 등록부** — "어떤 이름의 DO 가 무엇을 돌리는가" 한 곳.
 *
 * ## 왜 등록부인가
 * 시범(2026-08-02 `enrich-influencer`)이 통과하자 남은 레인으로 넓힐 차례가 됐는데, DO 클래스를 레인마다
 * 새로 만들면 `wrangler-ads.toml` 마이그레이션이 레인 수만큼 늘어난다. DO **인스턴스**는 이름으로 갈리므로
 * (`idFromName(lane)`), **클래스 하나 + 이름별 인스턴스**면 바인딩 변경 없이 레인을 늘릴 수 있다.
 * ⇒ DO 는 자기 이름(`ctx.id.name`)으로 이 표를 찾아 실행한다.
 *
 * ## 🩺 왜 이 두 레인부터인가 (라이브 근거)
 * ```
 *   enrich-influencer  알람 전: 마지막 실행 4시간 전 · 알람 후: 12회/시간, 시간당 ~150명 측정
 *   maintenance        커서가 KST 10:00 이후 13시간 제자리 · region_pending 32,761 불변
 *                      KST 21:00 사망(CPU) · 22:00 디스패치됐는데 성공·실패 어느 기록도 없음
 * ```
 * 정비는 단계가 `hourUTC` 에 묶여 **하루 3~4회차**뿐이라, 한 번 죽으면 다음 기회가 6~12시간 뒤다.
 * 알람으로 옮기면 회차가 시간당 12회가 되고 **검증 주기도 12시간 → 5분**이 된다.
 *
 * ⚠️ **아무 레인이나 얹지 말 것.** 알람은 자기 인보케이션을 쓰므로 무료 한도를 레인 수만큼 곱한다.
 *   얹을 근거는 "cron 회차를 못 받아 굶는다" 또는 "회차가 죽어 진도가 안 나간다" 여야 한다 —
 *   하루 1회면 충분한 배치(주간 리포트 등)는 cron 이 맞다.
 */
import type { Env } from '@/worker/types/env'

export interface AlarmLane {
  /** 기본 간격 override(ms). 미지정이면 정책 기본(5분). */
  intervalMs?: number
  /** 시간당 상한 override. 미지정이면 정책 기본(12). */
  runsPerHour?: number
  run: (env: Env) => Promise<unknown>
}

/**
 * 🔑 키가 곧 DO 인스턴스 이름이다. 이름을 바꾸면 **다른 인스턴스**가 되어 저장된 알람·카운터가 끊긴다
 *   (옛 인스턴스의 알람이 계속 깨어나 같은 큐를 두 번 집는다) — 이름은 함부로 바꾸지 말 것.
 */
export const ALARM_LANES: Record<string, AlarmLane> = {
  'enrich-influencer': {
    run: async (env) => {
      const { runInfluencerEnrich } = await import('@/features/marketing/api/influencer-enrich-lane')
      return runInfluencerEnrich(env, 0, undefined, null, { driver: 'alarm' })
    },
  },
  maintenance: {
    run: async (env) => {
      const { runNextMaintenancePhase } = await import('@/features/marketing/api/influencer-maintenance')
      return runNextMaintenancePhase(env)
    },
  },
  /**
   * 🎯 **인플루언서 발굴** — 대표의 유일한 우선순위인데 34개 레인 중 가장 굶고 있었다 (2026-08-03 실측).
   *
   * ## 왜 얹는가 (위 "얹을 근거" 둘 중 **둘 다** 해당)
   * ```
   *   KST 09:00 회차 (per_tick 3 · 무료)
   *     influencer  budget 1 → run:[inbound-onboarding]
   *                            deferred:[collect, consented-reminder, social-maintenance]
   * ```
   * 인플루언서 도메인은 **레인 4개가 시간당 예산 1칸**을 나눠 쓴다 → collect 는 잘해야 4시간에 한 번.
   * 그리고 그 한 번마저 죽는다:
   * ```
   *   22:00:35  디스패치 (run:['collect'])
   *   22:00:38  ads:collect  Worker exceeded CPU time limit.   ← 3초 뒤
   * ```
   * 자식 CPU 는 부모에게 청구되므로 B2B 29개와 같은 벽에 부딪힌다. 실측 결과: **마지막 성공 KST 03:01,
   * 6시간 20분 정지** — 그동안 리드 0건, 커서 0전진.
   * ⇒ 예산 재분배로는 못 푼다(누가 굶느냐만 바뀌고 벽은 그대로다). 자기 인보케이션이 있어야 한다.
   *
   * ## ⚠️ `runsPerHour: 1` 인 이유 — 처리량을 미는 게 아니라 **고장을 고치는 것**
   * cron 이 원래 `0 * * * *`(시간당 1회)다. 기본 12회/시간을 그대로 받으면 그건 **설계 의도를 넘는**
   * 증설이고, 대표가 경계한 네이버 부하 증가가 된다. 여기서는 **의도한 값으로 복원만** 한다.
   *   · YT 검색은 `ytBudgetTotal`(하루 90~100)이 하드캡이라 회차 수와 무관하게 총량이 같다.
   *   · 네이버는 하루 25,000 쿼터에 실사용 ~2%.
   * ⚠️ 이 값을 올리려면 **네이버 차단 리스크를 다시 판단**할 것 — 대표 확인 사항이다.
   *
   * 🔒 이중 실행은 리스(`ads_collect_lease`)가 막는다 — 알람과 cron 이 겹쳐도 한쪽만 잡는다.
   *   그래도 부모 쪽 디스패치는 게이트로 끈다(겹치면 순수 낭비이고, 부모 CPU 를 또 먹는다).
   */
  collect: {
    runsPerHour: 1,
    run: async (env) => {
      const { runInfluencerAutoCollect } = await import('@/features/marketing/api/influencer-auto-collect')
      return runInfluencerAutoCollect(env)
    },
  },
  /**
   * 📊 **구글시트 미러** — 전 레인 중 **최다 CPU 사망**이라 얹는다 (2026-08-04, 위 "얹을 근거" 충족).
   *
   * ```
   *   cron_failures 3일치:  ads:sheets-sync  Worker exceeded CPU time limit.  ×16
   * ```
   * 자기가 무거운 게 아니라 부모 `waitUntil` 꼬리에서 **부모가 죽을 때 끌려간다** — 대표가 이틀
   * 못 본 시트 정지(2026-08-03)가 이 모양이었다. 알람은 부모가 없어 자기 예산 30초를 받는다.
   *
   * ## ⚠️ `runsPerHour: 1` — collect 와 같은 이유(증설이 아니라 의도 복원)
   * cron 설계가 매시간 1회다. 더 돌리면 Sheets API 쿼터와 D1 페이지 읽기(풀 성장 비례)만 태운다.
   * 게이트(`ADS_SHEETS_SYNC_ENABLED`)는 러너 안에서 본다 — 알람은 매시간 무조건 깨므로.
   * 🔒 이중 실행: cron 쪽 디스패치는 `!laneAlarmOn` 게이트로 끊는다(collect·maintenance 와 동일).
   *   시트 미러는 리스가 없어(커서 기반 append) 겹치면 **행이 중복**된다 — 게이트가 유일한 방어다.
   */
  'sheets-sync': {
    runsPerHour: 1,
    run: async (env) => {
      const { runSheetsMirrorDirect } = await import('./sheets-mirror-lane')
      return runSheetsMirrorDirect(env)
    },
  },
  /**
   * ⏰ **2차 이관 5레인** (2026-08-05 — sheets-sync 24h 판정 통과 후 확장).
   *
   * ## 근거 — 대조 실험이 라이브에서 완결됐다
   * ```
   *   10:00 KST 회차(역사적 최다 사망 시각):
   *     sheets-sync(알람)              ok=true 10.8s      ← 어제까지 매일 죽던 레인
   *     collect-company(cron 잔류)     CPU 사망
   *     sweep-kakao-chain(cron 잔류)   CPU 사망
   * ```
   * 이관 전 3일 사망: sheets-sync ×16 → 이관 후 24h **0**. 같은 회차에서 cron 잔류만 죽는다.
   *
   * ## 공통 규약 (sheets-sync 와 동일)
   * · `runsPerHour: 1` — 증설 아님, cron 의도 복원(외부 API 쿼터 불변)
   * · **게이트는 러너 안에서** — 알람은 매시간 무조건 깨므로 env 게이트를 여기서 본다(OFF = no-op)
   * · cron 쪽은 `!laneAlarmOn` 게이트로 손 뗌(이중 실행 차단 — index.ts 각 kick)
   * · 직접 호출(SELF 홉 없음) — 알람 인보케이션이 자기 예산이라 홉이 낭비다
   */
  'collect-company': {
    runsPerHour: 1,
    run: async (env) => {
      if (env.ADS_COMPANY_COLLECT_ENABLED !== 'true') return { skipped: 'gate_off' }
      // cron 시절 홀수시 격리(짝수시 storeinfo 와 예산 반토막 방지)는 **부모 예산을 나누던 시절의 이유**다.
      // 알람은 자기 예산이라 격리가 불필요하지만, 외부(네이버 지역검색) 호출량 의도는 보존한다 — 홀수시만.
      if (new Date().getUTCHours() % 2 !== 1) return { skipped: 'even_hour' }
      const { runCompanyAutoCollect } = await import('@/features/marketing/api/company-collect')
      return runCompanyAutoCollect(env)
    },
  },
  'sweep-kakao-chain': {
    runsPerHour: 1,
    run: async (env) => {
      if ((env as unknown as { ADS_ENRICH_DISABLED?: string }).ADS_ENRICH_DISABLED === 'true') return { skipped: 'gate_off' }
      const { runKakaoPhoneSweep } = await import('@/features/marketing/api/company-collect')
      return runKakaoPhoneSweep(env)
    },
  },
  // ⚠️ 키 = DO 인스턴스 이름 = 하트비트 이름. 쿼리 포함 이름을 **그대로** 쓴다 — 바꾸면 라이브의
  //   옛 행 `ads:reclassify-company?passes=5` 가 남아 stale watch 가 영원히 운다(이름은 못생겨도 안정이 먼저).
  'reclassify-company?passes=5': {
    runsPerHour: 1,
    run: async (env) => {
      if ((env as unknown as { ADS_ENRICH_DISABLED?: string }).ADS_ENRICH_DISABLED === 'true') return { skipped: 'gate_off' }
      const { runReclassifyLane } = await import('@/features/marketing/api/reclassify-lane')
      return runReclassifyLane(env)
    },
  },
  'collect-store-kakao': {
    runsPerHour: 1,
    run: async (env) => {
      if ((env as unknown as { ADS_STORE_KAKAO_ENABLED?: string }).ADS_STORE_KAKAO_ENABLED !== 'true') return { skipped: 'gate_off' }
      const { runStoreKakaoCollect } = await import('@/features/marketing/api/store-kakao-collect')
      return runStoreKakaoCollect(env)
    },
  },
  'collect-neis': {
    runsPerHour: 1,
    run: async (env) => {
      if ((env as unknown as { ADS_NEIS_ENABLED?: string }).ADS_NEIS_ENABLED !== 'true') return { skipped: 'gate_off' }
      const { runNeisAcademyCollect } = await import('@/features/marketing/api/neis-academy-collect')
      return runNeisAcademyCollect(env)
    },
  },
  /**
   * ⏰ **3차 이관 4레인** (2026-08-09 — 2차 판정 사흘 뒤).
   *
   * ## 근거 — 남은 사망이 전부 cron 잔류다 (D1 실측, 08-05 14:00 KST 2차 이관 이후)
   * ```
   *   이관된 9레인:                     사망 0 (사흘)
   *   match-registry(cron 잔류)         ×3 (마지막 08-06 10:00 KST)
   *   collect-hira ×2 · collect-commerce · collect-storeinfo   ← 08-08 23:00 KST 한 회차에 몰살
   * ```
   * hira·commerce·storeinfo 는 #1098 이 보정값(작업량 축소)으로 1시간 전에 처방했지만, 2차까지의
   * 실측이 말하는 건 **작업량이 아니라 부모 공유가 사인**이라는 것이다(자기 일에 지친 게 아니라
   * 부모가 죽을 때 끌려간다 — sheets-sync 가 이미 증명). 보정값은 방어로 유지하고(러너 안에서 그대로
   * 작동) 구조는 알람으로 옮긴다 — 두 처방은 겹치지 않는다.
   *
   * ## 규약은 2차와 동일
   * · `runsPerHour: 1` + 짝수시 레인은 러너 안에서 시각 보존(증설 아님 — cron 의도 복원)
   * · 게이트는 러너 안(알람은 매시간 무조건 깨므로) · cron 쪽은 `!laneAlarmOn` 으로 손 뗌
   * · ⚠️ match-registry 만 킬스위치 계열(`ADS_ENRICH_DISABLED` 기본 ON) — 게이트 방향이 반대다
   */
  'match-registry': {
    runsPerHour: 1,
    run: async (env) => {
      if ((env as unknown as { ADS_ENRICH_DISABLED?: string }).ADS_ENRICH_DISABLED === 'true') return { skipped: 'gate_off' }
      const { matchRegistryEmails } = await import('@/features/marketing/api/registry-email-match')
      return matchRegistryEmails(env, 400, { left: 45 }) // cron 킥과 같은 인자 — 처리량 의도 보존
    },
  },
  'collect-hira': {
    runsPerHour: 1,
    run: async (env) => {
      if ((env as unknown as { ADS_HIRA_ENABLED?: string }).ADS_HIRA_ENABLED !== 'true') return { skipped: 'gate_off' }
      const { runHiraHospitalCollect } = await import('@/features/marketing/api/hira-hospital-collect')
      return runHiraHospitalCollect(env)
    },
  },
  'collect-commerce': {
    runsPerHour: 1,
    run: async (env) => {
      if ((env as unknown as { ADS_COMMERCE_ENABLED?: string }).ADS_COMMERCE_ENABLED !== 'true') return { skipped: 'gate_off' }
      // cron 시절 짝수시(everyNHours(2,0)) 의도 보존 — 외부(data.go.kr) 호출량 불변.
      if (new Date().getUTCHours() % 2 !== 0) return { skipped: 'odd_hour' }
      const { runCommerceCollect } = await import('@/features/marketing/api/commerce-notify-collect')
      return runCommerceCollect(env)
    },
  },
  'collect-storeinfo': {
    runsPerHour: 1,
    run: async (env) => {
      if (env.ADS_STOREINFO_ENABLED !== 'true') return { skipped: 'gate_off' }
      if (new Date().getUTCHours() % 2 !== 0) return { skipped: 'odd_hour' }
      const { runStoreInfoCollect } = await import('@/features/marketing/api/store-info-collect')
      return runStoreInfoCollect(env)
    },
  },
}

export const ALARM_LANE_NAMES = Object.keys(ALARM_LANES)

/** 이름 → 레인. 모르는 이름이면 null(알람은 다음 회차를 걸지 않고 조용히 멎는다 — 유령 인스턴스 방지). */
export const lookupAlarmLane = (name: string | null | undefined): AlarmLane | null =>
  (name && Object.prototype.hasOwnProperty.call(ALARM_LANES, name) ? ALARM_LANES[name]! : null)
