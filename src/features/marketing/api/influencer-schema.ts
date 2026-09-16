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
  // 📈 2026-09-02: 유입 감시(`inflow-watchdog` sampleAxis)·풀 통계·타임라인이 `collected_at >= …` 로 최근 창을 자른다.
  //   업체 쪽(`idx_company_leads_collected_at`, 08-31)만 있고 인플루언서 쌍둥이가 없어 15.3만 행 전수였다. 기본 컬럼(CREATE 안)이라 이 자리.
  'CREATE INDEX IF NOT EXISTS idx_ad_inf_leads_collected_at ON ad_influencer_leads(collected_at)',
  /**
   * 🪦 **`idx_ad_inf_leads_bio(account_id, bio_checked_at)` 를 지운다** (2026-09-01 — 라이브 실측).
   *
   * 이 인덱스는 없느니만 못했다. `bio_checked_at IS NULL` 이 99.9%를 통과하므로 **거르는 일을 못 하는데**,
   * 플래너에겐 *동등 조건 두 개*(account_id=, bio_checked_at=)로 보여 **바로 아래 부분 인덱스를 이긴다.**
   * ```
   *   2026-08-27 에 부분 인덱스를 만들었는데 하루 41,114,785행 / 238회(회당 172,751)가 그대로였다.
   *   node:sqlite 로 재현: 이 인덱스가 있으면 → USING idx_ad_inf_leads_bio (거의 전수)
   *                        이 인덱스를 지우면 → USING idx_ad_inf_leads_bio_links (대상만)
   * ```
   * ⚠️ **그때 테스트가 "인덱스가 실제로 쓰이는지는 레포에서 확인 불가"라고 적어 놓고 넘어간 것**이 화근이다.
   *   `node:sqlite` 로 플래너를 직접 돌리면 확인된다 — 업체 쪽(`company-read-amplification.test.ts`)이
   *   이미 쓰던 방법인데 이 파일에는 안 왔다. 이제 `influencer-bio-scan.test.ts` 가 플랜을 검사한다.
   * ⚠️ `bio_checked_at` 을 WHERE 로 쓰는 곳은 이 쿼리 하나뿐이라(전수 grep) 지워도 잃는 것이 없다.
   */
  'DROP INDEX IF EXISTS idx_ad_inf_leads_bio',
  // 🔗 **링크인바이오 후보 부분 인덱스** (2026-08-27 — 라이브 실측으로 추가).
  //   바로 위 인덱스는 같은 날(07-29) 같은 의도로 만들어졌는데 **거르는 일을 못 한다**:
  //   `bio_checked_at IS NULL` 이 153,312행 중 153,221행(99.9%)을 통과시켜 필터가 사실상 없다.
  //   실측: 대상 선택 쿼리 1회가 `rows_read=153,223 · 168ms · 결과 0건`.
  //   진짜 대상은 **74명(0.05%)** 이다 — 0.05%를 찾으려고 100%를 읽고 있었다.
  //   ⚠️ `links LIKE '%linktr.ee%'` 는 앞에 `%` 라 **어떤 인덱스도 못 돕는다.** 그래서 인덱스로 노리는 것은
  //     LIKE 가 아니라 그 앞 단계다 — `links` 보유자는 2,410명(1.6%)뿐이라 여기서 63배가 줄고,
  //     LIKE 는 그 2,410행에만 돈다. 부분 인덱스라 스탬프가 찍힌 행은 스스로 빠져나간다.
  /**
   * 🔎 **대소문자 무시 조회 두 건** (2026-09-01 실측 — 합쳐 하루 4,626만 행 = 이 DB 읽기의 39%).
   *
   * 중복 판정·조회가 `LOWER(email) = LOWER(?)` · `LOWER(instagram) = ?` 로 도는데, **정규화가
   * 왼쪽(컬럼)에 걸려** 어떤 인덱스도 못 탄다 — 업체 DB 의 원부 전화 매칭과 **같은 클래스**다.
   * ```
   *   LOWER(email)      23,926,792행 / 138회   회당 173,382 (계정 전량)
   *   LOWER(instagram)  22,330,137행 / 129회   회당 173,101
   * ```
   * ⇒ 식(expression) 인덱스로 옮긴다. `node:sqlite` 실증: `USING … (account_id=? AND <expr>=?)`.
   * ⚠️ 식이 한 글자라도 다르면 안 쓰인다 — 호출부와 **같은 문자열**이어야 한다.
   */
  'CREATE INDEX IF NOT EXISTS idx_ad_inf_leads_email_ci ON ad_influencer_leads(account_id, LOWER(email))',
  'CREATE INDEX IF NOT EXISTS idx_ad_inf_leads_instagram_ci ON ad_influencer_leads(account_id, LOWER(instagram))',
  /**
   * 🏷️ **핸들 존재 확인** (2026-09-01 실측 — 합쳐 하루 1,655만 행).
   *
   * 수집이 "이 핸들 이미 있나"를 `handle IN (…60개)` 로 묻는데, `(account_id, platform)` 까지만 짚고
   * 나머지는 훑었다(회당 14.7만). 세 번째 키로 `handle` 을 넣으면 그대로 탐색이 된다.
   */
  'CREATE INDEX IF NOT EXISTS idx_ad_inf_leads_handle ON ad_influencer_leads(account_id, platform, handle)',
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
  /**
   * 🔗 **링크인바이오 후보 부분 인덱스** — 2026-09-01 에 **이 자리로 옮겼다.**
   *
   * 2026-08-27 에 만들 때 위쪽(ALTER 앞)에 뒀는데, `bio_checked_at` 은 **아래 ALTER 로 생기는 컬럼**이라
   * 새 DB 에서는 이 문장만 조용히 실패하고(각 문장이 `.catch(() => null)`) 체크섬은 저장돼
   * **영영 안 만들어진다.** 라이브는 컬럼이 이미 있어 만들어졌지만, 그건 운이었다.
   * (유닛 픽스처가 SSOT DDL 을 그대로 실행하다가 이걸 잡았다 — 손으로 베낀 스키마였다면 못 봤다.)
   */
  'CREATE INDEX IF NOT EXISTS idx_ad_inf_leads_bio_links ON ad_influencer_leads(account_id, id) WHERE links IS NOT NULL AND bio_checked_at IS NULL',
  /**
   * 📍 **지역 미확인 대상 고르기** (2026-09-01 실측 — 하루 1,211만 행 / 70회, 회당 17.3만).
   *
   * `region IS NULL AND source_keyword IS NOT NULL AND source_keyword != ''` 는 처리될수록 줄어드는
   * 집합이라 부분 인덱스가 정확히 맞는다(끝나면 인덱스가 비고, 대상이 없다는 답이 1행으로 나온다).
   * ⚠️ 부분 조건은 호출부 WHERE 와 **같아야** 쓰인다.
   * ⚠️ **`region` 은 위 ALTER 로 생기는 컬럼이라 이 자리(ALTER 뒤)여야 한다.** 앞에 두면 새 DB 에서
   *   이 문장만 조용히 실패하고(각 문장이 `.catch(() => null)`) 체크섬은 저장돼 **영영 안 만들어진다.**
   */
  `CREATE INDEX IF NOT EXISTS idx_ad_inf_leads_region_todo ON ad_influencer_leads(account_id, id)
     WHERE region IS NULL AND source_keyword IS NOT NULL AND source_keyword != ''`,
  /**
   * 🔗 **자기 링크 소음 후보** (2026-09-02 정적 감사 §3 #5). `cleanSelfLinkNoise` 가 `platform='naver_blog' AND links LIKE '%naver%'`
   * 로 커서를 걷는데 둘 다 `idx_ad_inf_leads_acct` 의 후필터라 한 번 돌면 계정 전체(15.3만)를 훑고 커서를 0 으로 되감았다
   * (23회/일 → ~350만 행). LIKE 는 원리적으로 인덱스 밖이지만, **그 앞 단계**(naver_blog + links 보유)를 줄인다 —
   * `idx_ad_inf_leads_bio_links` 와 같은 발상. 호출부 WHERE 에 `links IS NOT NULL` 을 **명시**해야 부분 조건이 쓰인다
   * (SQLite 는 `LIKE` 에서 IS NOT NULL 을 유도하지 않는다). `links` 가 ALTER 컬럼일 수 있어 **맨 뒤**(ALTER 뒤)에 둔다.
   */
  `CREATE INDEX IF NOT EXISTS idx_ad_inf_leads_selflink ON ad_influencer_leads(account_id, id)
     WHERE platform = 'naver_blog' AND links IS NOT NULL`,
]
