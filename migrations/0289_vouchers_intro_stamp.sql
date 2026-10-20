-- 🤝 이용권이 **판 시점의 영입자**를 기억한다 (2026-09-09 — 대표 원칙 "귀속되는 시점부터 계산")
--
-- 종전: 사용 시점에 매장의 *현재* 영입자를 읽어 커미션을 줬다. 그래서 영입자가 바뀌면
-- **과거에 팔린 이용권의 커미션까지 오늘의 영입자에게** 갔다(소급). 에러가 안 나서 안 보인다.
--
-- `intro_stamped_at` 이 핵심이다 — 이게 있어야 "영입자 없음(NULL)"과 "옛 이용권(미판정)"을
-- 구분할 수 있다. 구분 못 하면 옛 이용권이 전부 "영입자 없음"으로 접혀 실제 보상이 사라진다.
ALTER TABLE vouchers ADD COLUMN introduced_by_influencer_id INTEGER;
ALTER TABLE vouchers ADD COLUMN intro_stamped_at DATETIME;
