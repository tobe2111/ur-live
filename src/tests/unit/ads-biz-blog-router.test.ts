import { describe, it, expect } from 'vitest'
import { looksLikeBusinessBlog, extractBlogBizContact } from '@/features/marketing/api/biz-blog-router'

/**
 * 🔀 2026-07-28 업체형 블로그 → B2B 파트너풀 라우팅의 불변식 잠금.
 *
 *   배경: 인플루언서 풀 네이버 블로그 표본에서 ~7.7%가 업체 블로그였다(공인중개사·중고주방·철거공사…).
 *   인플루언서로는 노이즈지만 광고주 리드로는 자산 — 다만 **개인 블로거를 업체로 오판하면 파트너풀이
 *   오염된다**(그쪽은 실제 영업 대상 명단이다). 그래서 판별은 보수적이어야 하고, 그 경계를 여기서 고정한다.
 *
 *   ⚠️ 규칙(BIZ_STRONG/PHONE_IN_NAME)을 손대면 **아래 오탐 케이스가 여전히 false 인지** 반드시 확인할 것.
 *   정탐을 1건 더 얻으려다 개인 블로거를 쓸어담는 것이 이 기능의 유일한 실패 방식이다.
 */
describe('looksLikeBusinessBlog — 업체 계정 판별(보수적)', () => {
  it('① 실제 라이브 표본의 업체 블로그를 잡는다', () => {
    const yes: [string, string?][] = [
      ['에스공인중개사사무소'],
      ['성심공인중개사사무소'],
      ['명인리얼티부동산중개법인'],
      ['㈜석수테크놀러지 공식 블로그'],
      ['(주)모락모락'],
      ['(주)지디네트웍스 1544 3542'],          // 이름에 대표번호
      ['울산철거N강원종합공사 폐업지원 최대600만원'],
      ['서울플라워스쿨학원'],
      ['박문수요리아카데미'],
      ['하늘마음한의원'],
      ['엠씨케이광택 화성 본점'],
      ['간판 제작 전문업체'],
      ['Nangman guest house 펜션'],
      ['▶24시간 상담 환영◀', '견적 문의 010-1234-5678 전국 출장'], // 영업문구 + 소개글 전화
    ]
    for (const [name, desc] of yes) expect(looksLikeBusinessBlog(name, desc), name).toBe(true)
  })

  it('② 개인 블로거/크리에이터는 잡지 않는다 (오탐 = 파트너풀 오염)', () => {
    const no: [string, string?][] = [
      ['범상우맘'],
      ['단비의 새하마노'],
      ['지민가든'],
      ['뽀송돌'],
      ['jungdam_1983님의 블로그'],
      ['월드가이드 worldguide'],
      ['브라우니'],
      ['도톰한 하루', '일상 브이로그와 맛집 기록을 남깁니다'],
      ['홍석천이원일', '💌 비즈니스 문의 : gaypig1111@gmail.com'], // 비즈니스 문의 메일 ≠ 업체
      ['지냐 Jinyaa', '뷰티 크리에이터입니다'],
      ['서울 맛집 탐방기', '주말마다 맛집을 다닙니다'],
      ['', ''],                                                   // 빈 이름
      ['카페 추천 일기', '동네 카페를 소개해요'],                    // '카페'는 업종어지만 개인 리뷰 블로그
    ]
    for (const [name, desc] of no) expect(looksLikeBusinessBlog(name, desc), name).toBe(false)
  })
})

describe('extractBlogBizContact — 저장된 텍스트에서 연락처(외부 요청 0)', () => {
  it('③ 이름에 박힌 대표번호/지역번호/휴대폰을 뽑는다', () => {
    expect(extractBlogBizContact('(주)지디네트웍스 1544 3542').phone).toBe('1544-3542')
    expect(extractBlogBizContact('한빛세탁 02-123-4567').phone).toBe('02-123-4567')
    expect(extractBlogBizContact('출장세차', '문의 010.9876.5432').phone).toBe('010-9876-5432')
  })

  it('④ 없으면 null — 허위로 채우지 않는다', () => {
    expect(extractBlogBizContact('범상우맘', '아이와 보낸 하루')).toEqual({ phone: null, email: null })
  })

  it('⑤ 이메일은 뽑되 플랫폼/이미지 오탐은 거른다', () => {
    expect(extractBlogBizContact('한빛세탁', '문의: hanbit@daum.net').email).toBe('hanbit@daum.net')
    expect(extractBlogBizContact('블로그', 'thumb@2x.png 이미지').email).toBeNull()
  })
})

/**
 * 🏘️ 카페 분리(2026-07-28 대표 "별도 매체로 분리")의 계약 고정.
 *   어드민 목록은 platform 미지정 시 `platform != 'naver_cafe'` 를 WHERE 에 넣어 카페를 빼고,
 *   `platform=naver_cafe` 로 명시하면 그것만 보여준다. 이 두 갈래가 뒤집히면
 *   ① 커뮤니티가 인플루언서 목록을 다시 오염시키거나 ② 카페를 아예 볼 수 없게 된다.
 *   (라우트 SQL 을 직접 부르지 않고 분기 규칙만 재현 — 서버 코드와 같은 조건식을 쓴다.)
 */
describe('카페 분리 — 기본 목록에서 제외, 명시 조회는 유지', () => {
  const PLATFORMS = ['youtube', 'naver_blog', 'naver_cafe', 'tistory', 'instagram', 'tiktok']
  /** 라우트와 동일한 분기: 유효 platform 이면 그 값으로, 아니면 카페 제외. */
  function whereFor(platform: string): string {
    return PLATFORMS.includes(platform) ? `platform = '${platform}'` : "platform != 'naver_cafe'"
  }
  it('① 기본(미지정)은 카페를 제외한다', () => {
    for (const q of ['', '  ', 'garbage']) expect(whereFor(q.trim())).toBe("platform != 'naver_cafe'")
  })
  it('② 카페를 명시하면 카페만 — 데이터는 보존되고 언제든 볼 수 있다', () => {
    expect(whereFor('naver_cafe')).toBe("platform = 'naver_cafe'")
  })
  it('③ 다른 플랫폼 명시는 영향 없음', () => {
    expect(whereFor('youtube')).toBe("platform = 'youtube'")
    expect(whereFor('naver_blog')).toBe("platform = 'naver_blog'")
  })
})
