/**
 * 🚀 2026-10-10 — 기존 회원 카카오 로그인의 D1 왕복을 **한 번**으로 (대표 "남은 비효율 둘 해결해줘").
 *
 * 왜 떼어 냈나:
 *   `upsertUser` 는 종전에 [조회(kakao_id) → 갱신(id) → 재조회(id)] 를 **차례로** 돌았다.
 *   라이브 7일 실측(`/api/_internal/kakao-login-diag`)에서 이 구간(`ms_db`)이 평균 **423ms**
 *   (max 765)로, 콜백 서버시간 1,224ms 중 카카오 토큰교환(662ms) 다음으로 큰 덩어리였다.
 *   셋이 직렬이던 **유일한 이유는 갱신이 앞 조회의 `id` 에 묶여 있었던 것**이다.
 *
 *   ⇒ 갱신을 `WHERE kakao_id = ?` 로 걸면 그 의존이 끊겨 **한 batch** 에 담을 수 있고,
 *     batch 안에서 갱신 **다음** 조회가 돌므로 **갱신된 행**을 그대로 돌려받아 재조회도 사라진다.
 *     (기존 회원 · 인증 이메일 보유 기준 D1 왕복 **4 → 2**. 나머지 1은 잠긴 셀러 자동연결이다.)
 *
 * 🔒 정확히 한 행만 맞는다: `idx_users_kakao_id_unique`(partial UNIQUE) 실재 +
 *    라이브 `kakao_id` 중복 **0 실측**(2026-10-10).
 *
 * 🆕 신규 회원은 왕복이 **안 늘어난다** — 갱신이 0행 no-op 이고 조회가 null 이라, 이 함수가
 *    종전 '선행 조회' 자리를 그대로 차지하고 호출부는 INSERT 경로로 떨어진다.
 *
 * ⚠️ 레거시 스키마(`last_login_at`·`profile_image`·`email_verified` 부재)면 batch **전체**가
 *    throw 한다(트랜잭션). 그래서 `ok: false` 로 돌려주고 호출부가 **종전 직렬 경로 + 폴백
 *    계단 3단을 그대로** 타게 한다 — 무회귀가 이 설계의 조건이다.
 *
 * 🔑 SET 절은 호출부(`KakaoAuthService` 의 직렬 폴백 UPDATE)와 **같은 컬럼 집합**이어야 한다.
 *    갈리면 로그인마다 다른 값이 쓰이는데 **에러가 안 난다** — 가드가 두 문장의 컬럼을 대조한다.
 */
import type { D1Database } from '@cloudflare/workers-types';
import type { KakaoUser, User } from '../types';

/** 카카오 phone_number 정규화 결과(미동의/이상 형식이면 null)를 받는다 — 규칙은 호출부 SSOT. */
export type FastUpsertResult = { ok: boolean; row: User | null };

export async function fastUpsertExistingKakaoUser(
  db: D1Database,
  kakaoUser: KakaoUser,
  validPhone: string | null,
): Promise<FastUpsertResult> {
  try {
    const rs = await db.batch([
      db.prepare(`
            UPDATE users
            SET name = ?,
                email = COALESCE(?, email),
                profile_image = CASE
                  WHEN profile_image IS NULL OR profile_image = ''
                       OR profile_image LIKE '%kakaocdn.net%' OR profile_image LIKE '%kakao.com%'
                  THEN ? ELSE profile_image END,
                phone = COALESCE(phone, ?),
                email_verified = ?,
                updated_at = datetime('now'),
                last_login_at = datetime('now')
            WHERE kakao_id = ?
          `).bind(
        kakaoUser.name,
        kakaoUser.email || null,
        kakaoUser.profileImage || null,
        validPhone,
        kakaoUser.emailVerified === true ? 1 : 0,
        kakaoUser.kakaoId,
      ),
      db.prepare(`
            SELECT id, kakao_id, name, email, profile_image, created_at
            FROM users
            WHERE kakao_id = ?
          `).bind(kakaoUser.kakaoId),
    ]);
    return { ok: true, row: ((rs[1]?.results?.[0] as User | undefined) ?? null) };
  } catch (e) {
    if (import.meta.env.DEV) console.warn('[kakao-upsert-fast] batch 실패 — 직렬 경로로 폴백:', e);
    return { ok: false, row: null };
  }
}
