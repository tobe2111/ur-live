-- 🤝 손바뀜 마감 payout 을 식별하고, 그 돈이 "누구 것이었는지" 를 행에 남긴다 (2026-09-08).
--
-- 왜 필요한가: 마감 payout 이 취소되면 그 금액이 원장으로 되살아나
-- (payouts-generate 는 cancelled/failed 를 안 뺀다) **새 주인에게** 간다.
-- 그걸 막으려면 ① 이 행이 마감인지 ② 만들 때 주인이 누구였는지를 알아야 한다.
-- admin_memo(자유 문구)로는 못 한다 — 문장을 제어 신호로 쓰면 오타 한 번에 게이트가 풀린다.
ALTER TABLE payouts ADD COLUMN kind TEXT;
ALTER TABLE payouts ADD COLUMN payee_user_id INTEGER;
