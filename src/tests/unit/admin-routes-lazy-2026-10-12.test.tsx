/**
 * ⚡ 어드민 라우트 표를 어드민 경로에서만 받는다 (2026-10-12, 대표 "대기업급 속도 · 근본 원인").
 * 근거는 `src/routes/admin.routes.tsx` 의 `AdminRouteTree` 머리말.
 *
 *   ① 원래 표의 경로가 **하나도 빠짐없이** 하위 Routes 에서 맞는다(`/admin/x` → `x`)
 *   ② 표에 없는 어드민 경로는 404 페이지로(빈 화면 금지)
 *   ③ App 은 표를 펼치지 않고 `/admin/*` 한 줄만 둔다 · 어드민 표는 소비자 첫 부팅 청크와 다른 봉투
 * ⚠️ 못 막는 것: 실제 렌더(보호 라우트·레이아웃) — 그건 표가 그대로라 종전과 같다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { createRoutesFromChildren, matchRoutes } from 'react-router-dom'
import { AdminRoutes, adminRouteTreeChildren } from '@/routes/admin.routes'

const original: string[] = []
for (const r of ([] as unknown[]).concat(AdminRoutes().props.children)) {
  const p = (r as { props?: { path?: string } })?.props?.path
  if (typeof p === 'string') original.push(p)
}
const routes = createRoutesFromChildren([...adminRouteTreeChildren()])

describe('⚡ 어드민 라우트 표 — /admin/* 아래 하위 Routes', () => {
  it('원래 표가 비어 있지 않다(0이면 아래가 전부 헛돈다)', () => {
    expect(original.length).toBeGreaterThan(80)
    expect(original.every((p) => p === '/admin' || p.startsWith('/admin/'))).toBe(true)
  })

  it('① 모든 원래 경로가 접두를 뗀 채 그대로 맞는다', () => {
    for (const p of original) {
      const rest = p.slice('/admin'.length) || '/'
      const sample = rest.replace(/:[A-Za-z_]+/g, '123')
      const m = matchRoutes(routes, sample)
      expect(m, p).not.toBeNull()
      expect(m![m!.length - 1].route.path, p).toBe(rest)
    }
  })

  it('② 표에 없는 경로는 404 로', () => {
    const src = readFileSync('src/routes/admin.routes.tsx', 'utf8')
    expect(src).toMatch(/<Route path="\*" element=\{<AdminNotFoundPage \/>\} \/>/)
  })

  it('③ App 은 /admin/* 한 줄 · 어드민 표는 별도 봉투', () => {
    const app = readFileSync('src/App.tsx', 'utf8')
    expect(app).not.toMatch(/\{AdminRoutes\(\)\}/)
    expect(app).not.toMatch(/import \{ AdminRoutes \}/)
    expect(app).toMatch(/<Route path="\/admin\/\*" element=\{<AdminRouteTree \/>\} \/>/)
    expect(app).toMatch(/const AdminRouteTree = lazy\(\(\) => import\('\.\/routes\/admin\.routes'\)\)/)
    const v = readFileSync('vite.config.ts', 'utf8')
    const a = v.indexOf("id.includes('/src/routes/admin.routes')) return 'app-routes-admin'")
    const b = v.indexOf("id.includes('/src/routes/')) return 'app-routes'")
    expect(a).toBeGreaterThan(0)
    expect(b).toBeGreaterThan(a)
  })
})
