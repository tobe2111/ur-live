import { describe, it, expect } from 'vitest'
import { extractContacts, pickBusinessEmail, deobfuscateEmail } from '@/features/marketing/api/influencer-discovery'

/**
 * 🆕 2026-07-13 유어애즈 인플루언서 발굴 — 공개 설명 컨택 추출 순수함수 잠금.
 *   유튜브 채널 설명(API 공식 반환 텍스트)에서 이메일·인스타·틱톡·링크인바이오 추출.
 */
describe('extractContacts', () => {
  it('비즈니스 이메일 추출 + 이미지 URL 오탐 제외', () => {
    const t = '협업문의: brand.deal@example.com\n프로필사진 banner.png@2x 아님\ncontact@myshop.co.kr'
    const r = extractContacts(t)
    expect(r.emails).toContain('brand.deal@example.com')
    expect(r.emails).toContain('contact@myshop.co.kr')
    expect(r.emails.some(e => e.endsWith('.png'))).toBe(false)
  })

  it('인스타/틱톡 핸들 추출 (교차 SNS)', () => {
    const t = '👉 Instagram: https://instagram.com/beauty_guru_kr\nTikTok https://www.tiktok.com/@dance.king\n#reels'
    const r = extractContacts(t)
    expect(r.instagram).toContain('beauty_guru_kr')
    expect(r.tiktok).toContain('dance.king')
    // instagram.com/reel, /p 같은 경로는 핸들 아님
    expect(r.instagram).not.toContain('reels')
  })

  it('링크인바이오(링크트리 등) 추출', () => {
    const r = extractContacts('모든 링크 → https://linktr.ee/creator99 그리고 https://litt.ly/shop')
    expect(r.links.some(l => l.includes('linktr.ee/creator99'))).toBe(true)
    expect(r.links.some(l => l.includes('litt.ly/shop'))).toBe(true)
  })

  it('🆕 URL 없는 키워드+@ 표기 포착 (인스타 @foodie / IG: @x / 틱톡 @y)', () => {
    const r = extractContacts('📸 인스타 @foodie_kim  ·  IG: @seoul.eats  ·  틱톡 @dance_king')
    expect(r.instagram).toContain('foodie_kim')
    expect(r.instagram).toContain('seoul.eats')
    expect(r.tiktok).toContain('dance_king')
  })

  it('🆕 @ 없는 일반 문장은 핸들로 오인하지 않음 (오탐 방지)', () => {
    const r = extractContacts('My instagram is the best place to follow me every day')
    expect(r.instagram).toEqual([]) // "instagram is" 를 핸들로 잡지 않음(@ 필수)
  })

  it('🆕 @ 접두·후행 구두점 정규화 ("@Foodie." → "foodie")', () => {
    const r = extractContacts('인스타 @Foodie_Kim.')
    expect(r.instagram).toContain('foodie_kim')
    expect(r.instagram.some(h => h.startsWith('@') || h.endsWith('.'))).toBe(false)
  })

  it('🆕 유튜브·블로그 교차링크는 links 로 수집 (크로스플랫폼)', () => {
    const r = extractContacts('유튜브 https://youtube.com/@myfood_tv 블로그 https://foodie.tistory.com 네이버 https://blog.naver.com/foodielog')
    expect(r.links.some(l => l.includes('youtube.com/@myfood_tv'))).toBe(true)
    expect(r.links.some(l => l.includes('foodie.tistory.com'))).toBe(true)
    expect(r.links.some(l => l.includes('blog.naver.com/foodielog'))).toBe(true)
  })
})

