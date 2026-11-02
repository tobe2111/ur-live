/**
 * 🔔 알림 카탈로그 — 알림 종류마다 "누가 · 어디서 · 어떤 말로" 보는지 정하는 **한 곳** (2026-11-02 대표)
 *
 * 대표: *"알림창들 너무 TMI 가 많아. 굳이 유저들에게 보일 필요 없는 내용들이 많아서 간결하게 표시해야 하고 …
 *        유저 가입, 에이전시 가입 이런 중요한 것들은 알람이 하나도 안 오고 있어. 교환권 교환, 이용권 구입 등.
 *        가장 이상적이고 영구적이며 체계적으로 자리가 잡혀야 해."*
 *
 * ## 왜 한 곳인가
 * 알림을 쓰는 코드는 30곳이 넘고, 저마다 문구를 손으로 지었다. 그래서 —
 *   • 유저 화면에 `주문 상태: PREPARING`(영문 내부값) · `(대표 지시 — 본인 계정 10만딜 추가)`(어드민 메모)가 그대로 떴다.
 *   • 사장님 화면에 `GMV · CVR · 노출 가중치 0.7×`(내부 지표)가 떴다.
 *   • 어드민 종에는 크론 실패·일일 요약 같은 **시스템 소음 400건**만 쌓이고 가입·구매 알림은 **0건**이었다(2026-11-02 실측).
 * 쓰는 곳 30곳을 다 고쳐도 31번째가 또 그런다. ⇒ **보여 주는 쪽에서** 이 표를 한 번 지나가게 한다.
 * 이미 쌓인 옛 알림도 같이 깨끗해진다(읽을 때 적용되므로).
 *
 * ## 세 가지 규칙
 *   1. **유저·사장님 화면**: 제목은 한 줄 · 이모지 없음 · 설명은 짧게. 내부 값(영문 상태·지표·어드민 메모)은 안 보인다.
 *      볼 필요가 없는 종류(`HIDDEN_FOR_USER` · `HIDDEN_FOR_SELLER`)는 목록에도 미읽음 숫자에도 안 잡힌다.
 *   2. **어드민 종**: `업무`(사람·돈 사건 — 가입·구매·승인 대기·환불) 와 `시스템`(크론·성능·리포트) 두 칸으로 나눈다.
 *      종의 빨간 숫자는 **업무만** 센다. 시스템은 시스템 탭과 `/admin/system-monitoring` 에서 본다.
 *   3. 새 어드민 알림 종류를 만들면 **이 표에 등록**한다 — 시험이 코드를 훑어 미등록을 빨간불로 잡는다
 *      (`src/tests/unit/notification-catalog-2026-11-02.test.ts`).
 *
 * 순수 모듈 — 워커와 화면이 같이 읽는다(`@/` import 없음).
 */

// ── 어드민 ────────────────────────────────────────────────────────────────

export type AdminNotifGroup = 'business' | 'system'

/**
 * 어드민 알림 종류 → 칸. **모든** 어드민 알림 type 이 여기 있어야 한다(시험이 강제).
 * 판단 기준 하나: *"대표가 이걸 보고 사람·돈에 대해 할 일이 생기는가?"* → 업무. 아니면 시스템.
 */
export const ADMIN_NOTIF_GROUP: Readonly<Record<string, AdminNotifGroup>> = {
  // 🆕 2026-11-02 — 그동안 하나도 안 오던 핵심 사건
  user_signup: 'business',            // 유저 가입
  agency_signup: 'business',          // 에이전시 가입
  store_registered: 'business',       // 매장 입점 신청(승인 대기)
  voucher_purchased: 'business',      // 이용권 구매
  gifticon_purchased: 'business',     // 교환권 교환

  // 승인·심사 대기
  seller_registered: 'business',
  agency_registered: 'business',
  business_registration_submitted: 'business',
  seller_pending_reminder: 'business',
  community_gb_proposed: 'business',
  ads_access_request: 'business',
  youtube_growth_request: 'business',
  partnership_inquiry: 'business',
  influencer_outreach: 'business',

  // 주문·결제·환불 — 돈이 움직이는 사건
  deal_payment: 'business',           // 딜 결제(교환권 교환 포함 — 제목이 무엇을 샀는지 말한다)
  deal_charged: 'business',
  new_order: 'business',
  order_cancelled: 'business',
  return_request: 'business',
  deal_refund_requested: 'business',
  refund_failed: 'business',
  payment_failed: 'business',
  payment_orphan: 'business',
  donation_received: 'business',
  settlement_request: 'business',
  agency_settlement: 'business',
  payouts_generated: 'business',      // 주간 정산 생성 → 지급 승인이 필요하다
  supplier_clawback_shortfall: 'business',
  kt_alpha_send_failed: 'business',   // 교환권이 손님에게 안 갔다
  visit_reward_ended: 'business',

  // 시스템 — 개발이 본다. 대표의 종을 울리지 않는다.
  cron_failure: 'system',
  server_error: 'system',
  ledger_mismatch: 'system',
  perf_slo: 'system',
  ops_daily_digest: 'system',
  weekly_metrics: 'system',
  weekly_cohort_report: 'system',
  user_id_backfill: 'system',
  partner_pool_job: 'system',
  order_delivered: 'system',          // 이용권은 배송이 없다 — 상태 기록일 뿐
  system_alert: 'system',
  anomaly_detected: 'system',
}

/** 등록 안 된 종류는 업무로 둔다 — 모르는 것을 숨기는 쪽보다 보이는 쪽이 안전하다(시험이 미등록을 막는다). */
export function adminNotifGroup(type: string | null | undefined): AdminNotifGroup {
  return ADMIN_NOTIF_GROUP[String(type || '')] ?? 'business'
}

