/**
 * 🧬 파트너풀 중복 병합 — **삭제하지 않는다. 되돌릴 수 있게 접는다.** (2026-07-28 대표 지시)
 *
 * 배경(실측): 표본 2,000행에서 회사명 중복 **38.4%**(고유 326 업체가 768행). 전화번호까지 동일한데
 *   별개 행이었다 — 수집기가 `region` 에 **키워드의 지역**을 박아 dedup 키(`n:이름|지역`)가 갈렸기 때문.
 *   신규 유입은 `regionFromAddress()` 로 막았고(company-collect), 이 모듈은 **이미 쌓인 것**을 접는다.
 *
 * 안전 설계 — 이 순서가 곧 안전성이다:
 *   ① **삭제 0**. 패자는 `active=0` + `merged_into=<승자 id>` 로 표시만 한다(전량 복원 가능).
 *      액션풀 쿼리가 `active=1` 이라 작업 목록에서는 즉시 사라지고, 통계·이력은 그대로 남는다.
 *   ② **큐레이션 행 절대 불가침**. 대표가 손댄 행(`status != 'new'` 또는 `memo` 있음)은 승자 우선이고,
 *      한 그룹에 큐레이션 행이 **둘 이상이면 그룹째 건너뛴다**(사람이 판단할 몫 — 기계가 고르지 않는다).
 *   ③ **정보 손실 0**. 접기 전에 승자의 빈 연락처를 그룹 최선값으로 backfill(COALESCE — 기존값 불변).
 *   ④ **판정 기준은 전화 + 정규화 상호 동시 일치**. 이름만 같은 동명이업은 접지 않는다(전화가 신원).
 *   ⑤ `dryRun` 기본 — 무엇을 접을지 세어보고 나서 실행한다.
 *
 * 서브리퀘스트: 그룹 SELECT 1 + 행 SELECT `ceil(전화수/90)` + DB.batch 1 — maxGroups 500 이어도 최대 8회.
 *   (행 SELECT 를 쪼개는 이유는 D1 의 문장당 바인딩 100개 제한 — 아래 ② 주석 참조.)
 */
import type { D1Database } from '@cloudflare/workers-types'

export interface DedupeResult {
  dry_run: boolean
  groups_found: number
  groups_merged: number
  rows_folded: number
  backfilled: number
  skipped: Record<string, number>
  done: boolean
  sample: Array<{ name: string; phone: string; keep: number; fold: number[] }>
}

const _ensured = new WeakSet<object>()
async function ensureMergedColumn(DB: D1Database): Promise<void> {
  if (_ensured.has(DB)) return
  _ensured.add(DB)
  try { await DB.prepare('ALTER TABLE ad_company_leads ADD COLUMN merged_into INTEGER').run() } catch { /* 이미 존재 */ }
}

type Row = {
  id: number; company_name: string; phone: string | null; email: string | null; website: string | null
  address: string | null; business_no: string | null; status: string; memo: string | null
}

/** 대표가 손댄 행인가 — 기존 정리 로직(company-discovery)과 **동일 판정**을 쓴다. */
const isCurated = (r: Row): boolean => r.status !== 'new' || !!(r.memo && r.memo.trim())

/** 정보량 점수 — 값이 많은 행을 승자로(접힌 쪽 정보는 어차피 backfill 로 옮긴다). */
const score = (r: Row): number =>
  (r.email ? 8 : 0) + (r.website ? 4 : 0) + (r.business_no ? 2 : 0) + (r.address ? 1 : 0)

