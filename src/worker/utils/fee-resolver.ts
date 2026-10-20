/**
 * 💸 단일 수수료 리졸버 (SSOT) — 주문 1건의 결제액을 슬라이스로 분배
 *
 * 대표 확정 정책 (2026-06-25, docs/design/product-ownership-model.md):
 *   1. 플랫폼 수수료: 남의 상품(3P, 이용권+쇼핑) = 5% / 유어딜 직판(1P 쇼핑) = 0%
 *      🔴 2026-08-20 대표 최종 확정("이게 최종이야") — **매장 유입 채널로 이원화**:
 *        · 중개사(중개 업체)가 관리하는 매장 = **5%** (기존 값 유지)
 *        · 매장 업주가 직접 등록·운영    = **10%**
 *      채널은 매장 등록 시 선택(seller_meta.store_channel = 'direct'|'brokered').
 *      ⚠️ 채널 미지정(기존 매장)은 **brokered(5%)로 폴백** — 기존 매장을 조용히 10%로
 *      재가격하지 않는다(기존 9개 매장의 채널 백필은 대표 확인 후 별도). 설계: seller-dashboard-v2.md
 *   2. 홍보 소개비(핀): 주인 자율 (플랫폼 기본값/상한 없음, 음수 방지 가드만) · 주인 몫에서
 *   3. 에이전시: 지속배분+시한부 — 영입 가게 GMV 1%(플랫폼 5%에서), 실판매 시에만,
 *      가게당 24개월 한도. 율·기간은 어드민이 에이전시별 조절(여기선 기본값만).
 *   4. 제조가(공급가): 도매 B2B 원가 — 별도 축. 쇼핑만, 셀러 자기제작이면 0.
 *
 * ⚠️ 이 함수는 **순수 함수** (DB/네트워크/시간 의존 0). 요율은 인자로 주입(platform_settings → loadFeeRates).
 *    → 테스트로 영구히 불변식을 지킴. 정책이 바뀌면 *이 파일 한 곳만* 수정.
 *
 * ⚠️ 경계: 이 리졸버는 소비자 결제액의 **gross 슬라이스**(누가 얼마를 받나)만 계산.
 *    부가세(VAT 10%)·원천징수는 **지급(정산) 시점**의 별도 관심사
 *    (settlement-calc / tax-withholding.ts). 여기서 다루지 않음.
 */

export type Ownership = '1P' | '3P';
export type ProductKind = 'voucher' | 'shopping';

/** 정책 요율 — platform_settings 에서 로드(loadFeeRates). 여기 값은 *기본값(박제)*. */
export interface FeeRates {
  /** 3P 플랫폼 수수료 % — **중개(brokered) 채널** (1P 는 항상 0 강제). 기본 5. */
  platformPct: number;
  /** 3P 플랫폼 수수료 % — **직접(direct) 채널**(매장 업주 직접 등록). 기본 10. 2026-08-20 확정. */
  platformPctDirect: number;
  /** 에이전시 GMV % (플랫폼 수수료에서 분배). 기본 1. */
  agencyPct: number;
  /** 에이전시 지속배분 시한(개월). 기본 24. (리졸버는 withinTerm boolean 만 받음 — 참고용 상수) */
  agencyTermMonths: number;
  /**
   * 💸 2026-08-27 게이트 — 대행사 몫을 **2차 재원(매장이 판 돈)** 에서 뺄 것인가.
   *   `false`(기본) = 종전대로 유어딜 수수료 안에서. `true` = 대표 확정 구조.
   *   ⚠️ 켜면 정산 금액이 달라진다. staging 실결제 + 환불 역전 확인 뒤에만 켤 것.
   */
  agencyFromOwner?: boolean;
}

/** 대표 확정 기본값 — platform_settings 미설정 시 폴백 + 정책 SSOT. */
export const DEFAULT_FEE_RATES: Readonly<FeeRates> = Object.freeze({
  platformPct: 5,
  platformPctDirect: 10,
  agencyPct: 1,
  agencyTermMonths: 24,
  agencyFromOwner: false,   // 기본 꺼짐 — 켜기 전까지 현행과 동일
});

/** 에이전시 적립 조건 — 호출자가 DB 사실로 판정해 전달. */
export interface AgencyContext {
  /** 영입 에이전시 식별(있을 때만 적립 대상). 없으면 agency 슬라이스 0. */
  agencyId: string | number;
  /** 실제 판매가 일어났는가(이 주문이 GMV 에 잡히는가). false 면 0. */
  active: boolean;
  /** 가게 활성화 후 시한(기본 24개월) 이내인가. false 면 0. */
  withinTerm: boolean;
  /** per-agency override % (어드민 설정). 없으면 rates.agencyPct. */
  pctOverride?: number;
}