/** SQL `type IN (…)` 에 쓰는 시스템 종류 목록. */
export const ADMIN_SYSTEM_TYPES: readonly string[] =
  Object.entries(ADMIN_NOTIF_GROUP).filter(([, g]) => g === 'system').map(([t]) => t)

// ── 유저 · 사장님 화면 ─────────────────────────────────────────────────────

/** 유저 알림함에서 아예 안 보이는 종류 — 목록·미읽음 숫자 둘 다에서 빠진다. */
export const HIDDEN_FOR_USER: readonly string[] = [
  'seller_re_engage',    // "공구 진행률이 낮아요" — 판촉 잔소리. 공구는 지금 유어딜에 없는 말이다
  'broadcast_reminder',  // 라이브커머스 영구 중단 — 갈 곳이 없는 알림
]

/** 사장님(매장) 알림함에서 안 보이는 종류. */
export const HIDDEN_FOR_SELLER: readonly string[] = [
  'tier_change',         // "GMV 0원 · CVR · 노출 가중치 0.7×" — 내부 지표. 사장님이 할 일이 없다
]

export interface NotifText { title: string; message: string | null }

/** 화면에 내보내는 설명의 최대 길이 — 한 줄에 들어가는 만큼. */
export const NOTIF_MESSAGE_MAX = 60

const ORDER_STATUS_KO: Readonly<Record<string, string>> = {
  PENDING: '결제를 기다리고 있어요',
  PAID: '결제가 끝났어요',
  PREPARING: '준비 중이에요',
  SHIPPING: '배송을 시작했어요',
  SHIPPED: '배송을 시작했어요',
  DELIVERED: '배송이 끝났어요',
  DONE: '구매가 확정됐어요',
  CONFIRMED: '구매가 확정됐어요',
  CANCELLED: '취소됐어요',
  REFUNDED: '환불됐어요',
}

// 이모지·기호 그림 (🎟️ 🏪 ✨ 🎁 등) — 디자인 규칙 ⑥ "이모지 0"
const EMOJI_RE = /[\p{Extended_Pictographic}\u{FE0F}\u{200D}\u{1F3FB}-\u{1F3FF}]/gu

function clean(s: string | null | undefined): string {
  return String(s ?? '').replace(EMOJI_RE, '').replace(/\s+/g, ' ').trim()
}

function clip(s: string): string {
  return s.length > NOTIF_MESSAGE_MAX ? s.slice(0, NOTIF_MESSAGE_MAX - 1).trimEnd() + '…' : s
}

/**
 * 손님·사장님 화면에 내보낼 제목·설명. 원본 행은 그대로 두고 **보여 줄 말만** 다듬는다.
 *   • 이모지를 뗀다
 *   • `— 보관함에서 확인하세요` 같은 꼬리를 뗀다(눌러서 가면 된다)
 *   • 괄호 속 어드민 메모를 뗀다(`(대표 지시 — …)`)
 *   • 영문 주문 상태를 우리말로
 *   • 한 줄 길이로 자른다
 */
export function presentNotification(row: { type?: string | null; title?: string | null; message?: string | null }): NotifText {
  const type = String(row.type || '')
  let title = clean(row.title)
  let message = clean(row.message)

  switch (type) {
    case 'order_status': {
      const code = (String(row.title || '').match(/[A-Z_]{3,}/) || [''])[0]
      const ko = ORDER_STATUS_KO[code]
      if (ko) title = `주문이 ${ko}`
      message = ''   // "주문번호: GB-3-1789…" — 손님이 읽을 값이 아니다. 누르면 주문 화면이 열린다
      break
    }
    case 'admin_gift': {
      const amt = (message.match(/[\d,]+\s*딜/) || [''])[0].replace(/\s+/g, '')
      title = '딜 선물이 도착했어요'
      message = amt ? `${amt}이 들어왔어요` : ''
      break
    }
    case 'store_approved':
      title = '매장이 승인됐어요'
      message = '이제 손님에게 이용권이 보여요'
      break
    case 'seller_approved':
      title = '판매가 시작됐어요'
      message = '내 유어샵에 이용권을 올려 보세요'
      break
    case 'voucher_sold':
      title = '이용권이 팔렸어요'
      break
  }

  // 공통 다듬기 — 어떤 종류든
  title = title.replace(/\s*\((?:카드|딜)\)\s*$/, '')                       // "이용권 판매(카드)" → 결제수단은 내부 구분
  message = message
    .replace(/\s*\((?:대표|어드민|관리자|운영)[^)]*\)/g, '')                   // 어드민 메모
    .replace(/\s*[—-]\s*(?:보관함|지갑|마이)[^—]*확인하세요\.?$/, '')           // 꼬리 안내
    .trim()

  return { title: title || '새 알림', message: message ? clip(message) : null }
}

/**
 * SQL 조각 ` AND type NOT IN ('a','b')` — 숨김 목록은 이 파일의 상수(영문 소문자·밑줄)뿐이라 바인딩 없이 넣는다.
 * 그 꼴이 아닌 값이 섞이면 **던진다**(조용히 빼면 숨김이 풀린 줄 모른다).
 */
export function typeNotInSql(types: readonly string[], col = 'type'): string {
  if (types.length === 0) return ''
  for (const t of types) if (!/^[a-z_]+$/.test(t)) throw new Error(`notification type 꼴이 아니다: ${t}`)
  return ` AND ${col} NOT IN (${types.map((t) => `'${t}'`).join(',')})`
}

/** 목록 행 하나를 유저 화면용으로. `id`·`link`·`is_read` 등 나머지는 그대로 둔다. */
export function presentRow<T extends { type?: string | null; title?: string | null; message?: string | null }>(row: T): T {
  const p = presentNotification(row)
  return { ...row, title: p.title, message: p.message }
}
