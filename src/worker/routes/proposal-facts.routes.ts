/**
 * 📄 대외 소개서 자동 갱신의 서버 쪽 두 자리 (2026-11-02 대표 *"제안서는 계속 자동 업데이트가 안돼"* → *"가장 이상적으로"*)
 *
 * ① `GET /api/public/proposal-facts` — 덱이 쓰는 **라이브 숫자**(판매 중 이용권 · 실제 매장 · 카테고리 평균 판매가 ·
 *    셈법 예시 상품 · 덱 문장이 기대는 설정 스위치). 덱 생성 워크플로가 빌드할 때 읽는다.
 *    공개인 이유: 이 숫자들은 **이미 대외 소개서에 인쇄돼 나가는 값**이다(개인정보·매장 연락처 0, 건수·평균뿐).
 *    products 한 테이블(수천 행)만 읽고 edge 캐시 1시간이라 익명 호출이 D1 에 거의 닿지 않는다.
 *
 * ② `GET /api/admin/proposals/{manifest|file/:name}` — 워크플로가 GitHub Release(`proposals-latest`)에 올린
 *    **최신 덱**을 어드민에게 건넨다(requireAdmin — adminApp 아래에 붙는다).
 *    🔑 완성본(PDF·PPTX 약 40MB)을 레포에 커밋하지 않는 것이 요점이다 — 커밋하면 (a) 다시 뽑을 때마다 세션이
 *    그 바이너리를 다투고 (b) 매번 수 MB 씩 git 기록이 영구로 불어난다. Release 자산은 git 기록이 아니다.
 *    이 경로가 실패하면 화면이 저장소의 판(`/static/proposals/*.pdf`)으로 내려간다 — 그때는 화면이 그 사실을 말한다.
 */
import { Hono } from 'hono'
import type { Env } from '@/worker/types/env'
import { safeError } from '@/worker/utils/safe-error'
import { publicCache } from '@/worker/middleware/edge-cache'
import {
  PROPOSAL_FACTS_SQL as Q,
  PROPOSAL_SAMPLE_PRODUCT_ID,
  shapeProposalFacts,
  type SampleRow,
} from '@/shared/proposal-live-facts'

export const PROPOSAL_RELEASE_TAG = 'proposals-latest'
export const PROPOSAL_RELEASE_BASE = `https://github.com/tobe2111/ur-live/releases/download/${PROPOSAL_RELEASE_TAG}/`
/** 받아 줄 파일 이름 — 이 모양 밖은 거절한다(경로 조작 차단: 슬래시·점점·쿼리 전부 이 정규식 밖이다). */
export const PROPOSAL_ASSET_NAME = /^(?:urdeal-[a-z0-9-]+\.(?:pdf|pptx)|manifest\.json)$/

export const proposalFactsPublicRoutes = new Hono<{ Bindings: Env }>()

proposalFactsPublicRoutes.get('/', publicCache(3600), async (c) => {
  try {
    const db = c.env.DB
    const [counts, averages, anchor, fallback, settings] = await Promise.all([
      db.prepare(Q.counts).first<{ active: number; real_stores: number }>(),
      db.prepare(Q.averages).all<{ category: string; avg: number }>(),
      db.prepare(Q.anchor).bind(PROPOSAL_SAMPLE_PRODUCT_ID).first<SampleRow>(),
      db.prepare(Q.fallback).first<SampleRow>(),
      db.prepare(Q.settings).all<{ key: string; value: string }>(),
    ])
    const facts = shapeProposalFacts({
      counts: counts ?? null,
      averages: averages.results ?? [],
      anchor: anchor ?? null,
      fallback: fallback ?? null,
      settings: settings.results ?? [],
      now: new Date(),
    })
    return c.json({ success: true, data: facts })
  } catch (err) {
    return safeError(c, err, '소개서 숫자를 계산하지 못했습니다', '[proposal-facts]')
  }
})

export const adminProposalsRoutes = new Hono<{ Bindings: Env }>()

async function fromRelease(name: string): Promise<Response> {
  return fetch(PROPOSAL_RELEASE_BASE + name, {
    redirect: 'follow',
    // 덱은 하루 한 번 바뀐다 — 어드민이 탭을 오갈 때마다 GitHub 까지 가지 않게.
    cf: { cacheTtl: 300, cacheEverything: true },
  } as RequestInit)
}

adminProposalsRoutes.get('/proposals/manifest', async (c) => {
  try {
    const res = await fromRelease('manifest.json')
    if (!res.ok) return c.json({ success: false, code: 'NOT_BUILT', error: '자동 생성본이 아직 없습니다' }, 404)
    return c.json({ success: true, data: await res.json() })
  } catch (err) {
    return safeError(c, err, '자동 생성 기록을 읽지 못했습니다', '[admin-proposals]')
  }
})

adminProposalsRoutes.get('/proposals/file/:name', async (c) => {
  const name = c.req.param('name')
  if (!PROPOSAL_ASSET_NAME.test(name)) return c.json({ success: false, error: '허용되지 않는 파일입니다' }, 400)
  try {
    const res = await fromRelease(name)
    if (!res.ok || !res.body) return c.json({ success: false, code: 'NOT_BUILT', error: '자동 생성본이 아직 없습니다' }, 404)
    const type = name.endsWith('.pdf')
      ? 'application/pdf'
      : name.endsWith('.pptx')
        ? 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
        : 'application/json'
    return new Response(res.body, {
      headers: {
        'Content-Type': type,
        'Cache-Control': 'private, max-age=300',
        'Content-Disposition': `inline; filename="${name}"`,
      },
    })
  } catch (err) {
    return safeError(c, err, '소개서 파일을 읽지 못했습니다', '[admin-proposals]')
  }
})
