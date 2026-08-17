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
  // 🩹 현 물결 백필(2026-08-10) — activated_at 은 **새 활성화**에만 찍히므로, 이미 승격돼 있는 08-09
  //   물결(미실행 auto ~26개)은 NULL → created_at(7월) 폴백으로 **여전히 가짜 starved 를 낸다**
  //   (머지 직후 실제로 한 번 더 울렸다 — 대표 수신 2회째). 근사치 '-1 day'(=08-09 물결 시점)로 1회
  //   스탬프해 즉시 끈다. 조건 가드(활성·미실행·NULL)라 재실행돼도 무해 — 미래 물결은 승격이 찍는다.
  "UPDATE ad_discovery_keywords SET activated_at = datetime('now','-1 day') WHERE active = 1 AND last_run_at IS NULL AND activated_at IS NULL",
  // 🔄 2026-08-17 **최근 창(에폭) 카운터** — 기존 은퇴 3조건은 전부 *평생 누계* 라, 초기에 잘 나갔던
  //   키워드가 말라붙어도 **영구 면역**을 얻는다. 실측: 활성 auto 120개 중 은퇴 후보 **0개**인데
  //   '맛집' 871회/591건(회당 0.68) · '피부관리' 453회/561건(1.24)이 슬롯을 점유하고, 대기 후보의
  //   기대 수확은 회당 23.6건이었다. 누계로는 이 부류가 보이지 않는다 — 그래서 **지금**을 따로 센다.
  //   승격 시 리셋되므로 재도전은 항상 백지에서 시작한다(livelock 아님).
  'ALTER TABLE ad_discovery_keywords ADD COLUMN epoch_runs INTEGER NOT NULL DEFAULT 0',
  'ALTER TABLE ad_discovery_keywords ADD COLUMN epoch_saved INTEGER NOT NULL DEFAULT 0',
  // 🕊️ 에폭 은퇴는 자가치유(승격 시 리셋)라 영구 차단이 아니다 — 대신 **쿨다운**으로 즉시 재승격만 막는다.
  'ALTER TABLE ad_discovery_keywords ADD COLUMN retired_at DATETIME',
]

