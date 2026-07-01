/**
 * 📝 2026-07-01: 블로그 AI 자동 초안 (홍보/마케팅 전용).
 *
 * 대표 지시: "AI 자동 초안은 지금 시점까지의 내용 바탕으로, 비즈니스(서비스 홍보) 차원에서만.
 *   운영 정보는 나가면 안 됨."
 *
 * 설계 원칙:
 *   1) 소비자 홍보/마케팅 콘텐츠만 생성 — 이용권/교환권/동네딜/링크샵 혜택·활용법.
 *   2) 운영/내부 정보 유출 금지 — 수수료율·정산·원천징수·커미션·관리자·매출·도매(B2B) 등
 *      은 컨텍스트(brief)에 아예 넣지 않고, 출력 검증에서 나타나면 거부.
 *   3) 명칭 SSOT 준수(유저/사업자 유저/이용권/교환권/동네딜/링크샵) + 폐기 용어 금지
 *      (식사권/공구권/인플루언서/큐레이터/라이브커머스/쇼츠).
 *   4) 항상 초안(비공개)으로만 생성 → 관리자 검토 후 발행.
 *
 * ANTHROPIC_API_KEY 미설정 시 NOT_CONFIGURED.
 */

// 소비자 홍보용 서비스 사실 brief (grounding). ⚠️ 운영/내부 수치(수수료·정산·원천징수 등)는
//   의도적으로 제외 — 모델이 근거로 삼을 수 없게 해서 유출 자체를 차단한다.
const PROMO_BRIEF = [
  '너는 소비자 혜택 플랫폼 "유어딜"의 블로그 마케터다. 아래 사실만 근거로 소비자 대상 홍보/활용 글을 쓴다.',
  '',
  '## 유어딜 서비스 사실(이것만 사용)',
  '- 유어딜은 이용권·교환권·동네딜을 한곳에서 만나는 소비자 혜택 플랫폼이다.',
  '- 이용권: 온라인에서 할인가로 즉시 구매 → 매장에서 QR/PIN 으로 바로 사용. 카테고리는 식사·미용·숙소·기타. (공동구매가 아니라 즉시 구매)',
  '- 교환권: 카페 쿠폰·상품권 같은 익숙한 기프티콘. 선물용으로 특히 좋다. (이용권과는 별개)',
  '- 동네딜: 내 위치 기준 주변 지역의 딜을 모아 보여준다(하이퍼로컬).',
  '- 링크샵: 가입한 유저 누구나 자동으로 갖는 "나만의 쇼핑몰" 주소(도메인/u/{핸들}). 마음에 드는 혜택을 핀으로 추천해 링크 하나로 공유한다.',
  '- 딜 포인트: 미리 충전해 두면 결제가 빠르다. 마음에 드는 유저를 후원할 수도 있다.',
  '- 결제는 토스페이먼츠로 안전하게 처리된다.',
  '- 회원은 "유저"라 부르고, 사업자등록·판매 승인을 받으면 "사업자 유저"가 되어 링크샵에서 자기 상품을 판다.',
  '',
  '## 톤 & 형식',
  '- 따뜻하고 실용적인 한국어. 소비자가 "오늘 써보고 싶다"는 마음이 들게.',
  '- 마크다운(## / ### 헤딩, - 리스트, **굵게**). 코드블록/백틱 쓰지 말 것.',
  '- 400~800자 분량, 구체적인 활용 상황·팁 위주.',
  '',
  '## 절대 금지(위반 시 글 폐기)',
  '- 운영/내부 정보: 수수료율·정산·원천징수·커미션·세금·매출·관리자/백오피스·정책 수치.',
  '- 도매몰/B2B(유통스타트·판매사·제조사·공급가·도매) — 이건 완전 별개 서비스다.',
  '- 폐기/중단: "식사권"·"공구권"(→이용권), "인플루언서"·"크리에이터"·"큐레이터"(사람 지칭 금지, "유저"/"사업자 유저" 사용), "라이브커머스"·"라이브 방송"·"쇼츠"(영구중단이라 언급 금지).',
  '- brief 에 없는 수치/사실을 지어내지 말 것.',
].join('\n')

