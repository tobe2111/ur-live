/**
 * 🏬 운영자 몰 브랜딩·슬러그 불변식 〔세션 ③-a, 기획 확정 2026-07-29〕
 *
 * 여기서 지키는 것은 **두 가지 성격이 다르다**:
 *   ① 규격 — 대비(WCAG AA)·슬러그 문법처럼 **틀리면 명백히 잘못인 것**
 *   ② 드리프트 — 예약어 목록이 실제 라우트를 못 따라가는 것(조용히 낡는다)
 *
 * ⚠️ 이 테스트가 **못** 막는 것:
 *   - 라우트가 아닌 경로 충돌(정적 파일·워커가 가로채는 prefix). P0 는 어드민 수동 개설이라 사람이 확인한다.
 *   - 운영자가 **직접 고른 색**의 대비. P0 는 다크 짝을 파생하지 않고 기본값을 쓰므로 여기선 기본값만 본다
 *     (임의 파생이 AA 를 깨면 "대비는 규격"이라는 확정을 어긴다).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'fs'
import { resolve } from 'path'
import {
  MALL_COLOR_LIGHT, MALL_COLOR_DARK, POWERED_BY, PAYMENT_TRUST_NOTE,
  defaultIntro, initialOf, resolveMallBranding,
} from '@/shared/mall/branding'
import { RESERVED_SLUGS, validateMallName, validateMallSlug } from '@/shared/mall/slug'

// ── WCAG 상대휘도·대비비 (WCAG 2.x 정의 그대로) ──────────────────────────
function luminance(hex: string): number {
  const h = hex.replace('#', '')
  const ch = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
  const lin = ch.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * lin[0]! + 0.7152 * lin[1]! + 0.0722 * lin[2]!
}
function contrast(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p) as [number, number]
  return (x + 0.05) / (y + 0.05)
}

describe('대비는 취향이 아니라 규격 — WCAG AA', () => {
  // 대표 확정: "색은 취향이지만 대비는 규격입니다. 두 모드 모두 본문 텍스트 대비 AA 충족."
  it('라이트 대표색 위의 흰 글씨가 AA(4.5:1) 이상', () => {
    expect(contrast(MALL_COLOR_LIGHT, '#FFFFFF')).toBeGreaterThanOrEqual(4.5)
  })

  it('다크 대표색 위의 잉크 글씨가 AA(4.5:1) 이상', () => {
    // 다크 모드에선 밝은 대표색 위에 어두운 글씨가 얹힌다 — 라이트값을 그대로 쓰면 여기서 깨진다.
    expect(contrast(MALL_COLOR_DARK, '#0D0F12')).toBeGreaterThanOrEqual(4.5)
  })

  it('다크 짝은 라이트값보다 밝다 — 어두운 배경에서 읽히려면 방향이 반대여야 한다', () => {
    expect(luminance(MALL_COLOR_DARK)).toBeGreaterThan(luminance(MALL_COLOR_LIGHT))
  })

  it('두 색이 유어딜 본진 로즈와 구분된다', () => {
    expect(MALL_COLOR_LIGHT.toUpperCase()).not.toBe('#E0526B')
    expect(MALL_COLOR_DARK.toUpperCase()).not.toBe('#E0526B')
  })
})

describe('무설정 기본값 — "미완성"으로 보이면 안 된다', () => {
  it('아무것도 설정 안 해도 이름·이니셜·색·소개문이 채워진다', () => {
    const r = resolveMallBranding({ name: '동네상회' })
    expect(r.initial).toBe('동')
    expect(r.colorLight).toBe(MALL_COLOR_LIGHT)
    expect(r.intro).toContain('동네상회')
    expect(r.logoUrl).toBeNull()
  })

  it('배너는 P0 에 없다 — 빈 영역 placeholder 금지', () => {
    expect(resolveMallBranding({ name: 'x' }).showBanner).toBe(false)
  })

  it('문의 링크 미설정이면 null — 버튼을 만들지 않는다', () => {
    expect(resolveMallBranding({ name: 'x' }).contactUrl).toBeNull()
    expect(resolveMallBranding({ name: 'x', contactUrl: '  ' }).contactUrl).toBeNull()
  })

  it('설정값이 있으면 그것이 이긴다', () => {
    const r = resolveMallBranding({ name: '몰', logoUrl: 'https://x/y.png', color: '#123456', intro: '내 소개' })
    expect(r.logoUrl).toBe('https://x/y.png')
    expect(r.colorLight).toBe('#123456')
    expect(r.intro).toBe('내 소개')
  })

  it('이니셜은 공백·이모지로 시작해도 실제 글자를 찾는다', () => {
    expect(initialOf('  가게')).toBe('가')
    expect(initialOf('🍎사과')).toBe('🍎')   // 서로게이트 페어를 반으로 자르지 않는다
    expect(initialOf('')).toBe('?')
    expect(initialOf('shop')).toBe('S')
  })

  it('기본 소개문에 몰 이름이 들어간다', () => {
    expect(defaultIntro('가게')).toContain('가게')
  })
})

describe('고정 문구', () => {
  it('완전 화이트라벨이 아니다 — powered by 표기 유지', () => {
    expect(POWERED_BY).toContain('유어딜')
  })

  it('🔴 결제 문구가 **환불 주체를 단정하지 않는다**', () => {
    // 운영자도 /seller/orders 에서 환불을 실행할 수 있어(클래스 D 전수) "환불은 유어딜이 처리"는
    // 사실과 어긋날 수 있다. 법무 회신(질문 ⑥) 전까지 이 문구에 '환불'을 넣지 말 것.
    expect(PAYMENT_TRUST_NOTE).not.toContain('환불')
    expect(PAYMENT_TRUST_NOTE).toContain('결제')
  })
})

describe('슬러그 예약어 ↔ 실제 라우트 (드리프트 차단)', () => {
  const files = [
    ...readdirSync(resolve(process.cwd(), 'src/routes')).filter((f) => f.endsWith('.tsx'))
      .map((f) => resolve(process.cwd(), 'src/routes', f)),
    resolve(process.cwd(), 'src/App.tsx'),
  ]
  const segments = new Set<string>()
  for (const f of files) {
    const src = readFileSync(f, 'utf8')
    for (const m of src.matchAll(/path="([^"]+)"/g)) {
      const p = m[1]!.replace(/^\/+|\/+$/g, '')
      if (!p || p === '*') continue
      const first = p.split('/')[0]!
      if (!first || first.startsWith(':') || first === '*') continue
      segments.add(first.toLowerCase())
    }
  }

  it('라우트를 실제로 찾는다 (빈 스캔 방지)', () => {
    // 정규식이 깨지거나 파일이 옮겨지면 0개가 잡히고, 그러면 아래 포함 검사가 무의미하게 통과한다.
    expect(segments.size).toBeGreaterThanOrEqual(50)
  })

  it('실제 라우트 세그먼트가 전부 예약돼 있다', () => {
    // 하나라도 빠지면 그 슬러그로 몰이 개설되는 순간 **그 페이지가 죽는다.**
    const missing = [...segments].filter((s) => !RESERVED_SLUGS.includes(s))
    expect(missing, `예약어 누락(라우트 추가 후 목록 미갱신): ${missing.join(', ')}`).toEqual([])
  })
})

describe('표시명·슬러그 규칙', () => {
  it('표시명 2~20자 · 한글/영문/숫자/공백', () => {
    expect(validateMallName('가').ok).toBe(false)
    expect(validateMallName('동네 상회 1호점').ok).toBe(true)
    expect(validateMallName('a'.repeat(21)).ok).toBe(false)
    expect(validateMallName('가게🍎').ok).toBe(false)   // 이모지 불가
    expect(validateMallName('shop@1').ok).toBe(false)   // 특수문자 불가
  })

  it('슬러그 문법 3~30자 · 소문자/숫자/하이픈', () => {
    expect(validateMallSlug('ab').ok).toBe(false)
    expect(validateMallSlug('my-shop-1').ok).toBe(true)
    expect(validateMallSlug('My-Shop').ok).toBe(true)   // 소문자 정규화 후 판정
    expect(validateMallSlug('shop_1').ok).toBe(false)
    expect(validateMallSlug('-shop').ok).toBe(false)
    expect(validateMallSlug('shop-').ok).toBe(false)
  })

  it('🔴 예약어는 거부 — 이게 뚫리면 기존 페이지가 죽는다', () => {
    for (const s of ['admin', 'products', 'seller', 'pay', 'u', 'my', 'wholesale']) {
      expect(validateMallSlug(s).ok, `예약어가 통과됨: ${s}`).toBe(false)
    }
  })
})
