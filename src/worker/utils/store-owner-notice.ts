/**
 * 📩 **사장님에게 "당신 가게가 유어딜에 올라갔습니다" 를 알린다** (2026-09-21 — 대표 승인).
 *
 * > 대표: *"매장 사장님의 전화번호. 010으로 말이야. 되면 보내주는걸로."*
 *
 * ## 왜 이게 사기 방어인가
 * 남의 가게 이름으로 올라간 이용권을 가장 먼저 알아볼 사람은 **그 가게 사장님**이다. 그런데
 * 지금까지 사장님은 **알 길이 없었다** — 유어딜에 올 일이 없으니까. 제보 창구(`store_reports`)를
 * 만들어도 *존재를 모르면* 쓰이지 않는다. 이 통보가 그 창구로 데려간다.
 *
 * ## 🔴 지금은 **아무것도 발송하지 않는다** (의도)
 * 새 카카오 알림톡 템플릿은 **외부 검수**를 거쳐야 하고, 그건 대표가 채널 관리자에서 한다.
 * 그래서 이 파일은 **줄을 세우는 데까지만** 한다:
 *   - 템플릿 코드(`ALIGO_TPL_STORE_NOTICE`)가 없으면 → 줄만 서고 끝.
 *   - 게이트(`platform_settings.store_owner_notice_enabled`)가 `true` 가 아니면 → 역시 끝.
 *   ⇒ **둘 다 갖춰질 때만** 발송된다. 발송은 등급 C(발행/발송)라 대표가 켠다.
 *
 * ## ☎️ 010 만 줄을 선다
 * 지역번호·대표번호·번호 없음은 알림톡이 아예 안 간다 ⇒ 그 매장은 **사람이 전화를 거는 큐**
 * (`store_verify_calls`)로 간다. 두 레일이 같은 일을 두 번 하지 않게 여기서 갈라 둔다.
 * ⚠️ 010 이라고 진짜 사장님 번호라는 뜻은 아니다 — 사기꾼은 자기 휴대폰을 적으면 그만이고,
 * 그때 이 통보는 **사기꾼에게 간다**. 그래도 손해는 없다(그는 이미 다 안다). 이 레일의 값은
 * *진짜 사장님 번호가 적힌 흔한 경우*에 있다.
 */
import type { D1Database } from '@cloudflare/workers-types'
import { isMobileKr, normalizeKrPhone } from '../../shared/store-phone'

export const OWNER_NOTICE_KIND = 'store_listed'
export type OwnerNoticeStatus = 'queued' | 'sent' | 'failed'

export interface OwnerNoticeRow {
  id: number
  seller_id: number
  phone: string
  kind: string
  status: string
  error_msg: string | null
  created_at: string | null
  sent_at: string | null
}

const _done = new WeakSet<object>()

export async function ensureOwnerNotices(DB: D1Database): Promise<void> {
  if (_done.has(DB)) return
  _done.add(DB)
  try {
    await DB.prepare(`CREATE TABLE IF NOT EXISTS store_owner_notices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      seller_id INTEGER NOT NULL,
      phone TEXT NOT NULL,
      kind TEXT NOT NULL DEFAULT 'store_listed',
      status TEXT NOT NULL DEFAULT 'queued',
      error_msg TEXT,
      created_at DATETIME DEFAULT (datetime('now')),
      sent_at DATETIME
    )`).run()
    // 🔒 한 매장에 한 번만 — 같은 사람에게 같은 안내를 두 번 보내면 그건 스팸이다.
    //   ("이미 있나 SELECT 후 INSERT" 는 동시 승인에서 두 장을 만든다 — 머니/정합성 룰 #3)
    await DB.prepare(
      'CREATE UNIQUE INDEX IF NOT EXISTS idx_store_owner_notices_once ON store_owner_notices(seller_id, kind)',
    ).run()
  } catch {
    _done.delete(DB)
  }
}

