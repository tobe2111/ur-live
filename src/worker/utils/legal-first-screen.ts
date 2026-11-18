/**
 * ⚖️ 정책 문서 두 장(`/refund` 환불 및 교환/반품 정책 · `/terms` 이용약관) 서버 첫 화면 (2026-11-18).
 *
 * 라이브 실측(폰 4G · CPU 4배): `/refund` 첫 그림 1.5~3.0s · `/terms` 2.1~4.0s — 같은 조건 `/faq`(서버 첫 화면) 0.5~1.3s.
 * 둘 다 데이터 요청이 하나도 없는 고정 문서라 **화면 전체**를 서버가 그린다. 토스 PG 심사가 직접 여는 주소이기도 하다.
 *
 * 같은 모양의 근거(두 벌 금지):
 *   - 환불: 문구·구조·클래스 = `shared/refund-policy-content.ts`(`REFUND_BODY` 트리) — 화면이 같은 트리를 `createElement` 로 그린다.
 *   - 약관: 문구 = `pages/terms/consumer-terms-content.ts`(순수 데이터) · 클래스 = `shared/terms-page.ts` — `TermsDocument` 가 같은 상수를 쓴다.
 * 그리지 않는 것: 뒤로 화살표 그림(같은 24px 빈 칸 — 아이콘 두 벌 금지).
 * 📧 이메일이 든 글자는 `emailOff` 로 감싼다(Cloudflare 가리기가 `[email protected]` 으로 바꿔 글자 폭이 달라진다).
 * 🖥️ PC: 두 경로는 `shared/pc-fullbleed.ts` 등재(액자 없음 — 2026-09-21 A 묶음)라 [상단 네비 + 같은 본문](숙소 목록 선례).
 */
import { REFUND_BODY, REFUND_CLS, REFUND_COPY, type RefundNode } from '../../shared/refund-policy-content'
import { TERMS_CLS, termsEffectiveLine } from '../../shared/terms-page'
import { CONSUMER_TERMS } from '../../pages/terms/consumer-terms-content'
import type { TermsDoc } from '../../pages/terms/terms-types'
import { pcTopNavBlockHtml } from './pc-topnav-first-screen'
import { emailOff } from './email-off'
import { legalPathOf, LEGAL_FIRST_SCREEN_PATHS, type LegalPath } from '../../shared/legal-first-paths'

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const escAttr = (s: string) => esc(s).replace(/"/g, '&quot;')
const txt = (s: string) => emailOff(esc(s))

export { legalPathOf, LEGAL_FIRST_SCREEN_PATHS } // 워커 분기가 빌더와 함께 읽는다(판정 SSOT `shared/legal-first-paths.ts`)

/** 환불 문구 트리 → HTML(화면의 `renderRefundNode` 와 같은 태그·클래스). */
export function refundNodesHtml(nodes: RefundNode[]): string {
  return nodes.map((n) => typeof n === 'string' ? txt(n)
    : `<${n.tag}${n.cls !== undefined ? ` class="${escAttr(n.cls)}"` : ''}>${refundNodesHtml(n.kids)}</${n.tag}>`).join('')
}

/** 머리줄 — 화면은 `<button><ChevronLeft/></button>`, 서버는 같은 24px 빈 칸(누를 수 없는 그림 자리). */
function headHtml(c: { header: string; headerRow: string; back: string; backIcon: string; title: string; spacer: string }, title: string): string {
  return `<div class="${c.header}"><div class="${c.headerRow}"><span class="${c.back}" aria-hidden="true"><span class="${c.backIcon} block"></span></span>` +
    `<h1 class="${c.title}">${esc(title)}</h1><div class="${c.spacer}"></div></div></div>`
}

export function refundPageHtml(): string {
  return `<div class="${REFUND_CLS.root}">${headHtml(REFUND_CLS, REFUND_COPY.title)}<div class="${REFUND_CLS.content}">${refundNodesHtml(REFUND_BODY)}</div></div>`
}

export function termsPageHtml(doc: TermsDoc = CONSUMER_TERMS): string {
  const C = TERMS_CLS
  const pre = (doc.preamble ?? []).map((p) => `<p class="${C.preamble}">${txt(p)}</p>`).join('')
  const secs = doc.sections.map((s, i) => `<section class="${i > 0 ? C.sectionRest : ''}">` +
    (s.chapter ? `<p class="${C.chapter}">${txt(s.chapter)}</p>` : '') + `<h2 class="${C.h2}">${txt(s.title)}</h2>` +
    (s.paras ?? []).map((p) => `<p class="${C.para}">${txt(p)}</p>`).join('') +
    (s.items ? `<ol class="${C.items}">${s.items.map((it) => `<li>${txt(it)}</li>`).join('')}</ol>` : '') + '</section>').join('')
  return `<div class="${C.root}">${headHtml(C, doc.title)}<div class="${C.content}"><p class="${C.effective}">${txt(termsEffectiveLine(doc.effective, doc.version))}</p>${pre}` +
    `<div class="${C.sections}">${secs}</div><div class="${C.footer}"><p class="${C.footerText}">${txt(doc.footer)}</p></div></div></div>`
}

/**
 * @param pcPath PC 면 지금 경로(상단 네비를 먼저 그린다 — 앱의 `DesktopTopNav` 풀너비판). 폰·크롤러는 생략.
 * 🧷 노드 id 는 다른 첫 화면과 같다 — `lib/boot-first-screen.ts` 가 이 노드를 Suspense 폴백에 도로 붙인다. 로더는 그 아래(거의 안 보인다).
 */
export function buildLegalFirstScreen(path: LegalPath, loaderHtml: string, pcPath?: string): string {
  const page = path === '/refund' ? refundPageHtml() : termsPageHtml()
  return `<div id="ur-first-screen">${pcPath ? pcTopNavBlockHtml(pcPath) : ''}${page}</div>${loaderHtml.replace('min-height:100dvh', 'min-height:34dvh')}`
}
