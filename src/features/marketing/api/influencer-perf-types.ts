/**
 * 📊 인플루언서 보강 진단 타입 — `influencer-performance.ts` 에서 분리(2026-08-02, 600줄 캡).
 *
 * 이동만이다. **필드·주석 byte-불변**이고 원본이 재수출하므로 호출부는 무수정
 * (`influencer-keyword-store.ts` 분리와 같은 방식).
 */

/** 네이버 블로거 보강 결과 — 어드민 진단용(측정 성공 0 이 반복되면 차단/형식변경 신호).
 *  🩹 2026-07-28 추가된 3필드는 "0 인데 이유를 모르겠다"를 없애기 위한 것이다. 실제로 이 레인은
 *  라운드마다 `tried:0` 만 내보내며 멈춰 있었고(손상 핸들 12,357행을 뽑아서 버리는 중), 원인을 찾는 데
 *  스냅샷이 아니라 라이브 행을 직접 조회해야 했다. `selected/skipped` 만 있었으면 한 번에 보였다. */
export interface NaverEnrichDiag {
  tried: number; measured: number; contacts: number; failed: number
  /** 📧 그중 **이메일**만(2026-07-29) — `contacts` 는 인스타·링크만 채워도 +1 이라 '쓸 수 있는 리드'를 못 센다.
   *  실제로 풀에서 with_contact(3,542)가 with_email(2,359)보다 빨리 늘고 있었는데 그 격차가 안 보였다. */
  emails?: number
  /** 🚧 **차단으로 판정돼 스탬프 없이 넘긴 행**(2026-08-04). `failed` 의 부분집합이다.
   *  이게 0 보다 크면 그 회차의 수율은 **키워드 성적이 아니라 사고 기록**이다 — `naver-crawl-block.ts`. */
  blocked?: number
  /** 🚧 회차 말 차단 스냅샷(연속·누적·발동 여부). `tripped` 참이면 남은 행을 안 집고 멈춘 것. */
  crawl_block?: { streak: number; blocked: number; ok: number; tripped: boolean }
  selected?: number   // 후보 SELECT 가 실제로 돌려준 행 수(0 이면 큐가 빈 것 · >0 인데 tried 0 이면 전량 스킵)
  skipped?: number    // 핸들을 못 살려 스킵한 행(= 복구 불가 — healNaverHandles 의 unfixable 과 같은 집합)
  healed?: number     // 🩹 이번 라운드에 channel_id/url 에서 핸들을 되살려 측정한 행
  /** 🎁 이미 받은 RSS 에서 **더 뽑은** 것(추가 fetch 0) — 2026-07-29 대표 4축(카테고리화·정보 최대 수집).
   *  ⚠️ 이 환경에선 `rss.blog.naver.com` 이 프록시 차단이라 응답 실물을 못 봤다.
   *     그래서 이 카운터들이 **필드 존재 여부의 판정 근거**다: 계속 0 이면 그 필드는 오지 않는 것이니
   *     추측으로 파서를 더 손대지 말고 이 경로를 접을 것. */
  rss_cat?: number     // `<category>`(블로거 자기분류)를 받은 행
  rss_intro?: number   // 채널 `<description>`(블로그 소개글)을 받은 행
  rss_emails?: number  // 그 소개글에서 **처음** 이메일을 얻은 행
  cat_body?: number    // 글 본문 빈도로 **빈칸을** 채운 행(기존 분류 덮어쓰기 아님)
  /** 🏠 홈 fetch 를 생략한 행(연락처 4종이 이미 다 차 있어 응답이 버려질 것) — 아낀 서브리퀘스트 수와 같다. */
  home_skipped?: number
  /** ⏱️ 남은 창이 바닥값보다 짧아 **집지 않고 남긴** 행(2026-08-02). 이 값이 곧 "이번 라운드가 마감에
   *  걸린 정도"이고, 예전엔 이 행들이 `failed` 로 둔갑해 실패율을 오염시켰다
   *  (`enrichNaverActivity` 워커 루프의 `canStartBudgetedItem` 가드 참조). */
  window_skipped?: number
  /** 후보 조회 자체가 실패한 경우의 사유. 없으면 조회는 성공한 것 — `selected:0` 이 '큐가 빔'을 **확정**한다.
   *  (이게 없으면 조회 실패도 `selected:0` 으로 보여 "큐가 비었다"와 구분되지 않는다.) */
  query_error?: string
}