export async function dedupeCompanyLeads(
  DB: D1Database,
  opts: { dryRun?: boolean; maxGroups?: number } = {},
): Promise<DedupeResult> {
  const dryRun = opts.dryRun !== false // 기본 dry-run — 실행은 명시적으로만
  const maxGroups = Math.min(500, Math.max(1, Number(opts.maxGroups) || 200))
  await ensureMergedColumn(DB)

  const out: DedupeResult = {
    dry_run: dryRun, groups_found: 0, groups_merged: 0, rows_folded: 0, backfilled: 0,
    skipped: {}, done: false, sample: [],
  }
  const skip = (k: string) => { out.skipped[k] = (out.skipped[k] || 0) + 1 }

  // ① 중복 그룹 — 전화 + 정규화 상호가 **둘 다** 같을 때만. 아직 안 접힌 활성 행만 대상.
  const groups = (await DB.prepare(
    `SELECT phone AS ph, LOWER(REPLACE(REPLACE(company_name, ' ', ''), '　', '')) AS nk, COUNT(*) AS n
       FROM ad_company_leads
      WHERE COALESCE(active, 1) = 1 AND merged_into IS NULL
        AND phone IS NOT NULL AND phone != '' AND company_name IS NOT NULL AND company_name != ''
      GROUP BY ph, nk HAVING n > 1
      ORDER BY n DESC LIMIT ?`,
  ).bind(maxGroups).all<{ ph: string; nk: string; n: number }>().catch(() => null))?.results || []
  out.groups_found = groups.length
  if (!groups.length) { out.done = true; return out }

  // ② 그룹들의 실제 행을 가져온다 — 전화 IN 절로 좁히고 JS 에서 (전화,정규화이름) 으로 최종 그룹핑.
  //   ⚠️ **D1 은 문장당 바인딩 파라미터가 100개까지**다(라이브 실측: 100 정상 / 120 실패).
  //   예전엔 전화 전부를 한 IN 절에 넣고 실패를 `.catch(() => null)` 로 삼켜, maxGroups>100 이면
  //   **아무 오류 없이 0건**을 반환했다(오늘 하루 고친 '조용히 틀리는 코드' 를 내가 그대로 만들었다).
  //   → 90개씩 나눠 조회하고, 실패하면 삼키지 않고 결과에 남긴다.
  const phones = [...new Set(groups.map(g => g.ph))]
  const rows: Row[] = []
  for (let i = 0; i < phones.length; i += 90) {
    const chunk = phones.slice(i, i + 90)
    const r = await DB.prepare(
      `SELECT id, company_name, phone, email, website, address, business_no, status, memo
         FROM ad_company_leads
        WHERE COALESCE(active, 1) = 1 AND merged_into IS NULL AND phone IN (${chunk.map(() => '?').join(',')})`,
    ).bind(...chunk).all<Row>().catch(() => null)
    if (!r) { skip('행_조회_실패'); continue } // 조용한 0건 금지 — 실패를 결과에 드러낸다
    rows.push(...(r.results || []))
  }

  const norm = (s: string) => (s || '').toLowerCase().replace(/[\s　]/g, '')
  const want = new Set(groups.map(g => `${g.ph}\x00${g.nk}`))
  const buckets = new Map<string, Row[]>()
  for (const r of rows) {
    const k = `${r.phone}\x00${norm(r.company_name)}`
    if (!want.has(k)) continue
    const arr = buckets.get(k); if (arr) arr.push(r); else buckets.set(k, [r])
  }

  const stmts: ReturnType<D1Database['prepare']>[] = []
  for (const [, group] of buckets) {
    if (group.length < 2) { skip('그룹_단일행'); continue }
    const curated = group.filter(isCurated)
    // ② 큐레이션 행이 둘 이상이면 **기계가 고르지 않는다** — 사람이 판단할 몫.
    if (curated.length > 1) { skip('큐레이션_다수_보류'); continue }
    const pool = curated.length === 1 ? curated : group
    const keep = [...pool].sort((a, b) => (score(b) - score(a)) || (a.id - b.id))[0]
    const fold = group.filter(r => r.id !== keep.id)
    if (!fold.length) { skip('접을_행_없음'); continue }

    // ③ 정보 손실 0 — 승자의 빈 칸을 그룹 최선값으로 채운다(COALESCE 라 기존값은 불변).
    const pick = (f: keyof Row): string | null => {
      for (const r of [keep, ...fold]) { const v = r[f]; if (v != null && String(v).trim()) return String(v) }
      return null
    }
    const email = pick('email'), website = pick('website'), address = pick('address'), bizno = pick('business_no')
    const needsFill = (!keep.email && email) || (!keep.website && website) || (!keep.address && address) || (!keep.business_no && bizno)
    if (needsFill) {
      out.backfilled++
      stmts.push(DB.prepare(
        `UPDATE ad_company_leads
            SET email = COALESCE(email, ?), website = COALESCE(website, ?),
                address = COALESCE(address, ?), business_no = COALESCE(business_no, ?)
          WHERE id = ?`,
      ).bind(email, website, address, bizno, keep.id))
    }
    // ① 삭제 0 — 표시만. merged_into 로 언제든 되돌릴 수 있다.
    stmts.push(DB.prepare(
      `UPDATE ad_company_leads SET active = 0, merged_into = ?
        WHERE id IN (${fold.map(() => '?').join(',')}) AND merged_into IS NULL`,
    ).bind(keep.id, ...fold.map(r => r.id)))

    out.groups_merged++
    out.rows_folded += fold.length
    if (out.sample.length < 5) {
      out.sample.push({ name: keep.company_name, phone: keep.phone || '', keep: keep.id, fold: fold.map(r => r.id) })
    }
  }

  // dryRun 이면 여기까지가 전부 — 세기만 하고 한 줄도 쓰지 않는다.
  if (!dryRun && stmts.length) {
    const ok = await DB.batch(stmts).then(() => true).catch(() => false) // 배치 1회 = 서브리퀘스트 1
    if (!ok) { skip('배치_실패'); out.groups_merged = 0; out.rows_folded = 0; out.backfilled = 0 }
  }
  out.done = groups.length < maxGroups
  return out
}

/** 되돌리기 — 특정 승자로 접힌 행을 전부 복원(감사·오작동 대비). */
export async function undoDedupe(DB: D1Database, survivorId: number): Promise<number> {
  await ensureMergedColumn(DB)
  const r = await DB.prepare(
    'UPDATE ad_company_leads SET active = 1, merged_into = NULL WHERE merged_into = ?',
  ).bind(survivorId).run().catch(() => null)
  return (r as { meta?: { changes?: number } } | null)?.meta?.changes ?? 0
}
