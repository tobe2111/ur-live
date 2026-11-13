/**
 * 🧭 옛 유어샵 핸들 → 서버 302 (2026-11-13). 라이브: `/u/jiwon`(HANDLE_MOVED → jiwon1228) 첫 글자 1.4~1.7s ↔ 새 주소 0.76s.
 *   고정: ① HANDLE_MOVED 면 새 주소 ② 그 밖(정상·빈 시드·이상한 핸들·me) 은 null ③ 워커가 쿼리 없을 때만 부른다(귀속).
 *   못 보는 것: 라이브 302 자체(배포 뒤 curl 로 본다).
 */
import { describe, it, expect } from 'vitest'
import { curatorMovedRedirect } from '@/worker/utils/curator-moved-redirect'
import { readRaw } from '../helpers/source-text'

const MOVED = JSON.stringify({ success: false, code: 'HANDLE_MOVED', new_handle: 'jiwon1228' })
describe('옛 유어샵 핸들', () => {
  it('① HANDLE_MOVED → 새 주소', () => {
    expect(curatorMovedRedirect(MOVED, '/u/jiwon')).toBe('/u/jiwon1228')
    expect(curatorMovedRedirect(MOVED, '/u/jiwon/')).toBe('/u/jiwon1228')
  })
  it('② 그 밖은 넘기지 않는다', () => {
    expect(curatorMovedRedirect(JSON.stringify({ success: true, curator: { handle: 'a' } }), '/u/a')).toBeNull()
    expect(curatorMovedRedirect(null, '/u/jiwon')).toBeNull()
    expect(curatorMovedRedirect('{bad', '/u/jiwon')).toBeNull()
    expect(curatorMovedRedirect(JSON.stringify({ code: 'HANDLE_MOVED', new_handle: '../admin' }), '/u/jiwon')).toBeNull()
    expect(curatorMovedRedirect(JSON.stringify({ code: 'HANDLE_MOVED', new_handle: 'me' }), '/u/jiwon')).toBeNull()
    expect(curatorMovedRedirect(MOVED, '/u/me')).toBeNull()
    expect(curatorMovedRedirect(MOVED, '/u/jiwon/x')).toBeNull()
    expect(curatorMovedRedirect(JSON.stringify({ code: 'HANDLE_MOVED', new_handle: 'jiwon' }), '/u/jiwon')).toBeNull() // 제자리 루프 금지
  })
  it('③ 워커는 CURATOR 슬롯 · 쿼리 없을 때만 302', () => {
    expect(readRaw('src/worker/index.ts')).toContain("if (ssrSlot === 'CURATOR' && !url.search) { const moved = curatorMovedRedirect(ssrPayload, url.pathname); if (moved) { c.res = new Response(null, { status: 302")
  })
})
