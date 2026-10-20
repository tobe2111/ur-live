/**
 * 🏷️ **상호 존재 가드** — 발견 사이트를 채택할지 판정하는 마지막 관문 (2026-07-29 근본수리).
 *
 *   무엇이 잘못돼 있었나: 가드가 **원문 HTML** 과 상호를 비교했다. 그런데 로고·헤더는 거의 항상
 *   `<h1>김밥<span>천국</span></h1>` 처럼 마크업되므로, 태그가 상호 중간에 끼는 순간 **무조건 불일치**다.
 *   실측(라이브): 매장 레인이 그 라운드에 발견한 사이트 **2/2 가 `no_name`** 으로 버려졌고,
 *   매장 36,872건 중 이메일 보유는 **1건**이었다.
 *
 *   여기서 고정하는 것: ① 태그가 끼어도 상호를 알아본다 ② 엔티티가 섞여도 알아본다
 *   ③ **느슨한 상호는 여전히 채택하지 않는다**(프랜차이즈 본사 오귀속 방지 — 세기만 한다).
 *
 *   ⚠️ 이 테스트가 못 막는 것: 상호가 **이미지 로고로만** 있는 사이트는 여전히 못 알아본다(텍스트가 없다).
 *   그건 OCR 영역이라 다른 처방이고, 지금은 `name_loose_only` 계측이 그 규모를 알려줄 것이다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { normBizName } from '@/features/marketing/api/contact-enrich'

/** 크롤러가 실제로 하는 판정과 같은 형태(태그 제거 후 비교). */
const stripTag = (s: string) => s.replace(/<[^>]+>/g, '')
const seen = (html: string, name: string) => normBizName(stripTag(html)).includes(normBizName(name))
const seenLoose = (html: string, name: string) => normBizName(stripTag(html), true).includes(normBizName(name, true))

describe('상호 매칭 — 태그가 끼어도 알아본다', () => {
  it('🔒 로고 마크업으로 쪼개진 상호(이 버그의 정체)', () => {
    expect(seen('<h1 class="logo">김밥<span>천국</span></h1>', '김밥천국')).toBe(true)
  })

  it('줄바꿈·들여쓰기로 쪼개진 상호', () => {
    expect(seen('<div>\n  카페\n  베네\n</div>', '카페베네')).toBe(true)
  })

  it('HTML 엔티티가 섞여도(&nbsp;) 알아본다', () => {
    expect(seen('<p>미소&nbsp;헤어</p>', '미소헤어')).toBe(true)
  })

  it('진짜 남의 사이트는 여전히 거른다 — 가드의 존재 이유', () => {
    expect(seen('<h1>전혀 다른 상호</h1><p>연락처</p>', '김밥천국')).toBe(false)
  })
})

describe('느슨한 상호 — 세기만 하고 채택하지 않는다', () => {
  it('법인격 표기 차이: 엄격은 실패, 느슨은 맞음 — **이게 계측이 잡는 실제 사례**다', () => {
    expect(seen('<h1>한빛기획</h1>', '(주)한빛기획')).toBe(false)
    expect(seenLoose('<h1>한빛기획</h1>', '(주)한빛기획')).toBe(true)
  })

  it('지점 표기만 다른 경우도 느슨에서 잡힌다', () => {
    expect(seen('<h1>미소헤어</h1>', '미소헤어 본점')).toBe(false)
    expect(seenLoose('<h1>미소헤어</h1>', '미소헤어 본점')).toBe(true)
  })

  it('⚠️ **지점의 지역명까지는 안 지운다** — 프랜차이즈 본사 사이트가 개별 지점으로 세어지지 않게', () => {
    // '스타벅스 강남2호점' 은 느슨해져도 '스타벅스강남' 이라 본사 페이지('스타벅스')와 안 맞는다.
    // 계측이 과대 보고되면 다음 세션이 가드를 필요 이상으로 풀게 된다 — 보수적으로 센다.
    expect(seenLoose('<h1>스타벅스</h1>', '스타벅스 강남2호점')).toBe(false)
  })

  it('느슨한 기준에서도 남남은 남남 — 계측이 아무거나 세지 않는다', () => {
    expect(seenLoose('<h1>전혀 다른 상호</h1>', '김밥천국 2호점')).toBe(false)
  })
})

describe('normBizName', () => {
  it('공백만 지우는 것이 기본(축약은 loose 에서만)', () => {
    expect(normBizName(' 김밥 천국 ')).toBe('김밥천국')
    expect(normBizName('(주)한빛')).toBe('(주)한빛')
  })

  it('loose 는 괄호·법인격·지점 표기를 걷어낸다', () => {
    expect(normBizName('(주)한빛기획(강남)', true)).toBe('한빛기획')
    expect(normBizName('스타벅스 강남2호점', true)).toBe('스타벅스강남')
    expect(normBizName('미소헤어 본점', true)).toBe('미소헤어')
  })

  it('빈 값에도 터지지 않는다', () => {
    expect(normBizName('')).toBe('')
    expect(normBizName('', true)).toBe('')
  })
})

/**
 * 🔗 **크롤러가 실제로 그 규칙을 쓰는가** — 배선 불변식.
 *
 *   ⚠️ 위 시험들은 규칙(normBizName + 태그 제거)만 검증한다. 처음엔 그것만 두고 되돌려-검증을 했는데
 *   **수정을 지워도 전부 초록**이었다 — 시험이 크롤러가 아니라 *내가 시험 안에 다시 적은 규칙*을
 *   보고 있었기 때문이다. 규칙과 배선은 따로 고정해야 한다(이 레포가 반복해 만난 헛도는 가드).
 *
 *   ⚠️ 이 검사가 못 막는 것: 정규식 형태만 본다. 실제 크롤 동작은 라이브 `pass2_reason` 분포로 확인한다.
 */
describe('crawlContact — 상호 가드가 본문 텍스트를 본다(배선)', () => {
  const SRC = readFileSync(resolve(process.cwd(), 'src/features/marketing/api/contact-enrich.ts'), 'utf8')

  it('🔒 태그를 지운 텍스트로 비교한다 — 원문 HTML 만 보면 로고 마크업에서 무조건 불일치', () => {
    expect(SRC).toMatch(/normBizName\(stripTag\(slice\)\)/)
    expect(SRC).toMatch(/text\.includes\(wantName\)/)
  })

  it('🔒 느슨 매칭은 **채택하지 않는다** — 계측 플래그로만 간다', () => {
    expect(SRC).toMatch(/nameLoose = true/)
    // 같은 줄에서 느슨 매칭이 nameSeen 을 세우면 오귀속 방지가 무너진다.
    expect(SRC).not.toMatch(/wantLoose[^\n]*nameSeen = true/)
  })

  it('🔒 no_name 반환에 계측 플래그가 실린다(안 실으면 분포를 영영 못 본다)', () => {
    expect(SRC).toMatch(/reason: 'no_name', nameLoose/)
  })
})
