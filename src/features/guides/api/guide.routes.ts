/**
 * Operation Guide Routes — admin editable, role-scoped read access
 *
 * 🛡️ 2026-04-23 배치 174: 어드민/셀러/에이전시 3종 운영 가이드
 *
 * - 어드민만 수정 가능 (PATCH)
 * - 각 역할은 자기 가이드만 조회 가능 + 어드민은 전체 조회 가능
 * - 최초 배포 시 자동 시드 (sections 비어있으면 seedDefaults 실행)
 */
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import type { Env } from '@/worker/types/env'
import { safeError } from '@/worker/utils/safe-error';
import { swallow } from '@/worker/utils/swallow';
import { executeQuery } from '@/worker/utils/database'
import { loadSeedAsset, isGuideSeed, SEED_ASSET_PATHS, type SeedAssetEnv } from '../../../worker/utils/seed-assets'
// 🛡️ 2026-05-18: GUIDE_SEEDS (87KB) 는 dynamic import — 본 모듈에 정적 포함 X (worker bundle 축소).

export const guideRoutes = new Hono<{ Bindings: Env }>()

// 🔄 2026-07-11: 가이드 시드 콘텐츠 버전 — 블로그 BLOG_SEED_VERSION 메커니즘 미러.
//   guide-seed-*.ts 내용을 바꾸면 이 숫자를 **같은 커밋에서** +1 하세요.
//   올리면 배포 후 첫 가이드 접근 시 maybeSyncGuideSeed 가 라이브 DB 에 자동 반영:
//   신규 섹션 INSERT + 시드 관리 섹션(manually_edited=0) 최신화. 관리자가
//   /admin/operations-guide 에서 직접 수정/생성한 섹션(manually_edited=1)은 절대 안 덮어씀.
//   v1 = 암묵적 레거시(버전 미저장, ensureSeeded '0행일 때만' 시대) / v2 = 버전 메커니즘 도입.
//   v4 = 2026-07-12 체험 캠페인(어드민 대행생성·추첨·비정산) + 조건부 우대 커미션(셀러) 섹션.
//   v5 = 2026-07-13 상권 쿠폰(영수증 페이백) 운영 섹션 — 양 트랙 머지 통합 bump.
const GUIDE_SEED_VERSION = 21 // 2026-08-31 한정 해동 — 백필에 얼어붙어 시드가 못 닿던 섹션 13개(실측 대조)
// (이전) 20 // 2026-08-31 운영백서에 '무상 딜은 누가 내나' + 후기 보너스(매장이 금액 설정) 절 추가
// (이전) 18 // 2026-08-26 셀러·어드민 가이드 사실 갱신 — 폐기 기능(라이브·호스팅·어필리에이트·승급) 현행화 + 신분어 → 행위

// 🏭 2026-06-07: 'wholesale' 추가 — 도매몰 전용 가이드. 어드민 전용(읽기+편집).
type GuideType = 'admin' | 'seller' | 'agency' | 'wholesale'

const VALID_GUIDE_TYPES: GuideType[] = ['admin', 'seller', 'agency', 'wholesale']

interface GuideSection {
  id?: number
  guide_type: GuideType
  section_key: string
  section_icon: string
  section_title: string
  section_order: number
  content_md: string
  updated_at?: string
}

async function requireRole(c: any, roles: string[]): Promise<{ id: number; type: string } | null> {
  const auth = c.req.header('Authorization')
  if (!auth?.startsWith('Bearer ')) return null
  try {
    const { verify } = await import('hono/jwt')
    const payload = await verify(auth.slice(7), c.env.JWT_SECRET, 'HS256') as { id?: number; type?: string }
    if (payload?.type && roles.includes(payload.type)) return { id: payload.id || 0, type: payload.type }
    return null
  } catch { return null }
}

