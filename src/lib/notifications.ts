/**
 * 유어딜 알림 시스템 — 역할별 분리
 *
 * ┌─────────────┬──────────────┬────────────┬────────────┐
 * │ 채널         │ 발송 주체     │ 비용       │ 대상        │
 * ├─────────────┼──────────────┼────────────┼────────────┤
 * │ 인앱 알림    │ 시스템 자동   │ 무료       │ 모든 유저    │
 * │ 카카오 메시지 │ 시스템 자동   │ 무료       │ 카카오 유저  │
 * │ 알림톡(주문)  │ 시스템 자동   │ 플랫폼 부담 │ 전화번호 유저│
 * │ 알림톡(마케팅)│ 셀러 수동    │ 셀러 크레딧 │ 셀러 선택   │
 * │ 카카오 캘린더 │ 유저 직접    │ 무료       │ 유저 본인   │
 * │ 대시보드 알림 │ 시스템 자동   │ 무료       │ 셀러/어드민  │
 * └─────────────┴──────────────┴────────────┴────────────┘
 *
 * 트리거 목록:
 *
 * [시스템 → 소비자]
 * - 주문 상태 변경 (확인/배송/완료/취소) → 인앱 + 알림톡(주문)
 * - 방송 시작 → 인앱 + 카카오 메시지 (구독자)
 * - 방송 30분 전 → 인앱 (구독자)
 * - 팔로우 셀러 새 상품 → 인앱 (팔로워)
 * - 팔로우 셀러 방송 예고 → 인앱 (팔로워)
 * - 환불 완료 → 인앱
 * - 쿠폰 만료 임박 → 인앱 (크론)
 * - 공동구매 달성 → 인앱
 *
 * [시스템 → 셀러]
 * - 새 주문 → 대시보드
 * - 새 리뷰 → 대시보드
 * - 구매 확정/정산 가능 → 대시보드
 * - 새 팔로워 → 대시보드
 * - 후원 수령 → 대시보드
 * - 재고 품절 임박 → 대시보드 (크론)
 * - 공동구매 달성 → 대시보드 (크론)
 * - 반품 신청 → 대시보드
 *
 * [시스템 → 어드민]
 * - 새 주문 → 대시보드
 * - 정산 신청 → 대시보드
 * - 반품 신청 → 대시보드
 * - 후원 발생 → 대시보드
 *
 * [셀러 → 소비자]
 * - 브랜드메시지 (알림톡) → 셀러가 크레딧으로 직접 발송
 *
 * [유저 → 본인]
 * - 카카오 캘린더 추가 → 유저가 직접 클릭
 */

// ─── 인앱 알림 (소비자) ───────────────────────────────────────────
export async function notifyUser(DB: D1Database, userId: string, type: string, title: string, message?: string, link?: string) {
  try {
    await DB.prepare(`INSERT INTO user_notifications (user_id, type, title, message, link) VALUES (?, ?, ?, ?, ?)`)
      .bind(userId, type, title, message ?? null, link ?? null).run();
  } catch {}
}

// ─── 대시보드 알림 (셀러) ───────────────────────────────────────────
export async function notifySeller(DB: D1Database, sellerId: string | number, type: string, title: string, message?: string, link?: string) {
  try {
    await DB.prepare(`INSERT INTO dashboard_notifications (recipient_type, recipient_id, type, title, message, link) VALUES ('seller', ?, ?, ?, ?, ?)`)
      .bind(String(sellerId), type, title, message ?? null, link ?? null).run();
  } catch {}
}

// ─── 대시보드 알림 (어드민) ───────────────────────────────────────────
export async function notifyAdmin(DB: D1Database, type: string, title: string, message?: string, link?: string) {
  try {
    await DB.prepare(`INSERT INTO dashboard_notifications (recipient_type, recipient_id, type, title, message, link) VALUES ('admin', NULL, ?, ?, ?, ?)`)
      .bind(type, title, message ?? null, link ?? null).run();
  } catch {}
}

// ─── 팔로워 일괄 알림 (소비자, 인앱) ────────────────────────────────────
export async function notifyFollowers(DB: D1Database, sellerId: number, type: string, title: string, message?: string, link?: string) {
  try {
    const { results } = await DB.prepare('SELECT user_id FROM seller_follows WHERE seller_id = ?').bind(sellerId).all<{ user_id: string }>();
    if (!results?.length) return;
    const stmts = results.map(f =>
      DB.prepare('INSERT INTO user_notifications (user_id, type, title, message, link) VALUES (?, ?, ?, ?, ?)')
        .bind(f.user_id, type, title, message ?? null, link ?? null)
    );
    for (let i = 0; i < stmts.length; i += 50) {
      await DB.batch(stmts.slice(i, i + 50));
    }
  } catch {}
}

