/**
 * ☎️📧 **남의 연락처 · 가짜 연락처 정리** (2026-11-17 대표 *"다 해줘"* — 11-02 개선 목록 ②).
 *
 * ## 무엇이 문제였나 (라이브 실측 2026-11-17, `ad_company_leads`)
 * 제휴 제안을 보낼 연락처가 **그 업체 것이 아닌** 경우가 두 갈래로 있었다.
 *
 * 1. **가짜(자리표시) 연락처** — 양식의 예시값이 그대로 저장됐다.
 *    `010-0000-0000` 91행 · `010-1234-5678` 52행 · `010-1234-1234` 32행 · `N/A` 213행 · `010-개인정보` 25행 ·
 *    `gmail.com@gmail.com` 21행 · `email@naver.com` 12행 · `111@111.com` 10행.
 * 2. **남의 연락처** — 사이트를 만든 곳·호스팅·위젯의 연락처가 페이지 바닥글에서 긁혔다.
 *    `hosting@gabia.com` 92행(업종 11개) · `support@dable.io` 25행 · `ad@daangn.com` 18행(업종 8개) ·
 *    `052-5525-5255` 101행(업종 10개) · `031-709-8111` 48행(업종 7개).
 *
 * ## 🔑 "남의 것" 판정 = **서로 다른 업종 3개 이상에 걸친 같은 연락처**
 * 한 연락처가 여러 행에 붙는 것 자체는 정상이다 — 같은 브랜드의 지점들이다(실측: `새집느낌` 포장이사·입주청소 ·
 * `그린프로청소` 지점 12곳 · `주식회사풍연(풍연1~9지점)` · `이젠아카데미` 각 캠퍼스). 그런 묶음은 업종이 1~2개다.
 * 업종이 3개 이상으로 흩어지면 그건 한 업체가 아니라 **그 업체들의 사이트를 만든 쪽**이다.
 * ⚠️ 그래서 같은 업종 묶음은 **건드리지 않는다**(정리 대상이 아니라 발송 때 한 번만 보낼 대상이다).
 *
 * ## 무엇을 하나 — 지우지 않는다
 * - 연락처 칸만 비운다(행은 남는다). 남은 연락처가 없으면 보류(active=0) — "연락처 필수" 정책 그대로라
 *   나중에 진짜 연락처가 붙으면 다시 활성이 된다(`hold_reason` 을 적지 않는 이유).
 * - 남의 이메일은 `ad_email_suppress`(사유 `shared_vendor`)에 넣는다 — 보강·등록부 대조·발송이 모두 그 표를
 *   보므로 **다시 긁혀도 저장되지 않고, 혹시 남아도 발송되지 않는다.**
 * - 남의 전화는 억제 표가 없어 `platform_settings` 목록(`ads_shared_phone_block`)으로 들고, 보강 저장이 거른다.
 * - 등록부 출처(통신판매 신고 `commerce` · 정부 `govreg` · `registry`)의 전화는 그 업체가 직접 신고한 값이라
 *   공유 판정에서 뺀다(본사 대표번호를 지점들이 같이 쓰는 경우).
 */

import { chunkForBinds } from '../../../shared/db/d1-binds'

/** 가짜 전화 — 숫자 아닌 글자(`N/A`·`010-개인정보`)거나, 국번 뒤가 같은 숫자·연번이다. */
export function isPlaceholderPhone(raw: string | null | undefined): boolean {
  const s = String(raw ?? '').trim()
  if (!s) return false
  const d = s.replace(/\D/g, '')
  // 글자가 섞였는데 숫자가 모자라면 번호가 아니다(`N/A`·`010-개인정보`). 숫자가 충분하면 설명이 붙은 진짜 번호다
  //   (`02-928-6446(팩스)` — 라이브 실측). 글자 유무만 보면 그런 번호까지 지운다.
  if (d.length < 8) return true
  const last8 = d.slice(-8)
  if (/^(\d)\1{7}$/.test(last8)) return true              // 0000-0000 · 1111-1111
  return PLACEHOLDER_SEQ.has(last8)
}
const PLACEHOLDER_SEQ = new Set(['12345678', '12341234', '56785678', '87654321', '01234567', '23456789', '00001234', '12340000'])