async function ensureSeeded(DB: D1Database, guideType: GuideType, env?: SeedAssetEnv): Promise<void> {
  if (_done_ensureSeeded.has(DB)) return
  _done_ensureSeeded.add(DB)
  const existing = await DB.prepare(
    'SELECT COUNT(*) as n FROM operation_guides WHERE guide_type = ?'
  ).bind(guideType).first<{ n: number }>()
  if ((existing?.n ?? 0) > 0) return

  // 🌱 2026-08-19: 시드 산문(209KB)을 워커 번들에서 빼 **정적 자산**으로 읽는다(무료 압축 1MB 한도).
  //   못 읽으면 아무것도 넣지 않는다 — 빈 시드로 채우면 '있는데 비어 있는' 가이드가 된다.
  const GUIDE_SEEDS = await loadSeedAsset(env, SEED_ASSET_PATHS.guides, isGuideSeed)
  if (!GUIDE_SEEDS) { _done_ensureSeeded.delete(DB); return }  // 메모 해제 → 다음 요청에서 재시도
  const seed = GUIDE_SEEDS[guideType] || []
  for (const s of seed) {
    try {
      await DB.prepare(
        `INSERT OR IGNORE INTO operation_guides
         (guide_type, section_key, section_icon, section_title, section_order, content_md, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`
      ).bind(guideType, s.key, s.icon, s.title, s.order, s.content).run()
    } catch { /* non-critical */ }
  }
}

// ── 수동편집 보존 컬럼 인라인 ensure (blog_posts.manually_edited 미러) ──
//   구 프로덕션 테이블엔 없을 수 있어 ALTER 를 fail-soft 로 시도. repair-schema 에도 등록됨.
async function ensureGuideEditColumn(DB: D1Database): Promise<void> {
  if (_done_ensureGuideEditColumn.has(DB)) return
  _done_ensureGuideEditColumn.add(DB)
  await DB.prepare(
    'ALTER TABLE operation_guides ADD COLUMN manually_edited INTEGER DEFAULT 0'
  ).run().catch(swallow('guides:ensure-manually-edited'))
}

// ── 🔄 버전 재시드 — 시드↔DB 자동 동기화 (blog maybeSyncBlogSeed 미러) ──
//   코드의 GUIDE_SEED_VERSION > DB 저장 버전(platform_settings 'guide_seed_version')이면:
//   (a) 최초 1회 보수적 백필, (b) 신규 섹션 INSERT, (c) manually_edited=0 섹션 시드 최신화.
//   ❗ 아무것도 DELETE 하지 않음 — 시드에서 빠진 섹션은 그대로 둠(가이드는 블로그 글처럼
//   '낡아서 은퇴'가 아니라 운영자가 큐레이션하는 문서 — 정리는 관리자 DELETE/reseed 로).
/**
 * @returns 실제로 동기화했으면 true. **false 면 호출부는 guide_seed_version 을 올리면 안 된다** —
 *   올리면 다음부터 "이미 최신"으로 판단해 재시드를 영영 건너뛴다(라이브 가이드가 조용히 낡는다).
 */
