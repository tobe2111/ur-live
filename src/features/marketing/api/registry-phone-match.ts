/**
 * ☎️ **전화번호로 원부 이메일을 찾는다** (2026-08-03 대표 질문 — *"파트너풀에서 전화번호를 통해 이메일을 알아낼 수 있는 방법"*).
 *
 * ## 왜 이게 되는가
 * 통신판매업 신고는 **상호·전화·이메일을 함께** 공시한다. 그래서 `source='commerce'` 원부에만
 * 이메일이 20,378건 있고(다른 소스 전부 합쳐 152건), 그 행들은 **전화번호도 같이** 갖고 있다.
 * ⇒ 전화만 있고 이메일이 없는 리드의 전화번호를 원부에 대조하면 **외부 호출 0회로 이메일이 붙는다.**
 *
 * ## 이름 매칭(`registry-email-match`)이 못 잡던 것
 * ```
 *   "○○커피"  ↔  "주식회사 ○○커피"  ↔  "○○커피 강남점"     ← 같은 곳인데 name_norm 이 다르다
 *   "(주)에이비씨" ↔ "ABC"                                  ← 표기 체계가 아예 다르다
 * ```
 * 상호는 흔들린다. **전화번호는 안 흔들린다** — 숫자만 남기면 정확 일치하는 강한 키다.
 * 그래서 이름 매칭의 **보완**이지 대체가 아니다(둘 다 돌린다).
 *
 * ## 🛡️ 오매칭을 막는 것 — 이게 이 모듈의 절반이다
 * 전화번호가 같다고 항상 같은 사업자는 아니다:
 *   · **대표번호**(1588·1544·1566·1577·1600·1661·1670·1899·080…) 는 **본사 하나에 매장 수백**이다.
 *     그대로 이으면 전혀 다른 매장에 본사 이메일이 붙는다 — 잘못된 이메일은 **반송·스팸신고**가 되어
 *     도메인 평판을 깎는다(그건 되돌리기 어렵다).
 *   · **같은 번호에 원부 행이 여러 개**면 어느 쪽인지 모른다 → 버린다(ambiguous).
 *   · 너무 짧은 번호(정규화 후 9자리 미만)는 애초에 신뢰하지 않는다.
 *
 * ## ⚠️ 이 모듈이 하지 않는 것
 * - **외부 조회 안 한다.** 전화→이메일 역방향 조회 API 는 한국에 없다(개인정보보호법). 여기서 하는 것은
 *   **우리가 이미 공시로 받은 두 데이터를 잇는 것**뿐이다.
 * - 추측 생성 안 한다(`info@도메인` 같은 것). 공시된 주소만 옮긴다.
 */

/** 대표번호 접두 — 한 번호에 사업장이 여럿이라 **개별 사업자로 이어 붙이면 안 된다**. */
export const SHARED_LINE_PREFIXES = ['1588', '1544', '1566', '1577', '1600', '1661', '1670', '1899', '1855', '1877', '080'] as const

/**
 * 전화번호 정규화 — 숫자만 남긴다. 매칭 키로 쓸 수 없으면 `null`.
 * @returns 9자리 이상 숫자열, 아니면 null(짧은 번호·내선·쓰레기값)
 */
export function normalizePhoneKey(raw: unknown): string | null {
  const d = String(raw ?? '').replace(/\D/g, '')
  if (d.length < 9 || d.length > 12) return null
  return d
}

/** 대표번호인가 — 그렇다면 개별 매칭 키로 쓰지 않는다. */
export function isSharedLine(digits: string): boolean {
  return SHARED_LINE_PREFIXES.some(p => digits.startsWith(p))
}

/** 매칭 키로 쓸 수 있는 번호만 통과. 대표번호·짧은 번호는 걸러진다. */
export function phoneMatchKey(raw: unknown): string | null {
  const d = normalizePhoneKey(raw)
  if (!d || isSharedLine(d)) return null
  return d
}

export interface RegistryPhoneRow { phone: string | null; email: string | null; website: string | null }

/**
 * 후보 원부 행들에서 **확신할 수 있을 때만** 연락처를 고른다.
 *
 * @param rows 같은 전화번호로 찾은 원부 행들
 * @returns 이어 붙일 연락처, 또는 버리는 사유
 *
 * ⚠️ 여러 행이 나오면 **서로 이메일이 같을 때만** 통과시킨다 — 지점이 여럿이어도 대표 이메일이
 *   하나면 그건 같은 사업자라고 봐도 된다. 이메일이 갈리면 어느 쪽인지 모르므로 버린다.
 */
export function pickRegistryContact(rows: readonly RegistryPhoneRow[]): { email: string | null; website: string | null } | { skip: string } {
  if (!rows.length) return { skip: 'no_registry_row' }
  const emails = [...new Set(rows.map(r => (r.email || '').trim().toLowerCase()).filter(Boolean))]
  if (emails.length > 1) return { skip: 'ambiguous_phone' }
  const sites = [...new Set(rows.map(r => (r.website || '').trim()).filter(Boolean))]
  const email = emails[0] || null
  const website = emails.length === 1 || sites.length === 1 ? (sites[0] || null) : null
  if (!email && !website) return { skip: 'registry_row_empty' }
  return { email, website }
}
