/**
 * 상품 대량등록 API
 *
 * GET  /api/bulk-upload/template     - 엑셀 양식 다운로드 (CSV)
 * POST /api/bulk-upload/upload       - 엑셀/CSV 업로드 → 상품 일괄 등록
 * GET  /api/bulk-upload/categories   - 카테고리 목록 (대/중/소)
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { requireAuth, getCurrentUser } from '@/worker/middleware/auth';
import { validateImageUrl } from '@/worker/utils/validation';
import type { Env } from '@/worker/types/env';
const bulkUploadRoutes = new Hono<{ Bindings: Env }>();

// 🛡️ 2026-05-13: redundant cors() 제거 — 전역 cors 가 처리.

async function ensureTables(DB: D1Database) {
  if (_done_ensureTables.has(DB)) return
  _done_ensureTables.add(DB)
  try {
    await DB.prepare(`CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      level TEXT NOT NULL CHECK (level IN ('main', 'sub', 'detail')),
      parent_id INTEGER,
      name TEXT NOT NULL,
      slug TEXT NOT NULL,
      sort_order INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      FOREIGN KEY (parent_id) REFERENCES categories(id)
    )`).run();
  } catch { /* exists */ }
  // 멀티 이미지 컬럼
  try { await DB.prepare('ALTER TABLE products ADD COLUMN images TEXT DEFAULT \'[]\'').run(); } catch { /* exists */ }
  // 🩸 2026-11-24 — 여기서 products 에 category_main·category_sub·option_type·option_values 를 ALTER 로 더하려 했지만
  //   products 는 컬럼 예산 동결(scripts/products-column-baseline.json)이라 라이브에 그 열이 **없다**. 실패를 `/* exists */`
  //   로 삼켜 아래 INSERT 가 행마다 `no column named category_main` 으로 터졌다(일괄 등록 전 행 실패).
  //   → 열을 더하지 않는다. 대카테고리는 products.category 에, 옵션은 product_options 표에 넣는다.
}

// GET /api/bulk-upload/template — CSV 양식 다운로드
bulkUploadRoutes.get('/template', async (c) => {
  const headers = [
    '상품명*', '판매가*', '정가(비교가격)', '재고수량*',
    '대카테고리', '중카테고리',
    '메인이미지URL1*', '메인이미지URL2', '메인이미지URL3', '메인이미지URL4',
    '상세이미지URL1', '상세이미지URL2', '상세이미지URL3', '상세이미지URL4', '상세이미지URL5',
    '상품설명',
    '옵션타입(예:색상)', '옵션값(예:블랙,화이트,네이비)',
    '최소재고알림',
  ];

  const exampleRow = [
    '프리미엄 무선 이어폰', '89000', '149000', '100',
    '전자기기', '',
    'https://example.com/main1.jpg', 'https://example.com/main2.jpg', '', '',
    'https://example.com/detail1.jpg', 'https://example.com/detail2.jpg', '', '', '',
    'Bluetooth 5.3 지원, 노이즈 캔슬링',
    '색상', '블랙,화이트,네이비',
    '5',
  ];

  const bom = '\uFEFF';
  const csv = bom + [
    headers.join(','),
    exampleRow.map(v => `"${v}"`).join(','),
    // 안내 행
    '# *는 필수 항목입니다',
    '# 이미지URL은 https://로 시작하는 이미지 링크 (jpg/png/gif/webp 지원)',
    '# 옵션값은 쉼표(,)로 구분하여 입력',
    '# 대카테고리: 패션/뷰티/식품/전자기기/라이프스타일/유아동/잡화',
  ].join('\r\n');

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="product_bulk_template.csv"',
    },
  });
});

