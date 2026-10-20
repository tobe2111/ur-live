import { safeInternalPath } from '@/utils/safe-internal-path'
import { resolveConsumerAlias } from '@/shared/seo/consumer-redirects'

/**
 * 🔗 홈 섹션 '더보기' 링크 해석 (SSOT).
 *
 * 어드민이 `homepage_sections.more_href` 에 넣은 값을 **실제로 갈 수 있는 내부 링크**로 바꾼다.
 * 셋을 동시에 해야 하는데, 그동안 한 번에 하나씩만 맞아서 같은 신고가 세 번 났다:
 *   ① 외부 URL·인증 경로 차단          (`safeInternalPath`)
 *   ② 별칭을 정본으로                   (`/group-buy` → `/` — 안 하면 홈이 리마운트되며 옛 프레임이 번쩍)
 *   ③ **쿼리 보존**                     (`/?sort=popular` 의 `?sort=popular`)
 *
 * ## 💀 왜 인라인으로 두면 안 되는가 — 실제로 두 번 틀렸다
 * `safeInternalPath` 는 **경로 검증기이자 쿼리 제거기**다(2026-05-01, `?error=…` 누적 차단).
 * `ref`/`aff`/`invite` 만 화이트리스트로 살리고 **나머지 쿼리는 통째로 버린다.**
 *
 * - 2026-08-19: "쿼리를 다시 붙이자"고 고쳤는데, `safeInternalPath(more_href)` **결과에서** 쿼리를
 *   찾았다. 그때는 이미 버려진 뒤라 붙일 게 없었다 — **그 수정은 한 번도 동작한 적이 없다.**
 * - 2026-08-27: 그 위에 "아무 데도 못 가는 링크는 숨긴다"를 얹었더니, `/?sort=popular` 가 `/` 로
 *   납작해진 상태로 그 규칙에 걸려 **버튼이 통째로 사라졌다**(대표 신고 "더보기 클릭도 안 되고").
 *
 * ⇒ 순서를 뒤집는다: **먼저 쪼개고**, 경로만 검증·정규화하고, 쿼리는 따로 소독해 다시 붙인다.
 *   그리고 순수 함수로 빼서 **실제 입력으로 테스트**한다(문자열 검사로는 위 두 실수를 못 잡는다).
 */

/**
 * 쿼리·해시에 허용할 문자.
 *
 * 경로는 이미 `safeInternalPath` 가 내부 경로임을 보장하므로 쿼리가 외부로 보낼 수는 없다.
 * 그래도 제어문자·따옴표·꺾쇠는 막는다 — 링크가 어디 붙어 쓰일지는 이 함수가 모른다.
 */
const SAFE_QUERY_RE = /^[?#][A-Za-z0-9_\-=&%.,:/+~!*'()[\]]*$/

export function resolveSectionMoreHref(moreHref: string | null | undefined): string {
  if (!moreHref) return ''
  // ⚠️ 반드시 **검증 전에** 쪼갠다 — safeInternalPath 는 쿼리를 버린다(위 주석).
  const cut = moreHref.search(/[?#]/)
  const rawPath = cut === -1 ? moreHref : moreHref.slice(0, cut)
  const rawQuery = cut === -1 ? '' : moreHref.slice(cut)

  const path = safeInternalPath(rawPath, '')
  if (!path) return ''

  const canon = resolveConsumerAlias(path) ?? path
  const query = SAFE_QUERY_RE.test(rawQuery) ? rawQuery : ''
  return `${canon}${query}`
}

/**
 * 눌러도 **정말 아무 일이 없는** 링크인가.
 *
 * 홈에서 홈으로 가는 맨 `/` 가 그렇다. 쿼리가 붙어 있으면 다르다 —
 * `useHomeQuerySync` 가 정렬을 반영하고 그리드로 스크롤해 주므로 의도대로 동작한다.
 * 대표 확정 "안 올리면 아예 안 보이게"와 같은 철학: 죽은 버튼은 없느니만 못하다.
 */
export function isDeadEndHref(href: string): boolean {
  return href === '' || href === '/'
}
