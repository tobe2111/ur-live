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
/**
 * 🍰 **측정 샤드 수** — 인플루언서 보강을 몇 갈래로 나눠 돌릴까 (2026-08-09, 대표 승인 "2배부터").
 *
 * ## 왜 필요했나 (라이브 실측)
 * 측정이 **하루 ~4,200 에 묶여** 유입(6,000)을 못 따라가 백로그가 매일 +1,800 씩 늘고 있었다.
 * 그런데 한 회차는 이미 꽉 찼다 — `spent=44 / budget_total=45`, 처리 20행. **인보케이션당
 * 서브리퀘스트가 천장**이라 한 갈래로는 더 못 짠다.
 *
 * ⇒ 늘리는 유일한 길은 **갈래를 늘리는 것**이다. 알람 레인은 이름별 DO 인스턴스라 각자 자기
 *   인보케이션·자기 예산을 받는다 — **무료에서도 배수가 난다**(유료 전환 없이).
 *
 * ## 왜 지금까지 안 돌았나 — 이사 중 유실
 * 원래 `enrich-influencer-driver` 가 자식 K개를 띄웠는데, 그 kick 은 `if (!laneAlarmOn)` 게이트 뒤에 있다.
 * 2026-08-02 알람 전환 이후 **cron 은 "알람이 하겠지" 하고 손을 뗐고 알람 등록부엔 그 레인이 없었다.**
 * 그래서 4배 팬아웃이 **6일간 조용히 사라졌다**(하트비트 152시간 정지). `lane-alarm-boot.ts` 헤더가
 * 예고한 *"cron 킥은 게이트로 꺼져 있어 이 레인이 통째로 사라진다"* 가 실제로 일어난 것이다.
 *
 * ## 2 → 4 (2026-08-10, 대표 기승인 "차단 0이면 4배")
 * 2샤드로 하루를 돌린 실측이 조건을 채웠다:
 * ```
 *   차단 blocked 0 (ok 12,723)      샤드 둘 다 생존      백로그 28,759 → 26,057 (감소 유지)
 *   시간당 측정 180(1샤드) → 440    ← 14~19시 정상 구간 실측
 * ```
 * ⚠️ **네이버 부하가 또 배가 된다**(ok 12,723 → 2만대 후반 추정). **그 구간 데이터는 아직 없다** —
 *   올린 뒤 하루는 `blocked` 를 매일 봐야 하고, 차단이 뜨면 **즉시 이 값을 1 로** 되돌린다.
 *
 * ## 값을 올릴 때
 * ⚠️ **차단 수치를 먼저 본다.** 측정은 네이버를 직접 조회하므로 샤드 수만큼 부하가 곱해진다:
 *   `platform_settings.ads_naver_crawl_block` 의 `blocked` 가 0 을 유지하는지 하루 지켜본 뒤 올릴 것.
 *   차단당하면 측정이 통째로 멎어서, 얻는 것보다 잃는 게 크다.
 * 🔙 **롤백은 이 값을 1 로** — 그러면 `sliceClause` 가 조건을 안 붙여 샤딩 이전과 완전히 같아진다
 *   (남는 DO 인스턴스는 `lookupAlarmLane` 이 null 을 줘 조용히 멎는다 — 유령이 안 남는다).
 *   2 로 내리는 중간 롤백도 같은 방식으로 안전하다.
 */
export const ENRICH_SHARDS = 4

/**
 * 측정 샤드 레인들을 **생성**한다 — 손으로 나열하면 샤드 수와 `slice.k` 가 어긋나
 * 두 레인이 같은 사람을 재거나(중복) 일부가 영영 안 잡힌다(누락).
 *
 * 🔑 **샤드 0 의 이름은 `enrich-influencer` 그대로** — 이름이 곧 DO 인스턴스라, 바꾸면 기존
 *   알람·카운터가 끊기고 옛 인스턴스가 계속 깨어나 같은 큐를 두 번 집는다(위 주석).
 * 📗 샤드 1+ 는 **네이버 전용**(`naverOnly`) — YT 는 `slice` 를 안 받아 샤드마다 통째로 반복되는데
 *   YT 쿼터는 이미 초과이고 백로그의 98%가 네이버다(`naverOnly` docblock 에 실측).
 */
