/**
 * Admin Streams + Alimtalk Routes — 라이브 스트림 + 알림톡 관리
 *
 * 🛡️ 2026-04-22 배치 150 (TD-006 부분): admin-management.routes.ts 에서 분리.
 *
 * 엔드포인트:
 * - POST   /streams/replay         — 다시보기 영상 생성
 * - GET    /streams                — 전체 스트림 목록
 * - PUT    /streams/:id            — 스트림 수정
 * - DELETE /streams/:id            — 스트림 삭제
 * - GET    /alimtalk/pricing       — 패키지 목록
 * - POST   /alimtalk/pricing       — 새 패키지
 * - PUT    /alimtalk/pricing/:id   — 패키지 수정
 * - GET    /alimtalk/accounts      — 셀러별 크레딧 현황
 * - GET    /alimtalk/statistics    — 발송 통계
 */
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Env } from '@/worker/types/env';
import { executeQuery } from '@/worker/utils/database';
import type { D1Database } from '@cloudflare/workers-types';
// 💰 2026-08-10 알림톡 원가·마진 SSOT — 원가는 platform_settings, 판매가는 alimtalk_packages(분리).
import {
  ALIMTALK_COST_SETTING_KEYS, DEFAULT_ALIMTALK_UNIT_COST_KRW, DEFAULT_FRIENDTALK_UNIT_COST_KRW,
  parseUnitCost, computeAlimtalkMargin,
} from '@/shared/alimtalk-pricing';

export const adminStreamsRoutes = new Hono<{ Bindings: Env }>();

function safeAdminError(err: unknown, env: Env): string {
  const isProd = (env as Env & { ENVIRONMENT?: string }).ENVIRONMENT === 'production';
  if (isProd) return 'Internal server error';
  return err instanceof Error ? err.message : String(err);
}

interface IdRow { id: number }

// ─── 라이브 스트림 관리 ──────────────────────────────────────────