async function syncGuideSeed(DB: D1Database, firstRun: boolean, env?: SeedAssetEnv): Promise<boolean> {
  // ⚠️ 보수적 백필 (최초 버전-동기화 1회만): 기존 프로덕션 행들엔 수동 편집 여부를 구분할
  //   방법이 없음(컬럼이 지금 생겼으므로). 안전하게 **현재 라이브 내용 전부를 수동편집으로 간주**
  //   (auto-reference 는 기계 생성이라 제외) → 지금 라이브에 있는 문구는 아무것도 안 덮어씀.
  //   트레이드오프: 기존 섹션들은 이번 버전 시드로 자동 갱신되지 않음(신규 섹션 INSERT 는 됨).
  //   기존 섹션까지 시드로 되돌리려면 관리자 강제 리셋(POST /:type/reseed) 사용.
  //   이후(v2+)부터는 관리자가 실제로 편집한 섹션만 manually_edited=1 이 되어 정상 거버넌스.
  if (firstRun) {
    await DB.prepare(
      `UPDATE operation_guides SET manually_edited = 1 WHERE section_key != 'auto-reference'`
    ).run().catch(swallow('guides:seed-sync:backfill'))
  }

  // 🔓 **한정 해동** (2026-08-31 — 라이브 실측으로 발견).
  //   위 보수적 백필은 컬럼이 생기던 날 존재하던 **모든** 섹션을 '수동편집'으로 간주했다.
  //   아무도 편집하지 않은 섹션까지 그날로 얼어붙었고, 그래서 **영구 중단된 라이브커머스의
  //   OBS 설정법**이 셀러 가이드에 그대로 살아 있었다 — 시드에서 '종료됨'으로 바꿔도 안 닿는다.
  //   (2026-08-31 배포 후 확인: 신규·해동 섹션은 갱신됐는데 이 셋만 2026-04-27 상태였다.)
  //
  //   ⚠️ **키를 명시한 것만** 되돌린다. 전체 해동은 관리자가 진짜로 편집한 문구까지 날린다.
  //   ⚠️ 1회만 — 마커가 있으면 건너뛴다. 이후 관리자가 이 섹션을 편집하면 그 편집이 이긴다.
  const UNFREEZE_MARKER = 'guide_unfreeze_2026_08_31'
  const unfrozen = await DB.prepare(`SELECT value FROM platform_settings WHERE key = ?`)
    .bind(UNFREEZE_MARKER).first<{ value: string }>().catch(() => null)
  if (!unfrozen) {
    //   목록은 **추측이 아니라 실측**이다 — 2026-08-31 배포 직후 라이브 본문과 빌드된 시드 자산
    //   (dist/client/seed/guides.json)을 섹션 단위로 대조해, 본문이 실제로 갈린 것만 골랐다.
    //   ⚠️ **라이브가 시드보다 긴 것은 뺐다**(admin 'deploy', wholesale 'overview') —
    //      누군가 내용을 더한 흔적이라 시드로 되돌리면 그 사람의 작업이 사라진다.
    //   ⚠️ 'auto-reference' 는 기계 생성이라 애초에 백필에서 제외돼 있다(여기에도 넣지 않는다).
    const UNFREEZE_ONCE: Array<[GuideType, string]> = [
      ['seller', 'live-broadcast'],   // 종료된 기능의 OBS 설정법 (라이브 2254자 / 시드 232자)
      ['seller', 'live-mastery'],     // 종료된 기능의 운영 노하우 (2225 / 232)
      ['seller', 'welcome'],          // (487 / 907)
      ['seller', 'settlement'],       // (582 / 1122)
      ['admin', 'daily'],             // 낡은 일일 체크리스트 (484 / 544)
      ['admin', 'overview'],          // (435 / 465)
      ['admin', 'seller-ops'],        // (479 / 607)
      ['admin', 'agency-ops'],        // (951 / 1329)
      ['admin', 'settlement'],        // 정산 문서가 라이브엔 5분의 1만 있다 (476 / 2195)
      ['admin', 'moderation'],        // (430 / 880)
      ['admin', 'promo'],             // (539 / 2140)
      ['admin', 'legal'],             // (544 / 1064)
      ['wholesale', 'pricing-grades'],// (1452 / 1981)
    ]
    for (const [t, k] of UNFREEZE_ONCE) {
      await DB.prepare(
        `UPDATE operation_guides SET manually_edited = 0 WHERE guide_type = ? AND section_key = ?`
      ).bind(t, k).run().catch(swallow('guides:seed-sync:unfreeze'))
    }
    await DB.prepare(
      `INSERT INTO platform_settings (key, value, updated_at) VALUES (?, 'done', datetime('now'))
       ON CONFLICT(key) DO NOTHING`
    ).bind(UNFREEZE_MARKER).run().catch(swallow('guides:seed-sync:unfreeze-marker'))
  }

  const GUIDE_SEEDS = await loadSeedAsset(env, SEED_ASSET_PATHS.guides, isGuideSeed)
  if (!GUIDE_SEEDS) return false
  for (const type of VALID_GUIDE_TYPES) {
    const seed = GUIDE_SEEDS[type] || []
    for (const s of seed) {
      // 신규 섹션 삽입 (이미 있으면 no-op — UNIQUE(guide_type, section_key))
      await DB.prepare(
        `INSERT OR IGNORE INTO operation_guides
         (guide_type, section_key, section_icon, section_title, section_order, content_md, manually_edited, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 0, datetime('now'))`
      ).bind(type, s.key, s.icon, s.title, s.order, s.content).run().catch(swallow('guides:seed-sync:insert'))
      // 시드 관리 섹션(수동편집 안 됨)만 최신 시드 내용으로 갱신
      await DB.prepare(
        `UPDATE operation_guides
         SET section_icon = ?, section_title = ?, section_order = ?, content_md = ?, updated_at = datetime('now')
         WHERE guide_type = ? AND section_key = ? AND COALESCE(manually_edited, 0) = 0
           AND (section_title != ? OR content_md != ? OR section_icon != ? OR section_order != ?)`
      ).bind(s.icon, s.title, s.order, s.content, type, s.key, s.title, s.content, s.icon, s.order)
        .run().catch(swallow('guides:seed-sync:update'))
    }
  }
  return true
}

