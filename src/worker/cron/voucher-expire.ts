/**
 * 🎫 2026-06-21: 이용권(교환권) 만료 임박 알림 cron.
 *
 * 매일 09:00 UTC 실행 (stay-voucher-expire 와 동시, KST 18:00):
 *   - vouchers.expires_at 이 D-30 / D-7 / D-3 / D-1 인 미사용(unused) 이용권
 *   - 🧾 2026-07-05 (자문 컴플라이언스 점검): D-30 추가 — 공정위 신유형 상품권 표준약관의
 *     "유효기간 도래 30일 전 통지" 요건 정합. (만료 시엔 auto-settlement 가 100% 자동 환불 —
 *     표준약관 90% 환급 기준을 상회하는 정책이라 별도 환급 경로 불필요.)
 *   - 사용자에게 앱 내 알림(notifications) + 카카오 알림톡(인프라 설정 시) 발송
 *
 * 배경: 선결제 이용권은 유효기간(기본 90일)이 있어, 잊고 안 쓰면 낸 돈이 소멸.
 *   숙소(stay)는 이미 stay-voucher-expire.ts 로 알림 중이나 이용권은 없었음 → 동일 패턴 복제.
 *
 * 범위: KT 기프티쇼 교환권(p.kt_alpha_gift_code 보유)은 제외 — 쿠폰 유효기간은
 *   기프티쇼가 외부 관리(MMS 발송분)라 내부 expires_at 으로 안내하면 오정보 위험.
 *
 * 중복 발송 방지: notifications.type(`voucher_expire_{n}d`) + 최근 2일 내 존재 체크.
 * 전부 fail-soft (행별 try-catch). 알림톡 성공·실패는 sendTextNotice 가 기록한다.
 */
type Env = {
  DB: D1Database
}

type Row = {
  id: number
  user_id: string
  user_phone: string | null
  product_name: string | null
  restaurant_name: string | null
  code: string
  expires_at: string
  days_left: number
}

export async function runMealVoucherExpireCron(env: Env): Promise<{ d30: number; d7: number; d3: number; d1: number; alimtalk_sent: number; alimtalk_failed: number }> {
  let d30 = 0, d7 = 0, d3 = 0, d1 = 0
  let alimtalkSent = 0, alimtalkFailed = 0

  // D-7 / D-3 / D-1 임계 — 미사용 이용권(KT 교환권 제외).
  const sql = `
    SELECT v.id, v.user_id, u.phone AS user_phone,
           p.name AS product_name, p.restaurant_name,
           v.code, v.expires_at,
           CAST(julianday(v.expires_at) - julianday('now') AS INTEGER) AS days_left
      FROM vouchers v
      LEFT JOIN products p ON p.id = v.product_id
      LEFT JOIN users u ON CAST(u.id AS TEXT) = v.user_id
     WHERE v.status = 'unused'
       AND v.expires_at IS NOT NULL
       AND (p.kt_alpha_gift_code IS NULL OR p.kt_alpha_gift_code = '')
       AND CAST(julianday(v.expires_at) - julianday('now') AS INTEGER) IN (30, 7, 3, 1)
     ORDER BY v.expires_at ASC
     LIMIT 500
  `
  const rows = await env.DB.prepare(sql).all<Row>().catch(() => ({ results: [] as Row[] }))

  // 📨 2026-10-11: 발송은 `sendTextNotice` 한 곳 — 카카오 승인 템플릿만(어드민 승인 목록 — SENS) 나가고, 승인 전이면 건너뛴다.
  const { sendTextNotice } = await import('../../lib/text-notice')

  for (const r of (rows.results || [])) {
    const daysLeft = Number(r.days_left)
    if (![30, 7, 3, 1].includes(daysLeft)) continue
    // 멱등 키는 voucher 별(코드 포함) — 한 유저가 같은 날 여러 이용권 만료 시 각각 알림(돈이라 누락 금지).
    //   stay 버전은 (user,임계) 1회라 동일-일자 다건이 누락될 수 있음 → 이용권은 코드 스코프로 강화.
    const notifType = `voucher_expire_${daysLeft}d_${r.code}`

    // 중복 발송 방지 — 같은 voucher·임계로 최근 2일 내 이미 보냈으면 skip.
    const dup = await env.DB.prepare(
      `SELECT id FROM notifications WHERE user_id = ? AND type = ? AND created_at > datetime('now', '-2 days') LIMIT 1`
    ).bind(r.user_id, notifType).first().catch(() => null)
    if (dup) continue

    try {
      const productName = r.product_name || '이용권'
      const where = r.restaurant_name ? ` · ${r.restaurant_name}` : ''

      // 1. 앱 내 알림 INSERT — 탭하면 /my-vouchers 로 (link 컬럼 존재: youtube-broadcast-end-detect 등에서 사용).
      await env.DB.prepare(
        `INSERT INTO notifications (user_id, user_type, type, title, message, link, created_at)
         VALUES (?, 'user', ?, ?, ?, ?, datetime('now'))`
      ).bind(
        r.user_id, notifType,
        `🎫 이용권 만료 D-${daysLeft} — ${productName}`,
        `${daysLeft}일 후 만료돼요${where}. 코드 ${r.code} · 지금 사용하세요`,
        '/my-vouchers',
      ).run().catch(() => { /* table/컬럼 없으면 silent */ })

      // 2. 카카오 알림톡 — **30일 전 한 번만**(2026-10-11 대표 "30일 전만 하지뭐" — 7·3·1일 전은 앱 알림만).
      //    30일 전은 공정위 신유형 상품권 표준약관의 '유효기간 도래 30일 전 통지' 자리라 남긴다.
      //    등록 본문과 글자까지 같아야 한다(docs/alimtalk-register-list.md).
      if (r.user_phone && daysLeft === 30) {
        const message =
          `[유어딜] 구매하신 이용권 유효기간 안내\n\n` +
          `고객님께서 유어딜에서 구매하신 이용권의 유효기간이 ${daysLeft}일 남았습니다.\n\n` +
          `· 이용권: ${productName}${where}\n` +
          `· 이용권 코드: ${r.code}\n` +
          `· 만료일: ${r.expires_at.slice(0, 10)}\n\n` +
          `매장에서 아래 [내 이용권 보기]를 눌러 QR 을 보여주세요.`
        const result = await sendTextNotice(env, r.user_phone, { tpl: 'voucher_expire_soon', title: '이용권 유효기간 안내', text: message })
          .catch(() => ({ ok: false as const, via: 'alimtalk' as const, error: 'exception' }))
        if (result.ok) alimtalkSent++
        else if ('via' in result) alimtalkFailed++
      }

      if (daysLeft === 30) d30++
      else if (daysLeft === 7) d7++
      else if (daysLeft === 3) d3++
      else if (daysLeft === 1) d1++
    } catch { /* per-row fail-soft */ }
  }

  return { d30, d7, d3, d1, alimtalk_sent: alimtalkSent, alimtalk_failed: alimtalkFailed }
}
