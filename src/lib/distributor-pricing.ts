/**
 * 🏭 2026-06-01 유통스타트 도매몰 — 판매사 등급별 공급가 산출.
 *
 * 모델 (2026-06-16 대표 확정 — 판매가 기준 보장마진):
 *   - 판매가(retail) = 제조사가 등록한 권장소비자가 (= products.price). 전 등급 동일.
 *   - 등급마진율 = 판매사에게 **보장**되는 판매가 대비 마진 (일반 15% / 프로 30% / 프리미엄 38%).
 *   - 판매사 공급가 = max(제조사원가, 판매가 × (1 − 등급마진율/100)).  ← 원가를 하한(플랫폼 손실 차단).
 *       예) 판매가 10,000 → 일반 8,500 / 프로 7,000 / 프리미엄 6,200 (원가가 그보다 낮을 때).
 *   - 유통스타트 마진(수익) = 판매사 공급가 − 제조사원가.  ← 제조사에는 원가(supply_price)만 정산(불변).
 *   - 등급: A/B/C/D/OEM + SPECIAL. 고등급(A)일수록 마진율 ↑(= 공급가 ↓, 더 저렴).
 *
 * ⚠️ 2026-06-16 공식 전환: (구) 원가×(1+마크업) → (신) 판매가×(1−보장마진), 원가 하한.
 *   등급마진율 의미가 '원가 위 마크업' → '판매가 대비 보장마진'으로 바뀜 → distributor_grades 값도 신모델로 마이그레이션.
 *   등급 마진율은 distributor_grades 테이블(어드민 편집)에서 옴 — 여기선 순수 계산만.
 */

export type DistributorGrade = 'A' | 'B' | 'C' | 'D' | 'OEM' | 'SPECIAL';

/** distributor_grades 행 (어드민 설정) */
export interface GradeMargin {
  grade: string;
  margin_pct: number;
  is_special?: boolean;
}

/** 어드민 미설정 시 사용하는 안전 기본값 = 판매가 대비 보장마진(%). 고등급일수록 고마진(저공급가). admin 이 distributor_grades 로 덮어씀. */
export const DEFAULT_GRADE_MARGINS: Record<DistributorGrade, number> = {
  A: 38, // 프리미엄
  B: 30, // 프로(연 구독)
  C: 15, // 일반(승인 가입)
  D: 8,  // 하향(엣지)
  OEM: 40,
  SPECIAL: 45,
};

/** 미배정 판매사 기본 등급 — 스펙: "유통회원 가입 시 자동 C등급". 어드민이 A/B 상향 또는 D 하향 배정. */
export const DEFAULT_UNGRADED: DistributorGrade = 'C';

// ── 🆕 2026-06-17 대표 확정 모델: "제조사가+플랫폼 마진" (cost-plus) ──────────────────────────
//   제조사가 받을 금액(supply_price) 위에 플랫폼 마진%를 *붙여* 공급가 산출. 제조사는 입력가 전액 정산,
//   플랫폼 = 공급가 − 제조사가. (구 모델 '판매가−보장마진' 과 정반대 — distributorPriceFromRetail 은 deprecated.)
//     공급가 = clamp( round(제조사가 × (1 + 유효마진%)),  하한=제조사가,  상한=판매가(소비자가) )
//   🏭 2026-06-17 후속 대표 확정(resolveDistributorPrice 참조): **모든 등급 동일 마진** — 등급은 가격 차등 X,
//      노출 큐레이션 전용. 유효마진% = 제품별 플랫폼마진%(supply_margin_override_pct, 없으면 기본 10·어드민 편집).
//      → 등급배수(DEFAULT_GRADE_MULTIPLIERS/gradeMarginMultiplier)는 이 결정으로 **폐기**(미사용 dead code 제거,
//      2026-06-29). 등급별 가격 차등을 다시 도입하려면 이 모델 결정부터 되돌려야 함(상수 부활 X).
/** 제품별 플랫폼 마진 미설정 시 기본값(%). 어드민 platform_settings.wholesale_platform_commission_pct 로 전역 조정 가능(호출부가 전달). */
export const DEFAULT_PLATFORM_MARGIN_PCT = 10;

/**
 * 🆕 2026-06-17 cost-plus 공급가 — 제조사가 위에 플랫폼 마진을 붙임. 판매가(소비자가) 상한·제조사가 하한.
 * @param cost 제조사가 받을 금액(products.supply_price)
 * @param platformMarginPct 유효 플랫폼 마진%(제품별 마진% — 모든 등급 동일, 등급배수 폐기)
 * @param retailCeil 판매가(권장소비자가) — 공급가가 이를 넘지 않게(판매사 마진 음수 방지). 0/미지정이면 상한 없음.
 */
export function distributorPriceFromCost(cost: number, platformMarginPct: number, retailCeil = 0): number {
  const base = Math.max(0, Math.floor(cost || 0));
  const m = Number.isFinite(platformMarginPct) ? Math.max(0, platformMarginPct) : 0;
  let price = Math.round(base * (1 + m / 100));
  const ceil = Math.max(0, Math.floor(retailCeil || 0));
  if (ceil > 0 && price > ceil) price = ceil; // 판매가 초과 금지
  if (price < base) price = base;              // 제조사가 미만 금지(플랫폼 마진 음수 차단)
  return price;
}

