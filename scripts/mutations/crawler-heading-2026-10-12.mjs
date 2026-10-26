/**
 * 🏷️#️⃣ 크롤러 문서의 제목(`<h1>`) — 2026-10-12
 *
 * 색인 대상 23표면 중 17개가 heading 0 이었다(라이브 실측). 가드:
 * `src/tests/unit/crawler-heading-2026-10-12.test.ts` · 재조준: `list-surface-noscript-2026-10-12`.
 */
const SRC = 'src/worker/utils/crawler-noscript.ts'
const T = 'src/tests/unit/crawler-heading-2026-10-12.test.ts'
const L = 'src/tests/unit/list-surface-noscript-2026-10-12.test.ts'

export default [
  {
    name: '🏷️#️⃣ 목록 네 표면의 제목이 다시 `<p>` 로',
    why: '종전 상태로의 회귀 — 글자는 같아 본문 글자수가 안 변하고, 화면도 안 깨진다(heading 신호만 조용히 사라진다)',
    file: SRC,
    find: "    const head = h1Of(CONSUMER_SURFACE_SEO[path]?.crumb)",
    replace: "    const head = `<p>${esc(CONSUMER_SURFACE_SEO[path]?.crumb || '')}</p>`",
    test: T,
  },
  {
    name: '🏷️#️⃣ /faq 가 제목을 안 낸다',
    why: 'AI 검색이 가장 많이 인용하는 표면인데 Q&A 만 남아 "이 페이지가 무엇인가" 를 말하는 요소가 없다',
    file: SRC,
    find: "    return items ? `<noscript>${h1Of(CONSUMER_SURFACE_SEO[path]?.crumb)}<dl>${items}</dl></noscript>` : ''",
    replace: "    return items ? `<noscript><dl>${items}</dl></noscript>` : ''",
    test: T,
  },
  {
    name: '🏷️#️⃣ /about 이 제목을 안 낸다',
    why: '브랜드 설명 표면이 문단만 남는다',
    file: SRC,
    find: "    return lines ? `<noscript>${h1Of(CONSUMER_SURFACE_SEO[path]?.crumb)}${lines}</noscript>` : ''",
    replace: "    return lines ? `<noscript>${lines}</noscript>` : ''",
    test: T,
  },
  {
    name: '🏷️#️⃣ 약관 제목에 시행일·판 번호가 섞여 들어간다',
    why: '제목이 "유어딜 이용약관 (시행 … · v1.0)" 이 되면 heading 이 문서 식별이 아니라 메타 덩어리가 된다',
    file: SRC,
    find: "    return `<noscript>${h1Of(terms.title)}<p>시행 ${esc(terms.effective)} · v${esc(terms.version)}</p><ul>`",
    replace: "    return `<noscript>${h1Of(`${terms.title} (시행 ${terms.effective} · v${terms.version})`)}<ul>`",
    test: T,
  },
  {
    name: '🏷️#️⃣ 시드 없는 정적 표면 열 곳이 제목을 안 낸다',
    why: '`/partners`·`/creators`·`/experience`… 가 문단만 남는다(sitemap 제출 URL 전부)',
    file: SRC,
    // 2026-10-25: 사이에 생활 허브 FAQ(`faqDl`)가 끼었다 — 불변식(제목을 낸다) 그대로, 앵커만 재조준.
    find: "    return lines || kids ? `<noscript>${h1}${lines}${faqDl}${kids}</noscript>` : ''",
    replace: "    return lines || kids ? `<noscript>${lines}${faqDl}${kids}</noscript>` : ''",
    test: T,
  },
  {
    name: '🏷️#️⃣ 지역 페이지 44곳이 제목을 안 낸다',
    why: '"동네 맛집 할인권" 질의의 착지점인데 제목이 사라진다',
    file: SRC,
    // 🔁 2026-10-14 재조준: 사진 상한(`capRowImages`)이 끼며 모양이 바뀌었다(불변식 그대로).
    find: "    return `<noscript>${h1Of(`${label} 이용권`)}<ul>${capRowImages(rows).map(liOf).join('')}</ul>`",
    replace: "    return `<noscript><p>${esc(label)} 이용권</p><ul>${rows.map(liOf).join('')}</ul>`",
    test: T,
  },
  {
    name: '🏷️#️⃣ 쇼핑 상세 제목이 그냥 문단으로 돌아간다',
    why: '상품명이 `<p>` 가 되어 그 화면의 h1 과 요소가 갈린다',
    file: SRC,
    // 🔁 2026-10-14 재조준: 상세에 사진(`imgTag`)이 끼며 모양이 바뀌었다(불변식 그대로).
    find: "      return wrap(h1Of(d.name) + imgTag + lines([",
    replace: "      return wrap(lines([\n        esc(String(d.name || '').trim()),",
    test: T,
  },
  {
    name: '🏷️#️⃣ 지역 허브 제목을 손으로 적는다',
    why: '빵부스러기가 쓰는 상수와 두 벌이 된다 — 한쪽을 고치면 같은 문서 안에서 허브 이름이 갈린다(에러 0)',
    file: SRC,
    find: "    const h1 = h1Of(path === '/region' ? REGION_HUB_CRUMB : CONSUMER_SURFACE_SEO[path]?.crumb)",
    replace: "    const h1 = h1Of(path === '/region' ? '지역별' : CONSUMER_SURFACE_SEO[path]?.crumb)",
    test: T,
  },
  {
    name: '🏷️#️⃣ 빈 라벨에도 제목 태그를 만든다',
    why: '`<h1></h1>` 빈 제목은 없는 것보다 나쁘고, crumb 를 일부러 비워 둔 noindex 표면에 제목 신호를 준다',
    file: SRC,
    find: "  return t ? `<h1>${esc(t)}</h1>` : ''",
    replace: "  return `<h1>${esc(t)}</h1>`",
    test: T,
  },
  {
    name: '🏷️#️⃣ 제목에 HTML 탈출을 빼먹는다',
    why: '상품명은 사용자 데이터다 — 탈출을 빼면 시드 값이 마크업으로 샌다',
    file: SRC,
    find: "  return t ? `<h1>${esc(t)}</h1>` : ''",
    replace: "  return t ? `<h1>${t}</h1>` : ''",
    test: T,
  },
  {
    // 재조준한 기존 가드(`L`)가 **여전히** 빨간불을 내는지 따로 확인한다 — 러너는 주입 하나당
    // 시험 하나만 돌리므로, 한 주입에 시험 둘을 적어 둘 수 없다(`test` 는 문자열이다).
    name: '🏷️#️⃣ 목록 표면 제목을 손으로 적는다(재조준 가드 확인)',
    why: 'crumb SSOT 와 두 벌이 되면 빵부스러기의 마지막 단계와 본문 제목이 같은 문서 안에서 갈린다',
    file: SRC,
    find: "    const head = h1Of(CONSUMER_SURFACE_SEO[path]?.crumb)",
    replace: "    const head = h1Of('이용권 모아보기')",
    test: L,
  },
  {
    name: '🏷️#️⃣ 🔴 반대 방향 — 첫 화면이 있는 상세 요약에도 제목을 넣는다',
    why: '같은 `#root` 안에 첫 화면의 h1 이 이미 있어 **한 문서에 h1 이 둘**이 된다(규율 ② 위반)',
    file: SRC,
    find: "export function buildDetailNoscript(d: NoscriptDetailSeed | null | undefined): string {",
    replace: "export function buildDetailNoscript(d: NoscriptDetailSeed | null | undefined): string {\n  if (d?.name) return wrap(h1Of(d.name) + lines([d.restaurant_address ? esc(d.restaurant_address) : '']))",
    test: T,
  },
]
