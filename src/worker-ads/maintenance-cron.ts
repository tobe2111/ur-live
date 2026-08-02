/**
 * 🌙 **자동 정비 순환 — cron 경로** (엔트리에서 분리, 2026-08-02).
 *
 * ⏰ **알람이 정비를 몰면 이 경로는 발화하지 않는다**(`index.ts` 게이트). 같은 `MAINT_LEASE_KEY` 를
 *   다투면 진 쪽이 스냅샷도 안 남기고 사라지기 때문이다 — 아래 19시 양보 주석이 적어 둔 바로 그 사고다.
 *   알람 경로는 단계를 **커서**로 돌아 시간당 12회차를 받는다(`maintenance-phase-cursor.ts`).
 *   여기 남은 시각 고정 순환은 **알람이 꺼졌을 때의 폴백**이다(하루 3~4회차).
 */
import type { Env } from '@/worker/types/env'
import { RESCAN_HOUR_UTC } from './rescan-hour'

/**
 * `makeHourGates()` 가 돌려주는 것 중 **이 모듈이 쓰는 것만** — 전체를 끌어오면 순환 import 가 된다.
 * ⚠️ 제네릭 시그니처를 그대로 받아야 한다: `readonly string[]` 로 좁히면 호출부의 `as const` 리터럴이
 *   안 맞는다(TS2345 — 실제로 한 번 걸렸다).
 */
type HourGates = {
  hourlySchedule<T>(
    schedule: readonly T[], yieldHours: readonly number[],
    pathOf: (phase: T) => string, fallbackOf: (phase: T) => () => Promise<unknown>,
    beatOf?: (phase: T) => string,
  ): void
}

export function scheduleMaintenanceCron(env: Env, gates: HourGates): void {
  // ── 🌙 자동 정비 = **매시간 1단계 순환** + 19:00 UTC(=KST 04시) 라이브 재보정 (2026-07-26 대표 "버튼 말고 자동으로") ──
  //   버튼 시퀀스(🧬중복통합→🔗재추출→🏷️재분류→🏅품질)의 자동화 — influencer-maintenance SSOT(버튼과 동일 로직, 멱등).
  //   SELF 바인딩으로 **자체 인보케이션**에서 실행(fresh 서브리퀘스트 예산 — 같은 틱의 다른 레인과 예산 미공유). 미바인딩 시 직접 실행 폴백.
  //   기본 ON(대표 지시) — 끄려면 ur-ads env ADS_AUTO_MAINTENANCE_ENABLED='false'. 결과는 platform_settings 에 기록(무음 실패 방지).
  //   🩹 2026-07-28 근본수리: 기존엔 18시에 **4단계를 한 인보케이션**으로 몰아 돌렸다. 무료 플랜의 실효
  //   서브리퀘스트 상한은 ~29(학습값)인데 정비 1회는 수백~수천 D1 연산이 필요해 **매번 첫 단계 도중 죽었고**,
  //   모든 D1 호출이 `.catch(()=>null)` 이라 결과 스탬프조차 못 남겨 "07-26 이후 멈춤"으로 보였다.
  //   ⇒ ① 매시간 **한 단계씩 순환**(단계당 fresh 인보케이션 예산 — 하루 24회 ≈ 단계별 6회) ② 각 단계는 커서로
  //      다음 회차에 이어받는다 ③ 결과는 예산 밖에서 항상 기록. **새 cron 추가 없음**(무료 계정 cron 5/5 소진).
  //  ⏰ **알람이 정비를 몰면 cron 순환은 손을 뗀다**(2026-08-02) — 같은 `MAINT_LEASE_KEY` 를 다투면
  //    진 쪽이 스냅샷도 안 남기고 사라진다(19시 양보 주석이 적어 둔 바로 그 사고). 알람 경로는 단계를
  //    **커서**로 돌아 시간당 12회차를 받는다(시각 고정 순환은 하루 3~4회뿐이었다).
    // ⚠️ 배정표는 influencer-maintenance 의 **MAINT_SCHEDULE 이 SSOT** — 여기 복제하면 단계를 늘려도
    //    cron 이 모른다(실제로 'handle' 단계가 그렇게 누락될 뻔했다). 정적 import 를 피하려고 리터럴을
    //    두되, **유닛(ads-lane-cadence)이 두 리터럴의 일치를 직접 비교**한다 — 주석 약속이 아니라 빨간불.
    // 🩹 2026-07-29 균등 순환(`% 5`) → 가중 10슬롯. 근거는 SSOT 쪽 주석에 라이브 수치로 적어 뒀다:
    //    `reextract` 는 전수 36,880행에 `filled: 0`(할 일이 구조적으로 없음)인데 20%를 가져갔고,
    //    `reclassify` 는 전수 한 바퀴에 65시간, `handle` 은 수율 최고(2,481)인데 아직 안 끝났다.
    // 🩹 2026-08-02 재배분: `handle` 3 → 1(라이브 `done: true · unfixable: 34` — 고칠 게 없다),
    //    `reextract` 1 → 3(지역 백필 36,269 + 카페 회원수 3,142 를 이 단계가 이고 있다).
    //    자리도 근거가 있다 — 인덱스 7 은 19시 양보로 하루 1회라 1슬롯 단계를 두면 간격이 24h 가 된다.
    const PHASES = [
      'merge', 'reextract', 'reclassify', 'quality', 'handle',
      'selflink',
      'reclassify', 'reextract', 'quality', 'reclassify', 'reextract',
      'reclassify',
    ] as const
    // 🤝 **19시는 야간 재보정에 양보한다**(`RESCAN_HOUR_UTC`) — 둘이 같은 `MAINT_LEASE_KEY` 를 다투다
    //   진 쪽이 스냅샷도 안 남기고 사라지고 있었다(`maintenance_rescan.at` 이 07-27 에서 정지 — 순환 배포일).
    //   양보 비용은 **19시 슬롯을 가진 단계**가 진다(인덱스 7). 그래서 거기엔 여러 슬롯을 가진 단계만 둔다 —
    //   지금은 `reextract`(1·7·10) 이라 19시를 잃어도 hour 1·7·10·13·22 로 돌아 최대 간격 9h 다.
    //   1슬롯 단계를 인덱스 7 에 두면 간격이 24h 가 되어 경보 창(12h)을 깬다(유닛이 그 값을 고정한다).
    gates.hourlySchedule(PHASES, [RESCAN_HOUR_UTC],
      (phase) => `/__ads/maintenance?phase=${phase}`,
      (phase) => async () => {
        const { runMaintenancePhase } = await import('@/features/marketing/api/influencer-maintenance')
        return runMaintenancePhase(env, phase)
      })
}