// 버전 게이트: 코드 시드 버전 > DB 저장 버전일 때만 동기화 (isolate 당 1회 메모 — blog 미러).
// fail-soft — 동기화 실패가 가이드 조회를 절대 막지 않음(다음 요청에서 재시도).
let _guideSeedSyncedVersion = -1
async function maybeSyncGuideSeed(DB: D1Database, env?: SeedAssetEnv): Promise<void> {
  if (_guideSeedSyncedVersion >= GUIDE_SEED_VERSION) return
  try {
    await ensureGuideEditColumn(DB)
    const row = await DB.prepare(
      `SELECT value FROM platform_settings WHERE key = 'guide_seed_version'`
    ).first<{ value: string }>().catch(() => null)
    const stored = row ? Number(row.value) || 0 : 0
    if (stored < GUIDE_SEED_VERSION) {
      // ⚠️ 시드 자산을 못 읽었으면 버전을 올리지 않는다 — 다음 요청에서 재시도.
      const synced = await syncGuideSeed(DB, !row, env)
      if (!synced) return
      await DB.prepare(
        `INSERT INTO platform_settings (key, value, updated_at)
         VALUES ('guide_seed_version', ?, datetime('now'))
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`
      ).bind(String(GUIDE_SEED_VERSION)).run().catch(swallow('guides:seed-sync:version'))
    }
    _guideSeedSyncedVersion = GUIDE_SEED_VERSION
  } catch (err) {
    // 동기화 실패가 가이드 서빙을 막지 않도록 — 로그만 남기고 다음 요청에서 재시도
    console.error('[guides:seed-sync]', err)
  }
}

// ── GET /api/guides/:type — 역할별 가이드 조회 (읽기) ─────────────
guideRoutes.get('/:type', cors(), async (c) => {
  const type = c.req.param('type') as GuideType
  if (!VALID_GUIDE_TYPES.includes(type)) {
    return c.json({ success: false, error: 'Invalid guide type' }, 400)
  }

  // 권한 체크: 어드민은 모두 / 셀러는 seller / 에이전시는 agency / 도매몰은 어드민 전용
  const allowedRoles: Record<GuideType, string[]> = {
    admin: ['admin'],
    seller: ['admin', 'seller'],
    agency: ['admin', 'agency'],
    wholesale: ['admin'],
  }
  const user = await requireRole(c, allowedRoles[type])
  if (!user) return c.json({ success: false, error: '인증이 필요합니다' }, 401)

  try {
    await ensureSeeded(c.env.DB, type, c.env as unknown as SeedAssetEnv)
    // 🔄 버전 재시드: 코드의 시드 버전이 DB 보다 높으면 자동 반영(수동편집 섹션 보존). fail-soft.
    await maybeSyncGuideSeed(c.env.DB, c.env as unknown as SeedAssetEnv)
    const rows = await executeQuery<GuideSection>(c.env.DB,
      `SELECT id, guide_type, section_key, section_icon, section_title, section_order, content_md, updated_at
       FROM operation_guides WHERE guide_type = ? ORDER BY section_order ASC`,
      [type]
    )
    return c.json({ success: true, data: rows })
  } catch (err) {
    return safeError(c, err, '요청 처리 중 오류가 발생했습니다', '[guide]')
  }
})

