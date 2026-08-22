/**
 * ⭐ 어드민 개인 설정 라우트 (2026-08-22 대표 신고 — "즐겨찾기가 계속 초기화 돼")
 *
 * 즐겨찾기가 localStorage 에만 있어 기기·브라우저·시크릿창·사이트데이터삭제·오리진 전환마다
 * 사라졌다. 계정에 붙여 그 증상 자체를 없앤다. 저장 계층 배경: `worker/utils/admin-prefs.ts`.
 *
 * 🔒 IDOR: 대상 admin_id 를 **바디/쿼리에서 받지 않는다** — 토큰의 본인 id 만 쓴다.
 *    (받으면 어드민끼리 서로의 설정을 읽고 쓸 수 있다.)
 * 🔓 RBAC: `/api/admin/me/prefs/` 는 `isSelfServiceAdminPath` 로 열려 있다 — 읽기전용(viewer)도
 *    자기 메뉴는 고정할 수 있어야 한다(권한이 아니라 취향이다).
 */

import { cors } from 'hono/cors';
import type { D1Database } from '@cloudflare/workers-types';
import type { Hono } from 'hono';
import { requireAdmin } from '@/worker/middleware/auth';
import { safeError } from '@/worker/utils/safe-error';
import {
  ADMIN_PREF_KEYS,
  ADMIN_PREF_MAX_BYTES,
  getAdminPref,
  setAdminPref,
  type AdminPrefKey,
} from '@/worker/utils/admin-prefs';

/** 화이트리스트 밖 키는 저장하지 않는다 — 임의 키를 허용하면 테이블이 쓰레기통이 된다. */
function parsePrefKey(raw: string): AdminPrefKey | null {
  return (ADMIN_PREF_KEYS as readonly string[]).includes(raw) ? (raw as AdminPrefKey) : null;
}

/**
 * ⚠️ 제네릭을 `Hono<any>` 로 받는다. 호출부(`admin.routes.ts`)의 Bindings 타입은 그 파일 지역
 * 타입이라 여기서 재선언하면 **구조가 같아도 Hono 제네릭이 불변(invariant)이라 안 맞는다**.
 * 런타임 계약(`c.env.DB` 존재)은 호출부가 보장한다.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function registerAdminPrefRoutes(adminRoutes: Hono<any>): void {
  adminRoutes.get('/me/prefs/:key', cors(), requireAdmin() as any, async (c) => {
    const { DB } = c.env as { DB: D1Database };
    const user = (c as unknown as { get: (k: string) => unknown }).get('user') as { id?: string | number } | undefined;
    const adminId = Number(user?.id);
    if (!Number.isFinite(adminId) || adminId <= 0) return c.json({ success: false, error: 'Unauthorized' }, 401);
    const key = parsePrefKey(c.req.param('key'));
    if (!key) return c.json({ success: false, error: 'Unknown preference key' }, 400);
    try {
      const raw = await getAdminPref(DB, adminId, key);
      return c.json({ success: true, data: { key, value: raw ? JSON.parse(raw) : null } });
    } catch (e) {
      // ⚠️ fail-soft: 설정 조회 실패가 대시보드를 못 열게 하면 안 된다. 클라는 null 이면
      //    자기 localStorage 값을 그대로 쓴다(= 지금까지의 동작).
      return safeError(c, e, '설정을 불러오지 못했습니다', '[admin-prefs:get]');
    }
  });

  adminRoutes.put('/me/prefs/:key', cors(), requireAdmin() as any, async (c) => {
    const { DB } = c.env as { DB: D1Database };
    const user = (c as unknown as { get: (k: string) => unknown }).get('user') as { id?: string | number } | undefined;
    const adminId = Number(user?.id);
    if (!Number.isFinite(adminId) || adminId <= 0) return c.json({ success: false, error: 'Unauthorized' }, 401);
    const key = parsePrefKey(c.req.param('key'));
    if (!key) return c.json({ success: false, error: 'Unknown preference key' }, 400);
    let value: unknown;
    try {
      value = ((await c.req.json<{ value?: unknown }>()) || {}).value;
    } catch {
      return c.json({ success: false, error: 'Invalid JSON' }, 400);
    }
    if (key === 'nav_pins') {
      // 즐겨찾기는 "경로 문자열 배열"이다. 형태를 서버에서 강제한다 — 클라가 보낸 것을 그대로
      // 저장하면 다음 로드에서 렌더가 터진다(그 화면이 곧 대시보드 전체다).
      if (!Array.isArray(value) || value.some((v) => typeof v !== 'string' || !v.startsWith('/admin'))) {
        return c.json({ success: false, error: 'nav_pins 는 /admin 으로 시작하는 문자열 배열이어야 합니다' }, 400);
      }
      if (value.length > 40) return c.json({ success: false, error: '즐겨찾기는 최대 40개입니다' }, 400);
    }
    const serialized = JSON.stringify(value);
    if (serialized.length > ADMIN_PREF_MAX_BYTES) {
      return c.json({ success: false, error: '설정 값이 너무 큽니다' }, 400);
    }
    try {
      await setAdminPref(DB, adminId, key, serialized);
      return c.json({ success: true });
    } catch (e) {
      return safeError(c, e, '설정을 저장하지 못했습니다', '[admin-prefs:put]');
    }
  });
}
