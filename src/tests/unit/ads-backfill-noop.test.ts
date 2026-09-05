/**
 * 🪞 재조우 백필 no-op 제거 — `influencer-backfill-diff.ts` 계약.
 *
 * 이 시험이 지키는 것은 두 방향이다:
 *   ① 값이 하나도 안 바뀌면 **쓰지 않는다**(쓰기 예산이 발굴을 멈추던 원인)
 *   ② 값이 달라지는 경우는 **하나도 빠짐없이 쓴다** — 빠지면 F-32(구독자·소개글 영구 스테일)가 재발한다.
 *
 * ②가 더 중요하다. 그래서 SET 절의 규칙마다 개별 시험을 둔다(하나로 뭉치면 한 규칙이 죽어도 초록불).
 *
 * ⚠️ 이 시험이 **못 막는 것**: 실제 SQL 이 값을 어떻게 쓰는지는 검증하지 못한다(D1 이 없다).
 *   `backfillSql` 의 SET 절을 바꾸면 이 파일과 `influencer-backfill-diff.ts` 를 같은 커밋에서 고칠 것 —
 *   그 짝을 소스로 고정하는 것이 아래 ⑪ 이다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { backfillWouldChange, type BackfillCurrent, type BackfillIncoming } from '@/features/marketing/api/influencer-backfill-diff'

/** 저장값과 들어온 값이 완전히 같은 기준 상태 — 여기서 한 항목씩만 어긋뜨려 규칙을 하나씩 잰다. */
const CUR: BackfillCurrent = {
  email: 'a@b.com', instagram: 'insta', tiktok: 'tok', links: 'https://x',
  subscriber_count: 100, view_count: 5000,
  description: '소개글', last_post_at: '2026-09-01', opted_out: 0,
}
const INC: BackfillIncoming = {
  email: 'a@b.com', instagram: 'insta', tiktok: 'tok', links: 'https://x',
  subscriber_count: 100, view_count: 5000,
  description: '소개글', last_post_at: '2026-09-01', optOut: 0,
}

describe('재조우 백필 — 값이 안 바뀌면 쓰지 않는다', () => {
  it('① 완전히 같으면 false (이게 절약의 전부다)', () => {
    expect(backfillWouldChange(CUR, INC)).toBe(false)
  })

  it('② 저장값이 더 최신이어도(들어온 값이 옛것) 쓰지 않는다', () => {
    // 검색 결과는 종종 오래된 스냅샷을 준다. last_post_at 은 前進만 한다.
    expect(backfillWouldChange(CUR, { ...INC, last_post_at: '2026-08-01' })).toBe(false)
  })

  it('③ 들어온 값이 비어 있으면(0 · 빈 문자열 · null) 덮어쓰지 않는다', () => {
    expect(backfillWouldChange(CUR, { ...INC, subscriber_count: 0 })).toBe(false)
    expect(backfillWouldChange(CUR, { ...INC, view_count: 0 })).toBe(false)
    expect(backfillWouldChange(CUR, { ...INC, description: '' })).toBe(false)
    expect(backfillWouldChange(CUR, { ...INC, last_post_at: null })).toBe(false)
  })

  it('④ 이미 거부 태그가 선 행에 다시 거부가 와도 쓰지 않는다(sticky)', () => {
    expect(backfillWouldChange({ ...CUR, opted_out: 1 }, { ...INC, optOut: 1 })).toBe(false)
  })

  it('⑤ 컨택이 이미 있으면 다른 값이 와도 쓰지 않는다 (COALESCE 는 빈칸만 채운다)', () => {
    expect(backfillWouldChange(CUR, { ...INC, email: 'other@x.com' })).toBe(false)
    expect(backfillWouldChange(CUR, { ...INC, instagram: 'other' })).toBe(false)
  })
})

