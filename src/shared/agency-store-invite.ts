/**
 * 🔗 에이전시 매장 영입 링크 — 문구 단일 소스 (2026-10-31 대표)
 *   대표: *"매장 영입 링크 만들기 이렇게 버튼 필요하지 않을까? 카카오톡으로 보면 예쁘게 보이게끔 하거나.
 *   매장이 있어도 계속 초대가 필요해"* · *"그 링크로 들어와서 가입하면 바로 에이전시와 매장이 연동되게 하면 되잖아."*
 *
 * 같은 링크가 두 길로 카톡에 들어간다 — 둘 다 이 파일의 문구를 쓴다(두 벌이면 카드가 길마다 다르게 말한다).
 *   ① [카카오톡으로 보내기] — SDK 가 우리가 정한 카드를 보낸다(에이전시 이름이 들어간다).
 *   ② 주소를 복사해 붙여 넣기 — 카톡 스크래퍼가 서버 메타로 카드를 만든다. 워커는 **조회를 하지 않으므로**
 *      에이전시 이름 없이 같은 뜻을 말한다. 종전엔 이 길이 **유어딜 홈 카드**(`index, follow`)였다.
 *
 * 링크 모양(`/store/agency/<64자리 16진수>`)은 서버 `storeInviteUrl` 이 만든다.
 */
export const AGENCY_INVITE_PATH_PREFIX = '/store/agency/'

/** 가입 흐름에서 초대 토큰을 실어 나르는 쿼리 이름 — 초대 화면과 매장 등록 화면이 같은 이름을 쓴다. */
export const AGENCY_INVITE_QUERY = 'agency_invite'

const TOKEN_RE = /^[0-9a-f]{64}$/

/** 초대 토큰 모양인가 — 서버(`store-agency-invite.routes`)와 같은 규칙. 쿼리로 들어온 값을 그대로 믿지 않는다. */
export function isAgencyInviteToken(v: unknown): v is string {
  return typeof v === 'string' && TOKEN_RE.test(v)
}

/** 사장님이 받는 카드의 글. `agencyName` 이 없으면(스크래퍼 길) 이름 없이 같은 말을 한다. */
export function agencyInviteCardCopy(agencyName?: string | null): { title: string; description: string; button: string } {
  const name = (agencyName || '').trim()
  return {
    title: name ? `${name} 에이전시가 매장 운영을 맡겠다고 해요` : '에이전시가 매장 운영을 맡겠다고 해요',
    description: '링크를 열어 [맡기기] 한 번이면 이용권 등록·주문 관리를 대신 해 드려요. 아직 유어딜에 없는 매장도 등록하면 바로 연결돼요.',
    button: '매장 맡기기',
  }
}

/**
 * 워커 동적 표면 메타(`registerDynamicSurfaceSeo`) — 초대 링크 주소에만 답한다.
 * 🔴 `noindex` 필수 — 토큰이 든 주소는 그 에이전시만의 열쇠다. 검색에 뜨면 안 된다(종전 `index, follow`).
 */
export function agencyInviteSurfaceSeo(path: string): { title: string; description: string; path: string; noindex: true } | null {
  if (!path.startsWith(AGENCY_INVITE_PATH_PREFIX)) return null
  if (!isAgencyInviteToken(path.slice(AGENCY_INVITE_PATH_PREFIX.length))) return null
  const c = agencyInviteCardCopy(null)
  return { title: c.title, description: c.description, path, noindex: true }
}
