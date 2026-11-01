/**
 * 🔗 에이전시 매장 초대 링크(`/store/agency/:token`) — 서버 메타 (2026-10-31 대표 *"2번 카카오톡에선 어떻게 보여?"* → *"모두 진행해줘"*)
 *
 * 🩸 실측(배포 전 라이브, 카카오 스크래퍼 UA): 이 주소가 **유어딜 홈 카드**("유어딜 - 돈버는 쇼핑…")와
 *   `robots: index, follow` 로 나갔다. ① 어느 에이전시가 보낸 링크인지 카드에 없어 사장님에게 광고처럼 보였고
 *   ② 남에게 보이면 안 되는 개인 링크인데 검색에 올려도 된다고 말하고 있었다. 없는 토큰도 똑같이 200 이었다.
 *
 * ⇒ 카드 = 에이전시 이름이 들어간 제목(문구 SSOT `shared/agency-store-invite.ts` `agencyInviteCardCopy` — 에이전시가
 *   [카카오톡으로 보내기] 로 보내는 카드와 같은 문장) · **언제나 noindex** · 없는 토큰은 슬롯이 `ENTITY_SLOTS` 라 404 + noindex.
 * 🧷 같은 주소에 이름 없는 공통 메타(`agencyInviteSurfaceSeo`, 동적 표면)도 걸린다 — 그 rewrite 가 **나중에** 돌아
 *   덮으므로, 워커는 여기서 메타를 만들었으면 공통 rewrite 를 건너뛴다. 토큰이 없거나 조회 실패면 공통 메타(noindex)가 남는다.
 * 🔒 값은 공개 API(`GET /api/store-agency-invite/:token`)가 쿠키 없이 주는 **에이전시 이름 하나**뿐이다.
 */
import { agencyInviteCardCopy } from '../../shared/agency-store-invite'
import type { SurfaceRewriteMeta } from './surface-ssr-meta'

export function buildStoreInviteMeta(payload: unknown, origin: string, pathname: string): SurfaceRewriteMeta | null {
  const p = payload as { success?: boolean; agencyName?: unknown } | null
  if (!p || p.success !== true) return null
  const name = typeof p.agencyName === 'string' ? p.agencyName : ''
  const c = agencyInviteCardCopy(name)
  return {
    pageTitle: `${c.title} - 유어딜`,
    title: c.title,
    description: c.description,
    canonical: `${origin}${pathname}`,
    noindex: true,
  }
}
