/**
 * 🧾 2026-11-18 [UNLOCK_LOADING] 교환권 카테고리 캐시 6시간 + KT 동기화 때 비우기 — 대표 승인 "해줘".
 * 지키는 것: ① KV 수명이 SSOT 값(6시간)이고 키도 SSOT 하나 ② 동기화가 성공하면(synced>0) 그 키를 지운다 ③ 응답 헤더(잠금 항목)는 종전 그대로.
 * 못 막는 것: KT 밖에서 교환권을 손으로 바꾼 경우 — 최대 6시간 늦게 보인다(개수·브랜드 칸뿐).
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import { VOUCHER_CATEGORIES_CACHE_KEY, VOUCHER_CATEGORIES_KV_TTL_S } from '@/worker/utils/voucher-categories-cache'

const R = (p: string) => fs.readFileSync(p, 'utf8')

describe('교환권 카테고리 캐시', () => {
  it('KV 수명은 6시간, 키는 SSOT 하나', () => {
    expect(VOUCHER_CATEGORIES_KV_TTL_S).toBe(21600)
    const src = R('src/worker/routes/public-utility.routes.ts')
    expect(src).toMatch(/KV\.put\(CACHE_KEY, body, \{ expirationTtl: VOUCHER_CATEGORIES_KV_TTL_S \}\)/)
    expect(src).toMatch(/const CACHE_KEY = VOUCHER_CATEGORIES_CACHE_KEY/)
    expect(src).not.toMatch(/'vouchers_categories_v5'/)
    expect(VOUCHER_CATEGORIES_CACHE_KEY).toBe('vouchers_categories_v5')
  })
  it('KT 동기화가 성공하면 그 캐시를 지운다', () => {
    expect(R('src/worker/cron/kt-alpha-catalog-sync.ts')).toMatch(/if \(synced > 0\) await \(env as unknown as \{ SESSION_KV\?: KVNamespace \}\)\.SESSION_KV\?\.delete\(VOUCHER_CATEGORIES_CACHE_KEY\)/)
  })
  it('응답 헤더(잠금 항목)는 그대로', () => {
    expect(R('src/worker/routes/public-utility.routes.ts')).toMatch(/c\.header\('Cache-Control', 'public, max-age=300, stale-while-revalidate=120'\)/)
  })
})
