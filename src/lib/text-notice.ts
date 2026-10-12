/**
 * 📨 알림 한 통을 **네이버 클라우드 SENS 알림톡 하나로** 보낸다 (2026-10-12 대표 "이걸로 가자" · "알리고 잔해들 빼고")
 *
 * 🔁 2026-10-12: 발송처가 알리고 → SENS 로 바뀌었고 알리고 코드는 전부 걷어냈다. 알리고는 보내는 서버의
 *    고정 IP 등록이 필수인데 Cloudflare 는 나가는 IP 가 매번 달라(라이브 -99/-101) 한 통도 못 보냈다.
 *    아래 2026-10-11 기록은 그 전 상태의 역사다.
 *
 * (2026-10-11 대표 "알리고로만 하는건데? 솔라피는 뭐야?")
 *
 * 그 전 상태(라이브 실측):
 *  - 사장님·손님 이용권 알림 7종이 **솔라피**(쓰지 않는 다른 문자 회사)로 가게 돼 있었고, 그 키
 *    (`ALIMTALK_API_KEY`)가 라이브에 없어 **조용히 건너뛰었다**. 그래서 한 통도 안 나갔다.
 *  - 시스템 알림톡(`system-alimtalk.ts`)은 알리고로 가지만 주소가 틀려 **성공 기록 0건**이었다.
 *
 * 규칙 (대표 "문자는 안 쓸거고 카톡만" 2026-10-11):
 *  - 그 알림의 템플릿이 카카오 검수를 통과했으면(어드민 `alimtalk_approved_templates` 에 이름이 있으면)
 *    **알림톡**으로 보낸다. 문자(SMS)는 보내지 않는다(대체 발송 포함).
 *  - 아직 승인 전이면 **보내지 않는다**(앱 알림만) — `alimtalk_failures` 에 `pending:<코드>` 로 남긴다.
 *  ⇒ 템플릿이 하나씩 승인될 때마다 어드민에서 이름을 적어 넣기만 하면 **배포 없이** 알림톡으로 넘어간다.
 *
 * 성공·실패는 둘 다 남긴다 — "안 나갔는데 아무도 모른다" 가 이 파일이 생긴 이유다.
 *  - 성공: `alimtalk_dispatch_log`(번호는 해시만) · 실패: `alimtalk_failures`(재시도 0회로 기록만)
 */
import type { D1Database } from '@cloudflare/workers-types'
import { sendSensAlimtalk, sensConfigured, type SensEnv } from './ncp-sens'
import { isAlimtalkOff } from './alimtalk-templates'

/** 어드민에서 카카오 검수를 통과한 템플릿 코드를 쉼표로 적는 자리. */
export const APPROVED_TEMPLATES_SETTING = 'alimtalk_approved_templates'

/**
 * 🔑 설정 형식: 이름만 적으면 그 이름이 곧 템플릿 코드다(SENS 는 등록 때 코드를 우리가 정한다 — 이름을 그대로 쓴다).
 * 등록 코드를 이름과 다르게 지었으면 `우리이름=등록코드` 로 적는다(쉼표·줄바꿈 구분).
 */
export function parseTemplateCodeMap(raw: unknown): Map<string, string> {
  const map = new Map<string, string>()
  for (const tok of String(raw ?? '').replace(/\s*=\s*/g, '=').split(/[\s,]+/)) {
    const t = tok.trim()
    if (!t) continue
    const eq = t.indexOf('=')
    const name = (eq >= 0 ? t.slice(0, eq) : t).trim()
    const code = (eq >= 0 ? t.slice(eq + 1) : t).trim()
    if (name && code) map.set(name, code)
  }
  return map
}

export function parseApprovedTemplates(raw: unknown): Set<string> {
  return new Set(parseTemplateCodeMap(raw).keys())
}

let _approvedCache: { at: number; map: Map<string, string> } | null = null
const APPROVED_TTL_MS = 60_000

