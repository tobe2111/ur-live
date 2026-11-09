/**
 * 📦 부품 파일(/assets/*)을 워커 없이 Pages 정적으로 (2026-11-09 대표 *"부품 파일 바로 내보내게 진행해줘"*).
 *   손님 한 명 첫 방문에 워커 요청 ~93건 중 ~60건이 부품이었다 — 하루 5만 명이면 월 1.4억 건.
 *   위험(대표가 알고 진행): 배포 순간 없는 부품 자리에 SPA HTML(200)이 나가 캐시에 남는 것. 그래서 셋을 함께 고정한다.
 *   ① _routes.json 이 /assets/* 를 워커에서 뺀다
 *   ② _headers 가 맨 위 `/*` 의 no-store 를 떼고(안 떼면 합쳐져 캐시가 꺼진다) 엣지 캐시를 5분으로 묶는다
 *   ③ 자가복구 두 경로(index.html 부트가드 · chunk-error.ts)가 이동 전에 부품을 cache:'reload' 로 다시 받는다
 *   ⚠️ 못 보는 것: Pages 가 `Cloudflare-CDN-Cache-Control` 을 실제로 따르는지(라이브 실측 몫).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

describe('부품 파일 정적 서빙', () => {
  it('① _routes.json 이 /assets/* 를 워커에서 뺀다', () => {
    const r = JSON.parse(readFileSync('public/_routes.json', 'utf8'))
    expect(r.exclude).toContain('/assets/*')
  })
  it('② _headers 의 /assets/* 가 no-store 를 떼고 1년 immutable + 엣지 5분', () => {
    const h = readFileSync('public/_headers', 'utf8')
    const block = (/\n\/assets\/\*\n((?:[ \t]+[^\n]*\n)+)/.exec(h) || [])[1] || ''
    for (const k of ['! Cache-Control', '! Pragma', '! Expires']) expect(block, k).toContain(k)
    expect(block).toMatch(/Cache-Control: public, max-age=31536000, immutable/)
    expect(block).toMatch(/Cloudflare-CDN-Cache-Control: max-age=31536000/) // 2026-11-09 저녁: 5분은 회귀였다(엣지가 5분마다 비어 부품이 매번 MISS) — _headers 주석
  })
  it('③ 부트가드 bustReload 가 부품을 다시 받은 뒤 이동한다', () => {
    const html = readFileSync('index.html', 'utf8')
    expect(html).toMatch(/function refreshAssets\(\)[\s\S]{0,900}cache: 'reload'/)
    expect(html).toMatch(/function bustReload\(\)[\s\S]{0,400}refreshAssets\(\)/)
  })
  it('③ chunk-error.ts 의 reloadWithCacheBust 도 같은 일을 한다', () => {
    const t = readFileSync('src/utils/chunk-error.ts', 'utf8')
    expect(t).toMatch(/export function reloadWithCacheBust\(\)[\s\S]{0,500}refreshAssetCache\(\)/)
    expect(t).toMatch(/cache: 'reload'/)
  })
})
