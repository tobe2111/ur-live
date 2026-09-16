/**
 * 🧾 **매장의 사업자번호 — 컬럼이 비어 있으면 meta 로** (2026-09-16)
 *
 * ## 왜 두 자리에 있나 (대표 신고 "사업자등록을 하려고 하는데 이런 에러가 뜨네?" → 라이브 실측)
 *
 * 프로덕션 `sellers` 의 컬럼 선언이 이렇다:
 * ```sql
 * business_number TEXT UNIQUE,     -- ← 테이블 레벨 UNIQUE
 * ```
 * 즉 **한 사업자번호에 셀러 행 하나**만 허용한다. 소비자 셀러(1인1행)에겐 맞는 제약이지만
 * **매장 모델에선 틀렸다** — 한 사업자가 지점을 여럿 내는 게 정상이다(프랜차이즈가 그 자체다).
 *
 * 실측: 라이브 `sellers` 에 행이 **하나뿐**이고(id=14 홍대돈까스, 2026-08-26),
 * 그 행이 `business_number='4790902930'` 을 쥐고 있다. 같은 번호로 두 번째 매장을 등록하면
 * `INSERT` 가 UNIQUE 위반으로 던지고, 바깥 catch 가 **"매장 등록 중 오류가 발생했습니다"** 로
 * 뭉갠다 → 화면엔 원인 없는 500. 그래서 08-26 이후 **매장이 한 곳도 등록되지 못했다.**
 *
 * ⚠️ 이건 2026-09-02 의 `email=''` 사고와 **같은 클래스**다(같은 파일·같은 INSERT·같은 문구).
 * 그때는 빈 문자열이 UNIQUE 슬롯을 먹었고 이번엔 진짜 값이 먹었다.
 *
 * ## 처방 — 컬럼을 버리지 않는다
 * `sellers.business_number` 는 소유권 이전 대조(`store-ownership-claims` 의 `bno_match`)·어드민
 * 심사·정산이 읽는 자리다. meta 로 **옮기면** 그 전부가 조용히 빈칸이 된다. 그래서:
 *
 * - 등록할 때 **항상 `seller_meta.business_number` 에 쓴다**(여기가 진실).
 * - 컬럼에는 **비어 있을 때만** 쓴다(그 번호의 첫 매장이 차지 → 기존 읽기 경로 무회귀).
 * - 읽을 때는 **이 헬퍼를 거친다** — 컬럼이 비면 meta 로 폴백.
 *
 * ⇒ 두 번째 매장부터도 번호가 **데이터에 남고** 대조가 된다. 화면·심사 어디도 빈칸이 아니다.
 *
 * ## 🔭 이게 임시방편이 아닌 이유, 그리고 진짜 끝은 어디인가
 * SQLite 는 **컬럼 선언의 UNIQUE 를 떼어낼 수 없다**(자동 인덱스라 `DROP INDEX` 불가) — 테이블
 * 재생성이 유일한 길이고, 104컬럼짜리 프로덕션 `sellers` 재생성은 **등급 C(결재)** 다.
 * 레포의 의도는 이미 비-UNIQUE 쪽이다 — `internal-admin-tools.routes.ts` 의 수리가
 * `CREATE INDEX idx_sellers_business_number …`(UNIQUE 없음)를 만든다. 옛 `CREATE TABLE` 의
 * `UNIQUE` 만 남아 실제 모델과 어긋나 있는 것이다.
 *
 * 제약이 제거되면 컬럼이 늘 채워지므로 **이 폴백은 저절로 no-op** 이 된다. 지울 필요도 없다.
 */
import { getSellerMeta } from './seller-meta'

/** meta 키 — 등록 경로와 읽기 경로가 같은 문자열을 쓰게 한 곳에 둔다. */
export const BUSINESS_NUMBER_META_KEY = 'business_number'

/** 숫자 10자리만 남긴다(하이픈 표기가 섞여 들어와도 대조가 되도록). */
export function normalizeBno(v: unknown): string {
  return String(v ?? '').replace(/[^0-9]/g, '')
}

/**
 * 매장들의 사업자번호를 한 번에 — `Map<sellerId, 10자리>`.
 * 컬럼이 있으면 그것, 없으면 meta. 둘 다 없으면 키 자체가 없다(빈 문자열을 넣지 않는다 —
 * "모름" 과 "없음" 을 섞으면 대조가 `false` 로 굳는다).
 */
export async function resolveBusinessNumbers(
  DB: D1Database,
  rows: Array<{ id: number; business_number?: string | null }>,
): Promise<Map<number, string>> {
  const out = new Map<number, string>()
  const need: number[] = []
  for (const r of rows) {
    const col = normalizeBno(r.business_number)
    if (col) out.set(r.id, col)
    else if (Number.isFinite(r.id) && r.id > 0) need.push(r.id)
  }
  if (need.length === 0) return out
  const meta = await getSellerMeta(DB, need).catch(() => new Map<number, Record<string, string>>())
  for (const id of need) {
    const v = normalizeBno(meta.get(id)?.[BUSINESS_NUMBER_META_KEY])
    if (v) out.set(id, v)
  }
  return out
}

/** 한 매장의 사업자번호(없으면 `''`). */
export async function resolveBusinessNumber(
  DB: D1Database,
  row: { id: number; business_number?: string | null },
): Promise<string> {
  return (await resolveBusinessNumbers(DB, [row])).get(row.id) || ''
}

/**
 * 이 번호를 **컬럼에** 넣어도 되는가 — 아무도 안 쓰고 있을 때만 참.
 * ⚠️ 검사와 INSERT 사이의 경합은 막지 못한다(D1 에 트랜잭션 없음). 그래서 호출부는 이 값을
 *   *최적화*로만 쓰고, 실제 UNIQUE 위반은 INSERT 를 감싼 폴백이 잡는다.
 */
export async function bnoColumnFree(DB: D1Database, bno: string): Promise<boolean> {
  const v = normalizeBno(bno)
  if (!v) return false
  const hit = await DB.prepare('SELECT id FROM sellers WHERE business_number = ? LIMIT 1')
    .bind(v).first<{ id: number }>().catch(() => null)
  return !hit
}

/**
 * 조회 결과의 `business_number` 빈칸을 meta 로 **제자리에서** 채운다.
 * 목록 화면(어드민 심사)이 한 줄로 쓰게 하려고 여기 둔다 — 호출부마다 루프를 복제하면
 * 한 곳만 빠뜨렸을 때 그 화면만 조용히 빈칸이 된다(이 결함이 정확히 그 모양이었다).
 */
export async function patchBusinessNumbers<T extends { id: number; business_number?: string | null }>(
  DB: D1Database,
  rows: T[],
): Promise<T[]> {
  const m = await resolveBusinessNumbers(DB, rows).catch(() => new Map<number, string>())
  for (const r of rows) if (!r.business_number) r.business_number = m.get(r.id) || null
  return rows
}