adminStreamsRoutes.post('/streams/replay', cors(), async (c) => {
  try {
    const { DB } = c.env;
    const { seller_id, title, description, youtube_url, product_ids } = await c.req.json<{
      seller_id: number; title: string; description?: string; youtube_url: string; product_ids?: number[];
    }>();

    if (!seller_id || !title || !youtube_url) {
      return c.json({ success: false, error: '셀러, 제목, YouTube URL은 필수입니다' }, 400);
    }

    // 🛡️ 2026-04-29 보안 audit (TD-016 HIGH): 입력 검증 — 길이/배열 크기/null-byte.
    if (typeof title !== 'string' || title.length === 0 || title.length > 200) {
      return c.json({ success: false, error: '제목은 1~200자여야 합니다' }, 400);
    }
    if (description !== undefined && description !== null && (typeof description !== 'string' || description.length > 5000)) {
      return c.json({ success: false, error: '설명은 5000자 이내여야 합니다' }, 400);
    }
    if (typeof youtube_url !== 'string' || youtube_url.length > 500 || /[\n\r\0]/.test(youtube_url)) {
      return c.json({ success: false, error: '유효하지 않은 YouTube URL' }, 400);
    }
    if (product_ids !== undefined && (!Array.isArray(product_ids) || product_ids.length > 50)) {
      return c.json({ success: false, error: '상품은 최대 50개까지 연결 가능합니다' }, 400);
    }

    let videoId = youtube_url;
    const urlMatch = youtube_url.match(/(?:youtube\.com\/(?:watch\?v=|live\/|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    if (urlMatch) videoId = urlMatch[1];

    const seller = await DB.prepare('SELECT id, name FROM sellers WHERE id = ?').bind(seller_id).first();
    if (!seller) return c.json({ success: false, error: '셀러를 찾을 수 없습니다' }, 404);

    const result = await DB.prepare(`
      INSERT INTO live_streams (seller_id, title, description, youtube_video_id, status, ended_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'ended', datetime('now'), datetime('now'), datetime('now'))
    `).bind(seller_id, title, description || null, videoId).run();

    const streamId = result.meta.last_row_id;

    if (product_ids && product_ids.length > 0) {
      try {
        await DB.prepare(`CREATE TABLE IF NOT EXISTS stream_products (id INTEGER PRIMARY KEY AUTOINCREMENT, stream_id INTEGER NOT NULL, product_id INTEGER NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, UNIQUE(stream_id, product_id))`).run();
      } catch {}

      await DB.batch(product_ids.map(pid =>
        DB.prepare('INSERT OR IGNORE INTO stream_products (stream_id, product_id) VALUES (?, ?)').bind(streamId, pid)
      ));
    }

    return c.json({ success: true, data: { id: streamId, youtube_video_id: videoId } }, 201);
  } catch (err) {
    return c.json({ success: false, error: safeAdminError(err, c.env) }, 500);
  }
});

adminStreamsRoutes.get('/streams', cors(), async (c) => {
  try {
    const { DB } = c.env;
    // 🛡️ 2026-06-17: 소프트 삭제(deleted_at) 스트림은 관리 목록에서 제외 — 삭제(단건/일괄) 후
    //   행이 실제로 사라지도록. status CHECK 제약상 'deleted' 를 못 쓰므로 deleted_at 으로 표시.
    await ensureStreamDeletedAt(DB);
    const status = c.req.query('status') || '';
    const conditions: string[] = ['ls.deleted_at IS NULL'];
    const params: unknown[] = [];
    if (status) { conditions.push('ls.status = ?'); params.push(status); }
    const sql = `SELECT ls.*, s.name AS seller_name FROM live_streams ls
       LEFT JOIN sellers s ON s.id = ls.seller_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY ls.created_at DESC LIMIT 100`;
    const { results } = await DB.prepare(sql).bind(...params).all();
    return c.json({ success: true, data: results || [] });
  } catch (err) {
    return c.json({ success: false, error: safeAdminError(err, c.env) }, 500);
  }
});

adminStreamsRoutes.put('/streams/:id', cors(), async (c) => {
  try {
    const { DB } = c.env;
    const id = c.req.param('id');
    const body = await c.req.json<{ title?: string; description?: string; youtube_video_id?: string; status?: string; product_ids?: number[] }>();

    const updates: string[] = [];
    const vals: unknown[] = [];
    if (body.title) { updates.push('title = ?'); vals.push(body.title); }
    if (body.description !== undefined) { updates.push('description = ?'); vals.push(body.description); }
    if (body.youtube_video_id) { updates.push('youtube_video_id = ?'); vals.push(body.youtube_video_id); }
    if (body.status) {
      // 🛡️ 2026-06-04 (P5 fix): CHECK 는 ('scheduled','live','ended') 만 허용 — 검증 없이 쓰면 CHECK 위반 500.
      const st = body.status === 'completed' ? 'ended' : body.status;
      if (!['scheduled', 'live', 'ended'].includes(st)) {
        return c.json({ success: false, error: '유효하지 않은 방송 상태입니다' }, 400);
      }
      updates.push('status = ?'); vals.push(st); if (st === 'ended') updates.push("ended_at = datetime('now')");
    }

    if (updates.length > 0) {
      updates.push("updated_at = datetime('now')");
      vals.push(id);
      await DB.prepare(`UPDATE live_streams SET ${updates.join(', ')} WHERE id = ?`).bind(...vals).run();
    }

    if (body.product_ids) {
      await DB.prepare('DELETE FROM stream_products WHERE stream_id = ?').bind(id).run();
      if (body.product_ids.length > 0) {
        await DB.batch(body.product_ids.map(pid =>
          DB.prepare('INSERT OR IGNORE INTO stream_products (stream_id, product_id) VALUES (?, ?)').bind(id, pid)
        ));
      }
    }

    return c.json({ success: true });
  } catch (err) {
    return c.json({ success: false, error: safeAdminError(err, c.env) }, 500);
  }
});

// 🛡️ 2026-06-17: 라이브 스트림 일괄 소프트 삭제 (어드민 대시보드 체크박스 선택).
//   ⚠️ 라우트 순서 — 반드시 '/streams/:id' 보다 먼저 등록해야 함 (그렇지 않으면 :id='bulk' 로 캡처됨).
//   live-monitor/bulk 와 동일 패턴: status='ended' + deleted_at (status CHECK 위반 방지, 매출/이력 보존).
adminStreamsRoutes.delete('/streams/bulk', cors(), async (c) => {
  try {
    const { DB } = c.env;
    const body = await c.req.json<{ ids?: unknown }>().catch(() => ({ ids: undefined }));
    const rawIds = Array.isArray(body.ids) ? body.ids : [];
    const ids = rawIds.map((v) => Number(v)).filter((n) => Number.isFinite(n) && n > 0);
    if (ids.length === 0) return c.json({ success: false, error: '삭제할 ID 가 없습니다' }, 400);
    if (ids.length > 100) return c.json({ success: false, error: '한번에 최대 100건까지 삭제 가능합니다' }, 400);

    await ensureStreamDeletedAt(DB);

    const placeholders = ids.map(() => '?').join(',');
    const targets = await executeQuery<{ id: number; deleted_at: string | null }>(
      DB,
      `SELECT id, deleted_at FROM live_streams WHERE id IN (${placeholders})`,
      ids,
    );
    if (targets.length === 0) return c.json({ success: false, error: '대상 스트림을 찾을 수 없습니다' }, 404);

    const toDelete = targets.filter((t) => !t.deleted_at).map((t) => t.id);
    const skipped = targets.length - toDelete.length;
    if (toDelete.length > 0) {
      const updPlaceholders = toDelete.map(() => '?').join(',');
      await executeQuery(
        DB,
        `UPDATE live_streams SET status = 'ended', ended_at = COALESCE(ended_at, datetime('now')),
         deleted_at = datetime('now') WHERE id IN (${updPlaceholders})`,
        toDelete,
      );
    }
    return c.json({
      success: true,
      deleted: toDelete.length,
      skipped,
      message: `${toDelete.length}건 삭제됨${skipped > 0 ? ` (${skipped}건은 이미 삭제됨)` : ''}`,
    });
  } catch (err) {
    return c.json({ success: false, error: safeAdminError(err, c.env) }, 500);
  }
});

adminStreamsRoutes.delete('/streams/:id', cors(), async (c) => {
  try {
    const { DB } = c.env;
    const streamId = c.req.param('id');
    const rows = await executeQuery<IdRow>(DB, 'SELECT id FROM live_streams WHERE id=?', [streamId]);
    if (rows.length === 0) return c.json({ success: false, error: '라이브 스트림을 찾을 수 없습니다' }, 404);
    // 🛡️ 2026-05-07: HARD DELETE → SOFT DELETE.
    //   라이브 방송은 매출/통계/시청자 이력과 연결됨. 영구 보존 필수.
    // 🛡️ 2026-05-17: live_streams.status CHECK(IN 'scheduled','live','ended') 위반 fix —
    //   'deleted' 쓰면 SqlError → 500. status='ended' + deleted_at 컬럼으로만 soft-delete 표시.
    try { await executeQuery(DB, `ALTER TABLE live_streams ADD COLUMN deleted_at DATETIME`, []); } catch { /* exists */ }
    await executeQuery(DB,
      `UPDATE live_streams SET status = 'ended', ended_at = COALESCE(ended_at, datetime('now')),
       deleted_at = datetime('now') WHERE id = ?`,
      [streamId]
    );
    return c.json({ success: true, data: { id: streamId, soft_deleted: true } });
  } catch (err) {
    return c.json({ success: false, error: safeAdminError(err, c.env) }, 500);
  }
});

// ─── Alimtalk 관리 ──────────────────────────────────────────────

async function ensureAlimtalkPackagesTable(DB: D1Database) {
  if (_done_ensureAlimtalkPackagesTable.has(DB)) return
  _done_ensureAlimtalkPackagesTable.add(DB)
  try {
    await DB.prepare(`
      CREATE TABLE IF NOT EXISTS alimtalk_packages (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        label      TEXT    NOT NULL,
        credits    INTEGER NOT NULL,
        price      INTEGER NOT NULL,
        is_active  INTEGER NOT NULL DEFAULT 1,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT    NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT    NOT NULL DEFAULT (datetime('now'))
      )
    `).run();
    const count = await DB.prepare('SELECT COUNT(*) as c FROM alimtalk_packages').first<{ c: number }>();
    if (!count || count.c === 0) {
      await DB.prepare(`
        INSERT INTO alimtalk_packages (label, credits, price, is_active, sort_order) VALUES
          ('100건',   100,   900,   1, 1),
          ('500건',   500,   4500,  1, 2),
          ('1,000건', 1000,  9000,  1, 3),
          ('3,000건', 3000,  27000, 1, 4),
          ('5,000건', 5000,  45000, 1, 5)
      `).run();
    }
  } catch { /* table exists */ }
}

/**
 * 💰 2026-08-10 원가 조회 — platform_settings(어드민 조정). 미설정/오타는 SSOT 기본값으로 폴백.
 *   원가가 있어야 마진을 계산할 수 있다. 판매가(packages.price)와 **분리 보관**한다.
 */
async function readAlimtalkUnitCosts(DB: D1Database): Promise<{ alimtalk: number; friendtalk: number }> {
  const row = await DB.prepare(
    'SELECT key, value FROM platform_settings WHERE key IN (?, ?)',
  ).bind(ALIMTALK_COST_SETTING_KEYS.alimtalk, ALIMTALK_COST_SETTING_KEYS.friendtalk)
    .all<{ key: string; value: string }>().catch(() => ({ results: [] as { key: string; value: string }[] }));
  const map = new Map((row.results || []).map((r) => [r.key, r.value]));
  return {
    alimtalk: parseUnitCost(map.get(ALIMTALK_COST_SETTING_KEYS.alimtalk), DEFAULT_ALIMTALK_UNIT_COST_KRW),
    friendtalk: parseUnitCost(map.get(ALIMTALK_COST_SETTING_KEYS.friendtalk), DEFAULT_FRIENDTALK_UNIT_COST_KRW),
  };
}

adminStreamsRoutes.get('/alimtalk/pricing', cors(), async (c) => {
  const { DB } = c.env;
  try {
    await ensureAlimtalkPackagesTable(DB);
    const { results } = await DB.prepare(
      `SELECT id, label, credits, price, is_active, sort_order, created_at, updated_at
       FROM alimtalk_packages ORDER BY sort_order ASC`
    ).all().catch(() => ({ results: [] }));
    // 원가를 함께 실어 보낸다 — 화면이 패키지별 마진율을 그리려면 둘이 같이 있어야 한다.
    return c.json({ success: true, data: results, unit_costs: await readAlimtalkUnitCosts(DB) });
  } catch {
    return c.json({ success: true, data: [] });
  }
});

/** 💰 원가 저장(어드민) — 요금제가 바뀌면 배포 없이 여기서 고친다. */
adminStreamsRoutes.put('/alimtalk/cost', cors(), async (c) => {
  const { DB } = c.env;
  try {
    const body = await c.req.json<{ alimtalk?: number | string; friendtalk?: number | string }>();
    const pairs: [string, unknown][] = [];
    if (body.alimtalk !== undefined) pairs.push([ALIMTALK_COST_SETTING_KEYS.alimtalk, body.alimtalk]);
    if (body.friendtalk !== undefined) pairs.push([ALIMTALK_COST_SETTING_KEYS.friendtalk, body.friendtalk]);
    if (pairs.length === 0) return c.json({ success: false, error: '변경할 항목이 없습니다' }, 400);
    for (const [key, raw] of pairs) {
      const n = Number(String(raw ?? '').trim());
      // 저장 시점에 막는다 — 잘못된 값이 들어가면 마진 표시가 통째로 거짓말이 된다.
      // 0 도 거부 — 저장은 되는데 표시는 폴백으로 뜨는 불일치를 만들고, 마진율을 항상 100% 로 만든다.
      if (!Number.isFinite(n) || n <= 0 || n > 1000) {
        return c.json({ success: false, error: '원가는 0보다 크고 1000원 이하여야 합니다' }, 400);
      }
      await DB.prepare(
        `INSERT INTO platform_settings (key, value) VALUES (?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      ).bind(key, String(n)).run();
    }
    return c.json({ success: true, data: await readAlimtalkUnitCosts(DB) });
  } catch (err) {
    return c.json({ success: false, error: safeAdminError(err, c.env) }, 500);
  }
});

adminStreamsRoutes.put('/alimtalk/pricing/:id', cors(), async (c) => {
  const { DB } = c.env;
  const id = c.req.param('id');
  try {
    const body = await c.req.json<{
      label?: string; credits?: number; price?: number;
      is_active?: boolean; sort_order?: number;
    }>();
    const fields: string[] = [];
    const values: (string | number)[] = [];
    if (body.label !== undefined)      { fields.push('label = ?');      values.push(body.label); }
    if (body.credits !== undefined)    { fields.push('credits = ?');    values.push(body.credits); }
    if (body.price !== undefined)      { fields.push('price = ?');      values.push(body.price); }
    if (body.is_active !== undefined)  { fields.push('is_active = ?');  values.push(body.is_active ? 1 : 0); }
    if (body.sort_order !== undefined) { fields.push('sort_order = ?'); values.push(body.sort_order); }
    if (fields.length === 0) return c.json({ success: false, error: '변경할 항목이 없습니다' }, 400);
    fields.push("updated_at = datetime('now')");
    values.push(parseInt(id));
    await DB.prepare(
      `UPDATE alimtalk_packages SET ${fields.join(', ')} WHERE id = ?`
    ).bind(...values).run();
    return c.json({ success: true, message: '패키지가 업데이트되었습니다' });
  } catch (err) {
    return c.json({ success: false, error: safeAdminError(err, c.env) }, 500);
  }
});

adminStreamsRoutes.post('/alimtalk/pricing', cors(), async (c) => {
  const { DB } = c.env;
  try {
    const body = await c.req.json<{ label: string; credits: number; price: number; sort_order?: number }>();
    if (!body.label || !body.credits || !body.price) {
      return c.json({ success: false, error: '필수 항목 누락 (label, credits, price)' }, 400);
    }
    const result = await DB.prepare(
      `INSERT INTO alimtalk_packages (label, credits, price, is_active, sort_order)
       VALUES (?, ?, ?, 1, ?)`
    ).bind(body.label, body.credits, body.price, body.sort_order ?? 99).run();
    return c.json({ success: true, data: { id: result.meta.last_row_id } });
  } catch (err) {
    return c.json({ success: false, error: safeAdminError(err, c.env) }, 500);
  }
});

/**
 * 🏬 2026-08-10 상인회(몰) 일괄 크레딧 지급 — 대표 지시 2단계 "상인회 단위 알림톡 판매".
 *
 * ## 왜 '몰 크레딧'이라는 새 주체를 만들지 않았나
 * 상인회는 **계정이 없다**(몰은 어드민이 만드는 데이터 행이고 운영자 로그인이 없다). 반면
 * 소속 매장들은 **이미 크레딧 주체**다(`seller_credits`). ⇒ 새 잔액 주체를 만드는 대신
 * **"상인회가 한 번 결제 → 소속 매장들에 배분"** 으로 모델링한다. 새 테이블 0, 운영자 계정 불필요,
 * 1단계 마진 회계(`credit_transactions.price_paid` 합계 = 매출)에 **자동으로 잡힌다.**
 *
 * ## 🔴 멱등 — 돈이 오가는 자리라 두 번 눌러도 두 번 주면 안 된다
 * `grant_ref`(세금계산서 번호 등 어드민이 입력하는 참조)를 `payment_key` 에 심고, 같은 ref 가
 * 이미 있으면 **아무것도 하지 않고** 그대로 반환한다. 참조를 강제하는 부수효과로 **지급이 항상
 * 문서와 짝지어진다** — 나중에 "이 크레딧 왜 나갔지"를 답할 수 있다.
 *
 * ⚠️ 발송 자체는 별개다 — ALIGO 3종 키가 설정돼야 실제로 나간다(현재 미설정 → 발송 0).
 *    이 엔드포인트는 **판매·회계**만 성립시킨다.
 */
adminStreamsRoutes.post('/alimtalk/grant', cors(), async (c) => {
  const { DB } = c.env;
  try {
    const body = await c.req.json<{
      mall_id?: number; seller_ids?: number[]; credits_per_seller?: number;
      total_price_paid?: number; grant_ref?: string; memo?: string;
    }>();
    const credits = Math.floor(Number(body.credits_per_seller));
    const totalPaid = Math.floor(Number(body.total_price_paid ?? 0));
    const ref = String(body.grant_ref ?? '').trim().slice(0, 80);
    if (!Number.isFinite(credits) || credits <= 0 || credits > 1_000_000) {
      return c.json({ success: false, error: '매장당 지급 건수는 1~1,000,000 사이여야 합니다' }, 400);
    }
    if (!Number.isFinite(totalPaid) || totalPaid < 0) {
      return c.json({ success: false, error: '결제금액이 올바르지 않습니다' }, 400);
    }
    if (!ref) return c.json({ success: false, error: '지급 참조(세금계산서 번호 등)를 입력해주세요' }, 400);

    const paymentKey = `grant:${ref}`;
    // 🔴 멱등 — 같은 참조로 이미 지급했으면 재실행하지 않는다.
    const dupe = await DB.prepare('SELECT id FROM credit_transactions WHERE payment_key = ? LIMIT 1')
      .bind(paymentKey).first<IdRow>().catch(() => null);
    if (dupe) return c.json({ success: true, data: { granted: 0, already: true } });

    // 대상 매장 — 몰 소속(승인된 것만) 또는 명시 목록.
    let sellerIds: number[] = Array.isArray(body.seller_ids)
      ? body.seller_ids.map((v) => Number(v)).filter((n) => Number.isFinite(n) && n > 0).slice(0, 500)
      : [];
    if (sellerIds.length === 0) {
      const mallId = Number(body.mall_id);
      if (!Number.isFinite(mallId) || mallId <= 0) {
        return c.json({ success: false, error: '몰을 선택하거나 매장을 지정해주세요' }, 400);
      }
      const rows = await DB.prepare(
        "SELECT id FROM sellers WHERE COALESCE(mall_id, 1) = ? AND status = 'approved' LIMIT 500",
      ).bind(mallId).all<IdRow>().catch(() => ({ results: [] as IdRow[] }));
      sellerIds = (rows.results || []).map((r) => Number(r.id));
    }
    if (sellerIds.length === 0) return c.json({ success: false, error: '지급 대상 매장이 없습니다' }, 400);

    // 매출 배분 — 나눠떨어지지 않는 나머지는 첫 매장에 몰아 **합계가 정확히 결제금액과 일치**하게.
    const per = Math.floor(totalPaid / sellerIds.length);
    const remainder = totalPaid - per * sellerIds.length;
    const desc = String(body.memo ?? '').trim().slice(0, 200) || `상인회 일괄 지급 (${ref})`;

    const stmts = sellerIds.flatMap((sid, i) => [
      DB.prepare(
        `INSERT INTO seller_credits (seller_id, balance, updated_at) VALUES (?, ?, datetime('now'))
         ON CONFLICT(seller_id) DO UPDATE SET balance = balance + excluded.balance, updated_at = datetime('now')`,
      ).bind(sid, credits),
      DB.prepare(
        `INSERT INTO credit_transactions (seller_id, type, amount, price_paid, description, payment_key, created_at)
         VALUES (?, 'charge', ?, ?, ?, ?, datetime('now'))`,
      ).bind(sid, credits, per + (i === 0 ? remainder : 0), desc, paymentKey),
    ]);
    await DB.batch(stmts);
    return c.json({ success: true, data: { granted: sellerIds.length, credits_each: credits, total_price_paid: totalPaid } });
  } catch (err) {
    return c.json({ success: false, error: safeAdminError(err, c.env) }, 500);
  }
});

adminStreamsRoutes.get('/alimtalk/accounts', cors(), async (c) => {
  const { DB } = c.env;
  try {
    const { results } = await DB.prepare(`
      SELECT s.id, s.name AS seller_name, s.email,
             COALESCE(sc.balance, 0) AS balance,
             sc.updated_at
      FROM sellers s
      LEFT JOIN seller_credits sc ON sc.seller_id = s.id
      WHERE s.status = 'approved'
      ORDER BY sc.balance DESC, s.name ASC
    `).all().catch(() => ({ results: [] }));
    return c.json({ success: true, data: results });
  } catch {
    return c.json({ success: true, data: [] });
  }
});

adminStreamsRoutes.get('/alimtalk/statistics', cors(), async (c) => {
  const { DB } = c.env;
  try {
    // 💰 2026-08-10: 종전 `total_cost = 발송건수 × 하드코딩 9원` 은 **원가가 아니라 매출(그것도 추정)** 이었다.
    //   실매출은 충전 원장(credit_transactions.price_paid)에서, 실원가는 발송건수 × 설정 원가에서 온다.
    const [totalSent, totalBalance, activeAccounts, charged, costs] = await Promise.all([
      DB.prepare('SELECT COUNT(*) AS cnt FROM alimtalk_logs WHERE success = 1')
        .first<{ cnt: number }>().catch(() => ({ cnt: 0 })),
      DB.prepare('SELECT COALESCE(SUM(balance), 0) AS total FROM seller_credits')
        .first<{ total: number }>().catch(() => ({ total: 0 })),
      DB.prepare('SELECT COUNT(*) AS cnt FROM seller_credits WHERE balance > 0')
        .first<{ cnt: number }>().catch(() => ({ cnt: 0 })),
      DB.prepare("SELECT COALESCE(SUM(price_paid), 0) AS total FROM credit_transactions WHERE type = 'charge'")
        .first<{ total: number }>().catch(() => ({ total: 0 })),
      readAlimtalkUnitCosts(DB),
    ]);
    const sent = totalSent?.cnt ?? 0;
    const m = computeAlimtalkMargin(charged?.total ?? 0, sent, costs.alimtalk);
    return c.json({
      success: true,
      data: {
        total_sent: sent,
        // ⚠️ 하위호환: 옛 화면이 total_cost 를 읽는다 — 이제 **진짜 원가**를 담는다(의미가 바뀌었다).
        total_cost: m.cost,
        revenue: m.revenue,
        margin: m.margin,
        margin_pct: m.marginPct,
        unit_cost: costs.alimtalk,
        active_accounts: activeAccounts?.cnt ?? 0,
        total_balance: totalBalance?.total ?? 0,
      },
    });
  } catch {
    return c.json({ success: true, data: { total_sent: 0, total_cost: 0, revenue: 0, margin: 0, margin_pct: 0, unit_cost: DEFAULT_ALIMTALK_UNIT_COST_KRW, active_accounts: 0, total_balance: 0 } });
  }
});

export default adminStreamsRoutes;


// 🛡️ 2026-05-19: ensure* per-worker 메모이제이션 (파일 끝).
const _done_ensureAlimtalkPackagesTable = new WeakSet<object>()

// 🛡️ 2026-06-17: live_streams.deleted_at defensive ALTER (per-worker 1회).
//   소프트 삭제 표식 컬럼 — 목록 필터(deleted_at IS NULL) + 일괄 삭제에서 참조.
const _done_ensureStreamDeletedAt = new WeakSet<object>()
async function ensureStreamDeletedAt(DB: D1Database) {
  if (_done_ensureStreamDeletedAt.has(DB)) return
  _done_ensureStreamDeletedAt.add(DB)
  try { await DB.prepare(`ALTER TABLE live_streams ADD COLUMN deleted_at DATETIME`).run() } catch { /* 이미 존재 */ }
}
