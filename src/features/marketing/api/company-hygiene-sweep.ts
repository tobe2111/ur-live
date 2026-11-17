/**
 * 🧹 **연락처 위생 백로그 1회 스윕** — 재분류 랩을 기다리지 않는다 (2026-08-14).
 *
 * ## 왜 따로 도는가 (이게 이 파일의 존재 이유다)
 * `company-lead-hygiene.ts` 의 주석은 *"이 레인은 어차피 전 행을 한 바퀴 돈다 — 추가 스캔 0"* 이라고
 * 적혀 있었다. **그 전제가 사실이 아니다.** 2026-08-14 실측:
 *
 * ```
 * classified_v 분포   v4 110,298 · v5 94,812 · v6 14,276 · v7 8,811 · v8 74,282
 * 재분류 처리량       250행/시간 (cap 1회/시간 · stopped_by=deadline — CPU 사망 학습분)
 * ```
 *
 * **v4 에 11만 행이 남아 있다는 것은 랩이 한 번도 완주하지 못했다는 뜻이다.** 250행/시간이면
 * 30만 행 한 바퀴에 **50일**이고, 규칙 버전을 올릴 때마다 그 시계가 처음으로 되돌아간다.
 * 즉 위생 규칙을 랩에 얹으면 *언젠가*가 아니라 **사실상 영영** 안 닿는 행이 생긴다.
 *
 * 대표가 파트너 풀 화면에서 보는 것은 지금의 876건이다. "고쳤지만 50일 뒤"는 안 고친 것과 같다.
 *
 * ## 🔑 설계 — 랩과 정반대로 판다
 * - 랩은 **전 행**을 돌며 규칙을 다시 매긴다(느리지만 빠짐없다).
 * - 이 스윕은 **결함이 있는 행만** SQL 로 좁혀 한 바퀴 돌고 **끝낸다**(id 창 이동, 완료 도장).
 *
 * ⚠️ **SQL 술어는 판정자가 아니라 *좁히개* 다.** 최종 판정은 `hygieneStatements` 하나뿐이고,
 *   그 함수는 **값이 실제로 바뀔 때만** 문장을 만든다 → SQL 이 과하게 잡아도(위양성) 결과는 무해하고,
 *   덜 잡으면(위음성) 그 행은 기존대로 랩이 처리한다. **어느 쪽도 새 사고를 만들지 않는다.**
 *
 * ⚠️ **id 창으로 전진한다** — 매칭 건수로 커서를 옮기면, 결함이 희소해서(30만 중 900) 한 회차가
 *   테이블을 통째로 훑게 된다(회차마다 풀스캔 = D1 읽기 폭식). 창을 고정하면 스윕 전체가
 *   **테이블 1회 통과**로 끝난다.
 */
import type { HygieneRow } from './company-lead-hygiene'

/** 스윕 세대. 위생 규칙이 바뀌어 **과거 행을 다시 훑어야 할 때만** 올린다(랩 버전과 무관). */
export const HYGIENE_SWEEP_VERSION = 4 // 2026-11-17: 규칙 보류(중국 메일·도어웨이)에 사유를 적는다 — 되살아난 행까지 다시 훑는다

const HYGIENE_STATE = 'ads_company_hygiene_sweep'
/** id 창 크기 — 회차당 스캔량을 예측 가능하게 묶는다(이 레인은 CPU 로 죽은 이력이 있다). */
const ID_WINDOW = 50_000

/**
 * ☎️ **국번 길이가 틀린 전화** 를 SQL 로 좁히는 술어.
 *
 * 옛 포맷터가 국번을 모른 채 잘라 `010-4233-5119` 를 `0104-233-5119` 로 저장했다.
 * 그래서 결함의 모양은 언제나 **"접두사에 맞는 머리 길이가 아니다"** 이다.
 *
 * ⚠️ 정답 목록이 아니라 **의심 목록**이다 — 실제 교정은 `formatKrPhone` 이 한다.
 */
export const PHONE_SHAPE_SUSPECT_SQL = `(
       phone NOT LIKE '%-%'
    OR (phone LIKE '02%'  AND phone NOT LIKE '02-%')
    OR (phone LIKE '050%' AND phone NOT LIKE '050_-%')
    OR (phone LIKE '15%'  AND phone NOT LIKE '15__-%')
    OR (phone LIKE '16%'  AND phone NOT LIKE '16__-%')
    OR (phone LIKE '18%'  AND phone NOT LIKE '18__-%')
    OR (phone LIKE '01%'  AND phone NOT LIKE '01_-%')
    OR (phone LIKE '03%'  AND phone NOT LIKE '03_-%')
    OR (phone LIKE '04%'  AND phone NOT LIKE '04_-%')
    OR (phone LIKE '05%'  AND phone NOT LIKE '050%' AND phone NOT LIKE '05_-%')
    OR (phone LIKE '06%'  AND phone NOT LIKE '06_-%')
    OR (phone LIKE '07%'  AND phone NOT LIKE '07_-%')
  )`

