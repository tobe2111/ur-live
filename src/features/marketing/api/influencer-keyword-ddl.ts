/**
 * 🧱 **키워드 테이블 DDL** — `influencer-auto-collect.ts` 에서 분리 (2026-07-29, 600줄 래칫).
 *
 *   순수 데이터(문장 목록)라 로직과 함께 있을 이유가 없다. 분리해도 동작은 같다 —
 *   `runDdlOnce` 가 이 배열의 **체크섬**으로 재적용 여부를 정하므로, 문장을 바꾸면 자동 재적용된다.
 *   ⚠️ 그러니 문장을 손대면(공백·순서 포함) 그 회차에 DDL 이 다시 돈다 — 의도한 변경일 때만 만질 것.
 */
/** 키워드 테이블 DDL — 체크섬 1회 조회로 갈음(`runDdlOnce`). 문장을 바꾸면 체크섬이 바뀌어 자동 재적용. */
export const KW_DDL: string[] = [
  `CREATE TABLE IF NOT EXISTS ad_discovery_keywords (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    keyword TEXT NOT NULL UNIQUE,
    category TEXT,
    active INTEGER NOT NULL DEFAULT 1,
    hits INTEGER NOT NULL DEFAULT 0,
    source TEXT NOT NULL DEFAULT 'seed',
    created_at DATETIME DEFAULT (datetime('now'))
  )`,
  // 📊 키워드별 성과(누적 발굴/저장 + 직전 실행 저장 + 마지막 실행 시각) — "어느 지역 키워드가 잘 무는지" 관측용.
  'ALTER TABLE ad_discovery_keywords ADD COLUMN found_total INTEGER NOT NULL DEFAULT 0',
  'ALTER TABLE ad_discovery_keywords ADD COLUMN saved_total INTEGER NOT NULL DEFAULT 0',
  'ALTER TABLE ad_discovery_keywords ADD COLUMN last_saved INTEGER NOT NULL DEFAULT 0',
  'ALTER TABLE ad_discovery_keywords ADD COLUMN last_run_at DATETIME',
  // 🌵 2026-07-29 고갈 카운터 — **연속** 무수확 횟수. `last_saved`(직전 1회)만으로는 "한때 잘 물었지만
  //   이제 다 훑은" 키워드를 구분할 수 없다. 실측: 유튜브가 `found 5 → saved 0` 인데 쿼터는 39/90만 씀 —
  //   `saved_total` 이 큰 옛 성공 키워드가 점수 상위를 계속 차지해 **이미 수확한 채널을 재방문**하고 있었다.
  //   (기존 은퇴 조건은 `saved_total = 0` 이라 이 부류를 영원히 못 걸러낸다.)
  'ALTER TABLE ad_discovery_keywords ADD COLUMN barren_streak INTEGER NOT NULL DEFAULT 0',
  // 🕐 2026-08-10 활성화 시각 — 순환 건강 판정의 미실행 나이가 **등록일** 기준이라, 몇 주 잠자던 후보가
  //   승격되는 순간 "N주 굶은 키워드"로 보였다(실측: '댕댕이' 07-21 생성 → 08-09 승격 → 즉시 3.7바퀴
  //   starved 경보 = #1106 승격 물결의 가짜 경보). 나이는 활성화부터 재야 한다. NULL(기존 시드)은
  //   created_at 폴백 — 시드는 생성 즉시 활성이라 두 값이 같다.
  'ALTER TABLE ad_discovery_keywords ADD COLUMN activated_at DATETIME',
]