// ── PATCH /api/guides/:type/:sectionKey — 관리자 전용 수정 ────────
guideRoutes.patch('/:type/:sectionKey', async (c) => {
  const type = c.req.param('type') as GuideType
  const sectionKey = c.req.param('sectionKey')
  if (!VALID_GUIDE_TYPES.includes(type)) {
    return c.json({ success: false, error: 'Invalid guide type' }, 400)
  }

  const user = await requireRole(c, ['admin'])
  if (!user) return c.json({ success: false, error: '관리자만 수정 가능합니다' }, 403)

  try {
    const body = await c.req.json<{
      section_title?: string
      section_icon?: string
      section_order?: number
      content_md?: string
    }>()

    // 🔄 수동편집 플래그 컬럼 보장 (구 프로덕션 테이블 대비, fail-soft)
    await ensureGuideEditColumn(c.env.DB)

    // 섹션 존재 확인
    const existing = await c.env.DB.prepare(
      'SELECT id FROM operation_guides WHERE guide_type = ? AND section_key = ?'
    ).bind(type, sectionKey).first<{ id: number }>()

    if (!existing) {
      // 신규 섹션 생성 — 관리자 직접 생성 = 수동편집(manually_edited=1) → 버전 재시드가 안 덮어씀
      if (!body.section_title || !body.content_md) {
        return c.json({ success: false, error: 'section_title, content_md 필수' }, 400)
      }
      await c.env.DB.prepare(
        `INSERT INTO operation_guides
         (guide_type, section_key, section_icon, section_title, section_order, content_md, manually_edited, updated_by, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 1, ?, datetime('now'))`
      ).bind(type, sectionKey, body.section_icon || '📄', body.section_title,
             body.section_order ?? 999, body.content_md, user.id).run()
      return c.json({ success: true, message: '섹션이 생성되었습니다' }, 201)
    }

    // 관리자 수정 = 수동편집으로 표시 → 이후 버전 재시드해도 이 섹션은 덮어쓰지 않음
    const sets: string[] = ['updated_at = datetime(\'now\')', 'updated_by = ?', 'manually_edited = 1']
    const params: unknown[] = [user.id]
    if (body.section_title !== undefined) { sets.push('section_title = ?'); params.push(body.section_title) }
    if (body.section_icon !== undefined) { sets.push('section_icon = ?'); params.push(body.section_icon) }
    if (body.section_order !== undefined) { sets.push('section_order = ?'); params.push(body.section_order) }
    if (body.content_md !== undefined) { sets.push('content_md = ?'); params.push(body.content_md) }
    params.push(type, sectionKey)

    await c.env.DB.prepare(
      `UPDATE operation_guides SET ${sets.join(', ')} WHERE guide_type = ? AND section_key = ?`
    ).bind(...params).run()
    return c.json({ success: true, message: '저장되었습니다' })
  } catch (err) {
    return safeError(c, err, '요청 처리 중 오류가 발생했습니다', '[guide]')
  }
})

// ── DELETE /api/guides/:type/:sectionKey — 관리자 전용 삭제 ───────
guideRoutes.delete('/:type/:sectionKey', async (c) => {
  const type = c.req.param('type') as GuideType
  const sectionKey = c.req.param('sectionKey')

  const user = await requireRole(c, ['admin'])
  if (!user) return c.json({ success: false, error: '관리자만 삭제 가능합니다' }, 403)

  try {
    await c.env.DB.prepare(
      'DELETE FROM operation_guides WHERE guide_type = ? AND section_key = ?'
    ).bind(type, sectionKey).run()
    return c.json({ success: true, message: '삭제되었습니다' })
  } catch (err) {
    return safeError(c, err, '요청 처리 중 오류가 발생했습니다', '[guide]')
  }
})