/**
 * 📍 링크 둘 — **주 행동은 대시보드**, 되찾기는 그 다음 (2026-09-21 대표 *"셀러대시보드 링크를
 * 주는게 맞지 않을까?"*).
 *
 * 처음엔 되찾기(`/store/find`) 하나만 걸었는데, **누가 이 문자를 받는지**를 다시 세어 보니
 * 대표 말이 맞았다. 수신자는 `sellers.phone` 의 010 이고, 그 번호는 거의 항상 **등록을 한 사람이
 * 자기 번호로 적은 것**이다 — 그 사람에게 이 문자는 "당신 가게가 등록됐습니다" 가 아니라
 * **"승인됐습니다, 이제 관리하세요"** 다. 되찾기 링크만 주면 정작 할 일이 없다.
 *
 * 그렇다고 되찾기를 빼면 이 통보의 **존재 이유**가 사라진다. 중개사·대행이 사장님 번호를 적어
 * 등록한 경우(우리 모델에 실제로 있는 레일)엔 수신자가 등록을 안 한 사람이고, 그때 필요한 건
 * 되찾기다. ⇒ **둘 다, 순서를 정해서.**
 *
 * ⚠️ 대시보드 주소는 `/seller` 가 아니라 `/seller/waiting` 이다. 그 페이지가 같은 세션에서
 * 셀러 토큰을 발급해 대시보드로 들여보낸다(재로그인 0). `/seller` 로 바로 보내면
 * `requireSeller` 가 이메일·비번 로그인으로 튕긴다 — 카카오로 가입한 사장님에겐 낯선 화면이다.
 * **못 덮는 경우**: 세션이 아예 없으면 그 페이지가 `/seller/login` 으로 보낸다(그 역시 낯설다).
 * 그 흐름을 고치는 건 이 PR 범위 밖이라 그대로 두고 여기 적어 둔다.
 */
export const OWNER_NOTICE_DASHBOARD_URL = 'https://urdeal.kr/seller/waiting'
export const OWNER_NOTICE_CLAIM_URL = 'https://urdeal.kr/store/find'

/** 소비자에게 보일 문구. 템플릿 검수에도 이 문안을 그대로 낸다(두 벌이면 반드시 갈린다). */
export function ownerNoticeMessage(storeName: string): string {
  const name = String(storeName || '').trim() || '고객님의 매장'
  return [
    `[유어딜] ${name} 매장이 유어딜에 등록되었습니다.`,
    '',
    '이제 이용권을 만들고 주문을 받으실 수 있어요.',
    `내 매장 관리: ${OWNER_NOTICE_DASHBOARD_URL}`,
    '',
    '직접 등록하지 않으셨다면 알려 주세요.',
    OWNER_NOTICE_CLAIM_URL,
    '',
    '문의: 유어딜 고객센터',
  ].join('\n')
}

/**
 * 알림톡 버튼 — 카카오 템플릿에도 **같은 두 개를** 등록해야 한다(본문처럼 버튼도 템플릿의 일부다).
 * 순서가 의미다: 대부분의 수신자에게 필요한 것이 먼저다.
 */
export function ownerNoticeButtonsJson(): string {
  return JSON.stringify({
    button: [
      { name: '내 매장 관리하기', type: 'WL', url_mobile: OWNER_NOTICE_DASHBOARD_URL, url_pc: OWNER_NOTICE_DASHBOARD_URL },
      { name: '내가 등록한 게 아니에요', type: 'WL', url_mobile: OWNER_NOTICE_CLAIM_URL, url_pc: OWNER_NOTICE_CLAIM_URL },
    ],
  })
}

/**
 * 줄 세우기 — 010 이 아니면 **아무 행도 만들지 않는다**(사람이 거는 큐가 그 매장을 맡는다).
 * fail-soft: 승인 자체는 이미 끝났으므로 여기서 실패해도 승인을 되돌리지 않는다.
 * @returns 'queued' | 'skip_not_mobile' | 'skip_duplicate' | 'skip_error'
 */
export async function queueOwnerNotice(
  DB: D1Database,
  sellerId: number,
  phone: string | null | undefined,
): Promise<'queued' | 'skip_not_mobile' | 'skip_duplicate' | 'skip_error'> {
  if (!Number.isInteger(sellerId) || sellerId <= 0) return 'skip_error'
  if (!isMobileKr(phone)) return 'skip_not_mobile'
  try {
    await ensureOwnerNotices(DB)
    const r = await DB.prepare(
      'INSERT OR IGNORE INTO store_owner_notices (seller_id, phone, kind) VALUES (?, ?, ?)',
    ).bind(sellerId, normalizeKrPhone(phone), OWNER_NOTICE_KIND).run()
    return r.meta.changes > 0 ? 'queued' : 'skip_duplicate'
  } catch {
    return 'skip_error'
  }
}