function enrichShardLanes(shards: number): Record<string, AlarmLane> {
  const k = Math.max(1, Math.floor(shards))
  const out: Record<string, AlarmLane> = {}
  for (let i = 0; i < k; i++) {
    out[i === 0 ? 'enrich-influencer' : `enrich-influencer-${i + 1}`] = {
      run: async (env) => {
        // 🔌 킬스위치 — 규약 "게이트는 러너 안"(§2차 이관). 이 줄이 없으면 알람 모드에서 스위치가
        //   죽은 손잡이가 된다(cron 폴백에만 게이트가 남는 "이사 중 유실" — 2026-08-09 발견·수리).
        if ((env as unknown as { ADS_INFLUENCER_ENRICH_DISABLED?: string }).ADS_INFLUENCER_ENRICH_DISABLED === 'true') return { skipped: 'disabled' }
        const { runInfluencerEnrich } = await import('@/features/marketing/api/influencer-enrich-lane')
        return runInfluencerEnrich(env, 0, undefined, k > 1 ? { i, k } : null, { driver: 'alarm', naverOnly: i > 0 })
      },
    }
  }
  return out
}

export const ALARM_LANES: Record<string, AlarmLane> = {
  ...enrichShardLanes(ENRICH_SHARDS),
  maintenance: {
    run: async (env) => {
      // 🤝 19시(UTC)는 야간 재보정에 양보 — cron 시절 `hourlySchedule(PHASES, [RESCAN_HOUR_UTC])` 의
      //   양보를 알람에서도 복원한다(2026-08-09 4차). 둘이 같은 MAINT_LEASE 를 다투면 진 쪽이
      //   스냅샷도 안 남기고 사라진다(maintenance-cron.ts 의 원 규약 — 시각 상수도 같은 SSOT).
      const { RESCAN_HOUR_UTC } = await import('./rescan-hour')
      if (new Date().getUTCHours() === RESCAN_HOUR_UTC) return { skipped: 'rescan_hour' }
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
      // 라우트(`/__ads/match-registry`)와 같은 5패스 예산 루프 — 첫 판(1패스)은 처리량을 1/5 로
      //   줄이고 있었다(2026-08-09 04:00 KST 실측 scanned=400). 두 벌이 갈리면 이렇게 된다.
      const budget = { left: 45 }
      let last = await matchRegistryEmails(env, 400, budget)
      for (let i = 1; i < 5 && !last.done && budget.left > 8; i++) last = await matchRegistryEmails(env, 400, budget)
      return last
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
  /**
   * ⏰ **4차 이관 — 일 1회 레인 7개** (2026-08-09, 대표가 붙여넣은 침묵 경보의 근본 수리).
   *
   * ## 왜 — 하루 한 번뿐인 기회가 부모 사망에 걸리면 통째로 증발한다 (D1 실측)
   * ```
   *   침묵 경보:  maintenance-rescan 3.2일 · collect-localdata-chain 2.1일
   *   08-08 하루에만:  nps(16h)·daily-batch(18h)·sweep-nts(19h)·scan-notices(21h)·nara-contract(23h)
   *                    전부 발화 실종 — 그 시각들의 회차 이력이 정확히 잠정(p:1 = 부모가 꼬리 전에 사망)
   * ```
   * 매시간 레인은 한 번 죽어도 다음 정각이 있지만 **일 1회 레인은 그날이 끝**이다. 알람은 부모가
   * 없어 자기 예산을 받는다 — 1~3차와 같은 처방을, 가장 취약한(기회가 가장 희소한) 레인에 적용.
   *
   * ## 규약 — 시각은 러너 안에서 보존(외부 호출량 불변), 나머지는 1~3차와 동일
   *
   * ⚠️ **이 자리에 있던 "sweep-mx·collect-franchise 는 발화를 놓친 적 없으니 남긴다"는 전제는 2026-08-12 에
   *   반증됐다** — 아래 5차 이관 참조. 전제를 적을 때는 *언제 다시 재는가*까지 적어야 낡지 않는다.
   */
  'maintenance-rescan': {
    runsPerHour: 1,
    run: async (env) => {
      if ((env as unknown as { ADS_AUTO_MAINTENANCE_ENABLED?: string }).ADS_AUTO_MAINTENANCE_ENABLED === 'false') return { skipped: 'gate_off' }
      const { RESCAN_HOUR_UTC } = await import('./rescan-hour')
      if (new Date().getUTCHours() !== RESCAN_HOUR_UTC) return { skipped: 'off_hour' }
      const { runNightlyRescan } = await import('@/features/marketing/api/influencer-maintenance')
      return runNightlyRescan(env)
    },
  },
  'collect-localdata-chain': {
    runsPerHour: 1,
    run: async (env) => {
      if ((env as unknown as { ADS_LOCALDATA_ENABLED?: string }).ADS_LOCALDATA_ENABLED !== 'true') return { skipped: 'gate_off' }
      if (new Date().getUTCHours() !== 20) return { skipped: 'off_hour' }
      const { runLocalDataCollect } = await import('@/features/marketing/api/localdata-collect')
      return runLocalDataCollect(env)
    },
  },
  'collect-nps': {
    runsPerHour: 1,
    run: async (env) => {
      if ((env as unknown as { ADS_NPS_ENABLED?: string }).ADS_NPS_ENABLED !== 'true') return { skipped: 'gate_off' }
      if (new Date().getUTCHours() !== 16) return { skipped: 'off_hour' }
      const { runNpsWorkplaceEnrich } = await import('@/features/marketing/api/nps-workplace-enrich')
      return runNpsWorkplaceEnrich(env)
    },
  },
  'daily-batch': {
    runsPerHour: 1,
    run: async (env) => {
      // env 게이트 없음(cron 도 무게이트) — 시각만 지킨다.
      if (new Date().getUTCHours() !== 18) return { skipped: 'off_hour' }
      const { runAdsDailyBatch } = await import('./daily-batch')
      return runAdsDailyBatch(env)
    },
  },
  'sweep-nts': {
    runsPerHour: 1,
    run: async (env) => {
      if (env.ADS_COMPANY_COLLECT_ENABLED !== 'true') return { skipped: 'gate_off' }
      if (new Date().getUTCHours() !== 19) return { skipped: 'off_hour' }
      const { sweepBusinessStatus } = await import('@/features/marketing/api/business-status-sweep')
      return sweepBusinessStatus(env)
    },
  },
  // ⚠️ 나라장터는 **opt-out**(기본 ON — 2026-08-04 대표 "자동으로 데이터 나오게끔") — 게이트 방향 주의.
  'collect-nara-contract': {
    runsPerHour: 1,
    run: async (env) => {
      if ((env as unknown as { ADS_NARA_CONTRACT_ENABLED?: string }).ADS_NARA_CONTRACT_ENABLED === 'false') return { skipped: 'gate_off' }
      if (new Date().getUTCHours() !== 23) return { skipped: 'off_hour' }
      const { runNaraContractCollect } = await import('@/features/marketing/api/nara-contract-collect')
      return runNaraContractCollect(env)
    },
  },
  /**
   * 🏛️ **나라장터 조달업체** — 대행사 새 수집 루트 (2026-08-11 대표 *"아직 손 안댄거 다 해줘"*).
   *   근거·왜 되살렸는지(코드 12 오독으로 지워졌던 레인)는 `nara-vendor-collect.ts` 헤더.
   *   ⚠️ 게이트는 **opt-out**(기본 ON) — 계약 레인과 같은 규약(2026-08-04 대표 "자동으로 데이터 나오게끔").
   */
  'collect-nara-vendor': {
    runsPerHour: 1,
    run: async (env) => {
      if ((env as unknown as { ADS_NARA_VENDOR_ENABLED?: string }).ADS_NARA_VENDOR_ENABLED === 'false') return { skipped: 'gate_off' }
      if (new Date().getUTCHours() !== 15) return { skipped: 'off_hour' }
      const { runNaraVendorCollect } = await import('@/features/marketing/api/nara-vendor-collect')
      return runNaraVendorCollect(env)
    },
  },
  /**
   * ⏰ **5차 이관 — 마지막 cron 잔류 일 1회 레인 2개** (2026-08-12, 대표 *"남은거 다 해결하고 종료해야지"*).
   *
   * ## 왜 — 4차가 남겨 둔 전제("이 둘은 놓친 적 없다")가 반증됐다
   * `collect-franchise` 는 08-11 오전 7시(KST) 슬롯을, `sweep-mx` 는 08-11 새벽 2시 슬롯을 걸렀다.
   * 처음엔 배포 충돌로 읽었는데, **회차 이력(`ads_tick_history`)이 다른 답을 줬다**:
   * ```
   *   h=17  ran=8  p:1      ← sweep-mx 의 유일한 슬롯
   *   h=22  ran=8  p:1      ← collect-franchise 의 유일한 슬롯
   *   그날 24회차 중 ran=8 은 이 둘뿐이고, 침묵한 레인도 정확히 이 둘뿐이다.
   *   ran<=6 인 회차는 16개 전부 정상 마감(p 없음).
   * ```
   * `p:1` 은 *"띄운 건 안다, 결과는 모른다"* 지 실패가 아니다 — 그래서 **레인 자기 통계**로 갈랐다:
   * `ads_franchise_stats.last_run` 이 **08-10 그대로**였다. 부모가 센 `ran` 에는 있는데 자식이 자기
   * 기록을 못 남겼다 ⇒ 자식이 **시작조차 못 했다**(부모가 `waitUntil` 을 비우기 전에 CPU 로 죽었다).
   * `index.ts` 가 이미 적어 둔 *"같은 시각에 겹치면 부모 CPU 를 나눠 쓰다 꼬리가 잘린다"* 그대로다.
   *
   * 🔑 **`dailyAt` 은 `isDeferrable=false`(=`always`) 라 회차 예산이 못 막는다.** 예산을 조여도 이
   *   둘은 항상 실려 나가고, 16~23 시가 이미 포화라 **혼잡한 시각의 꼬리**가 된다. 그래서 예산 조정이
   *   아니라 이관이 처방이다 — 알람은 부모가 없어 자기 인보케이션 예산을 받는다(1~4차와 같은 처방).
   *
   * ## 남긴 것
   * `silence-digest`(23h)는 **cron 에 남긴다** — 같은 날 h=23 회차는 `ran=5`로 정상 마감했고
   * 하트비트도 08-11 23:01 로 실제 발화했다. 굶은 근거가 없다. (⚠️ 다음에 h=23 이 `ran>=7`+`p:1` 로
   * 관측되면 그때 같은 처방을 적용할 것 — 이번엔 "놓친 적 없다"를 **측정으로** 확인했다.)
   */
  'sweep-mx': {
    runsPerHour: 1,
    run: async (env) => {
      if (env.ADS_COMPANY_COLLECT_ENABLED !== 'true') return { skipped: 'gate_off' }
      if (new Date().getUTCHours() !== 17) return { skipped: 'off_hour' }
      const { sweepEmailMx } = await import('@/features/marketing/api/email-mx-sweep')
      return sweepEmailMx(env)
    },
  },
  'collect-franchise': {
    runsPerHour: 1,
    run: async (env) => {
      if ((env as unknown as { ADS_FRANCHISE_ENABLED?: string }).ADS_FRANCHISE_ENABLED !== 'true') return { skipped: 'gate_off' }
      if (new Date().getUTCHours() !== 22) return { skipped: 'off_hour' }
      const { runFranchiseCollect } = await import('@/features/marketing/api/franchise-collect')
      return runFranchiseCollect(env)
    },
  },
  /**
   * 🩸 **주기가 두 벌로 갈려 있었다** (2026-08-11 라이브 실측).
   *   2026-08-10 에 cron 게이트를 `dailyAt(21)` → `everyNHours(4, 1)` 로 올렸는데(대표 "셋 다 해줘"),
   *   그 게이트는 `!laneAlarmDrivesEnrich(env)` 뒤에 있고 **라이브는 알람이 몬다.** 여기 등록부는
   *   `!== 21` 그대로였다 ⇒ **증설이 배포는 됐는데 한 번도 발효되지 않았다**(`ads_notice_stats`:
   *   `last_run 2026-08-10 21:00`, `total_runs 11` = 계속 일 1회). 에러도 경보도 없었다.
   *   ⇒ 같은 레인의 주기는 **두 곳이 반드시 같아야 한다** — `ads-lane-cadence-parity` 가 강제한다.
   */
  'scan-notices': {
    runsPerHour: 1,
    run: async (env) => {
      if ((env as unknown as { ADS_NOTICE_ENABLED?: string }).ADS_NOTICE_ENABLED !== 'true') return { skipped: 'gate_off' }
      if (new Date().getUTCHours() % 4 !== 1) return { skipped: 'off_hour' }
      const { runNoticeScan } = await import('@/features/marketing/api/notice-scan')
      return runNoticeScan(env)
    },
  },
}

export const ALARM_LANE_NAMES = Object.keys(ALARM_LANES)

/** 이름 → 레인. 모르는 이름이면 null(알람은 다음 회차를 걸지 않고 조용히 멎는다 — 유령 인스턴스 방지). */
export const lookupAlarmLane = (name: string | null | undefined): AlarmLane | null =>
  (name && Object.prototype.hasOwnProperty.call(ALARM_LANES, name) ? ALARM_LANES[name]! : null)
