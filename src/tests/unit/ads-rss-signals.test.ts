/**
 * 🎁 이미 받은 RSS 에서 **더 뽑는** 신호 — 2026-07-29 대표 4축(수집·카테고리화·필터링·정보 최대 수집).
 *
 * 이 레인은 블로그당 RSS 를 최대 120KB 받아 놓고 제목·날짜만 쓰고 버렸다. 서브리퀘스트가 이 파이프라인의
 * 천장(무료 50/인보케이션)이라, **이미 산 데이터를 더 쓰는 것**이 처리량을 안 건드리고 품질을 올리는 길이다.
 *
 * ⚠️ 이 유닛이 **못 보는 것**: 네이버 RSS 응답의 실제 모양. 작성 환경의 프록시가
 *    `rss.blog.naver.com` 을 CONNECT 403 으로 막아 실물을 한 번도 못 봤다. 여기 픽스처는 RSS 2.0 스펙
 *    형태를 가정한 것이고, "필드가 실제로 오는가"의 판정 근거는 **라이브 diag 카운터**(`rss_cat`/`rss_intro`)다.
 *    계속 0 이면 추측으로 파서를 더 손대지 말고 이 경로를 접을 것.
 */
import { describe, it, expect } from 'vitest'
import {
  stripXmlText, stripVideoTitles, extractRssChannelDescription, extractRssCategories,
  extractRssItemText, buildNaverDescription, deriveNaverRssSignals,
} from '@/features/marketing/api/influencer-parse'
import { classifyCategory, classifyCategoryByHits } from '@/features/marketing/api/influencer-classify'

const RSS = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
  <title>수민의 홈카페</title>
  <link>https://blog.naver.com/sumin</link>
  <description><![CDATA[ 매일 홈카페 기록합니다. 협찬 문의 sumin.cafe@naver.com / 인스타 @sumin_cafe ]]></description>
  <item>
    <title><![CDATA[성수동 카페 3곳 다녀왔어요]]></title>
    <category><![CDATA[카페투어]]></category>
    <pubDate>Mon, 28 Jul 2026 09:00:00 +0900</pubDate>
    <description><![CDATA[<p>오늘은 <b>성수동 카페</b> 투어. 디저트가 좋았고 커피도 훌륭.</p>
      <p>문의는 업체 담당자 partner@somecompany.co.kr 로 하라고 안내받았어요.</p>]]></description>
  </item>
  <item>
    <title>홈카페 라떼아트 연습</title>
    <category>홈카페</category>
    <category>카페투어</category>
    <pubDate>Sun, 27 Jul 2026 09:00:00 +0900</pubDate>
    <description>커피 원두 추천과 카페 도구 이야기. 디저트 베이킹도 조금.</description>
  </item>
