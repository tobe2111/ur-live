/**
 * ⏸️ **유어애즈 레인 일시정지 — 스위치 하나** (2026-09-02, D1 계정 일일 읽기 한도 사고).
 *
 * ## 왜 하나여야 하나
 * 레인을 멈추는 길이 지금까지 **열다섯 개**였다(`ADS_*_ENABLED` 를 지우거나 `*_DISABLED='true'` 로 —
 * 방향이 섞여 있다). 게다가 `ADS_LANE_ALARM_ENABLED='false'` 하나만 끄면 설계상 **cron 경로가 대신
 * 돌기 시작한다**(알람이 몰지 않으면 부모가 손을 다시 잡는다). "전부 멈춰" 가 대시보드에서 15번의
 * 클릭이고 그중 하나를 빠뜨리면 조용히 계속 읽는다 — 9/1 처럼 유어딜이 그 값을 치른다.
 *
 * ## 무엇을 멈추나 / 무엇을 남기나
 * `ADS_LANES_PAUSED='true'` 면 **발굴·측정·정비** 레인이 전부 멈춘다 — cron `kick` 은 등록만 하고 띄우지
 * 않고, DO 알람은 **체인을 살린 채**(다음 알람은 걸되 레인은 안 돌린다) 쉬고, 부트스트랩·시트 미러도 쉰다.
 * **사람에게 가는 것은 남긴다**: 신청자 온보딩 안내(약속) · 동의 리드 리마인드. 서비스몰 부수 작업
 * (자동입찰·후속·주간 리포트)은 레인이 아니라 그대로 돈다 — 고객 대면이고 읽기가 작다.
 *
 * ## 정지가 사고처럼 보이지 않게
 * 매 정각 `cron_hb:ads:lanes-paused` 에 `paused=true` 를 남긴다(비용: 배치에 한 줄). 침묵 감시
 * (`cron-stale-watch`)와 헬스 게이트(`getCronHealth`)는 그 표식이 신선하면 `ads:*` 침묵을 **경보 대신
 * '일시정지 중'** 으로 분류한다. 표식 없이 멈추면 두 감시가 15개 레인을 매시 신고한다.
 *
 * ## AIMD 학습기
 * 알람 경로는 `runs`/`failStreak`/`runHistory` 를 **건드리지 않고** 돌아간다 — 정지를 실패로 세면
 * 재개 첫 회차의 처리량이 바닥에서 시작한다.
 *
 * 🔻 롤백/재개: env 에서 값을 지우거나 `'false'`. 다음 정각에 부트스트랩이 체인을 이어 간다.
 */
export const PAUSE_ENV = 'ADS_LANES_PAUSED'
/** 하트비트 이름(`ads:` 접두는 adsBeat 가 붙인다) — 감시 쪽 상수와 같아야 한다(`cron-heartbeat.ts`). */
export const PAUSE_BEAT = 'lanes-paused'
/** 정지 중에도 띄우는 레인 — 사람에게 약속한 것만. 늘리려면 여기에(그리고 헤더에 이유를). */
export const PAUSE_EXEMPT_PATHS: ReadonlySet<string> = new Set(['/__ads/consented-reminder', '/__ads/inbound-onboarding'])

export function lanesPaused(env: unknown): boolean {
  return String((env as Record<string, unknown> | undefined)?.[PAUSE_ENV] ?? '').trim().toLowerCase() === 'true'
}

export function pauseExempt(path: string): boolean {
  return PAUSE_EXEMPT_PATHS.has(path.split('?')[0] ?? path)
}
