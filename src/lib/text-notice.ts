/**
 * 📨 알림 한 통을 **알리고 하나로** 보낸다 (2026-10-11 대표 "알리고로만 하는건데? 솔라피는 뭐야?")
 *
 * 그 전 상태(라이브 실측):
 *  - 사장님·손님 이용권 알림 7종이 **솔라피**(쓰지 않는 다른 문자 회사)로 가게 돼 있었고, 그 키
 *    (`ALIMTALK_API_KEY`)가 라이브에 없어 **조용히 건너뛰었다**. 그래서 한 통도 안 나갔다.
 *  - 시스템 알림톡(`system-alimtalk.ts`)은 알리고로 가지만 주소가 틀려 **성공 기록 0건**이었다.
 *
 * 규칙 (2026-10-11 대표 "문자는 안 쓸거고 카톡만" 반영):
 *  - 그 알림의 템플릿이 카카오 검수를 통과했으면(어드민 `alimtalk_approved_templates` 에 코드가 있으면)
 *    **알림톡**으로 보낸다. 실패 시 문자 대체는 하지 않는다.
 *  - 아직 승인 전이면 **보내지 않는다**(앱 알림만) — `alimtalk_failures` 에 `pending:<코드>` 로 남긴다.
 *  - 문자는 어드민 `notice_sms_enabled='true'` 일 때만(기본 OFF).
 *  ⇒ 템플릿이 하나씩 승인될 때마다 어드민에서 코드를 적어 넣기만 하면 **배포 없이** 알림톡으로 넘어간다.
 *
 * 성공·실패는 둘 다 남긴다 — "안 나갔는데 아무도 모른다" 가 이 파일이 생긴 이유다.
 *  - 성공: `alimtalk_dispatch_log`(번호는 해시만) · 실패: `alimtalk_failures`(재시도 0회로 기록만)
 */
import type { D1Database } from '@cloudflare/workers-types'
import { sendAlimtalk, sendAligoSms, resolveAligoSender } from './aligo'

/** 어드민에서 카카오 검수를 통과한 템플릿 코드를 쉼표로 적는 자리. */
export const APPROVED_TEMPLATES_SETTING = 'alimtalk_approved_templates'

export function parseApprovedTemplates(raw: unknown): Set<string> {
  return new Set(
    String(raw ?? '')
      .split(/[\s,]+/)
      .map((s) => s.trim())
      .filter(Boolean),
  )
}

let _approvedCache: { at: number; set: Set<string> } | null = null
const APPROVED_TTL_MS = 60_000

async function approvedTemplates(db: D1Database | undefined): Promise<Set<string>> {
  if (!db) return new Set()
  if (_approvedCache && Date.now() - _approvedCache.at < APPROVED_TTL_MS) return _approvedCache.set
  try {
    const row = await db
      .prepare('SELECT value FROM platform_settings WHERE key = ?')
      .bind(APPROVED_TEMPLATES_SETTING)
      .first<{ value: string }>()
    const set = parseApprovedTemplates(row?.value)
    _approvedCache = { at: Date.now(), set }
    return set
  } catch {
    return new Set()
  }
}

/**
 * 📵 2026-10-11 대표 "문자는 안 쓸거고 카톡만 쓸건데" — 문자(단문·장문·알림톡 실패 시 대체)는 기본 OFF.
 * 어드민 `notice_sms_enabled` 를 'true' 로 바꿀 때만 문자를 쓴다(그때도 비용은 알리고 포인트에서 나간다).
 */
export const SMS_ENABLED_SETTING = 'notice_sms_enabled'
let _smsCache: { at: number; on: boolean } | null = null
async function smsAllowedSetting(db: D1Database | undefined): Promise<boolean> {
  if (!db) return false
  if (_smsCache && Date.now() - _smsCache.at < APPROVED_TTL_MS) return _smsCache.on
  try {
    const row = await db.prepare('SELECT value FROM platform_settings WHERE key = ?').bind(SMS_ENABLED_SETTING).first<{ value: string }>()
    const on = String(row?.value ?? '').trim() === 'true'
    _smsCache = { at: Date.now(), on }
    return on
  } catch {
    return false
  }
}

/** 테스트용 — 캐시 비우기. */
export function _resetApprovedTemplatesCache(): void {
  _approvedCache = null
  _smsCache = null
}

export function normalizeMobile(phone: unknown): string | null {
  const p = String(phone ?? '').replace(/[^0-9]/g, '')
  return /^01\d{8,9}$/.test(p) ? p : null
}

export type TextNoticeResult =
  | { ok: true; via: 'alimtalk' | 'sms' }
  | { ok: false; skipped: 'no_credentials' | 'invalid_phone' | 'template_not_approved' }
  | { ok: false; via: 'alimtalk' | 'sms'; error: string }

