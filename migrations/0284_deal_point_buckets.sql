-- 💸 2026-07-05 딜 포인트 유상/무상 이중 버킷 (약관 "무상 딜 우선 차감·무상 딜 환급 제외" 시스템 강제)
-- SSOT: src/worker/utils/point-buckets.ts
--  - user_points.free_balance: 무상(리워드·이벤트·초대) 잔액. 유상 = balance - free_balance (파생).
--  - point_transactions.free_delta: 거래별 무상 버킷 적용분 (적립 +, 차감 -). 환불 대칭 복원 근거.
-- 프로덕션 반영은 repair-schema(/api/_internal/repair-schema) + ensureDealBuckets 런타임 보장.

ALTER TABLE user_points ADD COLUMN free_balance INTEGER NOT NULL DEFAULT 0;
ALTER TABLE point_transactions ADD COLUMN free_delta INTEGER DEFAULT 0;