/** 홍보 소개비 — 주인이 자율 책정. amount(고정) 또는 pct 중 하나. */
export interface PromoSpec {
  /** 귀속된 프로모터 식별(있을 때만 소개비 발생). */
  promoterId: string | number;
  /** 고정 금액(원). pct 와 동시 지정 시 amount 우선. */
  amount?: number;
  /** 결제액 대비 % (주인 자율). */
  pct?: number;
}

/** 주문 1건(또는 라인 1건)의 분배 입력 사실. */
export interface FeeContext {
  /** 소비자 결제액(이 슬라이스 base). 정수 원. */
  amount: number;
  /** 1P(유어딜 직판) / 3P(셀러). 어드민 업로드=1P, 셀러 업로드=3P. */
  ownership: Ownership;
  /** 이용권 / 쇼핑 (요율은 동일하나 검증/표시용). */
  productKind: ProductKind;
  /** 제조가(공급가) — 쇼핑 B2B 원가. 없으면 0. */
  supplyCost?: number;
  /** 에이전시 영입 컨텍스트(없으면 미적용). */
  agency?: AgencyContext | null;
  /** 홍보(핀) 소개비(없으면 미적용). */
  promo?: PromoSpec | null;
  /** 매장 유입 채널 — 'direct'(업주 직접, 10%) | 'brokered'(중개 관리, 5%).
   *  미지정 = brokered 폴백(기존 매장 무재가격). seller_meta.store_channel 에서 로드. */
  storeChannel?: 'direct' | 'brokered';
}

/** 분배 결과 — 슬라이스 합 = amount (정확히, 반올림 잔차는 ownerNet 흡수). */
export interface FeeBreakdown {
  amount: number;
  ownership: Ownership;
  productKind: ProductKind;
  /** 플랫폼 수수료 총액(에이전시 포함). 1P=0. */
  platform: number;
  /** 에이전시 몫(platform 안에서 분배). */
  agency: number;
  /** 유어딜이 실제 갖는 플랫폼 몫 = platform - agency. */
  platformNet: number;
  /** 홍보 소개비(주인 몫에서). */
  promo: number;
  /** 제조가(B2B 원가). */
  supply: number;
  /** 주인 순수익 = 나머지 전부 (반올림 잔차 흡수 → 합 항등식 정확). */
  ownerNet: number;
  /**
   * 💸 2026-08-27: 대행사 몫이 **어디서 나갔는지**. `true` = 2차 재원(매장이 판 돈),
   *   `false` = 유어딜 수수료 안(종전). 불변식이 합계를 어떻게 세야 하는지가 여기서 갈리고,
   *   기록(`order_fee_breakdown`)에도 남아 나중에 "이 주문은 어느 규칙이었나"를 알 수 있다.
   */
  agencyFromOwner: boolean;
}

function isNonNegInt(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n) && n >= 0;
}
function clampPct(p: unknown, fallback: number): number {
  return typeof p === 'number' && Number.isFinite(p) && p >= 0 && p <= 100 ? p : fallback;
}

/**
 * 주문 1건 → 슬라이스 분배. 순수·결정적(같은 입력 → 같은 출력 → 환불 역전 대칭 안전).
 *
 * 분배 순서(off-the-top → 나머지):
 *   platform(1P=0) → supply(원가) → promo(주인 자율, 음수 가드) → ownerNet(나머지)
 *   agency 는 platform 의 하위 슬라이스(합에 더해지지 않음).
 */