export async function listOwnerNotices(
  DB: D1Database,
  opts: { status?: string; limit?: number } = {},
): Promise<OwnerNoticeRow[]> {
  await ensureOwnerNotices(DB)
  const limit = Math.min(200, Math.max(1, Number(opts.limit) || 50))
  const status = opts.status || 'queued'
  const { results } = await DB.prepare(
    `SELECT id, seller_id, phone, kind, status, error_msg, created_at, sent_at
       FROM store_owner_notices WHERE status = ? ORDER BY id DESC LIMIT ?`,
  ).bind(status, limit).all<OwnerNoticeRow>().catch(() => ({ results: [] as OwnerNoticeRow[] }))
  return results || []
}

/** 게이트 — 템플릿 코드와 설정이 **둘 다** 있어야 발송이 켜진다. */
export async function ownerNoticeSendEnabled(
  DB: D1Database,
  templateCode: string | undefined,
): Promise<boolean> {
  if (!templateCode || templateCode === 'TBD') return false
  const row = await DB.prepare("SELECT value FROM platform_settings WHERE key = 'store_owner_notice_enabled'")
    .first<{ value: string | null }>()
    .catch(() => null)
  return String(row?.value || '') === 'true'
}

export interface OwnerNoticeSendDeps {
  apikey: string
  userid: string
  senderkey: string
  sender: string
  tplCode: string
  send: (p: {
    apikey: string; userid: string; senderkey: string; tpl_code: string; sender: string
    receiver_1: string; recvname_1: string; subject_1: string; message_1: string; button_1: string
  }) => Promise<{ success: boolean; message: string }>
}

/**
 * 줄에 선 통보를 실제로 보낸다 — **게이트를 통과한 호출자만** 부른다(`ownerNoticeSendEnabled`).
 *
 * ## 🔒 셀러 크레딧을 쓰지 않는다
 * `sendSellerAlimtalk` 은 **셀러 크레딧 1건을 차감**한다. 그 모델은 "셀러가 자기 손님에게 보낸다"
 * 는 전제이고, 이 통보는 정반대다 — **유어딜이 (아직 유어딜을 모르는) 사장님에게** 보낸다.
 * 남의 잔액을 깎아 그 사람에게 통보를 보내는 건 말이 안 되므로 여기선 발송기를 직접 부른다.
 *
 * ## 한 건씩, 그리고 결과를 남긴다
 * 성공이든 실패든 그 행의 `status` 가 바뀐다 ⇒ 같은 사람에게 두 번 가지 않는다.
 * 실패는 `failed` 로 남아 **자동 재시도되지 않는다** — 어드민이 보고 판단한다(문자 폭탄 방지).
 */
export async function sendQueuedOwnerNotices(
  DB: D1Database,
  deps: OwnerNoticeSendDeps,
  opts: { limit?: number } = {},
): Promise<{ sent: number; failed: number }> {
  const rows = await listOwnerNotices(DB, { status: 'queued', limit: Math.min(50, Math.max(1, Number(opts.limit) || 20)) })
  let sent = 0
  let failed = 0
  for (const row of rows) {
    // 🔒 먼저 자리를 선점한다(CAS) — 두 어드민이 동시에 눌러도 한 사람에게 두 번 가지 않는다.
    const claim = await DB.prepare(
      "UPDATE store_owner_notices SET status = 'sending' WHERE id = ? AND status = 'queued'",
    ).bind(row.id).run().catch(() => ({ meta: { changes: 0 } }))
    if (!claim.meta.changes) continue
    const store = await DB.prepare('SELECT business_name FROM sellers WHERE id = ?')
      .bind(row.seller_id).first<{ business_name: string | null }>().catch(() => null)
    const message = ownerNoticeMessage(store?.business_name || '')
    let ok = false
    let err = ''
    try {
      const r = await deps.send({
        apikey: deps.apikey, userid: deps.userid, senderkey: deps.senderkey,
        tpl_code: deps.tplCode, sender: deps.sender,
        receiver_1: row.phone, recvname_1: store?.business_name || '사장님',
        subject_1: '매장 등록 안내', message_1: message,
        button_1: ownerNoticeButtonsJson(),
      })
      ok = r.success
      err = r.success ? '' : String(r.message || '발송 실패')
    } catch (e) {
      ok = false
      err = e instanceof Error ? e.message.slice(0, 200) : '발송 오류'
    }
    await DB.prepare(
      "UPDATE store_owner_notices SET status = ?, error_msg = ?, sent_at = CASE WHEN ? = 'sent' THEN datetime('now') ELSE sent_at END WHERE id = ?",
    ).bind(ok ? 'sent' : 'failed', ok ? null : err, ok ? 'sent' : 'failed', row.id).run().catch(() => null)
    if (ok) sent++; else failed++
  }
  return { sent, failed }
}
