/**
 * 🔑 **업체(B2B) 수집 키워드 — 화면에서 직접 고르는 자리** (2026-08-02 대표 요구).
 *
 * ## 왜 별도 모듈인가
 * `partner-pool.routes.ts` 가 598줄로 600 캡 코앞이라, 여기 라우트를 더하면 래칫에 걸린다.
 * 같은 이유로 이미 `partner-pool-dedupe.routes.ts` 를 뽑아 둔 선례가 있어 그 패턴을 따른다.
 * ⚠️ **반드시 `requireAdmin()` 뒤에 마운트**할 것 — 앞에 두면 이 라우트만 인증을 안 거친다
 *   (부모 파일 주석이 같은 경고를 남겨 뒀다).
 *
 * ## 왜 이게 필요했나
 * 인플루언서 풀은 `KeywordManager` 로 키워드를 켜고 끄고 우선순위를 매길 수 있는데,
 * **업체 풀은 서버에 `GET/POST /keywords` 가 있는데도 화면이 없었다** — 키워드 4,546개가
 * 시드로만 굴러가고 대표가 손댈 방법이 없었다. 네 축 중 **③ 필터링**이 한쪽 도메인에만 있던 셈이다.
 *
 * ⚠️ 여기서 켜고 끄는 것은 **수집 대상**이지 이미 모인 리드가 아니다. 끈다고 기존 리드가 지워지지 않는다
 *   (지우는 건 별도 삭제 경로). 그래서 되돌리기가 안전하다.
 */
import { Hono } from 'hono'
import type { Env } from '@/worker/types/env'
import { listCompanyKeywords, addCompanyKeyword, setCompanyKeywordActive } from './company-collect'
import { adsLeadsDb } from '../../../shared/ads/leads-db'

const app = new Hono<{ Bindings: Env }>()

// GET /api/admin/partner-pool/keywords — 레인 A 지역검색 키워드 풀(지역 × 업종 시드 + 수기 추가).
app.get('/keywords', async (c) => c.json({ success: true, keywords: await listCompanyKeywords(adsLeadsDb(c.env)) }))

// POST /api/admin/partner-pool/keywords { keyword, category?, subcategory?, region?, tier? }
app.post('/keywords', async (c) => {
  const b = await c.req.json().catch(() => ({})) as { keyword?: string; category?: string; subcategory?: string; region?: string; tier?: number }
  const r = await addCompanyKeyword(adsLeadsDb(c.env), b.keyword || '', b.category, b.subcategory, b.region, b.tier)
  return c.json({ success: r.ok, error: r.error }, r.ok ? 200 : 400)
})

/**
 * PATCH /api/admin/partner-pool/keywords/:id { active: 0|1 }
 * 인플루언서 풀의 `PATCH /influencer-pool/keywords/:id` 와 같은 계약(화면 동작을 두 도메인에서 통일).
 * ⚠️ id 가 비숫자면 400 — `intParam` 을 안 쓰는 이유는 여기서 기본값으로 떨어지면 **엉뚱한 키워드**를
 *   끄기 때문이다(페이지네이션과 달리 관대함이 해가 되는 자리).
 */
app.patch('/keywords/:id', async (c) => {
  const id = Number(c.req.param('id'))
  if (!Number.isFinite(id) || id <= 0) return c.json({ success: false, error: 'INVALID_ID' }, 400)
  const b = await c.req.json().catch(() => ({})) as { active?: number | boolean }
  const r = await setCompanyKeywordActive(adsLeadsDb(c.env), id, b.active ? 1 : 0)
  return c.json({ success: r.ok, error: r.error }, r.ok ? 200 : 404)
})

export const partnerPoolKeywordRoutes = app
