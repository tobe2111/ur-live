/**
 * 💸 단일 수수료 리졸버 — 불변식 + 규칙 테스트
 *
 * docs/design/product-ownership-model.md 의 확정 정책(2026-06-25)을 영구히 잠금:
 *   1. 3P(이용권+쇼핑)=5% / 1P 직판=0%
 *   2. 홍보 소개비=주인 자율(음수 가드)
 *   3. 에이전시=GMV 1%(플랫폼에서), 실판매+시한 내에만, ≤플랫폼
 *   4. 제조가=B2B 원가(별도 슬라이스)
 *
 * 불변식(assertFeeInvariants):
 *   ① 슬라이스 합 = 결제액  ② 주인 순수익 ≥ 0  ③ 에이전시 ≤ 플랫폼
 *   ④ 1P 플랫폼 0  ⑤ 모든 슬라이스 ≥ 0
 */
import { describe, it, expect } from 'vitest';
import {
  resolveOrderFees,
  assertFeeInvariants,
  negateBreakdown,
  DEFAULT_FEE_RATES,
  type FeeContext,
} from '../../worker/utils/fee-resolver';

const activeAgency = (over?: Partial<FeeContext['agency']>) => ({
  agencyId: 1,
  active: true,
  withinTerm: true,
  ...over,
}) as NonNullable<FeeContext['agency']>;

describe('수수료 리졸버 — 문서 예시(10,000원) 정확 재현', () => {
  it('3P 쇼핑: 공급가 6000 / 플랫폼 5%=500 / 소개비 500 / 주인 3000', () => {
    const b = resolveOrderFees({
      amount: 10_000,
      ownership: '3P',
      productKind: 'shopping',
      supplyCost: 6_000,
      promo: { promoterId: 9, amount: 500 },
    });
    expect(b.platform).toBe(500);
    expect(b.supply).toBe(6_000);
    expect(b.promo).toBe(500);
    expect(b.ownerNet).toBe(3_000);
    assertFeeInvariants(b);
  });

  it('3P 이용권: 플랫폼 5%=500 / 소개비 500 / 주인 9000 (공급가 없음)', () => {
    const b = resolveOrderFees({
      amount: 10_000,
      ownership: '3P',
      productKind: 'voucher',
      promo: { promoterId: 9, amount: 500 },
    });
    expect(b.platform).toBe(500);
    expect(b.supply).toBe(0);
    expect(b.promo).toBe(500);
    expect(b.ownerNet).toBe(9_000);
    assertFeeInvariants(b);
  });

  it('1P 쇼핑(유어딜 직판): 공급가 6000 / 플랫폼 0 / 소개비 500 / 유어딜 3500', () => {
    const b = resolveOrderFees({
      amount: 10_000,
      ownership: '1P',
      productKind: 'shopping',
      supplyCost: 6_000,
      promo: { promoterId: 9, amount: 500 },
    });
    expect(b.platform).toBe(0);
    expect(b.agency).toBe(0);
    expect(b.supply).toBe(6_000);
    expect(b.promo).toBe(500);
    expect(b.ownerNet).toBe(3_500);
    assertFeeInvariants(b);
  });
});

describe('규칙 1 — 플랫폼 수수료(3P=5% / 1P=0%)', () => {
  it('3P → 5%', () => {
    expect(resolveOrderFees({ amount: 10_000, ownership: '3P', productKind: 'voucher' }).platform).toBe(500);
  });
  it('1P → 0%(직판, 자기한테 수수료 안 매김)', () => {
    expect(resolveOrderFees({ amount: 10_000, ownership: '1P', productKind: 'shopping' }).platform).toBe(0);
  });
  it('이용권/쇼핑 동일 요율(3P)', () => {
    const v = resolveOrderFees({ amount: 7_777, ownership: '3P', productKind: 'voucher' }).platform;
    const s = resolveOrderFees({ amount: 7_777, ownership: '3P', productKind: 'shopping' }).platform;
    expect(v).toBe(s);
  });
});

