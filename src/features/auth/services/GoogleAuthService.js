export class GoogleAuthService {
    db;
    constructor(db) {
        this.db = db;
    }
    /**
     * Google ID Token에서 사용자 정보 추출
     * (Firebase Auth에서 이미 검증된 토큰 사용)
     */
    extractUserFromToken(tokenPayload) {
        if (!tokenPayload.email_verified) {
            throw new Error('Google email not verified');
        }
        return {
            googleId: tokenPayload.sub,
            email: tokenPayload.email ?? "",
            name: tokenPayload.name || (tokenPayload.email ?? "").split('@')[0],
            profileImage: tokenPayload.picture
        };
    }
    /**
     * DB에 Google 사용자 저장 또는 업데이트
     */
    async upsertUser(googleUser) {
        console.log('[GoogleAuthService] Upserting user to DB...');
        try {
            // 기존 사용자 확인
            const existingUser = await this.db.prepare(`
        SELECT id, google_id, name, email, profile_image, created_at
        FROM users 
        WHERE google_id = ? OR email = ?
      `).bind(googleUser.googleId, googleUser.email).first();
            let userId;
            if (existingUser) {
                // 기존 사용자 업데이트
                userId = existingUser.id;
                await this.db.prepare(`
          UPDATE users 
          SET google_id = ?,
              name = ?, 
              email = ?, 
              profile_image = ?,
              updated_at = datetime('now'),
              last_login_at = datetime('now')
          WHERE id = ?
        `).bind(googleUser.googleId, googleUser.name, googleUser.email, googleUser.profileImage || null, userId).run();
                console.log('[GoogleAuthService] ✅ Updated user:', userId);
            }
            else {
                // 새 사용자 생성
                const result = await this.db.prepare(`
          INSERT INTO users (
            google_id,
            name, 
            email, 
            profile_image,
            created_at,
            last_login_at,
            updated_at
          ) VALUES (?, ?, ?, ?, datetime('now'), datetime('now'), datetime('now'))
        `).bind(googleUser.googleId, googleUser.name, googleUser.email, googleUser.profileImage || null).run();
                userId = result.meta.last_row_id;
                console.log('[GoogleAuthService] ✅ Created user:', userId);
            }
            // 사용자 정보 다시 조회하여 반환
            const user = await this.db.prepare(`
        SELECT id, google_id, name, email, profile_image, firebase_uid, created_at
        FROM users
        WHERE id = ?
      `).bind(userId).first();
            if (!user) {
                throw new Error('Failed to retrieve user after upsert');
            }
            return user;
        }
        catch (error) {
            console.error('[GoogleAuthService] DB error:', error);
            throw new Error(`Database error: ${error.message}`);
        }
    }
    /**
     * Firebase UID를 DB에 저장
     */
    async updateFirebaseUID(userId, firebaseUID) {
        try {
            await this.db.prepare(`
        UPDATE users SET firebase_uid = ? WHERE id = ?
      `).bind(firebaseUID, userId).run();
            console.log('[GoogleAuthService] ✅ Firebase UID updated for user:', userId);
        }
        catch (error) {
            console.warn('[GoogleAuthService] firebase_uid column not found, skipping update:', error);
        }
    }
}
