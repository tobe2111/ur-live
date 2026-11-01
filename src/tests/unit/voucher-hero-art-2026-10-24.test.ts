/**
 * 🦦 교환권 머리 배너 — 글자와 유달이가 겹치지 않는다 (2026-10-24 대표 *"배너 속 글자랑 배너 유달이랑 위치도 겹치잖아"*).
 *
 * 배너는 4:1(PC) 그림이고 주인공(유달이·상품)이 오른쪽 45%에 있다. 폰 머리(2:1, 196px)에 꽉 채우면
 * 오른쪽 절반만 남아 주인공이 제목 아래로 들어왔다 ⇒ 머리에서는 사진을 줄여 오른쪽 아래에 붙이고,
 * 왼쪽은 그 사진의 가장자리 색으로 채운다.
 *
 * ⚠️ 이 시험이 못 보는 것: 실제로 안 겹쳐 보이는지(브라우저 렌더) · 바탕이 평평하지 않은 배너.
 */
import { describe, it, expect } from 'vitest'
import { readCode, stripComments } from '../helpers/source-text'
import { HERO_CARD_CLS, heroEdgeFillStyle, heroEdgeFillCss } from '@/shared/home-strip-banners'

/**
 * 🔀 2026-11-01 — 교환권 머리에서 배너가 **걷혔다**(대표 확정 A안, `shared/vouchers-top-row`).
 *   그래서 이 `hero` 변형(`BannerHeroRail`·`HERO_CARD_CLS`·`heroEdgeFill*`)은 **현재 사용처가 0** 이다.
 *   코드를 지우지 않은 이유: 대표가 배너를 되돌리고 싶어질 때 한 줄이면 복원되고, 같은 파일을
 *   **홈 배너가 계속 쓴다**(hero 가 아닌 strip/inline/wide 변형) — 섞어 지우면 홈이 깨진다.
 *   ⚠️ 아래 단언들은 "되살릴 때 지켜야 할 모양" 을 보관하는 것이지 **지금 화면을 지키는 게 아니다.**
 */
describe('교환권 머리 배너(hero 변형 — 현재 사용처 0) — 그림을 오른쪽 아래로', () => {
  it('머리에서는 사진을 꽉 채우지 않고 줄여서 오른쪽 아래에 붙인다', () => {
    expect(HERO_CARD_CLS).toContain('[&>img]:!inset-auto')
    expect(HERO_CARD_CLS).toContain('[&>img]:!right-0')
    expect(HERO_CARD_CLS).toContain('[&>img]:!w-auto')
    expect(HERO_CARD_CLS).toMatch(/\[&>img\]:!h-\[(\d+)%\]/)
    const h = Number(HERO_CARD_CLS.match(/\[&>img\]:!h-\[(\d+)%\]/)![1])
    expect(h, '꽉 채우면(100%) 주인공이 제목 아래로 들어온다').toBeLessThanOrEqual(70)
  })

  it('제목은 그림이 시작하는 자리 앞에서 멈춘다', () => {
    const w = Number(HERO_CARD_CLS.match(/\[&>strong\]:!max-w-\[(\d+)%\]/)![1])
    expect(w).toBeLessThanOrEqual(50)
  })

  it('왼쪽은 같은 사진의 가장자리 색으로 채운다 — 화면과 서버가 같은 값', () => {
    const st = heroEdgeFillStyle('https://x/a.jpg')!
    expect(st.backgroundImage).toContain('https://x/a.jpg')
    expect(st.backgroundPosition).toContain('left')
    expect(heroEdgeFillCss('https://x/a.jpg')).toContain(st.backgroundSize)
    expect(heroEdgeFillStyle('')).toBeUndefined()
  })

  it('배선 — hero 변형을 쓰는 쪽은 그 함수를 쓴다 (화면만 남았다)', () => {
    const ui = stripComments(readCode('src/components/home/HomeBannerStrip.tsx'))
    expect(ui).toMatch(/hero \? heroEdgeFillStyle\(bg\)/)
    // 🔀 서버 첫 화면 쪽 단언은 걷었다 — A안에서 워커는 교환권 배너를 그리지 않는다.
    //   그 방향(배너가 서버 첫 화면으로 되살아남)은 `vouchers-hero-banner-ssr-2026-10-18` 이 잡는다.
    const fs = stripComments(readCode('src/worker/utils/vouchers-first-screen.ts'))
    expect(fs, 'A안: 워커가 배너를 그리지 않는다').not.toMatch(/heroEdgeFillCss/)
  })
})