describe('규칙 2 — 홍보 소개비(주인 자율 + 음수 가드)', () => {
  it('고정 금액 그대로', () => {
    expect(resolveOrderFees({ amount: 10_000, ownership: '3P', productKind: 'voucher', promo: { promoterId: 1, amount: 1234 } }).promo).toBe(1234);
  });
  it('퍼센트 책정', () => {
    expect(resolveOrderFees({ amount: 10_000, ownership: '3P', productKind: 'voucher', promo: { promoterId: 1, pct: 7 } }).promo).toBe(700);
  });
  it('음수 가드: 소개비가 주인 몫 초과 입력 → 주인 gross 로 clamp(ownerNet 0, 음수 아님)', () => {
    // amount 10000, platform 500 → ownerGross 9500. 소개비 99999 요청 → 9500 으로 clamp.
    const b = resolveOrderFees({ amount: 10_000, ownership: '3P', productKind: 'voucher', promo: { promoterId: 1, amount: 99_999 } });
    expect(b.promo).toBe(9_500);
    expect(b.ownerNet).toBe(0);
    assertFeeInvariants(b);
  });
  it('소개비 없음 → 0', () => {
    expect(resolveOrderFees({ amount: 10_000, ownership: '3P', productKind: 'voucher' }).promo).toBe(0);
  });
  it('promoterId 없으면 미적용', () => {
    // @ts-expect-error 의도적 누락 검증
    expect(resolveOrderFees({ amount: 10_000, ownership: '3P', productKind: 'voucher', promo: { amount: 500 } }).promo).toBe(0);
  });
});

describe('규칙 3 — 에이전시(GMV 1%, 실판매+시한, ≤플랫폼)', () => {
  it('실판매+시한 내 → 1% = 100, platformNet 400', () => {
    const b = resolveOrderFees({ amount: 10_000, ownership: '3P', productKind: 'voucher', agency: activeAgency() });
    expect(b.agency).toBe(100);
    expect(b.platformNet).toBe(400);
    assertFeeInvariants(b);
  });
  it('실판매 아님(active=false) → 0', () => {
    expect(resolveOrderFees({ amount: 10_000, ownership: '3P', productKind: 'voucher', agency: activeAgency({ active: false }) }).agency).toBe(0);
  });
  it('시한 초과(withinTerm=false) → 0', () => {
    expect(resolveOrderFees({ amount: 10_000, ownership: '3P', productKind: 'voucher', agency: activeAgency({ withinTerm: false }) }).agency).toBe(0);
  });
  it('1P 는 에이전시 미적용 → 0', () => {
    expect(resolveOrderFees({ amount: 10_000, ownership: '1P', productKind: 'shopping', agency: activeAgency() }).agency).toBe(0);
  });
  it('per-agency override 율 적용', () => {
    const b = resolveOrderFees({ amount: 10_000, ownership: '3P', productKind: 'voucher', agency: activeAgency({ pctOverride: 3 }) });
    expect(b.agency).toBe(300);
  });
  it('가드: 에이전시 율이 플랫폼 초과해도 ≤플랫폼 으로 clamp', () => {
    const b = resolveOrderFees({ amount: 10_000, ownership: '3P', productKind: 'voucher', agency: activeAgency({ pctOverride: 99 }) });
    expect(b.agency).toBe(b.platform); // 500 로 clamp
    expect(b.agency).toBeLessThanOrEqual(b.platform);
    assertFeeInvariants(b);
  });
});

describe('규칙 4 — 제조가(B2B 원가, 별도 슬라이스)', () => {
  it('공급가 슬라이스 분리 + 주인 순수익은 나머지', () => {
    const b = resolveOrderFees({ amount: 10_000, ownership: '3P', productKind: 'shopping', supplyCost: 7_000 });
    expect(b.supply).toBe(7_000);
    expect(b.platform).toBe(500);
    expect(b.ownerNet).toBe(2_500);
    assertFeeInvariants(b);
  });
  it('공급가가 (결제액-플랫폼) 초과 → clamp(주인 음수 방지)', () => {
    const b = resolveOrderFees({ amount: 10_000, ownership: '3P', productKind: 'shopping', supplyCost: 99_999 });
    expect(b.supply).toBe(9_500); // 10000 - 500
    expect(b.ownerNet).toBe(0);
    assertFeeInvariants(b);
  });
});

