-- 🛡️ 2026-05-18: live_streams.youtube_video_id NULL 허용.
--   배경: 에이전시가 셀러용 라이브를 사전에 예약/생성할 때 youtube_video_id 는
--   방송 시작 시점에 발급됨. 기존 NOT NULL 은 워크플로우와 안 맞음.
--   D1 (SQLite) 은 ALTER COLUMN 직접 지원 안 함 — 컬럼 추가 / 데이터 복사 패턴.
--   하지만 기존 운영 데이터가 많으므로, 단순화: 빈 문자열 '' 을 default 로 두고
--   코드에서 || '' fallback (이미 사용 중인 패턴). 별도 ALTER 미적용.
--
--   대신 NOT NULL INSERT audit 가드는 통과시켜야 하므로 코드에서 빈 문자열 명시.

-- 데이터 sanity: 기존 NULL row 가 있다면 빈 문자열 처리 (혹시 모를 schema drift 대비).
UPDATE live_streams SET youtube_video_id = '' WHERE youtube_video_id IS NULL;