export function resolveOrderFees(ctx: FeeContext, rates: FeeRates = DEFAULT_FEE_RATES): FeeBreakdown {
  const amount = isNonNegInt(ctx.amount) ? Math.floor(ctx.amount) : 0;
  const ownership: Ownership = ctx.ownership === '1P' ? '1P' : '3P';
  const productKind: ProductKind = ctx.productKind === 'shopping' ? 'shopping' : 'voucher';

  // 규칙 1: 플랫폼 수수료 — 1P 는 0, 3P 는 채널별(직접 10% / 중개 5%, 2026-08-20 대표 최종).
  const platformPct = ctx.storeChannel === 'direct'
    ? clampPct(rates.platformPctDirect, DEFAULT_FEE_RATES.platformPctDirect)
    : clampPct(rates.platformPct, DEFAULT_FEE_RATES.platformPct);
  const platform = ownership === '1P' ? 0 : Math.round((amount * platformPct) / 100);

  // 규칙 3: 대행사(에이전시) 몫 — 실판매 + 시한 내 + 영입 대행사 있을 때만.
  //
  // 💸 2026-08-27 대표 확정 — **재원이 바뀐다.** "유어딜은 대행사에게 돈을 주지 않는다.
  //   대행사는 자신들이 직접 중개수수료를 버는 구조" (그리고 대행사가 낀 매장은 유어딜이
  //   10%가 아니라 5%만 받아 **벌 자리를 비워 준다**). 그런데 코드는 대행사 몫을
  //   **유어딜 수수료 안에서** 떼고 있었다 — 확정과 정반대다.
  //
  //   `agencyFromOwner` 가 켜지면 대행사 몫이 **2차 재원**(결제액 − 유어딜 몫)에서 나간다.
  //   ⚠️ 기본은 꺼짐 — 켜기 전까지 계산은 현행과 **byte 단위로 동일**하다.
  //   ⚠️ 켠 뒤에도 불변식은 그대로다: 슬라이스 합 = 결제액, 모든 슬라이스 ≥ 0,
  //      그리고 **유어딜 몫은 어떤 경우에도 줄지 않는다**(아래 platformNet 이 그 증거다).
  const agencyFromOwner = rates.agencyFromOwner === true;
  let agency = 0;
  if (ownership === '3P' && ctx.agency && ctx.agency.agencyId != null && ctx.agency.active && ctx.agency.withinTerm) {
    const agencyPct = clampPct(ctx.agency.pctOverride, clampPct(rates.agencyPct, DEFAULT_FEE_RATES.agencyPct));
    const raw = Math.round((amount * agencyPct) / 100);
    // 켜짐: 2차 재원(결제액 − 유어딜 몫) 안에서. 꺼짐: 종전대로 유어딜 몫 안에서.
    agency = agencyFromOwner ? Math.min(raw, Math.max(0, amount - platform)) : Math.min(raw, platform);
  }
  // 유어딜 순수취액 — 켜지면 대행사 몫이 여기서 안 빠진다(= 5%/10% 가 온전히 남는다).
  const platformNet = agencyFromOwner ? platform : platform - agency;

  // 규칙 4: 제조가(공급가) — 0 ~ (amount - platform) 범위로 clamp(주인 몫을 음수로 만들지 않음).
  const rawSupply = isNonNegInt(ctx.supplyCost) ? Math.floor(ctx.supplyCost as number) : 0;
  const supply = Math.max(0, Math.min(rawSupply, amount - platform));

  // 주인 gross(소개비 낼 수 있는 한도) = amount - platform - supply (− 대행사 몫, 켜졌을 때).
  //   대행사 몫이 2차 재원에서 나가면 **매장이 소개비로 쓸 수 있는 한도도 그만큼 준다** —
  //   안 빼면 합이 결제액을 넘고 주인 몫이 음수가 된다.
  const agencyFromOwnerSlice = agencyFromOwner ? agency : 0;
  const ownerGross = Math.max(0, amount - platform - supply - agencyFromOwnerSlice);

  // 규칙 2: 홍보 소개비 — 주인 자율. 음수 가드: ownerGross 초과 불가.
  let promo = 0;
  if (ctx.promo && ctx.promo.promoterId != null) {
    const requested = isNonNegInt(ctx.promo.amount)
      ? Math.floor(ctx.promo.amount as number)
      : ctx.promo.pct != null
        ? Math.round((amount * clampPct(ctx.promo.pct, 0)) / 100)
        : 0;
    promo = Math.max(0, Math.min(requested, ownerGross));
  }

  // 주인 순수익 = 나머지 전부 → 합 항등식이 정확히(±0) 성립.
  const ownerNet = amount - platform - supply - promo - agencyFromOwnerSlice;

  return { amount, ownership, productKind, platform, agency, platformNet, promo, supply, ownerNet, agencyFromOwner };
}

/**
 * 불변식 검사 — 위반 시 throw. 테스트에서 사용 + (선택) 프로덕션 배선 시 방어 호출.
 *   ① 슬라이스 합 = 결제액 (겹침/누락 0)
 *   ② 주인 순수익 ≥ 0 (소개비 음수 가드)
 *   ③ 에이전시 ≤ 플랫폼 수수료
 *   ④ 1P 는 플랫폼 수수료 0 (→ 에이전시도 0)
 *   ⑤ 모든 슬라이스 ≥ 0
 */
