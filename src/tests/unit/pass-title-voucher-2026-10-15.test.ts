/**
 * 🏷️ 이용권 상세 제목이 **"공동구매"** 라고 말하던 것 (2026-10-15 대표 승인 "추천대로").
 *
 * 실측: 라이브 `/pass/` 15건 전부 `${상품명} 공동구매 - ${가게명}`. 그 단어가 사실이 아니다 —
 * 2026-05-30 에 경제를 **즉시판매 단일가**로 바꿨고 2026-09-04 대표 확정이 *"마감 개념은 없어"* 다.
 * 310건의 검색 제목이 "여러 명이 모여야 하는 것"처럼 말하고 있었다. 근거·결정: `shared/seo/detail-title.ts` ③.
 *
 * 고정하는 것:
 *   ① `passDetailTitle` — 단어 · 꼬리 가게명 · 같은 말 두 번 안 함 · 가게 없으면 사이트 이름
 *   ② 서버·클라가 **같은 SSOT** 를 쓴다(손으로 제목을 적지 않는다 — 두 벌이면 Googlebot 과 Yeti 가 갈린다)
 *   ③ 이용권 상세 표면에 `공동구매` 0건
 *   ④ **반대 방향** — 공구 서비스(운영자 몰)의 `공동구매` 는 그대로다(서비스가 다르다)
 *   ⑤ `twitter:site` 죽은 값 제거 — 되살리려면 봇 셸이지 이 자리가 아니다
 * ⚠️ 못 막는 것: 구글이 그 제목을 실제로 쓰는지(색인 수일~수주) · 제목이 보기 좋은지 ·
 *    `group_buy_current`("N명 함께 구매 중") 문구 자체(별건 — 이번 승인 범위는 단어 교체다).
 */
import { describe, it, expect } from 'vitest'
import { passDetailTitle } from '@/shared/seo/detail-title'
import { readCode, readRaw } from '../helpers/source-text'

const SERVER = 'src/worker/utils/detail-ssr-meta.ts'
const CLIENT = 'src/pages/GroupBuyDetailPage.tsx'
const SSOT = 'src/shared/seo/detail-title.ts'

describe('① passDetailTitle', () => {
  it('단어가 이용권이고 꼬리는 가게 이름이다', () => {
    expect(passDetailTitle('마라샹궈 2인 세트', '신룽푸마라탕 명동점'))
      .toBe('마라샹궈 2인 세트 이용권 - 신룽푸마라탕 명동점')
  })
  it('같은 말을 두 번 하지 않는다 — 라이브 359건 중 2건이 이름에 `이용권` 을 품었다', () => {
    expect(passDetailTitle('1개월 이용권 + 운동복', '스포애니 강남'))
      .toBe('1개월 이용권 + 운동복 - 스포애니 강남')
    expect(passDetailTitle('1개월 이용권 + 운동복', '스포애니 강남').match(/이용권/g)).toHaveLength(1)
  })
  it('🔁 권종을 이미 말하는 이름에도 안 붙인다 — 배포 후 실측 53건', () => {
    // 🩸 첫 판(`includes('이용권')`)은 **글자가 같을 때만** 걸러서 53건이 `…권 이용권` 으로 나갔다.
    //    아래 세 문자열은 2026-10-15 라이브에서 그대로 복사한 것이다(숙박권 49 · 1주일권 3 · 2회권 1).
    expect(passDetailTitle('평일 1박 숙박권 (프리미엄 리버뷰 스위트)', '그랑블루글램핑&펜션'))
      .toBe('평일 1박 숙박권 (프리미엄 리버뷰 스위트) - 그랑블루글램핑&펜션')
    expect(passDetailTitle('주중 자유이용 1주일권', '목동클라이밍센터'))
      .toBe('주중 자유이용 1주일권 - 목동클라이밍센터')
    expect(passDetailTitle('주말 클래스 2회권', '가게')).toBe('주말 클래스 2회권 - 가게')
    // `할인권` 도 같은 클래스다(`/pass/2888` 이 `… 할인권 이용권` 으로 나갔다).
    expect(passDetailTitle('치즈돈가스 2인 세트 할인권', '홍대돈까스'))
      .toBe('치즈돈가스 2인 세트 할인권 - 홍대돈까스')
  })
  it('🔴 반대 방향 — 권종이 없는 이름에는 반드시 붙인다 (라이브 306건)', () => {
    // 이 방향이 더 비싸다: 넓히다가 전부 생략하면 306건이 무엇인지 말하지 않는 제목이 된다.
    for (const n of ['마라샹궈 2인 세트', '닭도리탕', '치즈돈가스 2인 세트', '족발 세트']) {
      expect(passDetailTitle(n, '가게'), n).toBe(`${n} 이용권 - 가게`)
    }
  })
  it('🔴 판정은 **권 복합어**다 — 띄어 쓴 한 글자 `권` 은 권종이 아니다', () => {
    // `[가-힣A-Za-z0-9]권` 이라 앞 글자가 붙어 있어야 한다. 이 경계가 없으면 이름 아무 데나
    // 든 `권` 한 글자가 접미사를 삼킨다.
    expect(passDetailTitle('자유 권 체험', '가게')).toBe('자유 권 체험 이용권 - 가게')
  })
  it('가게 이름이 없을 때만 사이트 이름으로 떨어진다', () => {
    expect(passDetailTitle('족발 세트', '')).toBe('족발 세트 이용권 - 유어딜')
    expect(passDetailTitle('족발 세트', null)).toBe('족발 세트 이용권 - 유어딜')
  })
  it('공백을 다듬는다 · 빈 입력에도 안 터진다', () => {
    expect(passDetailTitle('  마라탕  ', ' 가게 ')).toBe('마라탕 이용권 - 가게')
    expect(passDetailTitle('', '가게')).toBe('이용권 - 가게')  // 🩸 앞 공백이 안 남는다(SSOT 주석)
    expect(() => passDetailTitle(null, undefined)).not.toThrow()
  })
  it('생성기가 공동구매를 **덧붙이지** 않는다', () => {
    // 🩸 이 단언의 첫 판은 `'공동구매 세트'` 를 넣고 출력에 그 단어가 없기를 기대했다 — 틀렸다.
    //    생성기는 **가게가 붙인 상품명을 검열하지 않는다**(라이브 310건 중 그런 이름은 0건).
    //    지킬 것은 *덧붙이는 접미사*이고, 그래서 이름을 뺀 나머지만 본다.
    for (const n of ['마라탕', '족발 세트', '1개월 이용권 + 운동복']) {
      expect(passDetailTitle(n, '가게').replace(n, '')).not.toContain('공동구매')
    }
  })
  it('사이트 이름을 접미사로 덧붙이지 않는다 — 길이가 잘린다(머리말 🔴)', () => {
    expect(passDetailTitle('마라샹궈 2인 세트', '신룽푸마라탕 명동점')).not.toContain('유어딜')
  })
})