describe('재조우 백필 — 달라지는 경우는 빠짐없이 쓴다 (F-32 회귀 방지)', () => {
  it('⑥ 빈 컨택은 채운다 — 네 필드 각각', () => {
    expect(backfillWouldChange({ ...CUR, email: null }, INC)).toBe(true)
    expect(backfillWouldChange({ ...CUR, instagram: null }, INC)).toBe(true)
    expect(backfillWouldChange({ ...CUR, tiktok: null }, INC)).toBe(true)
    expect(backfillWouldChange({ ...CUR, links: null }, INC)).toBe(true)
  })

  it('⑦ 빈 문자열도 "없음"으로 보고 채운다 (좁게 잡으면 갱신을 건너뛴다)', () => {
    expect(backfillWouldChange({ ...CUR, email: '' }, INC)).toBe(true)
  })

  it('⑧ 구독자수·총조회는 달라지면 최신화한다 — 줄어드는 방향도 포함', () => {
    expect(backfillWouldChange(CUR, { ...INC, subscriber_count: 101 })).toBe(true)
    expect(backfillWouldChange(CUR, { ...INC, subscriber_count: 50 })).toBe(true)
    expect(backfillWouldChange(CUR, { ...INC, view_count: 6000 })).toBe(true)
    expect(backfillWouldChange({ ...CUR, subscriber_count: null }, INC)).toBe(true)
  })

  it('⑨ 소개글이 달라지면 최신화한다 (재분류가 낡은 소개글로 판정하던 그 사고)', () => {
    expect(backfillWouldChange(CUR, { ...INC, description: '바뀐 소개글' })).toBe(true)
    expect(backfillWouldChange({ ...CUR, description: null }, INC)).toBe(true)
  })

  it('⑩ 마지막 글 날짜는 더 최신일 때 쓰고, 없던 행에도 쓴다', () => {
    expect(backfillWouldChange(CUR, { ...INC, last_post_at: '2026-09-02' })).toBe(true)
    expect(backfillWouldChange({ ...CUR, last_post_at: null }, INC)).toBe(true)
  })

  it('⑪ 나중에 써 넣은 거부 문구를 잡는다', () => {
    expect(backfillWouldChange(CUR, { ...INC, optOut: 1 })).toBe(true)
    expect(backfillWouldChange({ ...CUR, opted_out: null }, { ...INC, optOut: 1 })).toBe(true)
  })
})

describe('배선 — 순수함수가 실제 저장 경로에 붙어 있는가', () => {
  const SAVE = 'src/features/marketing/api/influencer-save.ts'
  const src = readFileSync(SAVE, 'utf8')

  it('⑫ 백필 batch 가 걸러진 목록을 쓴다 (existing 을 그대로 쓰면 절약이 0이다)', () => {
    const m = src.match(/const changed = await pickChangedForBackfill\([^)]*\)/)
    expect(m, '거르는 호출이 사라졌다').toBeTruthy()
    // batch 에 넘기는 것이 걸러진 목록이어야 한다 — 호출만 해 놓고 existing 을 쓰면 조용히 무효가 된다.
    expect(src).toMatch(/DB\.batch\(\s*changed\.map/)
  })

  it('⑬ 조회 실패는 fail-open — 못 읽었다고 갱신을 건너뛰지 않는다', () => {
    const fn = src.slice(src.indexOf('async function pickChangedForBackfill'))
    expect(fn, 'pickChangedForBackfill 을 못 찾았다').toContain('pickChangedForBackfill')
    expect(fn).toMatch(/if \(!res\?\.results\) return existing/)
  })

  it('⑭ 비교는 저장 형태(500자 절단)와 같은 값으로 한다', () => {
    const fn = src.slice(src.indexOf('async function pickChangedForBackfill'))
    expect(fn).toMatch(/description: l\.description\.slice\(0, 500\)/)
  })

  it('⑮ SET 절이 다루는 컬럼을 조회가 전부 읽어 온다 (하나라도 빠지면 그 규칙이 늘 참이 된다)', () => {
    const fn = src.slice(src.indexOf('async function pickChangedForBackfill'))
    for (const col of ['email', 'instagram', 'tiktok', 'links', 'subscriber_count',
      'view_count', 'description', 'last_post_at', 'opted_out']) {
      expect(fn, `조회 SELECT 에 ${col} 이 없다`).toContain(col)
    }
  })
})
