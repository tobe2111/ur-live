/**
 * 🎯 "다녀온 사람들" 블로그 정확도 〔2026-11-09 대표 *"연관 없는 블로그도 있네. 정확성이 많이 떨어져?"*〕
 *
 * 실측(라이브 자동 공개 블로그 2,009개): 제목에 가게 이름이 없는 글이 24%, 그 대부분이 남의 이야기였다
 * (동네 맛집 총정리 · 아파트 순위 · 가구 납품기). 이름이 업종 그 자체인 데모 가게("입주청소" 등 11곳)의 글 382개는
 * 전부 그 업종의 아무 글이었다.
 *
 * 지키는 것
 *   ① 자동 공개는 `blogAutoShow` 하나 — 제목이 가게를 불러야 한다(잘린 제목·띄어 쓴 이름 포함)
 *   ② 업체 글 · 모음 글 · 업종 이름 가게는 자동 공개하지 않는다(후보로 남는다)
 *   ③ 수집 · 쌓인 글 재판정 · 손님 응답이 **같은 판정**을 쓴다
 *   ④ 사람이 '보이기' 로 고른 자동 글은 사람 것이 된다(재판정이 다시 내리지 않는다)
 * 못 보는 것: 제목에 이름이 있어도 내용이 딴 얘기인 글 · 업체 블로그 이름이 목록 밖 낱말인 경우.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { blogAutoShow, titleNamesStore, isListPost, isVendorAuthor, isGenericStoreName, videoMatch } from '@/shared/creator-content'
import { pickBlogCandidates, blogSecondQuery } from '@/features/creator-content/api/content-collect'

const read = (p: string) => readFileSync(p, 'utf8')

describe('① 제목이 가게를 부른다', () => {
  it('그대로 · 띄어 쓴 이름 · 잘린 제목', () => {
    expect(titleNamesStore('잠실 꾸꾸데쎄르 소금빵 후기', '꾸꾸데쎄르 (연산점)')).toBe(true)
    expect(titleNamesStore('합정 홍대 스시 맛집 스시사카바, 다시 찾은 합초밥 후기', '스시사카바 합정')).toBe(true)
    expect(titleNamesStore("[이태원 맛집] 디저트가 예술인 '타르틴베....", '타르틴베이커리 이태원점')).toBe(true)
  })
  it('이름이 요약에만 있으면 아니다 · 잘린 끝이 두 글자 이하면 아니다', () => {
    expect(titleNamesStore('잠실 석촌호수 데이트 코스', '이소한우전문')).toBe(false)
    expect(titleNamesStore('세라믹 테이블 제작! 문크림·세인트블랙 3종 | 광화문 민....', '민소한우 정상 광화문점')).toBe(false)
  })
})

describe('② 남의 이야기는 자동 공개하지 않는다', () => {
  it('모음 글', () => {
    for (const t of ['서울 근교 온수풀 글램핑 BEST 5', '대구 아파트 TOP10', '서초구 에어컨청소 업체 6곳 비교', '잠실 맛집 총정리', '전주 한옥마을 필수 쇼핑리스트'])
      expect(isListPost(t)).toBe(true)
    expect(isListPost('꾸꾸데쎄르 소금빵 솔직 후기')).toBe(false)
  })
  it('업체 글', () => {
    expect(isVendorAuthor('업소용가구전문,대건산업')).toBe(true)
    expect(isVendorAuthor('정직한보일러')).toBe(true)
    expect(isVendorAuthor('빵순이의 일상')).toBe(false)
    // 2026-11-09 밤 라이브 실측 — 한우집 칸에 남아 있던 업체 글
    for (const a of ['피스월드 스마트 언더렌지™ (인덕션 전문기업)', '대한민국 대표 프랜차이즈 기업', '현대파출 식당전문', '행사용품렌탈전문'])
      expect(isVendorAuthor(a)).toBe(true)
    expect(isVendorAuthor('1인가구 직장인 서울 살이')).toBe(false)
  })
  it('업종 이름 가게 — 동네 한 단어를 떼면 업종만 남는다', () => {
    for (const n of ['입주청소', '서초에어컨청소', '홍대돈까스', '송파한우정육식당', '쌀국수집', '분당셀프사진관'])
      expect(isGenericStoreName(n)).toBe(true)
    // 상표가 붙으면 업종 이름이 아니다
    for (const n of ['포비쌀국수', '입주청소 슈어클린', '꾸꾸데쎄르', '민소한우 정상 광화문점', '네이처클린 입주청소 용인점'])
      expect(isGenericStoreName(n)).toBe(false)
  })
  it('실측 사례 — 한우집에 뜬 가구 납품기는 빠지고 진짜 후기는 남는다', () => {
    const addr = '서울 종로구 종로 34'
    expect(blogAutoShow({ title: '세라믹 테이블 제작! 문크림·세인트블랙·다크애쉬 3종 | 광화문 민....', summary: '서울 종로구 종로 34 (민소한우 정상 광화문점) 이번 광화문 민소한우 현장에 납품한 테이블', author: '업소용가구전문,대건산업' }, '민소한우 정상 광화문점', addr)).toBe(false)
    expect(blogAutoShow({ title: '광화문 민소한우 정상 광화문점 점심 한우 런치 후기', summary: '종로구 광화문 회식', author: '베어쀼의 리뷰' }, '민소한우 정상 광화문점', addr)).toBe(true)
  })
})

describe('②-b 판정 하나(blogAutoShow)가 위 규칙을 실제로 쓴다', () => {
  const addr = '부산 연제구 연산동 1'
  it('이름이 요약에만 있는 글은 이름·동네가 다 맞아도 자동 공개 안 함', () => {
    expect(blogAutoShow({ title: '연산동 빵집 나들이', summary: '연산동 꾸꾸데쎄르 소금빵', author: '빵순이' }, '꾸꾸데쎄르', addr)).toBe(false)
    expect(blogAutoShow({ title: '연산동 꾸꾸데쎄르 나들이', summary: '소금빵', author: '빵순이' }, '꾸꾸데쎄르', addr)).toBe(true)
  })
  it('업종 이름 가게는 완벽한 글이어도 자동 공개 안 함', () => {
    expect(blogAutoShow({ title: '연산동 입주청소 후기', summary: '연산동', author: '살림꾼' }, '입주청소', addr)).toBe(false)
  })
})

describe('③ 세 곳이 같은 판정을 쓴다', () => {
  it('수집 — pickBlogCandidates 의 confident 가 blogAutoShow 다', () => {
    const r = pickBlogCandidates([
      { title: '잠실 맛집 총정리 — 꾸꾸데쎄르 외 9곳', link: 'https://blog.naver.com/a_b/223456789012', description: '연산동 꾸꾸데쎄르', bloggername: '맛집러', postdate: '20261021' },
      { title: '연산동 꾸꾸데쎄르 소금빵 후기', link: 'https://blog.naver.com/c_d/223456789013', description: '연산동', bloggername: '빵순이', postdate: '20261021' },
    ], '꾸꾸데쎄르', '부산 연제구 연산동 1')
    expect(r.map((x) => x.confident)).toEqual([false, true])
  })
  it('쌓인 글 재판정 · 손님 응답도 blogAutoShow', () => {
    const collect = read('src/features/creator-content/api/content-collect.ts')
    expect(collect).toMatch(/confident: blogAutoShow\(/)
    expect(collect).toMatch(/const ok = blogAutoShow\(\{ title: r\.title, summary: r\.summary, author: r\.author_name \}, r\.store_name, r\.address\)/)
    expect(collect).toMatch(/const rejudged = await rejudgeAutoBlogs\(DB\)/)
    // 내리기만 한다(지우지 않는다) · 자동 글만
    expect(collect).toMatch(/SET status = 'candidate'[^`]*WHERE id = \? AND status = 'visible' AND source = 'auto'/)
    const routes = read('src/features/creator-content/api/content.routes.ts')
    expect(routes).toMatch(/r\.platform === 'naver_blog' && !blogAutoShow\(/)
  })
})

describe('④ 사람이 고른 글은 사람 것', () => {
  it("사장님·어드민이 '보이기' 를 누르면 source 가 owner/admin 이 된다", () => {
    const routes = read('src/features/creator-content/api/content.routes.ts')
    expect(routes).toMatch(/source = CASE WHEN \? = 'visible' AND source = 'auto' THEN \? ELSE source END/)
    expect(routes).toMatch(/status, admin \? 'admin' : 'owner', id, s\.store_key/)
  })
})

describe('⑤ 2026-11-09 저녁 — 빈 가게 줄이기 · 사진 우선순위', () => {
  it('구·동 없는 도로명 주소는 시로 동네를 본다(제주시 → "제주")', () => {
    const addr = '제주특별자치도 제주시 연북로 168'
    expect(blogAutoShow({ title: '제주도 김명자굴국밥 제주본점 후기', summary: '공항 근처', author: '여행자' }, '김명자굴국밥 제주본점', addr)).toBe(true)
    // 시가 안 맞으면 여전히 아니다
    expect(blogAutoShow({ title: '김명자굴국밥 제주본점 후기', summary: '서울 마포', author: '여행자' }, '김명자굴국밥 제주본점', '경기 김포시 풍무로 1')).toBe(false)
  })
  it('재판정은 양방향 — 공개 탈락은 후보로, 후보 통과는 공개로(자동 글만)', () => {
    const collect = read('src/features/creator-content/api/content-collect.ts')
    expect(collect).toMatch(/if \(r\.status === 'visible' && !ok\) down\.push\(r\.id\)/)
    expect(collect).toMatch(/else if \(r\.status === 'candidate' && ok\) up\.push\(r\.id\)/)
    expect(collect).toMatch(/SET status = 'visible'[^`]*WHERE id = \? AND status = 'candidate' AND source = 'auto'/)
  })
  it('글이 없는 가게는 두 번째 검색을 이름만으로', () => {
    expect(blogSecondQuery('벌툰 일산역점')).toBe('벌툰 일산역')
    expect(blogSecondQuery('꾸꾸데쎄르 (연산점)')).toBe('꾸꾸데쎄르')
    const collect = read('src/features/creator-content/api/content-collect.ts')
    expect(collect).toMatch(/const second = known\.size \? q : blogSecondQuery\(s\.store_name\)/)
  })
  it('사진은 사진 있는 글이 3개 안 되는 가게부터', () => {
    const collect = read('src/features/creator-content/api/content-collect.ts')
    expect(collect).toMatch(/t\.status = 'visible' AND t\.thumb_url <> ''\) >= 3/)
  })
})

describe('⑥ 2026-11-10 — 영상도 업종 이름 가게는 자동 공개 안 함', () => {
  it('videoMatch', () => {
    expect(videoMatch('인천 주안 홍대돈까스 제육돈까스', '홍대돈까스')).toBe(false)
    expect(videoMatch('꾸꾸데쎄르 소금빵', '꾸꾸데쎄르')).toBe(true)
  })
  it('쌓인 공개 영상도 내리고 · 손님 응답도 거른다', () => {
    const collect = read('src/features/creator-content/api/content-collect.ts')
    expect(collect).toMatch(/isStoreOwnPost\(r\.author_name, r\.store_name\) \|\| !videoMatch\(r\.title \?\? '', r\.store_name\)/)
    expect(read('src/features/creator-content/api/content.routes.ts')).toMatch(/r\.platform === 'youtube' && !videoMatch\(/)
  })
})
