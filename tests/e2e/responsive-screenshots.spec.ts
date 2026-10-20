/**
 * 🛡️ 2026-05-21: PC 반응형 스크린샷 batch — 4 viewport × 주요 페이지.
 *
 * 사용법:
 *   npx playwright test tests/e2e/responsive-screenshots.spec.ts --headed
 *
 * 결과:
 *   tests/e2e/screenshots/<viewport>/<page>.png
 *
 * 검토:
 *   사람이 PNG 를 비교해서 깨진 레이아웃 / 잘림 / overlap 시각 검증.
 *   자동화는 layout shift 만 detect, 미적 판단은 사람 영역.
 */
import { test } from '@playwright/test'

const VIEWPORTS = [
  { name: 'mobile-small', width: 360, height: 800 },
  { name: 'mobile-large', width: 430, height: 932 },
  { name: 'tablet',       width: 768, height: 1024 },
  { name: 'desktop',      width: 1280, height: 800 },
  { name: 'desktop-wide', width: 1920, height: 1080 },
]

const PAGES = [
  { name: 'home',        path: '/' },
  { name: 'browse',      path: '/browse' },
  { name: 'vouchers',    path: '/vouchers' },
  { name: 'live',        path: '/live' },
  { name: 'login',       path: '/login' },
  { name: 'cart',        path: '/cart' },
  { name: 'group-buy',   path: '/group-buy' },
  { name: 'referral',    path: '/referral' },
  { name: 'blog',        path: '/blog' },
  { name: 'search',      path: '/search' },
]

for (const vp of VIEWPORTS) {
  for (const p of PAGES) {
    test(`${vp.name} :: ${p.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height })
      await page.goto(p.path, { waitUntil: 'networkidle', timeout: 20000 }).catch(() => {})
      // 약간의 lazy load / 애니메이션 시간
      await page.waitForTimeout(800)
      await page.screenshot({
        path: `tests/e2e/screenshots/${vp.name}/${p.name}.png`,
        fullPage: true,
      })
    })
  }
}
