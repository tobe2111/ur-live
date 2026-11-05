# [LOADING_ADDITIVE] 2026-11-05 — `/vouchers/my` 색인 보장을 사본 읽기 확인 먼저

- 파일: `src/features/group-buy/api/group-buy-public.routes.ts` (`/vouchers/my`)
- 대표: *"잠금파일도 모두 허가해줄게"*(2026-11-04) · *"계속 최적화"*(2026-11-05)
- 무엇: isolate 당 1회 `CREATE INDEX IF NOT EXISTS idx_vouchers_user_created`(원본 쓰기 1왕복) →
  `schemaPresent(DB, { indexes: [...] })` 로 **가까운 사본에서 읽어** 있으면 건너뛴다. 없을 때만 종전 DDL.
- 왜: 손님이 적은 콜로(HKG·NRT)는 요청 대부분이 새 isolate 라 "isolate 당 1회" 가 사실상 매 요청이다.
- 결과 불변: 같은 SELECT · 같은 응답. 색인이 없는 DB 는 지금과 똑같이 만들어진다.
- 같은 PR: 블로그 `ensureBlogTable`(DDL 7) · 쿠폰 `ensureTables`(2) · 알림 설정 `ensureNotificationPrefColumns`(2).
- 시험: `replica-session-no-ddl-2026-11-05` · `partial-slow-round2-2026-11-02`(재조준).
