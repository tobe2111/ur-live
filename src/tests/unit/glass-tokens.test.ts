import { describe, it, expect } from 'vitest'
import { glass, boutiqueCard, boutiqueLabel, boutiqueCTA } from '@/components/glass/glassTokens'

/**
 * 🛡️ 2026-04-29: Glass 토큰 단위 테스트
 *
 * 검증:
 *   1. 모든 glass 변형이 backdropFilter + WebkitBackdropFilter 둘 다 정의 (Safari 호환)
 *   2. actionRail / navPill / statsChip 등 핵심 토큰 존재
 *   3. boutique* 토큰 (CTA / label / card) 정의
 */

describe('glass tokens', () => {
  it('주요 glass 변형이 backdropFilter 정의 (chip 류 제외)', () => {
    const blurExpected = ['actionRail', 'navPill', 'statsChip', 'chatBar', 'panel', 'playCircle', 'liveBadge']
    blurExpected.forEach((name) => {
      const style = glass[name]
      expect(style, `${name} 토큰 존재해야 함`).toBeDefined()
      const hasBlur = String(style.backdropFilter || '').includes('blur')
      expect(hasBlur, `${name} 은 backdropFilter blur 가 있어야 함`).toBe(true)
    })
  })

  it('Safari 호환을 위한 WebkitBackdropFilter 동시 정의', () => {
    Object.entries(glass).forEach(([name, style]) => {
      // navPill, statsChip, actionRail 등은 둘 다 있어야 함
      // liveBadge, scheduledChip 은 webkit 없을 수도 있음 (옅은 chip)
      if (style.backdropFilter) {
        const isCriticalGlass = ['actionRail', 'navPill', 'statsChip', 'chatBar', 'panel', 'playCircle'].includes(name)
        if (isCriticalGlass) {
          expect(style.WebkitBackdropFilter, `${name} 은 Safari 호환 webkit prefix 필요`).toBeDefined()
        }
      }
    })
  })

  it('핵심 토큰 7종 모두 정의됨', () => {
    expect(glass.actionRail).toBeDefined()
    expect(glass.navPill).toBeDefined()
    expect(glass.statsChip).toBeDefined()
    expect(glass.chatBar).toBeDefined()
    expect(glass.panel).toBeDefined()
    expect(glass.playCircle).toBeDefined()
    expect(glass.liveBadge).toBeDefined()
  })

  it('Boutique 토큰 (CTA / label / card) 정의', () => {
    expect(boutiqueCard.background).toContain('rgba(255,255,255')
    expect(boutiqueLabel.background).toContain('linear-gradient')
    expect(boutiqueCTA.background).toContain('#EF4444')
    expect(boutiqueCTA.background).toContain('#EC4899')
  })

  it('actionRail dark glass 명세', () => {
    expect(glass.actionRail.background).toBe('rgba(0,0,0,0.40)')
    expect(glass.actionRail.color).toBe('#fff')
    expect(glass.actionRail.border).toContain('rgba(255,255,255,0.15)')
  })
})