export function assertFeeInvariants(b: FeeBreakdown): void {
  const fail = (msg: string) => {
    throw new Error(`[fee-resolver] invariant violated: ${msg} — ${JSON.stringify(b)}`);
  };
  // ① 합 = 결제액. **대행사 몫이 어디서 나갔느냐로 세는 법이 갈린다** —
  //   유어딜 몫 안(종전)이면 platform 이 이미 포함하고, 2차 재원이면 별도 항이다.
  if (b.agencyFromOwner) {
    if (b.platform + b.agency + b.supply + b.promo + b.ownerNet !== b.amount) fail('sum != amount');
    // 이 모드에선 유어딜이 온전히 가져간다 — 줄어들면 재원이 새고 있다는 뜻이다.
    if (b.platformNet !== b.platform) fail('platformNet != platform (agencyFromOwner)');
    // 대행사 몫은 2차 재원을 넘을 수 없다.
    if (b.agency > b.amount - b.platform) fail('agency > 2차 재원');
  } else {
    if (b.platform + b.supply + b.promo + b.ownerNet !== b.amount) fail('sum != amount');
    if (b.platformNet + b.agency + b.supply + b.promo + b.ownerNet !== b.amount) fail('net-sum != amount');
    // 종전 모드에선 대행사 몫이 유어딜 수수료 안에서 나간다.
    if (b.agency > b.platform) fail('agency > platform');
  }
  // ② 주인 순수익 ≥ 0
  if (b.ownerNet < 0) fail('ownerNet < 0');
  // ④ 1P → 플랫폼 0
  if (b.ownership === '1P' && b.platform !== 0) fail('1P platform != 0');
  if (b.ownership === '1P' && b.agency !== 0) fail('1P agency != 0');
  // ⑤ 모든 슬라이스 ≥ 0
  for (const [k, v] of Object.entries({
    platform: b.platform, agency: b.agency, platformNet: b.platformNet,
    promo: b.promo, supply: b.supply, ownerNet: b.ownerNet,
  })) {
    if ((v as number) < 0) fail(`${k} < 0`);
  }
}

/**
 * platform_settings 에서 요율 로드 — hardcode 금지(미설정 시 DEFAULT_FEE_RATES 폴백).
 *
 * 전용 네임스페이스 `fee_*` 키 사용 — 기존 산재 키(commission_rate_default / agency_commission_pct 등)와
 * 충돌 없음. 어드민이 이 키로 정책 요율을 조절. 리졸버 배선 시 이 로더로 요율 주입.
 *   fee_platform_pct_3p        (기본 5)  — 3P 플랫폼 수수료 % (중개 채널)
 *   fee_platform_pct_3p_direct (기본 10) — 3P 플랫폼 수수료 % (직접 채널, 2026-08-20)
 *   fee_agency_pct        (기본 1)   — 에이전시 GMV %
 *   fee_agency_term_months(기본 24)  — 에이전시 지속배분 시한(개월)
 */
export async function loadFeeRates(
  DB: import('@cloudflare/workers-types').D1Database,
): Promise<FeeRates> {
  const read = async (key: string, fallback: number): Promise<number> => {
    try {
      const row = await DB.prepare('SELECT value FROM platform_settings WHERE key = ?')
        .bind(key)
        .first<{ value: string }>();
      const n = row ? Number(row.value) : NaN;
      return Number.isFinite(n) && n >= 0 ? n : fallback;
    } catch {
      return fallback;
    }
  };
  const [platformPct, platformPctDirect, agencyPct, agencyTermMonths] = await Promise.all([
    read('fee_platform_pct_3p', DEFAULT_FEE_RATES.platformPct),
    read('fee_platform_pct_3p_direct', DEFAULT_FEE_RATES.platformPctDirect),
    read('fee_agency_pct', DEFAULT_FEE_RATES.agencyPct),
    read('fee_agency_term_months', DEFAULT_FEE_RATES.agencyTermMonths),
  ]);
  return { platformPct, platformPctDirect, agencyPct, agencyTermMonths };
}

/**
 * 환불 역전 — 분배의 정확한 음수(대칭). 결정적이라 재계산으로 역전 가능.
 * 부분 환불은 refundedAmount 로 비례 분배 후 다시 resolveOrderFees 호출 권장(라인 단위 재계산).
 */
export function negateBreakdown(b: FeeBreakdown): FeeBreakdown {
  return {
    ...b,
    amount: -b.amount,
    platform: -b.platform,
    agency: -b.agency,
    platformNet: -b.platformNet,
    promo: -b.promo,
    supply: -b.supply,
    ownerNet: -b.ownerNet,
  };
}