// ─── 에이전시 알림 ───────────────────────────────────────────────
export async function notifyAgencyForSeller(DB: D1Database, sellerId: number, type: string, title: string, message?: string, link?: string) {
  try {
    await DB.prepare(`CREATE TABLE IF NOT EXISTS agency_notifications (id INTEGER PRIMARY KEY AUTOINCREMENT, agency_id INTEGER NOT NULL, type TEXT NOT NULL, title TEXT NOT NULL, message TEXT, link TEXT, is_read INTEGER DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`).run().catch(() => {})
    const agency = await DB.prepare('SELECT agency_id FROM agency_sellers WHERE seller_id = ?').bind(sellerId).first<{ agency_id: number }>()
    if (!agency) return
    await DB.prepare('INSERT INTO agency_notifications (agency_id, type, title, message, link) VALUES (?, ?, ?, ?, ?)')
      .bind(agency.agency_id, type, title, message ?? null, link ?? null).run()
  } catch {}
}

// ─── 카카오톡 메시지 (소비자, 구독자 대상, 시스템 자동) ─────────────────
export async function sendKakaoMessageToSubscribers(DB: D1Database, streamId: number, title: string, sellerName: string, kakaoRestApiKey?: string) {
  if (!kakaoRestApiKey) return 0;
  try {
    const { results: subs } = await DB.prepare(`
      SELECT bs.user_id
      FROM broadcast_subscriptions bs
      JOIN users u ON CAST(bs.user_id AS TEXT) = CAST(u.id AS TEXT)
      WHERE bs.stream_id = ? AND u.kakao_access_token IS NOT NULL
    `).bind(streamId).all<{ user_id: string }>();

    if (!subs?.length) return 0;

    const { getKakaoTokenSimple } = await import('./kakao-token');
    let sent = 0;
    for (const sub of subs) {
      try {
        const token = await getKakaoTokenSimple(DB, sub.user_id, kakaoRestApiKey);
        if (!token) continue;
        const templateObject = JSON.stringify({
          object_type: 'feed',
          content: {
            title: `🔴 ${sellerName} 라이브 시작!`,
            description: title,
            image_url: 'https://live.ur-team.com/og-image.png',
            link: { web_url: `https://live.ur-team.com/live/${streamId}`, mobile_web_url: `https://live.ur-team.com/live/${streamId}` },
          },
          buttons: [{ title: '시청하기', link: { web_url: `https://live.ur-team.com/live/${streamId}`, mobile_web_url: `https://live.ur-team.com/live/${streamId}` } }],
        });

        await fetch('https://kapi.kakao.com/v2/api/talk/memo/default/send', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/x-www-form-urlencoded' },
          body: `template_object=${encodeURIComponent(templateObject)}`,
        });
        sent++;
      } catch {}
    }
    return sent;
  } catch { return 0; }
}

// ─── 팔로워에게 카카오 메시지 (방송 시작 시) ─────────────────
export async function sendKakaoToFollowers(DB: D1Database, sellerId: number, title: string, description: string, link: string, buttonText: string, kakaoRestApiKey?: string) {
  if (!kakaoRestApiKey) return 0;
  try {
    const { results: followers } = await DB.prepare(`
      SELECT sf.user_id
      FROM social_follows sf
      JOIN users u ON CAST(sf.user_id AS TEXT) = CAST(u.id AS TEXT)
      WHERE sf.seller_id = ? AND u.kakao_access_token IS NOT NULL
    `).bind(sellerId).all<{ user_id: string }>();

    if (!followers?.length) return 0;
    const { getKakaoTokenSimple } = await import('./kakao-token');
    const fullUrl = `https://live.ur-team.com${link}`
    let sent = 0;
    for (const f of followers.slice(0, 100)) {
      try {
        const token = await getKakaoTokenSimple(DB, f.user_id, kakaoRestApiKey);
        if (!token) continue;
        const templateObject = JSON.stringify({
          object_type: 'feed',
          content: { title, description, image_url: 'https://live.ur-team.com/og-image.png', link: { web_url: fullUrl, mobile_web_url: fullUrl } },
          buttons: [{ title: buttonText, link: { web_url: fullUrl, mobile_web_url: fullUrl } }],
        });
        await fetch('https://kapi.kakao.com/v2/api/talk/memo/default/send', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/x-www-form-urlencoded' },
          body: `template_object=${encodeURIComponent(templateObject)}`,
        });
        sent++;
      } catch {}
    }
    return sent;
  } catch { return 0; }
}
