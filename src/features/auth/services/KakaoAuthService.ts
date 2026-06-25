import type { D1Database } from '@cloudflare/workers-types';

// 🛡️ 2026-05-24: 카카오 phone_number 정규화 — '+82 10-1234-5678' → '01012345678'.
//   미동의/잘못된 형식이면 null 반환 (NULL safe — 기존 phone 보존 책임은 호출자).
function normalizeKakaoPhone(raw: string | undefined): string | null {
  if (!raw) return null
  let p = raw.replace(/[^\d]/g, '')
  if (p.startsWith('82')) p = '0' + p.slice(2)
  return /^01\d{8,9}$/.test(p) ? p : null
}

/**
 * Kakao OAuth 2.0 인증 서비스
 * 
 * 책임:
 * - Kakao OAuth 토큰 교환
 * - Kakao 사용자 정보 조회
 * - DB에 사용자 저장/업데이트
 * - 서비스 약관 조회
 */

import type { 
  KakaoTokenResponse, 
  KakaoUserInfoResponse,
  KakaoServiceTermsResponse,
  KakaoUser,
  User 
} from '../types';

export class KakaoAuthService {
  private readonly KAKAO_AUTH_URL = 'https://kauth.kakao.com';
  private readonly KAKAO_API_URL = 'https://kapi.kakao.com';
  
  constructor(
    private db: D1Database,
    private kakaoRestApiKey: string
  ) {
    if (!kakaoRestApiKey) {
      throw new Error('KAKAO_REST_API_KEY is required');
    }
  }
  