/** 🌏 중국 무료메일 도메인 — 위생 규칙(`company-lead-hygiene` 🌏)과 아래 좁히개가 **같은 목록**을 쓴다. */
export const OVERSEAS_FREEMAIL_DOMAINS = ['163.com', '126.com', 'qq.com', 'sina.com', 'sina.cn', 'sohu.com', 'yeah.net', 'foxmail.com', '139.com', 'aliyun.com'] as const

/**
 * 🎭 가짜 연락처 좁히개 — 판정은 `company-contact-quality` 의 함수가 한다(여기는 넓게 잡아도 무해).
 *   전화: 글자가 섞였거나(`N/A`·`010-개인정보`) 뒤 8자리가 반복·연번. 이메일: 예시 도메인·예시 아이디·아이디=도메인.
 */
export const PLACEHOLDER_CONTACT_SUSPECT_SQL = `(
       (phone IS NOT NULL AND phone != '' AND (phone GLOB '*[^0-9 ()+.~-]*'
          OR phone LIKE '%0000-0000' OR phone LIKE '%1111-1111' OR phone LIKE '%1234-5678' OR phone LIKE '%1234-1234'
          OR phone LIKE '%5678-5678' OR phone LIKE '%8765-4321' OR length(replace(replace(phone,'-',''),' ','')) < 8))
    OR (email IS NOT NULL AND email != '' AND (email LIKE '%@example.%' OR email LIKE '%@test.com' OR email LIKE '%@email.com'
          OR email LIKE '%@domain.com' OR email LIKE '%@111.com' OR email LIKE '%@abc.com' OR email LIKE '%@aaa.com'
          OR email LIKE '%@company.com' OR email LIKE '%@xxx.com' OR email LIKE '%@yourdomain.com'
          OR email LIKE 'email@%' OR email LIKE 'mail@%' OR email LIKE 'test@%' OR email LIKE 'example@%' OR email LIKE 'admin@%'
          OR email LIKE 'abc@%' OR email LIKE 'aaa@%' OR email LIKE 'id@%' OR email LIKE 'user@%' OR email LIKE 'none@%'
          OR email LIKE 'gmail.com@%' OR email LIKE 'naver.com@%' OR email LIKE 'naver@%' OR email LIKE 'gmail@%'
          OR email LIKE 'daum.net@%' OR email LIKE 'hanmail@%' OR email LIKE '11%@%' OR email LIKE '00%@%'))
  )`

/** 🕳️ 도어웨이·빈 페이지 제목 좁히개(webkr 한정 — 판정은 `pageTitleHoldReason`, 여기는 넓게 잡아도 무해). */
export const PAGE_HOLD_SUSPECT_SQL = `(source = 'webkr' AND hold_reason IS NULL AND (company_name LIKE '%벌초%' OR company_name LIKE '%이장%'
    OR company_name LIKE '%파묘%' OR company_name LIKE '%유골%' OR company_name LIKE '%중입니다%' OR company_name LIKE '%중 입니다%'
    OR company_name LIKE '%Forbidden%' OR company_name LIKE '%Not Found%' OR company_name LIKE '%페이지%' OR company_name LIKE '%문화대전%'
    OR company_name LIKE 'site move' OR company_name LIKE 'index of%'))`

/** 결함 후보 술어 — 전화 모양 + 이름에 남은 HTML 엔티티(`SM C&amp;C 성수`) + 해외 무료메일 온라인판매(🌏) + 가짜 연락처(🎭) + 도어웨이(🕳️). */
export const HYGIENE_SUSPECT_SQL =
  `(company_name LIKE '%&%;%') OR (phone IS NOT NULL AND phone != '' AND ${PHONE_SHAPE_SUSPECT_SQL})`
  // 🧷 v4: `active = 1` 조건을 뺐다 — 이미 보류된 행에도 사유를 적어야 다음 재수집에 안 풀린다.
  + ` OR (hold_reason IS NULL AND category = '온라인판매' AND (${OVERSEAS_FREEMAIL_DOMAINS.map(d => `email LIKE '%@${d}'`).join(' OR ')}))`
  + ` OR ${PLACEHOLDER_CONTACT_SUSPECT_SQL} OR ${PAGE_HOLD_SUSPECT_SQL}`

