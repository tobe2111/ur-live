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
 * 🏠 2026-08-04 (대표 시안 승인 "좋다 이렇게 가자"): 홈 쇼케이스용 `banner_type`·`video_url` 추가.
 *   자리(히어로/중간/와이드)를 배너 행이 스스로 알고 있어야 홈이 "무엇을 어디에 그릴지"를
 *   조회 한 번으로 정한다. 종류 SSOT: `shared/constants/home-showcase.ts`.
 */

import { Hono } from 'hono';
import { safeError } from '../../../worker/utils/safe-error';
import { isBannerType, DEFAULT_BANNER_TYPE } from '../../../shared/constants/home-showcase';

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
    `ALTER TABLE banners ADD COLUMN banner_type TEXT DEFAULT '${DEFAULT_BANNER_TYPE}'`,
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

    // 🎯 자리 필터. 값이 이상하면 무시하고 전체를 준다 — 홈이 빈손이 되는 것보다 낫다.
    const typeRaw = (c.req.query('type') || '').trim();
    const typeFilter = isBannerType(typeRaw) ? typeRaw : '';

    // ⚠️ `COALESCE(banner_type, 기본값)` — 이 컬럼이 생기기 **전에 등록된 배너**는 NULL 이라
    //   그냥 `banner_type = ?` 로 거르면 옛 배너가 전부 사라진다(조용한 회귀).
    const typeWhere = typeFilter ? `AND COALESCE(banner_type, ?) = ?` : '';
    const typeBind: string[] = typeFilter ? [DEFAULT_BANNER_TYPE, typeFilter] : [];

    const banners = await DB.prepare(`
      SELECT id, title, image_url, video_url, link_url, description,
             COALESCE(banner_type, ?) AS banner_type,
             display_order, start_date, end_date
      FROM banners
      WHERE is_active = 1
        AND (start_date IS NULL OR start_date <= ?)
        AND (end_date IS NULL OR end_date >= ?)
        ${typeWhere}
      ORDER BY display_order ASC, created_at DESC
    `).bind(DEFAULT_BANNER_TYPE, now, now, ...typeBind).all();

    // 브라우저는 짧게, 엣지는 길게 — 배너는 분 단위로 안 바뀐다.
    c.header('Cache-Control', 'public, max-age=60');
    c.header('CDN-Cache-Control', 'public, max-age=300');
    return c.json({ success: true, data: banners.results });
  } catch (err) {
    return safeError(c, err, '요청 처리 중 오류가 발생했습니다', '[banners]');
  }
});
