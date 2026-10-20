-- 🎁 2026-07-05 체험단(FCFS) 참여 리뷰 자동 표시 (표시광고법 — 경제적 대가 표시 의무)
-- 작성 API(reviews.routes POST /)가 fcfs_applications(selected/paid) 서버 판정으로 세팅 — 작성자가 끌 수 없음.
-- 프로덕션 반영은 repair-schema + reviews.routes ensureTable 런타임 ALTER 가 보장.

ALTER TABLE product_reviews ADD COLUMN is_sponsored INTEGER DEFAULT 0;