async function approvedTemplates(db: D1Database | undefined): Promise<Map<string, string>> {
  if (!db) return new Map()
  if (_approvedCache && Date.now() - _approvedCache.at < APPROVED_TTL_MS) return _approvedCache.map
  try {
    const row = await db
      .prepare('SELECT value FROM platform_settings WHERE key = ?')
      .bind(APPROVED_TEMPLATES_SETTING)
      .first<{ value: string }>()
    const map = parseTemplateCodeMap(row?.value)
    _approvedCache = { at: Date.now(), map }
    return map
  } catch {
    return new Map()
  }
}

/**
 * 그 이름의 템플릿이 승인돼 있으면 **보낼 코드**를, 아니면 undefined.
 * (`sendTextNotice` 를 안 거치고 직접 보내는 곳 — 버튼이 있는 사장님 통보 등 — 이 같은 승인 목록을 쓰게.)
 */
export async function approvedTemplateCode(db: D1Database | undefined, name: string): Promise<string | undefined> {
  return (await approvedTemplates(db)).get(name)
}

/** 테스트용 — 캐시 비우기. */
export function _resetApprovedTemplatesCache(): void {
  _approvedCache = null
}

export function normalizeMobile(phone: unknown): string | null {
  const p = String(phone ?? '').replace(/[^0-9]/g, '')
  return /^01\d{8,9}$/.test(p) ? p : null
}

export type TextNoticeResult =
  | { ok: true; via: 'alimtalk' }
  | { ok: false; skipped: 'no_credentials' | 'invalid_phone' | 'template_not_approved' | 'turned_off' }
  | { ok: false; via: 'alimtalk'; error: string }

/**
 * @param tpl  알림 종류 코드 — 알림톡 템플릿 코드와 같은 문자열(승인되면 그대로 알림톡 tpl_code 가 된다)
 * @param title 알림 제목(앱 알림·기록용 — 알림톡 본문에는 안 들어간다)
 */
export async function sendTextNotice(
  env: unknown,
  phone: unknown,
  n: { tpl: string; title: string; text: string; forceAlimtalk?: boolean },
): Promise<TextNoticeResult> {
  // 🔕 대표가 끈 알림(alimtalk-templates.ts ALIMTALK_OFF_TEMPLATES) — 앱 알림만. 놓친 것으로 기록하지도 않는다(의도한 일이다).
  if (!n.forceAlimtalk && isAlimtalkOff(n.tpl)) return { ok: false, skipped: 'turned_off' }
  const e = (env ?? {}) as Record<string, unknown>
  // 🟢 2026-10-12 — 네이버 클라우드 SENS 키 넷(NCP_*)이 있어야 보낸다. 없으면 앱 알림만(호출부가 따로 보낸다).
  if (!sensConfigured(e)) return { ok: false, skipped: 'no_credentials' }
  const to = normalizeMobile(phone)
  if (!to) return { ok: false, skipped: 'invalid_phone' }

  const db = e.DB as D1Database | undefined
  const approved = await approvedTemplates(db)
  if (!n.forceAlimtalk && !approved.has(n.tpl)) {
    // 승인 전 템플릿 → 보내지 않는다(검수 전 템플릿은 SENS 가 거절한다). 무엇을 놓쳤는지는 남긴다.
    await recordOutcome(db, to, `pending:${n.tpl}`, n.text, { success: false, error: 'template_not_approved' }).catch(() => {})
    return { ok: false, skipped: 'template_not_approved' }
  }
  // SENS 는 템플릿 코드를 등록할 때 우리가 정한다 — 우리 이름이 곧 코드(설정에 `이름=코드` 로 다르게 적었으면 그 코드).
  const result = await sendSensAlimtalk(e as SensEnv, { templateCode: approved.get(n.tpl) || n.tpl, to, content: n.text })
  await recordOutcome(db, to, `alimtalk:${n.tpl}`, n.text, result).catch(() => {})
  return result.success ? { ok: true, via: 'alimtalk' } : { ok: false, via: 'alimtalk', error: result.error || 'unknown' }
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
