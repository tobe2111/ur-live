/**
 * 🧱 어드민 화면은 전부 어드민 공통 틀(AdminLayout) 안에 그린다 (2026-11-26 대표 "배경이 어둡네").
 *   틀 밖에 놓인 화면은 흰 바탕·왼쪽 메뉴가 없어서, PC·폰이 다크 모드면 바탕이 검게 나오고 제목이 안 보였다.
 *   실측: 결재함 · AI 팀 본사 · 플랫폼 모델 · 대외 소개서 · 캠페인 신청자 · 인플루언서 발송 큐 6개가 그랬다.
 *   ⚠️ 못 막는 것: 화면이 틀 안에서 자기 배경을 검게 칠하는 경우(눈으로 봐야 한다).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const ROOT = resolve(__dirname, '../../..')
const routes = readFileSync(resolve(ROOT, 'src/routes/admin.routes.tsx'), 'utf-8')
const EXEMPT = new Set(['src/pages/NotFoundPage.tsx'])
const LAYOUT = /AdminLayout|SellerLayout|AgencyLayout|<Navigate|Login/

describe('어드민 라우트 화면 = 공통 틀 안', () => {
  const files = [...routes.matchAll(/import\('@\/(pages\/[\w/-]+)'\)/g)].map(m => {
    const base = resolve(ROOT, 'src', m[1])
    const f = [base + '.tsx', base + '/index.tsx'].find(existsSync)
    return { mod: m[1], f }
  })

  it('화면 목록을 읽었다(파서가 헛돌지 않는다)', () => {
    expect(files.length).toBeGreaterThan(50)
  })

  it('모든 화면이 AdminLayout(또는 다른 대시보드 틀)으로 감싼다', () => {
    const bad = files
      .filter(x => x.f && !EXEMPT.has(x.f.slice(ROOT.length + 1)))
      .filter(x => !LAYOUT.test(readFileSync(x.f!, 'utf-8')))
      .map(x => x.mod)
    expect(bad, '틀 밖 화면 — 다크 모드에서 바탕이 검게 나온다').toEqual([])
  })

  it('AI 팀 본사·결재함은 실제로 틀을 쓴다', () => {
    for (const p of ['src/pages/admin/AdminAiTeamPage.tsx', 'src/pages/admin/AdminDecisionsPage.tsx']) {
      expect(readFileSync(resolve(ROOT, p), 'utf-8')).toMatch(/<AdminLayout title=/)
    }
  })
})
