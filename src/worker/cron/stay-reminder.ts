/**
 * 🛡️ 2026-05-18: 숙소 예약 D-1 / D-day 자동 알림.
 *   2026-05-18 (refund-alimtalk-impl PR): 실제 알림톡 발송 연결.
 *
 * 매일 09:00 KST 실행:
 *   - D-1: 게스트에 내일 체크인 안내 + 체크인 코드 사전 안내
 *   - D-day: 게스트에 오늘 체크인 + 코드, 호스트에 도착 예정
 *
 * 알림톡: 네이버 클라우드 SENS via lib/text-notice (NCP_* env 4종 필요 · 2026-10-12 알리고 제거).
 *   템플릿 코드는 default value 사용 — 추후 kakao_alimtalk_templates 매핑.
 */
import { sendTextNotice } from '../../lib/text-notice'
import { sensConfigured } from '../../lib/ncp-sens'
type Env = {
  DB: D1Database;
}
type Booking = {
  id: number; product_id: number; check_in_date: string; check_out_date: string;
  guest_name: string; guest_phone: string;
  check_in_code: string | null;
  product_name: string | null;
  room_name: string | null;
  seller_phone: string | null;
  check_in_time: string | null;
  reminder_d1_sent_at: string | null;
  reminder_dday_sent_at: string | null;
}

// 🛡️ 2026-06-12 (전수조사 4차 B-6): reminder dedup 컬럼 보장 — 핸들러 inline ALTER 대신
//   WeakSet 메모이즈 ensure (머니/정합성 룰의 per-request DDL 방지 패턴). repair-schema 에도 등록.
const reminderColsEnsured = new WeakSet<D1Database>()
async function ensureReminderColumns(DB: D1Database): Promise<void> {
  if (reminderColsEnsured.has(DB)) return
  await DB.prepare(`ALTER TABLE stay_bookings ADD COLUMN reminder_d1_sent_at TEXT`).run().catch(() => null)
  await DB.prepare(`ALTER TABLE stay_bookings ADD COLUMN reminder_dday_sent_at TEXT`).run().catch(() => null)
  reminderColsEnsured.add(DB)
}

export async function runStayReminderCron(env: Env): Promise<{ d1_sent: number; dday_sent: number; alimtalk_sent: number; alimtalk_failed: number }> {
  const today = new Date().toISOString().slice(0, 10)
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10)

  // 🛡️ 2026-06-12: dedup 컬럼 — 본 cron 은 '0 9'/'0 0' 두 트리거에서 실행돼
  //   기존엔 같은 예약에 하루 2번 알림(인앱+알림톡 중복)이 나갔음.
  await ensureReminderColumns(env.DB)

  // D-1 + D-day 예약 fetch (status='confirmed' 만).
  const rows = await env.DB.prepare(
    `SELECT b.id, b.product_id, b.check_in_date, b.check_out_date,
            b.guest_name, b.guest_phone, b.check_in_code,
            b.reminder_d1_sent_at, b.reminder_dday_sent_at,
            p.name as product_name, r.name as room_name,
            s.phone as seller_phone,
            psi.check_in_time
       FROM stay_bookings b
       LEFT JOIN products p ON p.id = b.product_id
       LEFT JOIN product_stay_rooms r ON r.id = b.room_id
       LEFT JOIN sellers s ON s.id = b.seller_id
       LEFT JOIN product_stay_info psi ON psi.product_id = b.product_id
      WHERE b.status = 'confirmed'
        AND b.check_in_date IN (?, ?)`
  ).bind(today, tomorrow).all<Booking>().catch(() => ({ results: [] as Booking[] }))

  let d1Sent = 0
  let ddaySent = 0
  let alimtalkSent = 0
  let alimtalkFailed = 0

  // 알림톡 핸들러 lazy load (인프라 미설정 환경에서도 cron 동작 보장).
  // 📨 2026-10-12 알림톡 = 네이버 클라우드 SENS(키 넷이 없으면 앱 알림만). 실패 기록은 sendTextNotice 가 남긴다.
  const alimtalkConfigured = sensConfigured(env as unknown as Record<string, unknown>)

  for (const b of (rows.results || [])) {
    const isToday = b.check_in_date === today
    // 🛡️ 2026-06-12: dedup — 같은 타입 reminder 는 booking 당 1회만.
    if (isToday && b.reminder_dday_sent_at) continue
    if (!isToday && b.reminder_d1_sent_at) continue
    try {
      // 1. notifications 테이블 INSERT (어플 내 알림).
      await env.DB.prepare(
        `INSERT INTO notifications (user_id, user_type, type, title, message, created_at)
         SELECT b2.user_id, 'user', ?, ?, ?, datetime('now')
           FROM stay_bookings b2 WHERE b2.id = ?`
      ).bind(
        isToday ? 'stay_check_in_today' : 'stay_check_in_tomorrow',
        isToday ? `오늘 체크인 — ${b.product_name}` : `내일 체크인 — ${b.product_name}`,
        isToday
          ? `체크인 코드: ${b.check_in_code || '-'} · 체크인 ${b.check_in_time || '15:00'}`
          : `${b.room_name} · 체크인 ${b.check_in_time || '15:00'}`,
        b.id,
      ).run().catch(() => { /* notifications 테이블 없으면 silent */ })

      // 2. 카카오 알림톡 발송 (인프라 설정된 경우만).
      if (alimtalkConfigured && b.guest_phone) {
        const phone = b.guest_phone.replace(/\D/g, '')
        const isValid = /^01\d{8,9}$/.test(phone)
        if (isValid) {
          const templateCode = isToday
            ? 'stay_dday'
            : 'stay_d1'
          const message = isToday
            ? `[유어딜]\n오늘 체크인 안내드립니다.\n\n· 숙소: ${b.product_name}\n· 객실: ${b.room_name}\n· 체크인: ${b.check_in_time || '15:00'}\n· 체크인 코드: ${b.check_in_code || '-'}\n\n즐거운 여행 되세요.`
            : `[유어딜]\n내일 체크인 예정입니다.\n\n· 숙소: ${b.product_name}\n· 객실: ${b.room_name}\n· 체크인: ${b.check_in_time || '15:00'}\n\n사전 안내문 확인 부탁드립니다.`

          const sent = await sendTextNotice(env, phone, { tpl: templateCode, title: '유어딜 알림', text: message })

          if (sent.ok) alimtalkSent++
          else if ('error' in sent) alimtalkFailed++
        }
      }

      // 🛡️ 2026-06-12: 발송 마킹 (인앱 알림 INSERT 이후 — 알림톡 실패 여부와 무관하게 재실행 중복 차단,
      //   알림톡 실패분은 sendTextNotice 가 alimtalk_failures 에 기록).
      await env.DB.prepare(
        `UPDATE stay_bookings SET ${isToday ? 'reminder_dday_sent_at' : 'reminder_d1_sent_at'} = datetime('now') WHERE id = ?`
      ).bind(b.id).run().catch(() => { /* noop */ })

      if (isToday) ddaySent++; else d1Sent++
    } catch { /* per-row fail-soft */ }
  }

  return { d1_sent: d1Sent, dday_sent: ddaySent, alimtalk_sent: alimtalkSent, alimtalk_failed: alimtalkFailed }
}
