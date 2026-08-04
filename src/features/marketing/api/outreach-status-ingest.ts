/**
 * 📬 **아웃리치 결과 유입 — 반응 루프를 닫는다** (2026-08-04, 대표 *"이메일 상태 경로도 만들어줘"*).
 *
 * ## 무엇이 비어 있었나
 * `email_status` · `opened_at` · `replied_at` 는 **읽는 곳이 이미 많다** — 발송 큐가 반송/신고를 제외하고
 * (`admin-ads-influencers.routes` `email_status NOT IN ('bounced','complained')`), 리마인더가 회신자를 빼고
 * (`consented-reminder.ts`), 통계가 bounced 를 센다. 그런데 **쓰는 경로가 하나도 없었다**:
 * 라이브 실측 2026-08-04 — 이메일 보유 7,615행 전부 `email_status IS NULL`.
 *
 * 대표가 발송을 **외부 도구로** 하기 때문이다. 그래서 반송·수신거부·회신이 DB 로 안 돌아오고, 결과가 셋이다:
 *   ① 같은 주소로 **다시 보낸다**(중복 163건까지 있다) ② 죽은 주소를 계속 들고 간다
 *   ③ **자동 조율이 대리 지표만 최적화한다** — "이메일이 있는가"까지만 보고 "제안이 통했는가"는 못 본다.
 *
 * ⇒ ③ 이 이 파일의 진짜 이유다. 키워드 자동 조율(`keyword-contact-yield.ts`)이 지금은 *연락처 유무*로
 *   몫을 나누는데, 여기로 결과가 들어오면 **반응률**로 나눌 수 있게 된다. 루프의 열린 끝이 여기다.
 *
 * ## 설계 원칙
 *   · **이메일 주소 기준 매칭** — 같은 주소가 여러 행에 있으면(실측 163건 중복) **전부** 갱신한다.
 *     같은 사람이므로 한 행만 고치면 나머지가 다음 발송에 다시 뽑힌다.
 *   · **멱등** — 같은 입력을 두 번 넣어도 최종 상태가 같다. 타임스탬프는 **처음 것을 보존**한다
 *     (`COALESCE(opened_at, ?)`) — 재업로드가 "방금 열었다"로 덮으면 반응 시점 분석이 망가진다.
 *   · **되돌릴 수 없는 것은 좁게** — `opt_out` 만 `opted_out=1` 을 세운다. 그건 법적 의사표시라
 *     자동 해제하지 않는다(해제는 사람이 어드민에서).
 *   · **미매칭을 삼키지 않는다** — 반환값에 `unmatched` 를 담는다. 조용한 0건은 "성공"과 구분이 안 된다.
 */

/** 받아들이는 상태값. 발송 큐·리마인더가 이미 쓰는 문자열과 **정확히** 같아야 한다(갈라지면 조용히 어긋난다). */
export const OUTREACH_STATUSES = ['sent', 'opened', 'replied', 'bounced', 'complained', 'opt_out'] as const
export type OutreachStatus = typeof OUTREACH_STATUSES[number]
export const isOutreachStatus = (v: unknown): v is OutreachStatus =>
  typeof v === 'string' && (OUTREACH_STATUSES as readonly string[]).includes(v)

/** 한 번에 받는 최대 행 수 — D1 배치와 워커 CPU 를 지키는 상한(초과분은 나눠 보내면 된다). */
export const OUTREACH_INGEST_MAX = 500

export interface OutreachItem { email: string; status: OutreachStatus; at?: string | null }

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

/** 이메일 정규화 — 매칭은 소문자·trim 기준. DB 에 대소문자가 섞여 있어 `LOWER()` 로 비교한다. */
export const normEmail = (v: unknown): string | null => {
  const s = String(v ?? '').trim().toLowerCase()
  return s && EMAIL_RE.test(s) ? s : null
}

/**
 * 📋 **CSV 도 받는다** — 메일 도구가 뱉는 건 대개 CSV 다. JSON 만 받으면 대표가 매번 변환해야 하고,
 *   그 마찰이 곧 "결과가 안 들어옴"이 된다(이 파일이 존재하는 이유가 정확히 그 마찰이었다).
 *
 * 형식: `email,status[,at]` — 헤더 행은 있으면 건너뛴다(첫 칸이 이메일이 아니면 헤더로 본다).
 * ⚠️ 파싱 실패 행은 **버리지 않고** `invalid` 로 센다 — 조용히 사라지면 업로드가 반쯤 먹혔는지 알 수 없다.
 */