/**
 * 🆕 2026-06-16 판매사 공급가(원 단위 반올림) — 신모델: 판매가 × (1 − 보장마진%), 단 제조사 원가를 하한.
 * @param retailPrice 판매가(권장소비자가, products.price)
 * @param supplyFloor 제조사 원가(products.supply_price) — 이 값 아래로는 절대 안 내려감(플랫폼 손실 차단)
 * @param marginPct 등급 보장마진율 (%) — 0~95 클램프
 */
export function distributorPriceFromRetail(retailPrice: number, supplyFloor: number, marginPct: number): number {
  const retail = Math.max(0, Math.floor(retailPrice || 0));
  const floor = Math.max(0, Math.floor(supplyFloor || 0));
  const m = Number.isFinite(marginPct) ? Math.min(95, Math.max(0, marginPct)) : 0;
  // 판매가 미설정(0)이면 원가로 — 원가 이하 판매 방지(제조사가 권장가 입력 전 degenerate fallback).
  if (retail <= 0) return floor;
  const byMargin = Math.round(retail * (1 - m / 100));
  return Math.max(floor, byMargin);
}

/**
 * (구 모델 — 원가 위 마크업) 판매사 공급가. 신모델 전환(2026-06-16) 후 직접 사용 X — 하위호환/테스트용 유지.
 * @deprecated 신모델은 distributorPriceFromRetail. resolveDistributorPrice 가 신공식 사용.
 */
export function distributorPrice(baseSupplyPrice: number, marginPct: number): number {
  const base = Math.max(0, Math.floor(baseSupplyPrice || 0));
  const m = Number.isFinite(marginPct) ? Math.max(0, marginPct) : 0;
  return Math.round(base * (1 + m / 100));
}

/** 유통스타트가 가져가는 마진액 = 판매사공급가 − 제조사공급가 (>= 0). */
export function platformMargin(baseSupplyPrice: number, marginPct: number): number {
  const base = Math.max(0, Math.floor(baseSupplyPrice || 0));
  return Math.max(0, distributorPrice(baseSupplyPrice, marginPct) - base);
}

/**
 * 판매사의 유효 등급 결정.
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

// ── 수량 구간 할인 (volume tier) — 등급가 위에 "많이 살수록 ↓" 적용 (2026-06-04) ──
//   모델: 등급 = 누구인가(base 공급가), 수량구간 = 얼마나 사는가(추가 % 할인). 둘은 곱(stack).
//   tier 없으면 0% (= 기존 동작 불변). discount_pct 는 0~90 클램프.
export interface QtyTier { min_qty: number; discount_pct: number }

/** qty 에 적용되는 수량구간 할인율(%) — min_qty <= qty 인 tier 중 최대 할인. 없으면 0. */
export function qtyTierDiscount(qty: number, tiers?: QtyTier[] | null): number {
  if (!tiers || !tiers.length) return 0
  let best = 0
  for (const t of tiers) {
    const mq = Math.max(1, Math.floor(Number(t.min_qty) || 1))
    const d = Math.max(0, Math.min(90, Number(t.discount_pct) || 0))
    if (qty >= mq && d > best) best = d
  }
  return best
}

/**
 * 🛡️ PRC-1 (2026-06-08) — 수량구간 할인의 "최소 플랫폼 마진" 하한 산출.
 *
 * 배경: tierUnitPrice 는 floor=공급원가(supply_price) 로 역마진은 막지만, 마진이 정확히 0 까지
 *   붕괴할 수 있음 → Toss PG 수수료(~2-3%) 차감 후 깊은 수량할인 주문에서 플랫폼 순손실 발생.
 *   따라서 하한을 `supply_price × (1 + minPlatformMarginPct/100)` 로 끌어올려 원가+최소마진 미만으로
 *   내려가지 못하게 한다. (예: minPlatformMarginPct=3 → PG 수수료 커버.)
 *
 * ⚠️ 가격 인상 버그 방지 불변식: 유효 하한은 절대 gradePrice(비-tier 등급가) 를 넘지 않아야 한다.
 *   저등급 마진/SPECIAL(0%) 처럼 supply_price×(1+minMargin%) > gradePrice 인 경우 그대로 두면
 *   하한이 등급가보다 높아져 "수량할인을 받았는데 등급가보다 비싸지는" 역전이 난다. 따라서:
 *       effectiveFloor = min(gradePrice, round(supply_price × (1 + minMargin/100)))
 *   tierUnitPrice 는 max(effectiveFloor, discounted) 이고 discounted <= gradePrice 이므로
 *   결과는 항상 [effectiveFloor, gradePrice] 구간 안에 머문다 → 등급가 초과 불가, 원가+최소마진 미만 불가.
 *
 * 기본 동작 보존: minPlatformMarginPct 의 기본값은 0 (어드민이 명시 설정하기 전까지 현행 가격 불변).
 *   minMargin=0 이면 effectiveFloor = min(gradePrice, round(supply_price)) = supply_price
 *   (등급가 = supply_price×(1+등급마진) >= supply_price 이므로 항상 supply_price 가 작거나 같음)
 *   → 기존(floor=supply_price) 와 정확히 동일.
 *
 * 어드민 설정: 값은 platform_settings.wholesale_min_platform_margin_pct 에서 읽는다.
 *   설정 UI 는 유통 어드민 설정 페이지(distributor-admin)에 두는 것이 적절 (여기서는 UI 미구현, note only).
 *
 * @param gradePrice 등급 적용 단가 (수량할인 적용 전, 비-tier 가)
 * @param supplyPrice 제조사 공급원가 (products.supply_price)
 * @param minPlatformMarginPct 최소 플랫폼 마진율(%) — 기본 0(현행 동작 보존)
 */