  /**
   * Authorization Code를 Access Token으로 교환
   */
  async exchangeCode(code: string, redirectUri: string): Promise<string> {
    const response = await fetch(`${this.KAKAO_AUTH_URL}/oauth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: this.kakaoRestApiKey,
        redirect_uri: redirectUri,
        code: code,
      }),
      signal: AbortSignal.timeout(8000), // 15s timeout
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('[KakaoAuthService] Token exchange failed:', errorText);
      throw new Error(`Kakao token exchange failed: ${errorText}`);
    }
    
    const data: KakaoTokenResponse = await response.json();
    
    if (!data.access_token) {
      throw new Error('No access token in response');
    }

    return data.access_token;
  }

  /**
   * Authorization Code → Access Token + Refresh Token 반환
   */
  async exchangeCodeFull(code: string, redirectUri: string): Promise<KakaoTokenResponse> {
    const response = await fetch(`${this.KAKAO_AUTH_URL}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: this.kakaoRestApiKey,
        redirect_uri: redirectUri,
        code,
      }),
      signal: AbortSignal.timeout(8000), // 15s timeout
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Kakao token exchange failed: ${errorText}`);
    }

    return response.json();
  }

  /**
   * Refresh Token으로 새 Access Token 발급
   */
  async refreshAccessToken(refreshToken: string): Promise<{ access_token: string; refresh_token?: string }> {
    const response = await fetch(`${this.KAKAO_AUTH_URL}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: this.kakaoRestApiKey,
        refresh_token: refreshToken,
      }),
      signal: AbortSignal.timeout(8000), // 15s timeout
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Kakao token refresh failed: ${errorText}`);
    }

    return response.json();
  }
  
  /**
   * Access Token으로 사용자 정보 조회
   */
  async getUserInfo(accessToken: string): Promise<KakaoUser> {
    // property_keys를 명시적으로 요청하여 닉네임/프로필 이미지가 반드시 포함되도록 함
    const response = await fetch(`${this.KAKAO_API_URL}/v2/user/me`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
      },
      body: 'property_keys=["kakao_account.profile","kakao_account.email","kakao_account.name","kakao_account.phone_number","properties.nickname","properties.profile_image"]',
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[KakaoAuthService] User info fetch failed:', errorText);
      throw new Error(`Failed to get Kakao user info: ${errorText}`);
    }

    const data: KakaoUserInfoResponse = await response.json();

    // 🛡️ 2026-05-01 진단 로그 — DEV 모드만 (production console 노이즈 방지).
    //   사용자 신고 추적용 — Kakao API 응답 raw 데이터 확인.
    if (import.meta.env.DEV) {
      console.log('[Kakao API RAW RESPONSE]', JSON.stringify({
        id: data.id,
        properties: data.properties,
        kakao_account: {
          email: data.kakao_account?.email,
          // @ts-expect-error — name 필드는 type 정의에 없을 수 있음
          name: data.kakao_account?.name,
          phone_number: data.kakao_account?.phone_number,
          profile: data.kakao_account?.profile,
        },
      }, null, 2));
    }

    if (!data.id) {
      throw new Error('Invalid user data from Kakao');
    }
    
    const kakaoUser: KakaoUser = {
      kakaoId: data.id.toString(),
      name: data.properties?.nickname ||
            data.kakao_account?.profile?.nickname ||
            'Kakao User',
      email: data.kakao_account?.email,
      emailVerified: data.kakao_account?.is_email_verified === true,
      // 🛡️ 2026-06-23 (대표 신고 — 우리 프로필이 옛 카카오 사진/배경으로 박힘): 카카오 공식 권장
      //   현행 필드 `kakao_account.profile.profile_image_url` 를 **우선**. `properties.profile_image` 는
      //   레거시라 사용자가 사진 변경해도 stale 하게 남는 케이스가 있어 후순위 폴백으로만 사용.
      profileImage: (data.kakao_account?.profile?.profile_image_url ||
                    data.properties?.profile_image || '')
                    .replace(/^http:\/\//, 'https://'),
      // 🛡️ 2026-05-24: 카카오 phone_number — scope 동의 시만 받음 (비즈 인증 앱).
      //   미동의 시 undefined → users.phone 변경 없이 NULL 유지 (기존 데이터 안 덮어씀).
      phoneNumber: data.kakao_account?.phone_number,
    };

    return kakaoUser;
  }
  
  /**
   * 🛡️ 2026-06-20 (OIDC 속도 최적화): 토큰교환 응답의 id_token(JWT)을 디코드해 사용자 식별정보 추출.
   *   → 별도 getUserInfo 카카오 왕복 1회 절약. id_token 은 우리가 TLS 로 카카오 토큰 엔드포인트에서
   *     *직접* 받은 것이라 신뢰 가능(브라우저 경유 X) → 서명검증 생략 가능(confidential client).
   *   필수 claim(sub, nickname) 누락 시 null 반환 → 호출자가 getUserInfo 로 폴백.
   *   id_token 미포함 필드(phone, 일부 email_verified)는 호출자가 보수적으로 처리.
   */
  parseIdToken(idToken: string | undefined | null): KakaoUser | null {
    if (!idToken || typeof idToken !== 'string') return null;
    try {
      const parts = idToken.split('.');
      if (parts.length !== 3) return null;
      const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const padded = b64.padEnd(b64.length + (4 - (b64.length % 4)) % 4, '=');
      const bin = atob(padded);
      // UTF-8 안전 디코드 (한글 닉네임 깨짐 방지 — atob 단독은 latin1)
      const bytes = Uint8Array.from(bin, (ch) => ch.charCodeAt(0));
      const payload = JSON.parse(new TextDecoder().decode(bytes)) as Record<string, unknown>;

      const sub = payload.sub;
      const nickname = payload.nickname;
      // sub(=kakaoId)·nickname 둘 다 있어야 fast path. 없으면 getUserInfo 폴백.
      if (!sub || typeof nickname !== 'string' || !nickname) return null;

      const picture = typeof payload.picture === 'string' ? payload.picture : '';
      return {
        kakaoId: String(sub),
        name: nickname,
        email: typeof payload.email === 'string' ? payload.email : undefined,
        // 카카오 OIDC 는 보통 인증된 이메일만 공유 + email_verified claim 동봉.
        //   claim 없으면 보수적으로 false → same-email 자동연결 게이트는 안전하게 skip.
        emailVerified: payload.email_verified === true,
        profileImage: picture.replace(/^http:\/\//, 'https://'),
        // id_token 엔 전화번호 없음 — undefined → upsert 의 COALESCE 가 기존 phone 보존.
        phoneNumber: undefined,
      };
    } catch {
      return null;
    }
  }

  /**
   * 서비스 약관 동의 내역 조회 (카카오싱크 전용)
   */
  async getServiceTerms(accessToken: string): Promise<string[]> {
    try {
      const response = await fetch(`${this.KAKAO_API_URL}/v2/user/service_terms`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
        signal: AbortSignal.timeout(8000), // 15s timeout
      });
      
      if (!response.ok) {
        console.warn('[KakaoAuthService] Service terms fetch failed (non-critical)');
        return [];
      }
      
      const data: KakaoServiceTermsResponse = await response.json();
      const tags = data.allowed_service_terms?.map(t => t.tag) || [];
      return tags;
      
    } catch (error) {
      console.warn('[KakaoAuthService] Service terms error (non-critical):', error);
      return [];
    }
  }
  
  /**
   * DB에 사용자 저장 또는 업데이트 (Upsert)
   */
  /**
   * 🛡️ 2026-05-01: Option B — 탈퇴 후 재가입 시 복원 가능 계정 체크.
   *   같은 kakao_id 의 deleted_accounts row 가 30일 내 있으면 isRestorable: true 반환.
   *   사용자에게 "이전 계정 복원" 동의 화면 표시 후 restoreUser 호출.
   *   동의 거부 시 그냥 신규 계정 생성 (옛 계정은 30일 후 hard purge cron 이 처리).
   */
  async checkRestorable(kakaoId: string): Promise<{ isRestorable: boolean; deletedAt?: string; originalName?: string | null; reregisterAvailableAt?: string }> {
    try {
      const row = await this.db
        .prepare(
          `SELECT original_name, deleted_at, reregister_available_at FROM deleted_accounts
           WHERE kakao_id = ? AND datetime(reregister_available_at) > datetime('now')
           ORDER BY deleted_at DESC LIMIT 1`
        )
        .bind(kakaoId)
        .first<{ original_name: string | null; deleted_at: string; reregister_available_at: string }>()
      if (!row) return { isRestorable: false }
      return {
        isRestorable: true,
        deletedAt: row.deleted_at,
        originalName: row.original_name,
        reregisterAvailableAt: row.reregister_available_at,
      }
    } catch {
      return { isRestorable: false }
    }
  }

  async upsertUser(kakaoUser: KakaoUser): Promise<User & { isNewUser?: boolean }> {
    try {
      // 기존 사용자 확인
      // 🛡️ 2026-05-06: profile_image 컬럼이 production 에 없을 수 있어 fallback 추가.
      //   첫 시도 → 컬럼 없으면 catch → 핵심 컬럼만 SELECT.
      let existingUser: User | null = null;
      try {
        existingUser = await this.db.prepare(`
          SELECT id, kakao_id, name, email, profile_image, created_at
          FROM users
          WHERE kakao_id = ?
        `).bind(kakaoUser.kakaoId).first<User>();
      } catch (selectErr) {
        if (import.meta.env.DEV) console.warn('[KakaoAuthService] SELECT with profile_image failed, retrying minimal:', selectErr);
        // Fallback: 최소 컬럼만 (id, kakao_id, name, email, created_at)
        const fallback = await this.db.prepare(`
          SELECT id, kakao_id, name, email, created_at
          FROM users
          WHERE kakao_id = ?
        `).bind(kakaoUser.kakaoId).first<Omit<User, 'profile_image'>>();
        if (fallback) existingUser = { ...fallback, profile_image: null } as unknown as User;
      }
      
      let userId: number;
      // 🛡️ 2026-04-30: 신규 사용자 detect — onboarding flow trigger 용
      const isNewUser = !existingUser;

      if (existingUser) {
        // 기존 사용자 업데이트
        userId = existingUser.id;
        // 🛡️ 2026-05-01: last_login_at / profile_image 컬럼이 production 에 없을 수 있음.
        //   첫 시도 → 컬럼 없으면 catch → 핵심 컬럼만 UPDATE.
        // 🛡️ 2026-05-24: phone 동기화 — 카카오에서 새로 받았고 기존이 비어있으면 채움.
        //   기존 phone 이 있으면 덮어쓰지 않음 (사용자가 직접 수정한 값 보존).
        //   COALESCE(?, phone) 패턴 — kakao phone NULL 이면 기존 phone 유지.
        const validPhone = normalizeKakaoPhone(kakaoUser.phoneNumber)
        try {
          // 🛡️ 2026-06-11 (사용자 신고 — 링크샵 프로필 이미지가 "영구적이지 않음"): 매 로그인마다
          //   카카오 프로필로 무조건 덮어써서 큐레이터 인라인 편집(/me/profile)으로 올린 커스텀
          //   이미지(r2 업로드 '/api/media/...' 등)가 다음 로그인 때 증발했음.
          //   → 현재 값이 비었거나 카카오 CDN 출처일 때만 갱신(카카오 아바타 변경은 계속 동기화),
          //   커스텀 업로드는 보존. phone 의 COALESCE 보존 패턴과 동일 사상.
          // 🛡️ 2026-06-24 (속도 최적화): email_verified 를 이 UPDATE 에 합침 — 기존엔
          //   아래에서 별도 UPDATE 1회를 더 날려 로그인마다 D1 왕복이 1번 더 들었음.
          //   기존 유저는 여기서 한 번에 갱신, 신규 유저만 INSERT 후 별도 UPDATE(아래 isNewUser 분기).
          //   email_verified 컬럼은 2026-06-06 부터 prod 존재 — 없던 레거시면 이 UPDATE 가 throw →
          //   catch 의 최소 UPDATE 로 degrade(기존에도 별도 UPDATE 가 동일하게 실패했음, 무회귀).
          await this.db.prepare(`
            UPDATE users
            SET name = ?,
                email = ?,
                profile_image = CASE
                  WHEN profile_image IS NULL OR profile_image = ''
                       OR profile_image LIKE '%kakaocdn.net%' OR profile_image LIKE '%kakao.com%'
                  THEN ? ELSE profile_image END,
                phone = COALESCE(phone, ?),
                email_verified = ?,
                updated_at = datetime('now'),
                last_login_at = datetime('now')
            WHERE id = ?
          `).bind(
            kakaoUser.name,
            kakaoUser.email || null,
            kakaoUser.profileImage || null,
            validPhone,
            kakaoUser.emailVerified === true ? 1 : 0,
            userId
          ).run();
        } catch (e) {
          if (import.meta.env.DEV) console.warn('[KakaoAuthService] UPDATE with last_login_at/profile_image failed, retrying with minimal columns:', e);
          // Fallback: 핵심 컬럼만 (name, email, updated_at)
          try {
            await this.db.prepare(`
              UPDATE users
              SET name = ?,
                  email = ?,
                  updated_at = datetime('now')
              WHERE id = ?
            `).bind(
              kakaoUser.name,
              kakaoUser.email || null,
              userId
            ).run();
          } catch (e2) {
            // 🛡️ 2026-05-06: 최소 UPDATE 도 실패 → 가장 마지막으로 updated_at 만 시도.
            //   여전히 실패해도 login 자체는 진행 (UPDATE 는 부가적인 작업).
            try {
              await this.db.prepare(`UPDATE users SET updated_at = datetime('now') WHERE id = ?`).bind(userId).run();
            } catch (e3) {
              if (import.meta.env.DEV) console.warn('[KakaoAuthService] all UPDATE attempts failed (non-fatal):', e3);
            }
          }
        }

      } else {
        // 🛡️ 2026-05-22 P0 보안 fix (이메일 takeover 방어 — Google OAuth 와 동일 패턴):
        //   기존 사용자가 이메일/비번 또는 다른 OAuth 로 동일 이메일 가입되어 있으면
        //   신규 kakao_id 로 user row 생성 → 이메일 중복 + 데이터 분리 + impersonation risk.
        //   해결: 이메일이 이미 다른 method 로 등록되어 있으면 EMAIL_ALREADY_LINKED 에러.
        //         프론트가 "기존 계정으로 로그인 후 카카오 연동" 안내.
        if (kakaoUser.email) {
          try {
            const emailOwner = await this.db.prepare(
              `SELECT id, kakao_id, password_hash FROM users
                WHERE email = ? AND email IS NOT NULL LIMIT 1`
            ).bind(kakaoUser.email).first<{ id: number; kakao_id: string | null; password_hash: string | null }>();
            if (emailOwner && (emailOwner.kakao_id !== kakaoUser.kakaoId || emailOwner.password_hash)) {
              const err = new Error('EMAIL_ALREADY_LINKED_TO_OTHER_METHOD') as Error & { code?: string; existingMethod?: string };
              err.code = 'EMAIL_ALREADY_LINKED_TO_OTHER_METHOD';
              err.existingMethod = emailOwner.password_hash ? 'password' : 'other_oauth';
              throw err;
            }
          } catch (e: unknown) {
            // 우리가 던진 에러 그대로 throw, DB 에러는 graceful continue (테이블 schema 부재 등).
            if ((e as { code?: string })?.code === 'EMAIL_ALREADY_LINKED_TO_OTHER_METHOD') throw e;
            if (import.meta.env.DEV) console.warn('[KakaoAuthService] email check skipped:', e);
          }
        }

        // 🛡️ 2026-05-01: production users 테이블에 toss_user_id 컬럼 없음.
        //   kakao_id UNIQUE constraint 도 production 에 없을 가능성 — 보강 시도.
        try {
          await this.db.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS idx_users_kakao_id_unique ON users(kakao_id) WHERE kakao_id IS NOT NULL`).run()
        } catch { /* 인덱스 이미 존재 또는 권한 X */ }

        // 🛡️ 2026-05-01 (CRITICAL fix): last_row_id 의존 제거 — 사용자 신고로
        //   "다른 카카오 계정 신규 가입자도 유어팀(정지원) 으로 표시" 가능성:
        //   D1 의 last_row_id 가 항상 새 row 의 ID 를 반환한다고 보장 X.
        //   해결: INSERT 후 kakao_id 로 다시 SELECT — 100% 새 사용자 row 보장.
        // 🛡️ 2026-05-24: 신규 사용자 INSERT 시 카카오에서 받은 phone 동시 저장.
        //   비즈 미인증 앱 → phone_number 안 받아짐 → NULL 로 INSERT (기존 동작 유지).
        const validPhone = normalizeKakaoPhone(kakaoUser.phoneNumber)
        try {
          await this.db.prepare(`
            INSERT INTO users (
              kakao_id,
              name,
              email,
              profile_image,
              phone,
              created_at,
              last_login_at,
              updated_at
            ) VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'), datetime('now'))
          `).bind(
            kakaoUser.kakaoId,
            kakaoUser.name,
            kakaoUser.email || null,
            kakaoUser.profileImage || null,
            validPhone
          ).run();
        } catch (insertErr) {
          // INSERT 실패 — UNIQUE constraint 위반 (race condition) 가능. 무시 후 아래 SELECT.
          if (import.meta.env.DEV) console.warn('[KakaoAuthService] INSERT failed (likely race or UNIQUE):', insertErr);
        }

        // 🛡️ INSERT 성공/race 무관 — kakao_id 로 SELECT 해서 정확한 user 찾음.
        //   last_row_id 가 0 또는 다른 row 의 ID 를 반환하더라도 안전.
        const insertedUser = await this.db.prepare(`
          SELECT id FROM users WHERE kakao_id = ?
        `).bind(kakaoUser.kakaoId).first<{ id: number }>();
        if (!insertedUser) {
          throw new Error(`Failed to find user after INSERT for kakao_id=${kakaoUser.kakaoId}`);
        }
        userId = insertedUser.id;
      }

      // 🛡️ 2026-06-06 (보안, 사용자 승인): 카카오 email verified 상태를 users 에 저장 —
      //   도매(become-distributor)·제조(become) 자동 same-email 연결 게이트의 SSOT.
      //   미verified email 로 사전등록된(관리자 시드) 승인 계정 takeover 차단용. best-effort
      //   (컬럼 없으면 repair-schema 후 다음 로그인에 채워짐 — login 자체는 비차단).
      // 🛡️ 2026-06-24 (속도 최적화): 기존 유저는 위 프로필 UPDATE 에 email_verified 를 합쳐
      //   이미 갱신함 → 여기선 신규 유저(INSERT 직후)만 별도 1회. 로그인당 D1 왕복 -1.
      if (isNewUser) {
        try {
          await this.db.prepare(`UPDATE users SET email_verified = ? WHERE id = ?`)
            .bind(kakaoUser.emailVerified === true ? 1 : 0, userId).run();
        } catch { /* 컬럼 미존재 — 비치명적, repair-schema 가 컬럼 추가 */ }
      }

      // 사용자 정보 다시 조회하여 반환.
      // 🛡️ 2026-05-06: profile_image 컬럼 production 에 없을 수도 있어 fallback 추가.
      let user: User | null = null;
      try {
        user = await this.db.prepare(`
          SELECT id, kakao_id, name, email, profile_image, created_at
          FROM users
          WHERE id = ?
        `).bind(userId).first<User>();
      } catch (selectErr) {
        if (import.meta.env.DEV) console.warn('[KakaoAuthService] final SELECT with profile_image failed, retrying minimal:', selectErr);
        const fallback = await this.db.prepare(`
          SELECT id, kakao_id, name, email, created_at
          FROM users
          WHERE id = ?
        `).bind(userId).first<Omit<User, 'profile_image'>>();
        if (fallback) user = { ...fallback, profile_image: null } as unknown as User;
      }

      if (!user) {
        throw new Error('Failed to retrieve user after upsert');
      }

      // 🛡️ 2026-05-27 (영구 fix): same-email seller auto-link.
      //   문제: 시드 데이터 또는 셀러 가입 시 sellers.linked_user_id 가 NULL 인 경우
      //   카카오 user 로그인 → curator dashboard 가 linked_seller 못 찾음 → BottomNav 가
      //   /host/new 로 fall through (사용자 보고).
      //   해결: 같은 email 의 seller 가 있고 linked_user_id IS NULL 이면 자동 매핑.
      //   idempotent — linked_user_id 이미 있으면 skip.
      // 🛡️ 2026-05-31 보안([UNLOCK_LOADING] 사용자 승인): 카카오 email 이 verified 일 때만 자동연결.
      //   미verified email 로는 사전 생성된 미연결 셀러 행 takeover 불가하도록 게이트.
      if (user.email && kakaoUser.emailVerified === true) {
        // 🏭 2026-06-05 [UNLOCK] (사용자 승인 — 정지원/디스크프리 계정 중첩 근본수정):
        //   users.email 에 UNIQUE 제약이 없어, 두 카카오 계정이 같은 email 을 공유하면(또는 시드 중복)
        //   이 자동연결이 '다른 사람의 미연결 셀러'를 이 유저에 붙여 링크샵이 옛 계정으로 뜰 수 있음.
        //   → email 이 정확히 이 유저 1명에게만 속할 때(모호하지 않을 때)만 연결. 모호하면 연결 보류(안전).
        // 🛡️ 2026-06-24 (속도 최적화): dupe COUNT 를 별도 SELECT → UPDATE 의 WHERE 서브쿼리로
        //   합침. 로그인당 D1 왕복 -1. 의미 동일(이 email 이 정확히 1명에게만 속할 때만 연결) +
        //   원자적이라 기존의 COUNT→UPDATE 사이 race(TOCTOU)도 제거 — 더 안전해짐.
        await this.db.prepare(
          `UPDATE sellers SET linked_user_id = ?, updated_at = datetime('now')
           WHERE email = ? AND (linked_user_id IS NULL OR linked_user_id = 0)
             AND (SELECT COUNT(*) FROM users WHERE email = ? AND email IS NOT NULL AND email != '') <= 1`
        ).bind(user.id, user.email, user.email).run().catch(() => null);
      }

      return { ...user, isNewUser };
      
    } catch (error) {
      console.error('[KakaoAuthService] DB error:', error);
      throw new Error(`Database error: ${(error as Error).message}`);
    }
  }
  
  /**
   * Firebase UID를 DB에 저장
   */
  async updateFirebaseUID(userId: number, firebaseUID: string): Promise<void> {
    try {
      await this.db.prepare(`
        UPDATE users SET firebase_uid = ? WHERE id = ?
      `).bind(firebaseUID, userId).run();
      
    } catch (error) {
      // firebase_uid 컬럼이 없을 수 있으므로 경고만 출력
      console.warn('[KakaoAuthService] firebase_uid column not found, skipping update:', error);
    }
  }
}
