/**
 * 🔑 어드민 플랫폼 설정 — 브라우저 자동 채움이 저장을 막지 않는다 (2026-11-26 대표 신고 *"flip_pilot_seller_ids: 양의 정수 CSV 여야 함"*)
 *
 * 사고: 연동 자격 칸(type=password)에 `autoComplete="off"` 만 있었다. 크롬은 비밀번호 칸에서 그 값을 무시하고 저장된 로그인을
 * 채우며, 그 앞의 글자 칸(8월 flip 파일럿 매장 seller_id)에 **아이디를** 넣었다 → 서버 검증이 저장을 통째로 거부.
 * 고정: 자격 칸은 `new-password`, 운영 정책 글자 칸은 `off`.
 * ⚠️ 못 보는 것: 실제 브라우저의 자동 채움 동작(브라우저마다 다르다).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

describe('자동 채움 방지', () => {
  it('연동 자격(비밀번호) 칸은 new-password', () => {
    const src = readFileSync('src/pages/admin-platform-settings/CloudflareCredsSection.tsx', 'utf8')
    expect(src).toMatch(/type="password" autoComplete="new-password"/)
    expect(src).not.toMatch(/type="password" autoComplete="off"/)
  })
  it('운영 정책 글자 칸은 autoComplete off', () => {
    const src = readFileSync('src/pages/AdminPlatformSettingsPage.tsx', 'utf8')
    expect(src).toMatch(/placeholder="미설정"\s*\n\s*autoComplete="off" name=\{`ops-\$\{f\.key\}`\}/)
  })
})