// POST /api/bulk-upload/upload — CSV 업로드 → 상품 일괄 등록
bulkUploadRoutes.post('/upload', requireAuth(), async (c) => {
  const user = getCurrentUser(c);
  if (!user) return c.json({ success: false, error: '로그인이 필요합니다' }, 401);

  const { DB } = c.env;
  await ensureTables(DB);

  // 셀러인지 어드민인지 확인
  const isAdmin = user.type === 'admin';
  let sellerId: number | null = null;

  if (!isAdmin) {
    // 셀러 ID 조회
    const seller = await DB.prepare('SELECT id FROM sellers WHERE username = ? OR id = ?')
      .bind(user.id, user.id).first<{ id: number }>();
    if (!seller) return c.json({ success: false, error: '셀러 정보를 찾을 수 없습니다' }, 403);
    sellerId = seller.id;
  }

  const body = await c.req.json<{ products: Array<Record<string, string>> }>();

  if (!body.products?.length) {
    return c.json({ success: false, error: '등록할 상품 데이터가 없습니다' }, 400);
  }

  if (body.products.length > 500) {
    return c.json({ success: false, error: '한 번에 최대 500개까지 등록 가능합니다' }, 400);
  }

  const results: { row: number; status: 'success' | 'error'; name?: string; error?: string }[] = [];
  let successCount = 0;

  // 🛡️ 2026-04-22: CSV formula injection 방어
  // Excel/Google Sheets 에서 수식 prefix (=, +, -, @, \t, \r) 로 시작하는 cell 은 수식으로 실행됨.
  // 나중에 관리자가 export 해서 열면 악성 함수 실행 가능 (HYPERLINK, WEBSERVICE 등).
  const stripFormula = (s: string): string => {
    if (typeof s !== 'string' || !s) return s;
    const first = s.charCodeAt(0);
    // =, +, -, @, \t, \r, \x00 으로 시작하면 single-quote prefix 로 무력화
    if (first === 0x3d || first === 0x2b || first === 0x2d || first === 0x40 || first === 0x09 || first === 0x0d || first === 0x00) {
      return "'" + s;
    }
    return s;
  };

  for (let i = 0; i < body.products.length; i++) {
    const p = body.products[i];
    try {
      const name = stripFormula(p['상품명*'] || p['name'] || '');
      const price = parseInt(p['판매가*'] || p['price'] || '0');
      const originalPrice = parseInt(p['정가(비교가격)'] || p['original_price'] || '0') || null;
      const stock = parseInt(p['재고수량*'] || p['stock'] || '0');
      const categoryMain = stripFormula(p['대카테고리'] || p['category_main'] || '');
      const description = stripFormula(p['상품설명'] || p['description'] || '');
      const optionType = p['옵션타입(예:색상)'] || p['option_type'] || null;
      const optionValues = p['옵션값(예:블랙,화이트,네이비)'] || p['option_values'] || '';
      const minStockAlert = parseInt(p['최소재고알림'] || p['min_stock_alert'] || '5');

      // 이미지 수집 — http/https URL만 허용, 길이/형식 검증
      const mainImages: string[] = [];
      for (let j = 1; j <= 4; j++) {
        const url = p[`메인이미지URL${j}`] || p[`main_image_${j}`] || '';
        if (!url) continue;
        const check = validateImageUrl(url);
        if (!check.valid) {
          throw new Error(`메인이미지URL${j}: ${check.error}`);
        }
        mainImages.push(url);
      }

      const detailImages: string[] = [];
      for (let j = 1; j <= 5; j++) {
        const url = p[`상세이미지URL${j}`] || p[`detail_image_${j}`] || '';
        if (!url) continue;
        const check = validateImageUrl(url);
        if (!check.valid) {
          throw new Error(`상세이미지URL${j}: ${check.error}`);
        }
        detailImages.push(url);
      }

      if (!name || !price) {
        results.push({ row: i + 1, status: 'error', name, error: '상품명과 판매가는 필수입니다' });
        continue;
      }
      // 🛡️ 2026-05-30: 음수/비정상 가격·재고 차단 — parseInt('-500')=-500 통과 시 장바구니/할인율/정산 수식 오염.
      if (!Number.isFinite(price) || price <= 0 || price > 100_000_000) {
        results.push({ row: i + 1, status: 'error', name, error: '판매가는 1~1억원 사이여야 합니다' });
        continue;
      }
      if (!Number.isFinite(stock) || stock < 0 || stock > 1_000_000) {
        results.push({ row: i + 1, status: 'error', name, error: '재고수량은 0~100만 사이여야 합니다' });
        continue;
      }
      if (originalPrice != null && (!Number.isFinite(originalPrice) || originalPrice < 0 || originalPrice > 100_000_000)) {
        results.push({ row: i + 1, status: 'error', name, error: '정가는 0~1억원 사이여야 합니다' });
        continue;
      }

      // 할인율 계산
      const discountRate = originalPrice && originalPrice > price
        ? Math.round((1 - price / originalPrice) * 100)
        : 0;

      // 옵션값 파싱
      const optionValuesArray = optionValues ? optionValues.split(',').map((v: string) => v.trim()).filter(Boolean) : [];

      const ins = await DB.prepare(`
        INSERT INTO products (
          name, description, price, original_price, discount_rate,
          image_url, stock, category, is_active,
          seller_id, min_stock_alert, images, detail_images
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)
      `).bind(
        name, description, price, originalPrice, discountRate,
        mainImages[0] || null, stock, categoryMain || 'lifestyle', // 대카테고리 → category (중카테고리는 저장 칸이 없어 받지 않는다)
        sellerId, minStockAlert,
        JSON.stringify(mainImages), JSON.stringify(detailImages),
      ).run();
      // 옵션 → product_options (상품 편집 화면과 같은 표). 옵션별 재고는 CSV 에 없어 0 — 셀러가 편집 화면에서 채운다.
      const productId = Number(ins.meta?.last_row_id);
      const optType = typeof optionType === 'string' ? stripFormula(optionType.trim()) : '';
      if (productId > 0 && optType && optionValuesArray.length) {
        await DB.batch(optionValuesArray.slice(0, 50).map((v: string) => DB.prepare(
          `INSERT INTO product_options (product_id, option_type, option_value, price_adjustment, stock, created_at)
           VALUES (?, ?, ?, 0, 0, datetime('now'))`,
        ).bind(productId, optType, stripFormula(v))));
      }

      results.push({ row: i + 1, status: 'success', name });
      successCount++;
    } catch (err) {
      results.push({ row: i + 1, status: 'error', name: p['상품명*'] || '', error: (err as Error).message });
    }
  }

  return c.json({
    success: true,
    data: {
      total: body.products.length,
      success: successCount,
      failed: body.products.length - successCount,
      results,
    },
    message: `${successCount}개 상품이 등록되었습니다.`,
  });
});

