/**
 * 🤖 `llms.txt` — AI 에이전트·검색이 읽는 사이트 요약 (2026-10-12, 대표 *"나머진 다 해줘"*)
 *
 * ## 왜
 *
 * `/llms.txt` 가 **404** 였다(라이브 실측). AI 검색·에이전트가 사이트를 읽을 때 처음 찾는
 * 관례적 입구이고, 없으면 그들은 HTML 을 통째로 긁어 추측한다. 2026-10-12 에 `<noscript>` 요약과
 * `FAQPage` 로 **상세·FAQ 쪽 문장**은 배달되게 만들었는데, *"이 사이트가 통째로 무엇인가"* 를
 * 한 장에 말해 주는 자리가 비어 있었다.
 *
 * ## 두 가지 규율
 *
 * ① **문구를 베끼지 않는다** — 소개 문장은 `CONCEPT_ABOUT_LINES`, Q&A 는 `CONCEPT_FAQ`,
 *   경로·설명은 `CONSUMER_SURFACE_SEO` 에서 온다. 세 SSOT 가 이미 화면과 구조화 데이터를
 *   먹이고 있으므로, 여기서 손으로 적으면 **네 번째 사본**이 생기고 반드시 갈린다.
 * ② **noindex 표면을 권하지 않는다** — `/search`·`/gb-market` 은 서버가 `noindex` 를 내는
 *   표면이다. 색인하지 말라고 한 URL 을 AI 에게 "여기를 보라" 고 제출하는 것은 서로 반대되는
 *   신호다(2026-10-11 에 `ItemList` 에서 같은 규율을 세웠다).
 *
 * ## 못 하는 것
 *
 * 이 파일이 있다고 AI 가 읽어 준다는 보장은 없다 — `llms.txt` 는 표준이 아니라 관례다.
 * 실제 인용 여부는 외부 판정이고 수일~수주 걸린다.
 */
import { CONSUMER_SURFACE_SEO } from './consumer-surfaces'
import { CONCEPT_ABOUT_LINES, CONCEPT_FAQ } from './concept-content'
import { LLMS_CATALOG_LINK_LABEL, LLMS_CATALOG_PATH } from './llms-catalog'
import { agentSearchLines } from '../agent-search'
import { agentCheckoutLines } from '../agent-checkout'

/** 법적·정책 표면 — 서비스 설명과 섞으면 "무엇을 파는 곳인가" 가 묻힌다. */
const POLICY_PREFIXES = ['/terms', '/privacy', '/refund', '/gdpr'] as const

function isPolicyPath(path: string): boolean {
  return POLICY_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`))
}

/** 링크 라벨 — 짧은 빵부스러기 라벨이 있으면 그것, 없으면 마케팅 제목. */
function labelOf(path: string): string {
  const s = CONSUMER_SURFACE_SEO[path]
  return s?.crumb || s?.title || path
}

function oneLine(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

export function buildLlmsTxt(origin: string, opts: { agentSearch?: boolean; agentCheckout?: boolean } = {}): string {
  const base = origin.replace(/\/+$/, '')
  // 루트는 제목 줄이 이미 가리킨다 — 링크 목록에 다시 넣지 않는다.
  const paths = Object.keys(CONSUMER_SURFACE_SEO).filter(
    (p) => p !== '/' && !CONSUMER_SURFACE_SEO[p]?.noindex,
  )
  const service = paths.filter((p) => !isPolicyPath(p))
  const policy = paths.filter(isPolicyPath)

  const linkLine = (p: string) =>
    `- [${labelOf(p)}](${base}${p}): ${oneLine(CONSUMER_SURFACE_SEO[p]?.description || '')}`

  const out: string[] = [
    // 🎨 2026-10-13 — 제목에서 em-dash 를 뺐다(anti-slop R1 이 이제 이 파일을 본다).
    //   주소는 줄을 따로 두므로 내용은 한 글자도 안 줄었다.
    '# 유어딜 (UrDeal)',
    base,
    '',
    `> ${CONCEPT_ABOUT_LINES[0]}`,
    '',
    ...CONCEPT_ABOUT_LINES.slice(1),
    '',
    // 🗂️ 2026-10-19 — 소개만으로는 *무엇을 어디서 얼마에* 파는지 모른다. 실제 목록은 따로(매시 갱신).
    `- ${LLMS_CATALOG_LINK_LABEL}: ${base}${LLMS_CATALOG_PATH}`,
    '',
    ...(opts.agentSearch ? agentSearchLines(base) : []),
    // 결제 링크는 검색 결과의 id 를 쓰므로 검색 창구가 함께 켜져 있을 때만 싣는다.
    ...(opts.agentSearch && opts.agentCheckout ? agentCheckoutLines(base) : []),
    '## 주요 페이지',
    '',
    ...service.map(linkLine),
    '',
    '## 자주 묻는 질문',
    '',
  ]
  // 🔀 서비스 설명을 **먼저** 놓는다 — 내용은 한 벌이고 순서만 다르다.
  //   화면(`/faq`)은 기존 10건(주문·배송·환불·회원)이 앞이고 컨셉 설명이 뒤인데, 그 순서를 그대로
  //   쓰면 AI 가 *"유어딜이 뭐야"* 로 와서 처음 읽는 문장이 **"주문을 취소하고 싶어요"** 가 된다
  //   (첫 판이 실제로 그랬다). `'서비스'` 카테고리가 정확히 그 컨셉 묶음이라 그것으로 가른다.
  const faqOrdered = [
    ...CONCEPT_FAQ.filter((f) => f.category === '서비스'),
    ...CONCEPT_FAQ.filter((f) => f.category !== '서비스'),
  ]
  for (const f of faqOrdered) {
    out.push(`### ${f.question}`, '', oneLine(f.answer), '')
  }
  if (policy.length > 0) {
    out.push('## 약관·정책', '', ...policy.map(linkLine), '')
  }
  return out.join('\n')
}
