/**
 * Banners API Routes (공개용)
 *
 * app.route('/api/banners', bannerRoutes) 에 등록됨.
 * ⚠️ 이 파일 내부 경로에 /api/banners 를 절대 포함하지 말 것 (더블 prefix 방지).
 *
 * Endpoints:
 * - GET /api/banners           - 활성 배너 목록 (공개)
 * - GET /api/banners?type=hero - 자리별 필터 (hero | inline | wide)
 *
 * 관리자용 배너 CRUD (GET all / POST / PUT / DELETE) →
 *   adminBannersRoutes → app.route('/api/admin/banners', adminBannersRoutes)
 *
 * 🏠 2026-08-04: 홈 쇼케이스용 `banner_slot`(자리)·`video_url` 추가.
 *   자리를 배너 행이 스스로 알고 있어야 홈이 "무엇을 어디에 그릴지" 조회 한 번으로 정한다.
 *   🔴 **자리 미지정(NULL)은 홈에 안 뜬다** — 기본값 없는 컬럼이라 기존 배너는 전부 미지정이다.
 *   (직전 판 `banner_type` 은 `DEFAULT 'inline'` 이라 **옛 배너가 저절로 홈에 나타났다** — 대표 신고.)
 *   SSOT: `shared/constants/home-showcase.ts`.
 */

import { Hono } from 'hono';
import { safeError } from '../../../worker/utils/safe-error';
import { isBannerSlot } from '../../../shared/constants/home-showcase';

type Bindings = {
  DB: D1Database;
};

export const bannerRoutes = new Hono<{ Bindings: Bindings }>();

/**
 * 컬럼 보강 — 핸들러 안에서 매 요청 ALTER 하지 않도록 WeakSet 메모이즈
 * (CLAUDE.md 머니/정합성 룰: per-request DDL 금지).
 * 컬럼이 이미 있으면 ALTER 가 던지고 그걸 삼킨다 — 이 레포의 기존 패턴이다.
 */
const _bannerColsReady = new WeakSet<D1Database>();
export async function ensureBannerColumns(DB: D1Database): Promise<void> {
  if (_bannerColsReady.has(DB)) return;
  _bannerColsReady.add(DB);
  for (const sql of [
    // ⚠️ **DEFAULT 를 주지 않는다.** SQLite 는 ADD COLUMN 의 기본값을 기존 행에도 적용하므로,
    //    기본값이 있으면 예전에 올려둔 배너가 전부 그 자리를 차지한 것으로 읽힌다(실제 사고).
    `ALTER TABLE banners ADD COLUMN banner_slot TEXT`,
    `ALTER TABLE banners ADD COLUMN video_url TEXT`,
  ]) {
    try { await DB.prepare(sql).run(); } catch { /* 이미 있음 */ }
  }
}

// GET /api/banners — 활성 배너 목록 (공개)
bannerRoutes.get('/', async (c) => {
  const { DB } = c.env;

  try {
    await ensureBannerColumns(DB);
    const now = new Date().toISOString();

    // 🎯 자리 필터. 값이 이상하면 무시하고 전체를 준다(기존 배너 캐러셀 같은 무필터 소비자 보호).
    const slotRaw = (c.req.query('type') || '').trim();
    const slotFilter = isBannerSlot(slotRaw) ? slotRaw : '';

    // 🔴 **엄격 일치**. 자리를 안 고른 배너(NULL)는 어떤 슬롯에도 안 뜬다 —
    //    COALESCE 로 기본값을 씌우면 옛 배너가 저절로 홈에 나타난다(2026-08-04 실사고).
    const slotWhere = slotFilter ? `AND banner_slot = ?` : '';
    const slotBind: string[] = slotFilter ? [slotFilter] : [];

    const banners = await DB.prepare(`
      SELECT id, title, image_url, video_url, link_url, description,
             banner_slot, display_order, start_date, end_date
      FROM banners
      WHERE is_active = 1
        AND (start_date IS NULL OR start_date <= ?)
        AND (end_date IS NULL OR end_date >= ?)
        ${slotWhere}
      ORDER BY display_order ASC, created_at DESC
    `).bind(now, now, ...slotBind).all();

    // 브라우저는 짧게, 엣지는 길게 — 배너는 분 단위로 안 바뀐다.
    c.header('Cache-Control', 'public, max-age=60');
    c.header('CDN-Cache-Control', 'public, max-age=300');
    return c.json({ success: true, data: banners.results });
  } catch (err) {
    return safeError(c, err, '요청 처리 중 오류가 발생했습니다', '[banners]');
  }
});
