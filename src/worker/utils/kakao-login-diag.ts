/**
 * 카카오 로그인 진단 로깅 (관측/회귀 감지용).
 *
 * 목적 (2026-06-20): iOS(Safari/WebKit) 카카오 로그인 실패 수정(signed-state fallback)
 *   이후, 실제로 iOS 로그인이 성공하는지 수치로 확인 + 재발 즉시 감지.
 *
 * 설계 원칙:
 *   - fail-soft: 진단 실패는 절대 로그인 흐름을 막지 않음 (모든 경로 try-catch).
 *   - per-request DDL 금지: ensureDiagTable 은 WeakSet 메모이즈 (요청당 1회 X).
 *   - 테이블 크기 제한: ~2% 확률로 오래된 행 정리(최근 3000개 유지) → write 부담 최소.
 *   - PII 미저장: kakao_id/email/이름 저장 안 함. 브라우저 종류·결과·플래그만.
 *
 * 조회: GET /api/_internal/kakao-login-diag (requireAdmin).
 */

const _diagEnsured = new WeakSet<D1Database>();

async function ensureDiagTable(DB: D1Database): Promise<void> {
  if (_diagEnsured.has(DB)) return;
  _diagEnsured.add(DB);
  try {
    await DB.prepare(
      `CREATE TABLE IF NOT EXISTS kakao_login_diag (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        created_at TEXT DEFAULT (datetime('now')),
        outcome TEXT,             -- 'success' | 'error'
        reason TEXT,              -- 'ok' | error code (oauth_state_expired 등)
        browser TEXT,             -- ios_safari / kakao_inapp_ios / android_chrome / ...
        ios INTEGER,              -- 1 = iOS WebKit 계열
        had_state_cookie INTEGER, -- 1 = state 쿠키 존재(쿠키 경로) / 0 = 쿠키 유실
        signed_fallback INTEGER,  -- 1 = 서명 state fallback 으로 복구(쿠키 없이 성공)
        is_new INTEGER            -- 1 = 신규 가입
      )`
    ).run();
  } catch { /* fail-soft — 진단 테이블 생성 실패해도 로그인 정상 */ }
}

/**
 * User-Agent → 브라우저 종류 분류. 핵심 신호는 `ios`(iOS 는 모두 WebKit).
 */
export function classifyBrowser(ua: string | null | undefined): { browser: string; ios: number } {
  const u = ua || '';
  const ios = /iPhone|iPad|iPod/i.test(u) ? 1 : 0;
  let browser = 'other';
  if (/KAKAOTALK/i.test(u)) browser = ios ? 'kakao_inapp_ios' : 'kakao_inapp_android';
  else if (ios) browser = /CriOS/i.test(u) ? 'ios_chrome' : (/FxiOS/i.test(u) ? 'ios_firefox' : 'ios_safari');
  else if (/Android/i.test(u)) browser = /Chrome|CriOS/i.test(u) ? 'android_chrome' : 'android_other';
  else if (/Edg\//i.test(u)) browser = 'desktop_edge';
  else if (/Chrome\//i.test(u)) browser = 'desktop_chrome';
  else if (/Firefox\//i.test(u)) browser = 'desktop_firefox';
  else if (/Safari\//i.test(u)) browser = 'desktop_safari';
  return { browser, ios };
}

export interface KakaoDiagFields {
  outcome: 'success' | 'error';
  reason: string;
  ua: string | null | undefined;
  hadStateCookie: boolean;
  signedFallback: boolean;
  isNew?: boolean;
}

/**
 * 카카오 콜백 결과 1건 기록. fail-soft (절대 throw 안 함).
 */
export async function recordKakaoLoginDiag(DB: D1Database, f: KakaoDiagFields): Promise<void> {
  try {
    await ensureDiagTable(DB);
    const { browser, ios } = classifyBrowser(f.ua);
    await DB.prepare(
      `INSERT INTO kakao_login_diag (outcome, reason, browser, ios, had_state_cookie, signed_fallback, is_new)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      f.outcome,
      f.reason,
      browser,
      ios,
      f.hadStateCookie ? 1 : 0,
      f.signedFallback ? 1 : 0,
      f.isNew ? 1 : 0,
    ).run();
    // 약 2% 확률로 오래된 행 정리 — 최근 3000개만 유지(write 부담 최소).
    if (Math.random() < 0.02) {
      await DB.prepare(
        `DELETE FROM kakao_login_diag WHERE id < (SELECT MAX(id) - 3000 FROM kakao_login_diag)`
      ).run().catch(() => { /* 정리 실패 무시 */ });
    }
  } catch { /* 진단 실패는 로그인에 영향 없음 */ }
}