const FREE_MAIL = new Set(['naver.com', 'gmail.com', 'daum.net', 'hanmail.net', 'nate.com', 'hotmail.com', 'kakao.com', 'outlook.com', 'yahoo.com'])
/** 무료메일 앞에 오면 예시값인 아이디 — 회사 도메인 앞이면 진짜일 수 있어서(`email@회사.kr`) 무료메일에만. */
const DUMMY_LOCAL = new Set(['email', 'mail', 'test', 'example', 'sample', 'abc', 'abcd', 'aaa', 'asdf', 'qwer', 'qwerty', 'id', 'youremail', 'your', 'xxx', 'none', 'noemail', 'null', 'admin', 'user', 'name', 'myemail'])
const DUMMY_DOMAIN = new Set(['example.com', 'example.co.kr', 'example.org', 'test.com', 'email.com', 'domain.com', 'yourdomain.com', 'company.com', 'abc.com', 'aaa.com', '111.com', 'xxx.com'])

/** 가짜 이메일 — 아이디가 도메인(`gmail.com@gmail.com`) · 예시 도메인 · 무료메일 앞 예시 아이디 · 같은 글자 반복. */
export function isPlaceholderEmail(raw: string | null | undefined): boolean {
  const s = String(raw ?? '').trim().toLowerCase()
  const at = s.lastIndexOf('@')
  if (at <= 0) return false
  const local = s.slice(0, at), domain = s.slice(at + 1)
  if (local === domain) return true                       // gmail.com@gmail.com
  // 아이디 = 도메인 이름은 **무료메일에서만** 가짜다(naver@naver.com). 회사 도메인에선 흔한 진짜 주소다
  //   (`lawus@lawus.co.kr`·`gi-corp@gi-corp.co.kr` — 라이브 실측).
  if (FREE_MAIL.has(domain) && (local === domain.split('.')[0] || local === 'hanmail' || local === 'gmail.com' || local === 'naver.com')) return true
  if (DUMMY_DOMAIN.has(domain)) return true
  if (/^(.)\1+$/.test(local)) return true                 // 111@ · aaaa@
  return FREE_MAIL.has(domain) && DUMMY_LOCAL.has(local)
}

/** 남의 연락처 판정 문턱 — 행 수와 업종 수. 같은 브랜드 지점 묶음(업종 1~2개)은 걸리지 않는다. */
export const SHARED_MIN_ROWS = 5
export const SHARED_MIN_CATEGORIES = 3
/** 등록부 출처 — 업체가 직접 신고한 연락처라 공유 판정에서 뺀다. */
export const AUTHORITATIVE_SOURCES = ['commerce', 'govreg', 'registry'] as const
const AUTH_SQL = AUTHORITATIVE_SOURCES.map(s => `'${s}'`).join(',')

/**
 * 남의 **이메일** 후보 — 이메일 인덱스(`idx_company_email_mark`)만 훑는다(실측 8.5만 항목, 테이블 67만 행을 안 읽는다).
 * 업종 수·출처는 인덱스에 없으므로 여기선 행 수로만 좁히고, 업종 판정은 `sharedEmailVerdictSql` 이 후보 행만 읽어 한다.
 */
export const SHARED_EMAIL_CANDIDATE_SQL = `SELECT email AS v, COUNT(*) AS n FROM ad_company_leads
   WHERE email IS NOT NULL AND email != '' GROUP BY email HAVING COUNT(*) >= ${SHARED_MIN_ROWS} ORDER BY n DESC LIMIT 2000`

/** 후보 이메일 중 남의 것 — 인덱스 탐색(`email IN`). ⚠️ `contact_source` NULL 은 `COALESCE` 로 — `NULL NOT IN (…)` 은 거짓이라 54만 행이 통째로 빠진다(실측). */
export function sharedEmailVerdictSql(n: number): string {
  return `SELECT email AS v FROM ad_company_leads
     WHERE email IN (${Array.from({ length: n }, () => '?').join(',')}) AND merged_into IS NULL
       AND COALESCE(contact_source, '') NOT IN (${AUTH_SQL})
     GROUP BY email HAVING COUNT(*) >= ${SHARED_MIN_ROWS} AND COUNT(DISTINCT category) >= ${SHARED_MIN_CATEGORIES}`
}

