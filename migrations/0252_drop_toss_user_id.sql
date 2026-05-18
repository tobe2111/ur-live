-- 🛡️ 2026-05-17: users.toss_user_id 컬럼 production drop 명시.
--
-- 배경: migration 0001 이 users.toss_user_id 를 NOT NULL UNIQUE 로 정의했지만
--   0029 migration 이 "skip - application 에서 처리" 로 명목상 제거.
--   실제 production 은 컬럼 자체가 drop 됨 (2026-05-01 Kakao 로그인 에러로 확인).
--   코드 주석에 명시되어 있지만 마이그레이션이 따로 없어 자동 검증이 못 잡음.
--
-- 본 마이그레이션은:
-- 1. production 에 이미 drop 된 케이스: ALTER 가 'no such column' 실패 → IF EXISTS 로 가드.
--    (D1 은 IF EXISTS 지원 안 함 → try block 으로 application repair-schema 가 처리).
-- 2. dev/test DB 에 컬럼이 남아 있는 경우: ALTER 실행 → drop 처리.
--
-- 효과: NOT NULL INSERT 체커가 users.toss_user_id 를 더는 누락 컬럼으로 보고하지 않음.

-- D1 ALTER TABLE DROP COLUMN — column 없으면 에러. 마이그레이션 시스템이 try/catch 하므로
--   transparent 한 fail 시 그대로 진행.
ALTER TABLE users DROP COLUMN toss_user_id;

-- 인덱스도 drop (관련 인덱스가 있던 경우)
DROP INDEX IF EXISTS idx_users_toss_id;