// 홍보 주제 백로그 (활용/상황/계절 앵글). slug 는 중복 방지 키.
export interface PromoTopic { slug: string; title: string; angle: string; tags: string[] }
export const PROMO_TOPICS: readonly PromoTopic[] = [
  { slug: 'date-course-vouchers', title: '알뜰한 데이트 코스, 이용권으로 완성하기', angle: '커플이 식사·카페·액티비티 이용권을 조합해 데이트를 알뜰하게 즐기는 코스 제안', tags: ['이용권', '데이트', '활용팁'] },
  { slug: 'office-lunch-savings', title: '직장인 점심값 아끼기 — 식사 이용권 200% 활용법', angle: '회사 근처 식사 이용권과 동네딜로 매일 점심값을 아끼는 실전 팁', tags: ['이용권', '직장인', '동네딜'] },
  { slug: 'weekend-getaway-stay', title: '주말 여행, 숙소 이용권으로 더 가볍게', angle: '주말 근교 여행에서 숙소 이용권을 똑똑하게 고르고 쓰는 법', tags: ['이용권', '여행', '숙소'] },
  { slug: 'beauty-selfcare-day', title: '나를 위한 뷰티 데이, 미용 이용권 추천', angle: '헤어·네일·피부관리 미용 이용권으로 셀프 케어 하는 법', tags: ['이용권', '뷰티', '셀프케어'] },
  { slug: 'gift-with-exchange-voucher', title: '센스 있는 선물, 교환권으로 마음 전하기', angle: '기념일·감사 인사에 교환권(기프티콘)을 선물로 활용하는 아이디어', tags: ['교환권', '선물', '기프티콘'] },
  { slug: 'discover-neighborhood-deals', title: '우리 동네 숨은 혜택, 동네딜로 발견하기', angle: '동네딜로 생활 반경 안의 좋은 매장·혜택을 찾는 방법', tags: ['동네딜', '로컬', '발견'] },
  { slug: 'linkshop-share-your-taste', title: '내 취향을 링크 하나로, 링크샵 자랑하기', angle: '링크샵에 좋아하는 혜택을 핀으로 모아 친구와 공유하는 재미', tags: ['링크샵', '공유', '취향'] },
  { slug: 'family-outing-savings', title: '가족 나들이, 이용권으로 알뜰하게 즐기기', angle: '주말 가족 외식·체험을 이용권과 동네딜로 알뜰하게 계획', tags: ['이용권', '가족', '나들이'] },
  { slug: 'first-time-yourdeal', title: '유어딜 처음이라면? 5분이면 끝나는 첫 사용 가이드', angle: '신규 유저가 이용권·교환권·동네딜을 처음 써보는 아주 쉬운 안내', tags: ['가이드', '입문', '유어딜'] },
  { slug: 'rainy-day-indoor', title: '비 오는 날 실내 데이트, 이렇게 즐기세요', angle: '비 오는 날 카페·실내 액티비티 이용권으로 알찬 하루 보내기', tags: ['이용권', '실내', '데이트'] },
  { slug: 'solo-treat-yourself', title: '혼자여도 충분히 즐거운, 나만의 이용권 코스', angle: '혼밥·혼카페·혼놀이를 이용권으로 근사하게 즐기는 법', tags: ['이용권', '혼자', '라이프'] },
  { slug: 'season-recommend', title: '이번 계절에 딱 맞는 이용권·동네딜 고르기', angle: '계절 감성에 맞춘 식사·나들이·뷰티 혜택 큐레이션', tags: ['이용권', '동네딜', '시즌'] },
] as const

// 출력 검증: 운영/내부 정보 유출 + 폐기 용어 + 도매몰 유입을 거부.
const OUTPUT_FORBIDDEN: RegExp[] = [
  /수수료/, /정산/, /원천징수/, /커미션/, /세금계산서/, /매출/, /백오피스/, /관리자/,
  /도매/, /유통스타트/, /판매사/, /제조사/, /공급가/, /\bB2B\b/,
  /식사권/, /공구권/, /인플루언서/, /크리에이터/, /큐레이터/, /셀러/,
  /라이브\s?커머스/, /라이브\s?방송/, /쇼츠/,
]