describe('deobfuscateEmail — 봇 회피 난독화 복원', () => {
  it('괄호/대괄호 at·dot', () => {
    expect(deobfuscateEmail('contact [at] gmail [dot] com')).toContain('contact@gmail.com')
    expect(deobfuscateEmail('abc(at)naver.com')).toContain('abc@naver.com')
  })
  it('한글 골뱅이·앳·엣 + 전각 점', () => {
    expect(deobfuscateEmail('문의 foodie 골뱅이 gmail.com')).toContain('foodie@gmail.com')
    expect(deobfuscateEmail('abc(엣)naver.com')).toContain('abc@naver.com')
    expect(deobfuscateEmail('abc@gmail．com')).toContain('abc@gmail.com')
  })
  it('공백 흩뿌리기 (@ 와 점 양옆 공백)', () => {
    expect(deobfuscateEmail('biz @ daum . net')).toContain('biz@daum.net')
    expect(deobfuscateEmail('hello at kakao dot com')).toContain('hello@kakao.com')
    expect(deobfuscateEmail('sub.brand @ company . co . kr')).toContain('sub.brand@company.co.kr')
  })
  it('일반 문장은 이메일로 오인하지 않음', () => {
    const EMAIL = /[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}/g
    expect((deobfuscateEmail('I eat at home and relax').match(EMAIL) || [])).toEqual([])
    expect((deobfuscateEmail('follow me at instagram').match(EMAIL) || [])).toEqual([])
  })
  it('extractContacts/pickBusinessEmail 가 난독화 이메일을 회수', () => {
    expect(extractContacts('협업문의: brand [at] gmail [dot] com').emails).toContain('brand@gmail.com')
    expect(pickBusinessEmail('비즈니스 문의 deal 골뱅이 naver.com')).toBe('deal@naver.com')
  })

  it('중복 제거 + 소문자 정규화', () => {
    const r = extractContacts('메일 Deal@X.com deal@x.com DEAL@x.com\nig instagram.com/AA instagram.com/aa')
    expect(r.emails).toEqual(['deal@x.com'])
    expect(r.instagram).toEqual(['aa'])
  })

  it('컨택 없는 설명 → 전부 빈 배열', () => {
    const r = extractContacts('구독과 좋아요 부탁드려요! 매주 화/목 업로드합니다.')
    expect(r.emails).toEqual([])
    expect(r.instagram).toEqual([])
    expect(r.tiktok).toEqual([])
    expect(r.links).toEqual([])
  })

  it('빈/undefined 입력 안전', () => {
    expect(extractContacts('').emails).toEqual([])
    expect(extractContacts(undefined as unknown as string).instagram).toEqual([])
  })
})

/**
 * 🆕 2026-07-20 영상 설명 노이즈(협찬사·서비스 메일)에서 채널 주인 비즈니스 이메일 선별.
 */
describe('pickBusinessEmail', () => {
  it('비즈니스 문맥어 근처 이메일 우선(협찬사 메일보다)', () => {
    const t = '이 영상은 유료광고를 포함합니다. 제품 문의 partner@bigbrand.com\n비즈니스 문의: zuyoni.biz@gmail.com'
    expect(pickBusinessEmail(t)).toBe('zuyoni.biz@gmail.com')
  })

  it('서비스/자동응답 계정(support@ 등)은 감점', () => {
    const t = 'support@youtube-partner.com 로 문제 신고\n연락: creator.deal@naver.com'
    expect(pickBusinessEmail(t)).toBe('creator.deal@naver.com')
  })

  it('개인메일 도메인 가산점 — 문맥 동률 시', () => {
    const t = 'a@corp.io\nb@gmail.com'
    expect(pickBusinessEmail(t)).toBe('b@gmail.com')
  })

  it('후보 없음 → null / 이미지 URL 제외', () => {
    expect(pickBusinessEmail('구독 좋아요!')).toBeNull()
    expect(pickBusinessEmail('thumb.png@2x')).toBeNull()
  })

  it('개인메일이 문맥 없어도 대행사(문맥 있는) 메일을 이김 — 티벳동생 케이스', () => {
    // 대행사 메일만 "비즈니스 문의" 문맥, 창작자 개인메일은 "contact:" 뿐 — 개인도메인이 지배적이어야 함.
    const t = '비즈니스 문의: know@fleekers.co.kr\ncontact: ilsan9924@naver.com'
    expect(pickBusinessEmail(t)).toBe('ilsan9924@naver.com')
    // 문맥이 전혀 없어도 개인도메인 우선.
    expect(pickBusinessEmail('제휴 문의 agency@company.co.kr\nilsan9924@naver.com')).toBe('ilsan9924@naver.com')
  })
})