</channel></rss>`

describe('stripXmlText', () => {
  it('태그를 떼고 엔티티를 푼다', () => {
    expect(stripXmlText('<p>안녕 <b>하세요</b></p>')).toBe('안녕 하세요')
    expect(stripXmlText('a &amp; b &quot;c&quot;')).toBe('a & b "c"')
  })
  it('&amp; 를 마지막에 풀어 이중 해제를 막는다 — 순서를 바꾸면 이 케이스가 깨진다', () => {
    // `&amp;lt;` 는 "리터럴 &lt;" 를 뜻한다. &amp; 를 먼저 풀면 `&lt;` → `<` 로 잘못 해제된다.
    expect(stripXmlText('&amp;lt;')).toBe('&lt;')
  })
  it('script/style 안쪽은 통째로 버린다(마크업 잡음이 분류 신호를 오염시킨다)', () => {
    expect(stripXmlText('<style>.a{color:red}</style>본문<script>var x=1</script>')).toBe('본문')
  })
  it('빈 입력·null 류에 throw 하지 않는다', () => {
    expect(stripXmlText('')).toBe('')
    expect(stripXmlText(undefined as unknown as string)).toBe('')
  })
})

describe('extractRssChannelDescription — 본인이 쓴 소개글만', () => {
  it('채널 레벨 description 을 뽑는다', () => {
    expect(extractRssChannelDescription(RSS)).toContain('매일 홈카페 기록합니다')
  })
  it('🚫 글 본문 description 은 절대 섞이지 않는다 — 남의 연락처가 딸려온다', () => {
    const intro = extractRssChannelDescription(RSS)
    expect(intro).toContain('sumin.cafe@naver.com')       // 본인 것: OK
    expect(intro).not.toContain('partner@somecompany.co.kr') // 남의 것: 절대 아님
  })
  it('채널 description 이 없으면 빈 문자열(있으면 쓰고 없으면 조용히)', () => {
    expect(extractRssChannelDescription('<rss><channel><item><description>본문</description></item></channel></rss>')).toBe('')
  })
})

describe('extractRssCategories — 블로거 자기분류', () => {
  it('CDATA·평문 둘 다, 중복 제거', () => {
    expect(extractRssCategories(RSS)).toEqual(['카페투어', '홈카페'])
  })
  it('없으면 빈 배열', () => {
    expect(extractRssCategories('<rss><channel><item><title>x</title></item></channel></rss>')).toEqual([])
  })
})

describe('extractRssItemText — 분류 전용 본문', () => {
  it('본문을 평문으로 모은다', () => {
    const body = extractRssItemText(RSS)
    expect(body).toContain('성수동 카페')
    expect(body).toContain('원두 추천')
    expect(body).not.toContain('<p>')
  })
  it('maxItems 를 넘지 않는다', () => {
    const many = `<rss><channel>${Array.from({ length: 20 }, (_, i) => `<item><description>본문${i}</description></item>`).join('')}</channel></rss>`
    const body = extractRssItemText(many, 3)
    expect(body).toContain('본문0')
    expect(body).not.toContain('본문5')
  })
})

describe('buildNaverDescription ↔ stripVideoTitles 짝 — 누적 방지', () => {
  it('반복 적용해도 꼬리가 쌓이지 않는다', () => {
    let d = buildNaverDescription('원래 소개글', '소개텍스트', ['카페투어'], ['글제목1'])
    for (let i = 0; i < 5; i++) d = buildNaverDescription(d, '소개텍스트', ['카페투어'], ['글제목1'])
    expect(d.match(/소개:/g)?.length).toBe(1)
    expect(d.match(/분류:/g)?.length).toBe(1)
    expect(d.match(/글:/g)?.length).toBe(1)
    expect(d.startsWith('원래 소개글')).toBe(true)
    expect(d.length).toBeLessThanOrEqual(500)
  })
  it('제목이 없어도 누적되지 않는다 — 여기가 진짜 실패 경로다', () => {
    // ⚠️ 위 케이스는 `글:` 이 항상 맨 앞 꼬리라 그 마커 하나만으로도 통째로 잘려 누적이 안 보인다.
    //    RSS 에 제목이 없고 소개/분류만 오는 블로그에서만 드러난다 — 마커 목록이 짝을 이뤄야 하는 이유.
    let d = buildNaverDescription('원래 소개글', '소개텍스트', ['카페투어'], [])
    for (let i = 0; i < 5; i++) d = buildNaverDescription(d, '소개텍스트', ['카페투어'], [])
    expect(d.match(/소개:/g)?.length).toBe(1)
    expect(d.match(/분류:/g)?.length).toBe(1)
  })
  it('stripVideoTitles 가 새 마커(소개/분류)도 떼어낸다 — 안 떼면 위 누적이 생긴다', () => {
    expect(stripVideoTitles('본문 | 소개: 어쩌고')).toBe('본문')
    expect(stripVideoTitles('본문 | 분류: 카페')).toBe('본문')
    expect(stripVideoTitles('본문 | 영상: 제목')).toBe('본문')  // 기존 마커 회귀 방지
  })
  it('신호가 하나도 없으면 빈 문자열 — 호출부가 description 을 안 건드린다', () => {
    expect(buildNaverDescription('원래', '', [], [])).toBe('')
  })
})

describe('deriveNaverRssSignals', () => {
  it('한 응답에서 제목·자기분류·소개글·본문을 모두 낸다(추가 fetch 0)', () => {
    const s = deriveNaverRssSignals(RSS, '이전 소개')
    expect(s.titles.length).toBeGreaterThan(0)
    expect(s.cats).toContain('홈카페')
    expect(s.intro).toContain('홈카페')
    expect(s.body).toContain('성수동')
    expect(s.description).toContain('분류:')
  })
  it('빈 XML 에도 throw 없이 빈 신호', () => {
    const s = deriveNaverRssSignals('', '이전')
    expect(s).toEqual({ description: '', intro: '', body: '', cats: [], titles: [] })
  })
})

describe('classifyCategoryByHits — 본문 전용 빈도 분류', () => {
  const filler = '오늘 하루 기록입니다. '.repeat(20) // 길이 조건(≥80) 충족용

  it('스치는 1회 언급으로는 분류하지 않는다 — 첫-매치 함수와의 핵심 차이', () => {
    // 여행 글에 "카페" 가 한 번 나온다고 카페 블로거가 되면 안 된다.
    const text = `${filler} 제주 여행 3박4일. 중간에 카페 하나 들렀다. 여행 코스는 다음과 같다. 여행 좋다.`
    expect(classifyCategoryByHits(text)).not.toBe('카페')
    // ⚠️ 대조군: 같은 텍스트를 첫-매치 함수에 넣으면 규칙 순서상 카페가 먼저 걸린다(그래서 본문엔 못 쓴다).
    expect(classifyCategory('', text)).toBe('카페')
  })
  it('반복되면 가장 많이 걸린 카테고리를 고른다', () => {
    const text = `${filler} 홈카페 원두 이야기. 디저트 베이킹. 커피 추출. 카페 도구 리뷰. 베이커리 방문.`
    expect(classifyCategoryByHits(text)).toBe('카페')
  })
  it('짧은 텍스트는 아예 판정하지 않는다(빈도 신호가 의미 없다)', () => {
    expect(classifyCategoryByHits('카페 카페 카페')).toBeNull()
  })
  it('신호가 없으면 null — 호출부가 기존 값을 유지한다', () => {
    expect(classifyCategoryByHits(`${filler} 특별할 것 없는 하루였다.`)).toBeNull()
  })
  it('병적 입력(초장문 반복)에도 끝난다 — 무한루프/지수백트래킹 방어', () => {
    const started = Date.now()
    expect(() => classifyCategoryByHits('카페 '.repeat(50_000))).not.toThrow()
    expect(Date.now() - started).toBeLessThan(5_000)
  })
})

describe('🚧 규약 — 본문에서 연락처를 뽑지 않는다(소스 불변식)', () => {
  it('enrichNaverActivity 의 연락처 보강은 rssIntro 만 본다', async () => {
    const fs = await import('node:fs')
    const src = fs.readFileSync('src/features/marketing/api/influencer-performance.ts', 'utf8')
    // 본문 변수(rssBody)가 연락처 추출기에 들어가면 남의 연락처가 DB 에 박힌다 — 되돌리기 어려운 오염.
    expect(src).not.toMatch(/(?:pickBusinessEmail|extractContacts)\s*\(\s*rssBody/)
    expect(src).toMatch(/pickBusinessEmail\(rssIntro\)/)
  })
})
