// ──────────────────────────────────────────────────────────────
// 🏭 2026-06-29 (대표) 도매 상품코드 — 카테고리 접두어 + 제조사 입력 코드.
//   형식 예: FD000BKJ (식품) · LV... (리빙) · HT... (건강). 앞 2글자 = 카테고리, 뒤 = 제조사 입력(영숫자).
//   저장: product_supply_meta.product_code (products 컬럼 미증식 — 예산제 준수). SSOT = 이 파일.
// ──────────────────────────────────────────────────────────────

/** 카테고리 id → 상품코드 접두어. 식품=FD · 리빙=LV · 건강=HT. 그 외/미지정=GD(general). */
export const WHOLESALE_CODE_PREFIX: Record<string, string> = {
  food: 'FD',
  living: 'LV',
  health: 'HT',
};

export function wholesaleCodePrefix(category?: string | null): string {
  return WHOLESALE_CODE_PREFIX[String(category || '').toLowerCase()] || 'GD';
}

/** 접두어(카테고리) + 제조사 입력 suffix → 전체 상품코드. suffix 는 영숫자만(대문자)·최대 16자. 빈 입력이면 ''. */
export function buildWholesaleProductCode(category: string | null | undefined, suffix: string): string {
  const clean = String(suffix || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16);
  return clean ? wholesaleCodePrefix(category) + clean : '';
}

/** 전체 코드에서 접두어를 떼어 suffix 만 반환(편집 폼 프리필용). 접두어와 무관하면 원본 그대로. */
export function wholesaleCodeSuffix(fullCode: string | null | undefined, category?: string | null): string {
  const code = String(fullCode || '').toUpperCase();
  if (!code) return '';
  const pre = wholesaleCodePrefix(category);
  if (code.startsWith(pre)) return code.slice(pre.length);
  // 알려진 접두어 중 하나로 시작하면 그것도 제거(카테고리 변경 케이스).
  for (const p of Object.values(WHOLESALE_CODE_PREFIX)) {
    if (code.startsWith(p)) return code.slice(p.length);
  }
  return code;
}

/** 사용자에게 보일 전체 코드 정규화(저장값 그대로 대문자). */
export function normalizeWholesaleProductCode(code: string | null | undefined): string {
  return String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 18);
}