/**
 * @param tpl  알림 종류 코드 — 알림톡 템플릿 코드와 같은 문자열(승인되면 그대로 알림톡 tpl_code 가 된다)
 * @param title 장문 문자 제목(22자 안쪽)
 */
export async function sendTextNotice(
  env: unknown,
  phone: unknown,
  n: { tpl: string; title: string; text: string; forceAlimtalk?: boolean },
): Promise<TextNoticeResult> {
  const e = (env ?? {}) as Record<string, unknown>
  const apiKey = String(e.ALIGO_API_KEY ?? '')
  const userId = String(e.ALIGO_USER_ID ?? '')
  if (!apiKey || !userId) return { ok: false, skipped: 'no_credentials' }
  const to = normalizeMobile(phone)
  if (!to) return { ok: false, skipped: 'invalid_phone' }

  const db = e.DB as D1Database | undefined
  const aligoEnv = {
    ALIGO_API_KEY: apiKey,
    ALIGO_USER_ID: userId,
    ALIGO_SENDER_PHONE: e.ALIGO_SENDER_PHONE as string | undefined,
    ALIGO_SENDER: e.ALIGO_SENDER as string | undefined,
    DISCORD_WEBHOOK_URL: e.DISCORD_WEBHOOK_URL as string | undefined,
  }
  const senderKey = String(e.ALIGO_SENDER_KEY ?? '')
  const useAlimtalk = !!senderKey && (n.forceAlimtalk || (await approvedTemplates(db)).has(n.tpl))
  const smsAllowed = await smsAllowedSetting(db)

  let via: 'alimtalk' | 'sms'
  let result: { success: boolean; error?: string }
  if (useAlimtalk) {
    via = 'alimtalk'
    result = await sendAlimtalk(aligoEnv, {
      senderKey,
      templateCode: n.tpl,
      to,
      message: n.text,
      sender: await resolveAligoSender(aligoEnv),
      // 📵 2026-10-11 대표 "문자는 안 쓸거고 카톡만" — 알림톡 실패 시 문자 대체도 기본 OFF.
      ...(smsAllowed ? { failoverText: { title: n.title, text: n.text } } : {}),
    })
  } else if (smsAllowed) {
    via = 'sms'
    result = await sendAligoSms(aligoEnv, { to, text: n.text, title: n.title })
  } else {
    // 승인 전 템플릿 + 문자 꺼짐 → 보내지 않는다(앱 알림은 호출부가 따로 보낸다). 무엇을 놓쳤는지는 남긴다.
    await recordOutcome(db, to, `pending:${n.tpl}`, n.text, { success: false, error: 'template_not_approved' }).catch(() => {})
    return { ok: false, skipped: 'template_not_approved' }
  }

  await recordOutcome(db, to, `${via}:${n.tpl}`, n.text, result).catch(() => {})
  return result.success ? { ok: true, via } : { ok: false, via, error: result.error || 'unknown' }
}

async function hashShort(input: string): Promise<string> {
  try {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input))
    return Array.from(new Uint8Array(buf)).slice(0, 16).map((b) => b.toString(16).padStart(2, '0')).join('')
  } catch {
    return `len${input.length}`
  }
}

async function recordOutcome(
  db: D1Database | undefined,
  to: string,
  code: string,
  text: string,
  result: { success: boolean; error?: string },
): Promise<void> {
  if (!db) return
  if (result.success) {
    await db
      .prepare('INSERT OR IGNORE INTO alimtalk_dispatch_log (phone_hash, template_code, message_hash) VALUES (?, ?, ?)')
      .bind(await hashShort(to), code, await hashShort(text))
      .run()
    return
  }
  await ensureFailuresTable(db)
  // 재시도 큐(retry-alimtalk)는 알림톡 템플릿으로 다시 보내므로 문자 실패를 거기 태우면 안 된다 — 기록만(max_retries 0).
  await db
    .prepare('INSERT INTO alimtalk_failures (phone, template_code, message, error, max_retries) VALUES (?, ?, ?, ?, 0)')
    .bind(to, code, text.slice(0, 1000), String(result.error ?? 'unknown').slice(0, 500))
    .run()
}

// 실패 기록 테이블 — 종전엔 system-alimtalk 이 발송 실패 때 만들었다. 발송이 이 파일로 옮겨와 생성도 여기서(워커당 1회).
const _failuresTableDone = new WeakSet<object>()
async function ensureFailuresTable(db: D1Database): Promise<void> {
  if (_failuresTableDone.has(db)) return
  _failuresTableDone.add(db)
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS alimtalk_failures (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      phone TEXT NOT NULL, template_code TEXT NOT NULL, message TEXT NOT NULL,
      error TEXT, retry_count INTEGER DEFAULT 0, max_retries INTEGER DEFAULT 3,
      next_retry_at DATETIME DEFAULT (datetime('now', '+5 minutes')),
      resolved INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `).run().catch(() => {})
}
