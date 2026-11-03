/**
 * 🩹 2026-11-03 — 부팅 때 서버 세션(ur_session)으로 소비자 표시(localStorage `user_id`/`session_login`)를
 * 되살렸을 때 쏘는 이벤트. 헤더처럼 렌더 때 localStorage 를 읽는 곳이 다시 그리게 한다.
 * 별도 파일인 이유: 헤더가 부팅 모듈(`auth-callback-bootstrap`)을 통째로 끌고 오지 않게(첫 화면 무게).
 */
export const CONSUMER_SESSION_RESTORED_EVENT = 'ur-consumer-session-restored'