function findForbidden(text: string): string | null {
  for (const re of OUTPUT_FORBIDDEN) {
    if (re.test(text)) return re.source
  }
  return null
}

export interface GeneratedDraft { title: string; summary: string; tags: string[]; content: string }

/** JSON 응답에서 코드펜스 제거 후 파싱. */
function parseDraftJson(raw: string): GeneratedDraft | null {
  let s = raw.trim()
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fence) s = fence[1].trim()
  // 첫 { ~ 마지막 } 만 추출(모델이 앞뒤에 말 붙였을 때 대비)
  const first = s.indexOf('{'); const last = s.lastIndexOf('}')
  if (first >= 0 && last > first) s = s.slice(first, last + 1)
  try {
    const o = JSON.parse(s) as Record<string, unknown>
    const title = String(o.title || '').trim()
    const summary = String(o.summary || '').trim()
    const content = String(o.content || '').trim()
    const tags = Array.isArray(o.tags) ? o.tags.map((t) => String(t).trim()).filter(Boolean).slice(0, 5) : []
    if (!title || !content) return null
    return { title, summary, tags, content }
  } catch {
    return null
  }
}

async function callClaude(apiKey: string, topic: PromoTopic, existingTitles: string[], strict: boolean): Promise<string | null> {
  const userMsg = [
    `아래 주제로 유어딜 소비자 홍보 블로그 글 1편을 써줘.`,
    `- 주제: ${topic.title}`,
    `- 앵글: ${topic.angle}`,
    `- 추천 태그(참고): ${topic.tags.join(', ')}`,
    existingTitles.length ? `- 이미 있는 글 제목(겹치지 않게): ${existingTitles.slice(0, 40).join(' / ')}` : '',
    strict ? '- 주의: 앞선 시도가 금지어(운영/내부 정보·폐기 용어)를 포함해 폐기됐다. 절대 금지 규칙을 엄격히 지켜라.' : '',
    '',
    '반드시 아래 JSON 형식으로만 응답(다른 말 X):',
    '{"title": "제목", "summary": "SEO 요약 한 문장(100~160자)", "tags": ["태그1","태그2","태그3"], "content": "## 마크다운 본문..."}',
  ].filter(Boolean).join('\n')

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2000,
      system: PROMO_BRIEF,
      messages: [{ role: 'user', content: userMsg }],
    }),
  }).catch(() => null)
  if (!res || !res.ok) return null
  const data = (await res.json().catch(() => null)) as { content?: Array<{ text?: string }> } | null
  const text = (data?.content || []).map((b) => b.text || '').join('').trim()
  return text || null
}

/**
 * 홍보 초안 1편 생성. 성공 시 {ok:true, draft}. 운영정보 유출/폐기어 감지 시 거부(ok:false).
 * 최대 1회 재시도(엄격 프롬프트).
 */
export async function generateBlogDraft(
  apiKey: string | undefined,
  topic: PromoTopic,
  existingTitles: string[] = [],
): Promise<{ ok: true; draft: GeneratedDraft } | { ok: false; error: string }> {
  if (!apiKey) return { ok: false, error: 'NOT_CONFIGURED' }

  for (let attempt = 0; attempt < 2; attempt++) {
    const raw = await callClaude(apiKey, topic, existingTitles, attempt > 0)
    if (!raw) { if (attempt > 0) return { ok: false, error: 'AI 호출 실패' }; continue }
    const draft = parseDraftJson(raw)
    if (!draft) { if (attempt > 0) return { ok: false, error: 'AI 응답 파싱 실패' }; continue }
    // 운영정보/폐기어 검증 — 제목·요약·본문·태그 전체
    const hay = `${draft.title}\n${draft.summary}\n${draft.content}\n${draft.tags.join(' ')}`
    const bad = findForbidden(hay)
    if (bad) { if (attempt > 0) return { ok: false, error: `금지어 감지(${bad}) — 홍보 외 정보 유출 방지로 폐기` }; continue }
    if (draft.content.length < 250) { if (attempt > 0) return { ok: false, error: '본문이 너무 짧음' }; continue }
    return { ok: true, draft }
  }
  return { ok: false, error: 'AI 초안 생성 실패' }
}