// ── POST /api/guides/:type/reseed — 관리자 전용 강제 리셋 (해당 type 전체 교체) ──
// 🏁 2026-06-17: guide-seed-*.ts 내용을 기존 DB 에 반영하는 운영 도구.
// 🔄 2026-07-11 역할 재정의: 일상적 시드 반영은 GUIDE_SEED_VERSION 버전 재시드가 자동 처리
//   (수동 편집 보존). 이 엔드포인트는 **수동 편집까지 초기화하는 강제 리셋** —
//   해당 guide_type 전체 DELETE 후 시드에서 재삽입(전부 시드 관리 상태로 복귀).
//   ⚠️ 관리자 수동 편집분도 덮어씀 → body { confirm: true } 필수(footgun 가드).
guideRoutes.post('/:type/reseed', async (c) => {
  const type = c.req.param('type') as GuideType
  if (!VALID_GUIDE_TYPES.includes(type)) {
    return c.json({ success: false, error: 'Invalid guide type' }, 400)
  }
  const user = await requireRole(c, ['admin'])
  if (!user) return c.json({ success: false, error: '관리자만 재시드 가능합니다' }, 403)

  try {
    const body = await c.req.json<{ confirm?: boolean }>().catch(() => ({} as { confirm?: boolean }))
    if (!body?.confirm) {
      return c.json({ success: false, error: '재시드는 기존 가이드 내용을 전부 교체합니다. { "confirm": true } 로 다시 요청하세요.' }, 400)
    }

    const GUIDE_SEEDS = await loadSeedAsset(c.env as unknown as SeedAssetEnv, SEED_ASSET_PATHS.guides, isGuideSeed)
    if (!GUIDE_SEEDS) {
      return c.json({ success: false, error: '시드 자산(seed/guides.json)을 읽지 못했습니다 — 배포 산출물을 확인하세요' }, 503)
    }
    const seed = GUIDE_SEEDS[type] || []
    if (seed.length === 0) {
      return c.json({ success: false, error: '해당 type 의 시드가 없습니다' }, 400)
    }

    await ensureGuideEditColumn(c.env.DB)
    // 버전-동기화를 먼저 완주 — 최초 실행(버전키 부재)이라면 여기서 전 type 보수적 백필이 돌아야
    // 아래의 버전 저장이 다른 type 들의 백필 기회를 건너뛰지 않음.
    await maybeSyncGuideSeed(c.env.DB, c.env as unknown as SeedAssetEnv)
    await c.env.DB.prepare('DELETE FROM operation_guides WHERE guide_type = ?').bind(type).run()
    let inserted = 0
    for (const s of seed) {
      try {
        // manually_edited=0 — 강제 리셋 후엔 전부 시드 관리 상태(이후 버전 재시드가 최신화)
        await c.env.DB.prepare(
          `INSERT INTO operation_guides
           (guide_type, section_key, section_icon, section_title, section_order, content_md, manually_edited, updated_by, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, 0, ?, datetime('now'))`
        ).bind(type, s.key, s.icon, s.title, s.order, s.content, user.id).run()
        inserted++
      } catch { /* skip bad section */ }
    }
    _done_ensureSeeded.delete(c.env.DB)
    // 저장 버전을 현재 코드 버전으로 — 다음 GET 의 maybeSyncGuideSeed 가 (버전키 부재 시의)
    // 보수적 백필로 방금 리셋한 시드 행들을 수동편집으로 오표시하지 않게 함.
    await c.env.DB.prepare(
      `INSERT INTO platform_settings (key, value, updated_at)
       VALUES ('guide_seed_version', ?, datetime('now'))
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`
    ).bind(String(GUIDE_SEED_VERSION)).run().catch(swallow('guides:reseed:version'))
    return c.json({ success: true, message: `${type} 가이드 ${inserted}개 섹션 재시드 완료`, inserted })
  } catch (err) {
    return safeError(c, err, '재시드 중 오류가 발생했습니다', '[guide]')
  }
})

export default guideRoutes


// 🛡️ 2026-05-19: ensure* per-worker 메모이제이션 (파일 끝).
const _done_ensureSeeded = new WeakSet<object>()
const _done_ensureGuideEditColumn = new WeakSet<object>()