describe('② 서버·클라가 같은 SSOT', () => {
  it('둘 다 passDetailTitle 을 부른다', () => {
    expect(readCode(SERVER)).toContain('passDetailTitle(')
    expect(readCode(CLIENT)).toContain('passDetailTitle(')
  })
  it('제목을 손으로 조립하지 않는다 — 두 벌이면 Googlebot 과 Yeti 가 갈린다', () => {
    for (const f of [SERVER, CLIENT]) {
      // `${무엇} 이용권 - ` / `${무엇} 공동구매 - ` 같은 손조립 금지
      expect(readCode(f)).not.toMatch(/`\$\{[^}]+\}\s*(이용권|공동구매)\s*-\s*\$\{/)
    }
  })
})

describe('③ 이용권 상세에 공동구매 0건', () => {
  it('서버·클라 어디에도 없다(주석 제외)', () => {
    expect(readCode(SERVER)).not.toContain('공동구매')
    expect(readCode(CLIENT)).not.toContain('공동구매')
  })
  it('검사 대상이 비어 있지 않다 — 경로가 낡으면 통과가 아니라 실패', () => {
    // 🩸 길이 하한을 2000 으로 뒀더니 SSOT 에서 실패했다 — 그 파일은 주석이 대부분이라 코드가 1053자다.
    //    "경로가 낡지 않았다" 는 길이보다 **그 파일에만 있는 앵커**가 정확히 판정한다.
    expect(readCode(SERVER)).toContain('buildDetailMeta')
    expect(readCode(CLIENT)).toContain('__SSR_INITIAL_DETAIL__')
    expect(readCode(SSOT)).toContain('export function passDetailTitle')
  })
})

describe('④ 반대 방향 — 공구 서비스(운영자 몰)는 그대로', () => {
  it('몰 메타는 여전히 공동구매라고 말한다 — 거기선 실제로 여러 명이 모인다', () => {
    // 서비스 분리(CLAUDE.md): 유어딜 이용권 ↔ 공구 서비스 픽업 공구는 다른 것이다.
    expect(readCode('src/worker/utils/mall-ssr-meta.ts')).toContain('공동구매')
    expect(readCode('src/pages/MallHomePage.tsx')).toContain('공동구매')
  })
})

describe('⑤ twitter:site 죽은 값', () => {
  it('실행되는 줄에서 제거됐다', () => {
    const code = readCode('src/components/SEO.tsx')
    expect(code).not.toContain('twitter:site')
    expect(code).not.toContain('urdeal_kr')
  })
  it('나머지 twitter 메타는 그대로다 — 카드 자체를 끄지 않았다', () => {
    const code = readCode('src/components/SEO.tsx')
    for (const m of ['twitter:card', 'twitter:title', 'twitter:description', 'twitter:image']) {
      expect(code).toContain(m)
    }
  })
  it('왜 지웠는지가 그 자리에 남아 있다 — 다음 세션이 이 자리에 되살리지 않게', () => {
    expect(readRaw('src/components/SEO.tsx')).toContain('봇 셸')
  })
})