/**
 * 남의 **전화** — 전화 칸 인덱스가 없어 테이블을 한 번 훑는다(주 1회라 하루 평균 약 10만 행).
 * 고칠 행의 id 를 같이 받아(`GROUP_CONCAT`) 비우기는 기본키로 한다 — 두 번 훑지 않는다.
 */
export const SHARED_PHONE_SQL = `SELECT phone AS v, GROUP_CONCAT(id) AS ids FROM ad_company_leads
   WHERE merged_into IS NULL AND phone IS NOT NULL AND phone != ''
     AND COALESCE(contact_source, '') NOT IN (${AUTH_SQL})
   GROUP BY phone HAVING COUNT(*) >= ${SHARED_MIN_ROWS} AND COUNT(DISTINCT category) >= ${SHARED_MIN_CATEGORIES}
   ORDER BY COUNT(*) DESC LIMIT 300`

/** 주 단위 열쇠 — KST 기준 그 주 월요일 날짜. 정리는 주 1회만 돈다(D1 무료 읽기 한도 — 전화 집계가 테이블 1회 통과다). */
export function kstWeekKey(nowMs: number): string {
  const k = new Date(nowMs + 9 * 3600_000)
  const dow = (k.getUTCDay() + 6) % 7 // 월=0
  return new Date(Date.UTC(k.getUTCFullYear(), k.getUTCMonth(), k.getUTCDate() - dow)).toISOString().slice(0, 10)
}

export const SHARED_PHONE_KEY = 'ads_shared_phone_block'
/** 마지막 정리 결과 — 어드민 상태줄이 읽는다(`/api/admin/partner-pool/stats` 의 `contactQuality`). */
export const SWEEP_KEY = 'ads_shared_contact_sweep'

/** 저장값의 주 열쇠 — JSON(`{week,…}`)이 표준이고, 첫 배포분은 주 문자열만 적었다(그것도 같은 주로 읽는다). */
export function sweptWeek(raw: unknown): string | null {
  const s = String(raw ?? '')
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  try { const v = JSON.parse(s); return typeof v?.week === 'string' ? v.week : null } catch { return null }
}
const PHONE_BLOCK_CAP = 1000

export function parsePhoneBlock(raw: unknown): string[] {
  try { const v = JSON.parse(String(raw ?? '')); return Array.isArray(v) ? v.map(String).filter(Boolean) : [] } catch { return [] }
}

export interface SharedSweepResult { skipped?: boolean; emails: number; phones: number; email_rows: number; phone_rows: number; error?: string }

const changes = (r: unknown) => Number((r as { meta?: { changes?: number } } | null)?.meta?.changes) || 0

/**
 * 주 1회(KST 월요일 기준 주) — 남의 연락처를 찾아 억제·차단 목록에 넣고, 그 값을 가진 행의 칸을 비운다.
 * 억제 표의 **다른 사유(반송·수신거부)도 같이** 비운다 — 그 일은 원래 `sweepSuppressedEmails` 가 했는데
 * 업체 DB 이사 뒤로 표가 다른 DB 라 실패하고 있었다(같은 날 실측).
 *
 * 읽는 양(주당): 이메일 인덱스 ~8.5만 + 후보 행 수천 + 전화 테이블 1회(~68만). 비우기는 인덱스·기본키 탐색.
 *
 * @param DB `adsLeadsDb(env)` — 문장마다 표를 보고 업체 DB·리드 DB·본 DB 로 갈라 보낸다. **한 문장에 두 DB 의 표를 섞지 않는다.**
 */