export function effectiveTierFloor(gradePrice: number, supplyPrice: number, minPlatformMarginPct = 0): number {
  const grade = Math.max(0, Math.round(gradePrice || 0))
  const supply = Math.max(0, Math.round(supplyPrice || 0))
  const m = Number.isFinite(minPlatformMarginPct) ? Math.max(0, minPlatformMarginPct) : 0
  const withMargin = Math.round(supply * (1 + m / 100))
  // 등급가 초과 금지 — 하한이 등급가보다 크면 수량할인이 가격을 올리게 됨(불변식 위반) → clamp.
  return Math.min(grade, withMargin)
}

/** 등급가 + 수량구간 할인 적용 최종 단가 (원 반올림).
 *  floor: 단가 하한. 기본은 공급원가(supply_price) 를 넘기지만, PRC-1 이후엔 호출부에서
 *  effectiveTierFloor(등급가, 공급원가, 최소마진%) 로 계산해 전달(원가+최소마진 하한, 등급가 clamp).
 *  수량할인이 하한 이하로 내려가 플랫폼이 손해보는 것을 방지. 미지정(0)이면 하한 없음(하위호환). */
export function tierUnitPrice(gradePrice: number, qty: number, tiers?: QtyTier[] | null, floor = 0): number {
  const base = Math.max(0, Math.round(gradePrice || 0))
  const d = qtyTierDiscount(qty, tiers)
  const discounted = d > 0 ? Math.round(base * (1 - d / 100)) : base
  const lo = Math.max(0, Math.round(floor || 0))
  return Math.max(lo, discounted)
}

/** 한 번에: 판매사가 볼 공급가 + 플랫폼 마진 + 적용 등급. (🆕 2026-06-17 cost-plus — 대표 확정)
 *  - baseSupplyPrice = 제조사가 받을 금액(supply_price). 제조사 정산 = 이 값 전액(splitWholesaleUnit).
 *  - marginOverridePct(제품별 플랫폼 마진%, supply_margin_override_pct): 설정(>=0)되면 그 제품의 기본 플랫폼 마진%.
 *      미설정(null)이면 defaultPlatformMarginPct(어드민 전역값) → 없으면 DEFAULT_PLATFORM_MARGIN_PCT(10).
 *  - 🏭 2026-06-17 후속 대표 확정: **모든 등급 동일 마진**(등급=노출 큐레이션 전용, 가격 차등 X). 등급배수 폐기.
 *  - 공급가 = clamp(round(제조사가 × (1 + 유효마진%)), 하한=제조사가, 상한=판매가). margin = 공급가 − 제조사가(=플랫폼). */
export function resolveDistributorPrice(opts: {
  baseSupplyPrice: number;
  retailPrice?: number | null;
  grade?: string | null;
  specialUntil?: string | null;
  table?: GradeMargin[] | null;
  marginOverridePct?: number | null;
  defaultPlatformMarginPct?: number | null;
  now?: Date;
}): { price: number; margin: number; grade: DistributorGrade; marginPct: number; overridden: boolean } {
  const grade = effectiveGrade(opts);
  const cost = Math.max(0, Math.floor(opts.baseSupplyPrice || 0));
  const retail = Math.max(0, Math.floor(Number(opts.retailPrice) || 0));
  const ov = opts.marginOverridePct;
  const hasOverride = ov != null && Number.isFinite(Number(ov)) && Number(ov) >= 0;
  const dflt = (opts.defaultPlatformMarginPct != null && Number.isFinite(Number(opts.defaultPlatformMarginPct)) && Number(opts.defaultPlatformMarginPct) >= 0)
    ? Number(opts.defaultPlatformMarginPct) : DEFAULT_PLATFORM_MARGIN_PCT;
  const basePct = hasOverride ? Math.max(0, Number(ov)) : dflt; // 제품별 플랫폼 마진%(없으면 전역 기본)
  // 🆕 2026-06-17 (대표 확정): 모든 등급 동일 마진 — 등급은 가격 차등 X(노출 큐레이션 전용). 마진은 조율 가능.
  const effMarginPct = Math.max(0, basePct);
  const price = distributorPriceFromCost(cost, effMarginPct, retail);
  return {
    price,
    margin: Math.max(0, price - cost), // 플랫폼 마진 = 공급가 − 제조사가
    grade,
    marginPct: effMarginPct,
    overridden: hasOverride,
  };
}