export interface HygieneSweepResult {
  scanned: number
  fixed: number
  cursor: number
  done: boolean
  /** 이미 완주해 아무 일도 안 했다 — 회차당 비용은 설정 1행 읽기뿐이다. */
  skipped?: boolean
}

interface SweepState { v: number; cursor: number; fixed: number; done: boolean }

function readState(raw: string | null | undefined): SweepState {
  try {
    const p = raw ? JSON.parse(raw) : null
    if (p && Number(p.v) === HYGIENE_SWEEP_VERSION) {
      return { v: HYGIENE_SWEEP_VERSION, cursor: Number(p.cursor) || 0, fixed: Number(p.fixed) || 0, done: !!p.done }
    }
  } catch { /* 손상/최초 실행 — 처음부터 */ }
  return { v: HYGIENE_SWEEP_VERSION, cursor: 0, fixed: 0, done: false }   // 세대가 다르면 다시 판다
}

/**
 * 결함 후보를 id 창 하나만큼 훑어 위생 문장을 적용한다.
 *
 * @returns `done: true` 면 이 세대의 백로그는 끝났다(다음 회차부터 `skipped`).
 */
export async function sweepCompanyHygiene(DB: D1Database, idWindow = ID_WINDOW): Promise<HygieneSweepResult> {
  const { hygieneStatements } = await import('./company-lead-hygiene')
  // 🧱 스키마 보장을 먼저 한다(이미 했으면 무비용) — 좁히개가 새 칸을 읽게 되는 순간(다음 PR `hold_reason`),
  //   배포 직후 그 칸이 아직 없으면 SELECT 가 실패한다. 실패는 아래에서 커서를 멈추게 했다.
  const { ensureCompanySchema } = await import('./company-discovery')
  await ensureCompanySchema(DB)

  const cur = await DB.prepare('SELECT value FROM platform_settings WHERE key = ?').bind(HYGIENE_STATE)
    .first<{ value: string }>().catch(() => null)
  const st = readState(cur?.value)
  if (st.done) return { scanned: 0, fixed: 0, cursor: st.cursor, done: true, skipped: true }

  const hi = st.cursor + Math.max(1_000, idWindow)
  const rowsRes = (await DB.prepare(
    `SELECT id, company_name, phone, email, website, category, contact_source, source, status, memo, hold_reason
       FROM ad_company_leads
      WHERE merged_into IS NULL AND id > ? AND id <= ? AND (${HYGIENE_SUSPECT_SQL})
      ORDER BY id`,
  ).bind(st.cursor, hi).all<HygieneRow>().catch(() => null))
  // 🩺 조회 실패는 '결함 0' 이 아니다 — 커서를 움직이지 않고 끝낸다(다음 회차가 같은 창을 다시 본다).
  if (!rowsRes) return { scanned: 0, fixed: 0, cursor: st.cursor, done: false }
  const rows = rowsRes.results || []

  const stmts: D1PreparedStatement[] = []
  let fixed = 0
  for (const r of rows) {
    const s = hygieneStatements(r, sql => DB.prepare(sql))
    if (s.length) { for (const one of s) stmts.push(one); fixed++ }
  }
  for (let i = 0; i < stmts.length; i += 100) await DB.batch(stmts.slice(i, i + 100)).catch(() => null)

  // 창을 다 소진했는지는 **매칭 건수가 아니라 테이블 끝(MAX(id))** 으로 판정한다.
  //   매칭 0 을 완료로 읽으면 결함이 드문 구간에서 스윕이 조기 종료된다.
  const maxRow = await DB.prepare('SELECT MAX(id) AS n FROM ad_company_leads').first<{ n: number }>().catch(() => null)
  const maxId = Number(maxRow?.n) || 0
  const done = hi >= maxId
  const next: SweepState = { v: HYGIENE_SWEEP_VERSION, cursor: done ? maxId : hi, fixed: st.fixed + fixed, done }
  await DB.prepare('INSERT OR REPLACE INTO platform_settings (key, value) VALUES (?, ?)')
    .bind(HYGIENE_STATE, JSON.stringify(next)).run().catch(() => null)

  return { scanned: rows.length, fixed, cursor: next.cursor, done }
}
