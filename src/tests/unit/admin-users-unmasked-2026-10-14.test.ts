/**
 * 👁️ 어드민 유저 목록 — 이메일·전화를 원문으로 보여 준다 (2026-10-14 대표
 *   *"유저 관리 페이지에 유저들 정보는 마스킹처리 될게 아니라 다 보여야하잖아"*).
 *
 * 2026-07-13 데이터 감사 3단계가 목록 응답을 마스킹했다(`fo***@x.com` · `***-****-1234`).
 * 대표가 그 결정을 뒤집었다 — CS 가 목록에서 바로 연락처를 봐야 한다.
 *
 * 이 시험은 두 방향을 같이 잠근다:
 *  ① 목록 응답이 원문을 그대로 낸다(마스킹이 조용히 돌아오지 않게)
 *  ② 마스킹을 걷은 대신 남긴 방어 — 열람 감사 로그와 깊은 페이지네이션 알림 — 가 그대로 있다.
 *     마스킹이 없는 지금은 그 둘이 대량 열람을 알아챌 유일한 장치다.
 *
 * ⚠️ 못 보는 것: 화면이 실제로 원문을 그리는지(브라우저 밖) · 다른 어드민 화면(주문 목록 등)의 마스킹.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { stripComments } from '../helpers/source-text'

const SRC = stripComments(readFileSync('src/features/admin/api/admin-users.routes.ts', 'utf8'))
const listHandler = (() => {
  const start = SRC.indexOf("'read_user_list'")
  expect(start).toBeGreaterThan(0)
  const begin = SRC.lastIndexOf('adminUsersRoutes.get(', start)
  const end = SRC.indexOf('adminUsersRoutes.', start)
  return SRC.slice(begin, end)
})()

describe('어드민 유저 목록 — 원문 노출', () => {
  it('목록 핸들러를 찾았다 (비면 헛도는 시험)', () => {
    expect(listHandler.length).toBeGreaterThan(500)
  })

  it('이메일·전화를 마스킹하지 않는다', () => {
    expect(listHandler).not.toMatch(/mask(Email|Phone)\s*\(/)
    expect(listHandler).toMatch(/data:\s*users\s*,/)
  })

  it('열람 감사 로그는 남는다', () => {
    expect(listHandler).toMatch(/writeAuditLog\(c,\s*\{\s*action:\s*'read_user_list'/)
  })

  it('깊은 페이지네이션 알림은 남는다', () => {
    expect(listHandler).toMatch(/if\s*\(offset\s*>=\s*2000\)/)
    expect(listHandler).toMatch(/sendAlert\(/)
  })
})