describe('불변식 — 회계 항등식(반올림 잔차 ownerNet 흡수 → 정확히 ±0)', () => {
  const amounts = [0, 1, 7, 37, 999, 5_500, 9_999, 10_001, 123_457, 1_000_000, 33_333];
  const supplies = [0, 1, 3_000, 7_777];
  const promos = [0, 1, 333, 5_000];
  it('platform + supply + promo + ownerNet === amount (전 조합)', () => {
    for (const amount of amounts) {
      for (const ownership of ['1P', '3P'] as const) {
        for (const supplyCost of supplies) {
          for (const pAmt of promos) {
            const b = resolveOrderFees({
              amount, ownership, productKind: 'shopping', supplyCost,
              promo: { promoterId: 1, amount: pAmt },
              agency: activeAgency(),
            });
            // 항등식 정확
            expect(b.platform + b.supply + b.promo + b.ownerNet).toBe(b.amount);
            // 동치 항등식
            expect(b.platformNet + b.agency + b.supply + b.promo + b.ownerNet).toBe(b.amount);
            // 전 불변식 통과
            expect(() => assertFeeInvariants(b)).not.toThrow();
          }
        }
      }
    }
  });
});

describe('결정성 + 환불 역전 대칭', () => {
  it('같은 입력 → 같은 출력(결정적)', () => {
    const ctx: FeeContext = { amount: 12_345, ownership: '3P', productKind: 'shopping', supplyCost: 4_000, promo: { promoterId: 2, pct: 5 }, agency: activeAgency() };
    expect(resolveOrderFees(ctx)).toEqual(resolveOrderFees(ctx));
  });
  it('negateBreakdown: 모든 슬라이스 부호 반전 + 합도 -amount', () => {
    const b = resolveOrderFees({ amount: 10_000, ownership: '3P', productKind: 'shopping', supplyCost: 6_000, promo: { promoterId: 1, amount: 500 }, agency: activeAgency() });
    const n = negateBreakdown(b);
    expect(n.platform).toBe(-b.platform);
    expect(n.ownerNet).toBe(-b.ownerNet);
    expect(n.platform + n.supply + n.promo + n.ownerNet).toBe(-b.amount);
  });
});

describe('요율 주입(platform_settings override 시뮬)', () => {
  it('DEFAULT_FEE_RATES = 확정 정책(5/1/24)', () => {
    expect(DEFAULT_FEE_RATES.platformPct).toBe(5);
    expect(DEFAULT_FEE_RATES.agencyPct).toBe(1);
    expect(DEFAULT_FEE_RATES.agencyTermMonths).toBe(24);
  });
  it('커스텀 요율 주입 시 그 값 사용', () => {
    const b = resolveOrderFees(
      { amount: 10_000, ownership: '3P', productKind: 'voucher', agency: activeAgency() },
      { platformPct: 8, agencyPct: 2, agencyTermMonths: 12 },
    );
    expect(b.platform).toBe(800);
    expect(b.agency).toBe(200);
    assertFeeInvariants(b);
  });
});

describe('입력 방어', () => {
  it('음수/NaN 결제액 → 0 으로 처리(throw 안 함)', () => {
    expect(resolveOrderFees({ amount: -5, ownership: '3P', productKind: 'voucher' }).amount).toBe(0);
    expect(resolveOrderFees({ amount: NaN, ownership: '3P', productKind: 'voucher' }).amount).toBe(0);
  });
  it('소수 결제액 → floor', () => {
    expect(resolveOrderFees({ amount: 9_999.9, ownership: '3P', productKind: 'voucher' }).amount).toBe(9_999);
  });
});
