/**
 * 🧱 인플루언서 리드 테이블 스키마(DDL) — `influencer-discovery.ts` 에서 분리(2026-07-29).
 *
 *   순수 데이터다(로직 0). 분리 이유는 시드 분리와 같다 — 원본 파일이 600줄 래칫에 동결돼 있어
 *   **인덱스 한 줄을 추가하려다 막혔다**. 스키마는 앞으로도 늘어날 자리이므로 캡 밖으로 뺀다.
 *
 *   ⚠️ 이 배열이 바뀌면 `runDdlOnce` 의 체크섬이 자동으로 바뀌어 다음 실행에 전부 재적용된다
 *   (수동 버전 bump 불필요). 문장 순서는 의미가 있다 — CREATE 가 ALTER 보다 앞.
 */

export const AD_INFLUENCER_DDL: string[] = [
  `CREATE TABLE IF NOT EXISTS ad_influencer_leads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER NOT NULL,
    platform TEXT NOT NULL DEFAULT 'youtube',
    channel_id TEXT NOT NULL,
    handle TEXT,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    subscriber_count INTEGER NOT NULL DEFAULT 0,
    view_count INTEGER NOT NULL DEFAULT 0,
    video_count INTEGER NOT NULL DEFAULT 0,
    country TEXT,
    thumbnail TEXT,
    email TEXT,
    instagram TEXT,
    tiktok TEXT,
    links TEXT,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'new',
    memo TEXT,
    category TEXT,
    source_keyword TEXT,
    collected_at DATETIME DEFAULT (datetime('now')),
    UNIQUE(account_id, platform, channel_id)
  )`,
  'CREATE INDEX IF NOT EXISTS idx_ad_inf_leads_acct ON ad_influencer_leads(account_id, id)',
  // 🚀 2026-07-29 보강 레인 순회 인덱스 — 없으면 라운드마다 **풀 전체를 스캔·정렬**한다(계정 0 = 38k행).
  //   보강은 시간당 12라운드 × 3쿼리라, 인덱스 없이는 D1 rows-read 가 하루 수천만 행으로 튄다(무료 5M/일).
  //   ORDER BY 가 인덱스 순서와 같아야 정렬이 사라지므로, 호출부의 ORDER BY 도 함께 맞춰 두었다.
  'CREATE INDEX IF NOT EXISTS idx_ad_inf_leads_perf ON ad_influencer_leads(account_id, platform, perf_checked_at)',
  'CREATE INDEX IF NOT EXISTS idx_ad_inf_leads_bio ON ad_influencer_leads(account_id, bio_checked_at)',
  // 🔗 **링크인바이오 후보 부분 인덱스** (2026-08-27 — 라이브 실측으로 추가).
  //   바로 위 인덱스는 같은 날(07-29) 같은 의도로 만들어졌는데 **거르는 일을 못 한다**:
  //   `bio_checked_at IS NULL` 이 153,312행 중 153,221행(99.9%)을 통과시켜 필터가 사실상 없다.
  //   실측: 대상 선택 쿼리 1회가 `rows_read=153,223 · 168ms · 결과 0건`.
  //   진짜 대상은 **74명(0.05%)** 이다 — 0.05%를 찾으려고 100%를 읽고 있었다.
  //   ⚠️ `links LIKE '%linktr.ee%'` 는 앞에 `%` 라 **어떤 인덱스도 못 돕는다.** 그래서 인덱스로 노리는 것은
  //     LIKE 가 아니라 그 앞 단계다 — `links` 보유자는 2,410명(1.6%)뿐이라 여기서 63배가 줄고,
  //     LIKE 는 그 2,410행에만 돈다. 부분 인덱스라 스탬프가 찍힌 행은 스스로 빠져나간다.
  'CREATE INDEX IF NOT EXISTS idx_ad_inf_leads_bio_links ON ad_influencer_leads(account_id, id) WHERE links IS NOT NULL AND bio_checked_at IS NULL',
  // 구버전 테이블 대비 컬럼 보강(이미 있으면 catch 로 무시): 출처 분류 · 아웃리치 후속(컨택시점/팔로업/채널) ·
  //   ✍ 개인화 초안(생성만·발송 없음, 정보통신망법) · 🔗 링크인바이오 시도 스탬프 · 📥 유입출처+사전동의 시각.
  'ALTER TABLE ad_influencer_leads ADD COLUMN category TEXT',
  'ALTER TABLE ad_influencer_leads ADD COLUMN source_keyword TEXT',
  'ALTER TABLE ad_influencer_leads ADD COLUMN region TEXT', // 📍 활동 지역(수집 키워드 접두 — influencer-region.ts). '' = 확인했지만 없음
  'ALTER TABLE ad_influencer_leads ADD COLUMN contacted_at DATETIME',
  'ALTER TABLE ad_influencer_leads ADD COLUMN follow_up_at DATETIME',
  'ALTER TABLE ad_influencer_leads ADD COLUMN contact_channel TEXT',
  'ALTER TABLE ad_influencer_leads ADD COLUMN outreach_draft TEXT',
  'ALTER TABLE ad_influencer_leads ADD COLUMN bio_checked_at DATETIME',
  'ALTER TABLE ad_influencer_leads ADD COLUMN source TEXT',
  'ALTER TABLE ad_influencer_leads ADD COLUMN consented_at DATETIME',
  // 📈 성과 지표(2026-07-21) — YT 최근 영상 ≤10 평균 조회/댓글, 네이버 RSS 30일 포스팅 수, 수집 스탬프.
  'ALTER TABLE ad_influencer_leads ADD COLUMN recent_avg_views INTEGER',
  'ALTER TABLE ad_influencer_leads ADD COLUMN recent_avg_comments INTEGER',
  'ALTER TABLE ad_influencer_leads ADD COLUMN recent_posts_30d INTEGER',
  'ALTER TABLE ad_influencer_leads ADD COLUMN perf_checked_at DATETIME',
]
