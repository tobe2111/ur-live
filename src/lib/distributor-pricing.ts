/**
 * 🏭 2026-06-01 유통스타트 도매몰 — 유통사 등급별 공급가 산출.
 *
 * 모델 (docs/design/wholesale-utongstart.md, 사용자 확정):
 *   - 제조사 공급가(base) = 제조사가 유통스타트에 주는 가격 (= products.supply_price).
 *   - 유통사 공급가 = base × (1 + 등급마진율/100).  ← 유통사가 유통스타트에 지불(선결제).
 *   - 유통스타트 마진(수익) = 유통사 공급가 − base.  ← 제조사에는 base 만 정산.
 *   - 등급: A/B/C/D/OEM + SPECIAL(특별할인, 기간한정 — 덤핑/임박품).
 *   - D-B 결정: 고등급(A)일수록 마진율 ↓(저렴), 저등급일수록 ↑. SPECIAL = 최저(덤핑).
 *
 * 등급 마진율은 distributor_grades 테이블(어드민 편집)에서 옴 — 여기선 순수 계산만.
 */

export type DistributorGrade = 'A' | 'B' | 'C' | 'D' | 'OEM' | 'SPECIAL';

/** distributor_grades 행 (어드민 설정) */
export interface GradeMargin {
  grade: string;
  margin_pct: number;
  is_special?: boolean;
}

/** 어드민 미설정 시 사용하는 안전 기본값 (고등급일수록 저마진). admin 이 distributor_grades 로 덮어씀. */
export const DEFAULT_GRADE_MARGINS: Record<DistributorGrade, number> = {
  A: 10,
  B: 15,
  C: 20,
  D: 25,
  OEM: 8,
  SPECIAL: 0,
};

/** 미배정 유통사 기본 등급 — 가장 보수적(고마진). 어드민이 수동 상향 배정. */
export const DEFAULT_UNGRADED: DistributorGrade = 'D';

/**
 * 유통사가 지불할 공급가 (원 단위 반올림).
 * @param baseSupplyPrice 제조사 공급가 (products.supply_price)
 * @param marginPct 등급 마진율 (%)
 */
export function distributorPrice(baseSupplyPrice: number, marginPct: number): number {
  const base = Math.max(0, Math.floor(baseSupplyPrice || 0));
  const m = Number.isFinite(marginPct) ? Math.max(0, marginPct) : 0;
  return Math.round(base * (1 + m / 100));
}

/** 유통스타트가 가져가는 마진액 = 유통사공급가 − 제조사공급가 (>= 0). */
export function platformMargin(baseSupplyPrice: number, marginPct: number): number {
  const base = Math.max(0, Math.floor(baseSupplyPrice || 0));
  return Math.max(0, distributorPrice(baseSupplyPrice, marginPct) - base);
}

/**
 * 유통사의 유효 등급 결정.
 * 특별할인 기간(special_discount_until) 안이면 SPECIAL, 아니면 배정 등급, 미배정이면 기본.
 */
export function effectiveGrade(opts: {
  grade?: string | null;
  specialUntil?: string | null;
  now?: Date;
}): DistributorGrade {
  const now = opts.now ?? new Date();
  if (opts.specialUntil) {
    const until = new Date(opts.specialUntil);
    if (!Number.isNaN(until.getTime()) && until.getTime() > now.getTime()) {
      return 'SPECIAL';
    }
  }
  const g = (opts.grade || '').toUpperCase();
  if (g === 'A' || g === 'B' || g === 'C' || g === 'D' || g === 'OEM') return g;
  return DEFAULT_UNGRADED;
}

/** 등급 → 마진율 조회 (테이블 우선, 없으면 기본값). */
export function marginForGrade(grade: string, table?: GradeMargin[] | null): number {
  if (table && table.length) {
    const row = table.find((r) => r.grade?.toUpperCase() === grade.toUpperCase());
    if (row && Number.isFinite(row.margin_pct)) return Math.max(0, row.margin_pct);
  }
  const def = DEFAULT_GRADE_MARGINS[grade.toUpperCase() as DistributorGrade];
  return Number.isFinite(def) ? def : DEFAULT_GRADE_MARGINS[DEFAULT_UNGRADED];
}

/** 한 번에: 유통사가 볼 공급가 + 플랫폼 마진 + 적용 등급. */
export function resolveDistributorPrice(opts: {
  baseSupplyPrice: number;
  grade?: string | null;
  specialUntil?: string | null;
  table?: GradeMargin[] | null;
  now?: Date;
}): { price: number; margin: number; grade: DistributorGrade; marginPct: number } {
  const grade = effectiveGrade(opts);
  const marginPct = marginForGrade(grade, opts.table);
  return {
    price: distributorPrice(opts.baseSupplyPrice, marginPct),
    margin: platformMargin(opts.baseSupplyPrice, marginPct),
    grade,
    marginPct,
  };
}