export async function sweepSharedContacts(DB: D1Database, nowMs = Date.now()): Promise<SharedSweepResult> {
  const out: SharedSweepResult = { emails: 0, phones: 0, email_rows: 0, phone_rows: 0 }
  const week = kstWeekKey(nowMs)
  const st = await DB.prepare('SELECT value FROM platform_settings WHERE key = ?').bind(SWEEP_KEY).first<{ value: string }>().catch(() => null)
  if (sweptWeek(st?.value) === week) return { ...out, skipped: true }

  try {
    // ① 남의 이메일 → 억제 표(리드 DB)
    const cand = ((await DB.prepare(SHARED_EMAIL_CANDIDATE_SQL).all<{ v: string }>())?.results || []).map(r => String(r.v))
    const emails: string[] = []
    for (const part of chunkForBinds(cand)) {
      const r = (await DB.prepare(sharedEmailVerdictSql(part.length)).bind(...part).all<{ v: string }>())?.results || []
      for (const x of r) emails.push(String(x.v).trim().toLowerCase())
    }
    for (let i = 0; i < emails.length; i += 50) {
      await DB.batch(emails.slice(i, i + 50).map(e => DB.prepare("INSERT OR IGNORE INTO ad_email_suppress (email, reason) VALUES (?, 'shared_vendor')").bind(e)))
    }
    out.emails = emails.length

    // ② 억제 표 전체(반송·거부·남의 것)를 업체 행에서 비운다 — 값 목록을 먼저 읽고 업체 표만 만지는 문장으로.
    //   ⚠️ `lower(email)` 로 비교하면 인덱스를 못 탄다 — 그대로 비교한다(억제 표·저장값 모두 소문자로 들어온다).
    //   📄 2026-11-25: 쪽으로 끝까지 읽는다 — 종전엔 정렬 없이 5,000건만 읽어, 표가 그보다 커지면 넘는 주소는 영영 안 비워졌다.
    const supList: string[] = []
    for (let last = 0, guard = 0; guard < 40; guard++) {
      const page = (await DB.prepare('SELECT rowid AS rid, email FROM ad_email_suppress WHERE rowid > ? ORDER BY rowid LIMIT 5000').bind(last).all<{ rid: number; email: string }>())?.results || []
      for (const r of page) if (r.email) supList.push(String(r.email))
      if (page.length < 5000) break
      last = Number(page[page.length - 1].rid)
    }
    for (const part of chunkForBinds(supList)) {
      const r = await DB.prepare(
        `UPDATE ad_company_leads SET email = NULL,
           active = CASE WHEN phone IS NOT NULL AND phone != '' THEN active ELSE 0 END
         WHERE email IN (${part.map(() => '?').join(',')})`,
      ).bind(...part).run()
      out.email_rows += changes(r)
    }

    // ③ 남의 전화 → 차단 목록(설정 — 보강 저장이 거른다) + 그 행의 전화를 비운다(기본키로)
    const ph = (await DB.prepare(SHARED_PHONE_SQL).all<{ v: string; ids: string }>())?.results || []
    const prev = parsePhoneBlock((await DB.prepare('SELECT value FROM platform_settings WHERE key = ?').bind(SHARED_PHONE_KEY).first<{ value: string }>().catch(() => null))?.value)
    const phones = [...new Set([...ph.map(r => String(r.v).trim()), ...prev].filter(Boolean))].slice(0, PHONE_BLOCK_CAP)
    await DB.prepare('INSERT OR REPLACE INTO platform_settings (key, value) VALUES (?, ?)').bind(SHARED_PHONE_KEY, JSON.stringify(phones)).run()
    const ids = ph.flatMap(r => String(r.ids || '').split(',').map(Number).filter(n => Number.isInteger(n) && n > 0))
    for (const part of chunkForBinds(ids)) {
      const r = await DB.prepare(
        `UPDATE ad_company_leads SET phone = NULL,
           active = CASE WHEN email IS NOT NULL AND email != '' THEN active ELSE 0 END
         WHERE id IN (${part.map(() => '?').join(',')})`,
      ).bind(...part).run()
      out.phone_rows += changes(r)
    }
    out.phones = ph.length
  } catch (e) {
    // 🩺 실패하면 주 도장을 안 찍는다 — 다음 회차가 다시 시도하고, 원문은 하트비트로 보인다.
    return { ...out, error: String((e as Error)?.message || e).slice(0, 200) }
  }
  // 결과를 같이 남긴다 — 이 값이 화면에 보여야 "정리가 돌았는가 · 얼마나 지웠는가" 를 대표가 직접 본다.
  await DB.prepare('INSERT OR REPLACE INTO platform_settings (key, value) VALUES (?, ?)')
    .bind(SWEEP_KEY, JSON.stringify({ week, at: new Date(nowMs).toISOString(), ...out })).run().catch(() => null)
  return out
}