// GET /api/bulk-upload/categories — 카테고리 목록
bulkUploadRoutes.get('/categories', async (c) => {
  const { DB } = c.env;
  await ensureTables(DB);

  const { results } = await DB.prepare(
    'SELECT id, level, parent_id, name, slug FROM categories WHERE is_active = 1 ORDER BY level, sort_order'
  ).all();

  // 트리 구조로 변환
  const categories = results ?? [];
  const mainCategories = categories.filter((c: Record<string, unknown>) => c.level === 'main');
  const subCategories = categories.filter((c: Record<string, unknown>) => c.level === 'sub');
  const detailCategories = categories.filter((c: Record<string, unknown>) => c.level === 'detail');

  const tree = mainCategories.map((main: Record<string, unknown>) => ({
    ...main,
    children: subCategories
      .filter((sub: Record<string, unknown>) => sub.parent_id === main.id)
      .map((sub: Record<string, unknown>) => ({
        ...sub,
        children: detailCategories.filter((d: Record<string, unknown>) => d.parent_id === sub.id),
      })),
  }));

  return c.json({ success: true, data: tree });
});

export { bulkUploadRoutes };


// 🛡️ 2026-05-19: ensure* per-worker 메모이제이션 (파일 끝).
const _done_ensureTables = new WeakSet<object>()
