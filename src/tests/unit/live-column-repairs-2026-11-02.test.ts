/**
 * 🩸 2026-11-02 — 라이브 컬럼 사진 가드를 켜자 드러난 **실제 사용자 결함** 둘을 고정한다.
 *
 *   ① '내 단골 가게' 가 늘 비었다 — `GET /my/follows` 가 `notify_new_product`·`notify_live_start` 를 읽는데
 *      라이브 seller_follows 엔 `notify_group_buy` 만 있다(라이브에 단골 3건). 새 상품 알림도 같은 이유로 안 나갔다.
 *   ② 탈퇴 기록 0행 — deleted_accounts INSERT 가 `reason` 을 쓰는데 보강 목록에 빠져 있었다.
 *
 * 판정: **쓰는 컬럼 ⊂ (라이브 사진 ∪ 그 파일의 ensure ALTER)**. 런타임 ensure 가 첫 호출 때 컬럼을 만들기
 * 때문에, 사진에 없는 컬럼은 ensure 가 반드시 만들어야 한다.
 * ⚠️ 못 보는 것: ensure 가 실제로 라이브에서 돌았는가(그건 주간 사진 대조 `snapshot-live-schema --check` 가 본다).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const ROOT = resolve(__dirname, '../../..')
const read = (p: string) => readFileSync(resolve(ROOT, p), 'utf-8')
const snap = JSON.parse(read('src/shared/db/live-schema.snapshot.json')).tables as Record<string, string>
const liveCols = (t: string) => new Set(String(snap[t] || '').split(',').filter(Boolean))
const ensured = (src: string, t: string) =>
  new Set([...src.matchAll(new RegExp(`ALTER TABLE ${t} ADD COLUMN (\\w+)`, 'g'))].map(m => m[1]))

describe('① 단골 목록 · 새 상품 알림', () => {
  const src = read('src/features/seller-public/api/seller-public.routes.ts')
  it('읽는 notify_* 컬럼이 전부 라이브에 있거나 ensure 가 만든다', () => {
    const used = new Set([...src.matchAll(/\bnotify_(new_product|live_start|group_buy)\b/g)].map(m => `notify_${m[1]}`))
    expect(used.size).toBe(3)
    const have = new Set([...liveCols('seller_follows'), ...ensured(src, 'seller_follows')])
    for (const c of used) expect(have.has(c), `seller_follows.${c} 를 아무도 안 만든다 — 단골 목록이 빈다`).toBe(true)
  })
})

describe('② 탈퇴 기록', () => {
  const src = read('src/worker/services/delete-account.service.ts')
  it('INSERT 컬럼이 전부 라이브에 있거나 ensure 가 만든다', () => {
    const m = src.match(/INSERT INTO deleted_accounts \(([^)]*)\)/)
    expect(m, 'INSERT 를 못 찾았다 — 이 시험이 헛돈다').toBeTruthy()
    const cols = m![1].split(',').map(s => s.trim())
    expect(cols.length).toBeGreaterThan(4)
    const have = new Set([...liveCols('deleted_accounts'), ...ensured(src, 'deleted_accounts')])
    for (const c of cols) expect(have.has(c), `deleted_accounts.${c} 를 아무도 안 만든다 — 탈퇴 기록이 안 남는다`).toBe(true)
  })
})