export function parseOutreachCsv(text: string): { items: OutreachItem[]; invalid: number } {
  const items: OutreachItem[] = []
  let invalid = 0
  for (const raw of String(text || '').split(/\r?\n/)) {
    const line = raw.trim()
    if (!line) continue
    const cols = line.split(',').map(c => c.trim().replace(/^"|"$/g, ''))
    const email = normEmail(cols[0])
    if (!email) { if (cols[0] && !/^e-?mail$/i.test(cols[0])) invalid++; continue }
    const status = String(cols[1] || '').toLowerCase()
    if (!isOutreachStatus(status)) { invalid++; continue }
    items.push({ email, status, at: cols[2] || null })
  }
  return { items, invalid }
}

/** 입력(JSON 배열)을 검증·정규화. 잘못된 행은 버리지 않고 센다. */
export function normalizeOutreachItems(raw: unknown): { items: OutreachItem[]; invalid: number } {
  if (!Array.isArray(raw)) return { items: [], invalid: 0 }
  const items: OutreachItem[] = []
  let invalid = 0
  for (const r of raw.slice(0, OUTREACH_INGEST_MAX)) {
    const o = r as { email?: unknown; status?: unknown; at?: unknown }
    const email = normEmail(o?.email)
    const status = String(o?.status ?? '').toLowerCase()
    if (!email || !isOutreachStatus(status)) { invalid++; continue }
    items.push({ email, status, at: typeof o?.at === 'string' ? o.at : null })
  }
  return { items, invalid }
}

/**
 * 상태별로 **무엇을 쓰는가** — 순수 함수라 유닛으로 고정한다.
 *
 * ⚠️ `sent` 가 `contacted_at` 을 **덮지 않는** 이유: 그 컬럼은 발송 큐의 "이미 보냈나" 판정에 쓰인다.
 *   재업로드가 시각을 갱신하면 리마인더 창(D+N)이 매번 밀려 **영원히 안 보내는** 상태가 된다.
 */
export function outreachSetClause(status: OutreachStatus): { sql: string; usesAt: boolean } {
  switch (status) {
    case 'sent':
      return { sql: "email_status = 'sent', contacted_at = COALESCE(contacted_at, ?)", usesAt: true }
    case 'opened':
      return { sql: "email_status = 'opened', opened_at = COALESCE(opened_at, ?)", usesAt: true }
    case 'replied':
      // 회신은 가장 강한 신호 — 반송/신고보다 뒤에 와도 이걸로 덮는다(사람이 실제로 답했다).
      return { sql: "email_status = 'replied', replied_at = COALESCE(replied_at, ?)", usesAt: true }
    case 'opt_out':
      // 🚫 법적 의사표시 — 자동 해제하지 않는다. 해제는 사람이 어드민에서.
      return { sql: "email_status = 'opt_out', opted_out = 1", usesAt: false }
    default: // bounced | complained
      return { sql: `email_status = '${status}'`, usesAt: false }
  }
}

interface D1Like {
  prepare(sql: string): { bind(...v: unknown[]): { run(): Promise<{ meta?: { changes?: number } }> } }
  batch(stmts: unknown[]): Promise<Array<{ meta?: { changes?: number } }>>
}

export interface OutreachIngestResult {
  received: number
  invalid: number
  applied: number      // 실제로 갱신된 **행** 수(같은 주소가 여러 행이면 그만큼 는다)
  unmatched: number    // 풀에 없는 주소 — 삼키지 않고 센다
  error?: string
}

/**
 * 상태를 반영한다. **주소 하나 = 문장 하나**(같은 주소의 모든 행을 한 UPDATE 로).
 * ⚠️ `LOWER(email) = ?` — DB 에 대소문자가 섞여 있다(실측). 인덱스를 못 타지만 이 경로는
 *   사람이 가끔 부르는 관리 기능이라 처리량보다 **정확한 매칭**이 우선이다.
 */
export async function ingestOutreachStatuses(DB: D1Like, items: OutreachItem[], nowIso: string): Promise<OutreachIngestResult> {
  const out: OutreachIngestResult = { received: items.length, invalid: 0, applied: 0, unmatched: 0 }
  if (!items.length) return out
  try {
    const stmts = items.map(it => {
      const { sql, usesAt } = outreachSetClause(it.status)
      const at = (it.at && /^\d{4}-\d{2}-\d{2}/.test(it.at)) ? it.at : nowIso
      const q = `UPDATE ad_influencer_leads SET ${sql} WHERE account_id = 0 AND LOWER(TRIM(email)) = ?`
      return usesAt ? DB.prepare(q).bind(at, it.email) : DB.prepare(q).bind(it.email)
    })
    const res = await DB.batch(stmts)
    res.forEach((r, i) => {
      const ch = Number(r?.meta?.changes) || 0
      out.applied += ch
      if (ch === 0) out.unmatched++
      void i
    })
    return out
  } catch (e) {
    return { ...out, error: (e as Error)?.message || 'fail' }
  }
}
