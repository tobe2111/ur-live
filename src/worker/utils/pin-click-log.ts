/**
 * 📌 유어샵 진열 카드 클릭 기록 — 한 곳(2026-10-18 대표 결재 `2026-10-15-ushop-pin-spa-nav` 안 1).
 *
 * 클릭을 기록하는 길이 둘이 됐다:
 *   ① 바깥에 공유된 `/u/:handle/p/:id` 링크(카톡·SNS) → 서버 리다이렉트(`GET …/redirect`)
 *   ② 유어샵 화면 안에서 카드를 누름 → 앱 안 이동 + 비콘(`POST …/click`)
 * 둘이 같은 함수를 써야 클릭 수가 경로에 따라 달라지지 않는다.
 *
 * 🔒 이 기록은 **통계(유어샵 클릭 수)** 전용이다. 소개비 귀속은 결제 때 실어 보내는 소개 값
 *    (`affiliate_ref`)이 정하고 이 테이블을 읽지 않는다 — 기록이 빠져도 커미션은 안 바뀐다.
 */

export interface PinRow { id: number; user_id: number; product_id: number }

/** 이 유어샵(handle)에 그 상품 핀이 있는가. 없으면 null. */
export async function findPin(DB: D1Database, handle: string, productId: number): Promise<PinRow | null> {
  return DB.prepare(
    `SELECT pp.id, pp.user_id, pp.product_id
     FROM product_pins pp
     JOIN users u ON u.id = pp.user_id
     WHERE u.handle = ? AND pp.product_id = ?
     LIMIT 1`,
  )
    .bind(handle, productId)
    .first<PinRow>()
}

async function sha256Short(input: string): Promise<string> {
  try {
    const data = new TextEncoder().encode(input)
    const buf = await crypto.subtle.digest('SHA-256', data)
    return Array.from(new Uint8Array(buf)).slice(0, 12).map(b => b.toString(16).padStart(2, '0')).join('')
  } catch { return '' }
}

/** 클릭 로그 + count 증가. 봇 탐지는 ip·UA **해시**만 남긴다(원문 저장 X). best-effort — 절대 던지지 않는다. */
export async function logPinClick(DB: D1Database, pin: PinRow, req: Request): Promise<void> {
  try {
    const ip = req.headers.get('cf-connecting-ip') || req.headers.get('x-real-ip') || ''
    const ua = req.headers.get('user-agent') || ''
    const dailySalt = new Date().toISOString().slice(0, 10)
    const ipHash = await sha256Short(`${ip}|${dailySalt}`)
    const uaHash = await sha256Short(ua)
    await DB.prepare(
      `INSERT INTO pin_click_logs (pin_id, curator_user_id, product_id, ip_hash, user_agent_hash, referer)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
      .bind(pin.id, pin.user_id, pin.product_id, ipHash, uaHash, req.headers.get('referer') || null)
      .run()
    await DB.prepare(`UPDATE product_pins SET click_count = click_count + 1 WHERE id = ?`)
      .bind(pin.id)
      .run()
  } catch { /* ignore */ }
}
