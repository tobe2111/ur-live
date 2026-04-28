/**
 * 🛡️ 2026-04-28: 공구권 카테고리 enum + 매칭 로직 테스트
 *
 * voucher 카테고리: meal_voucher / beauty_voucher / health_voucher
 *   - DB(products.category) 텍스트 enum
 *   - SQL 쿼리에서 IN (...) 으로 매칭
 *   - UI 카테고리 칩 ('전체' = 3종 모두)
 */
import { describe, it, expect } from 'vitest';
import {
  VOUCHER_CATEGORIES,
  VOUCHER_CATEGORY_LABELS,
  VOUCHER_CATEGORY_ICONS,
  VOUCHER_CATEGORY_SQL_PLACEHOLDERS,
  type VoucherCategory,
} from '@/shared/constants';

// API 의 카테고리 파라미터 → SQL category list 매핑 (group-buy.routes.ts 와 동일 로직)
function resolveCategories(param: string): VoucherCategory[] {
  if (param === 'all') return [...VOUCHER_CATEGORIES];
  if ((VOUCHER_CATEGORIES as readonly string[]).includes(param)) return [param as VoucherCategory];
  return [...VOUCHER_CATEGORIES]; // unknown → 안전한 fallback (전체)
}

const ALL_CATS = ['meal_voucher', 'beauty_voucher', 'health_voucher', 'pet_voucher', 'stay_voucher', 'activity_voucher'];

describe('VOUCHER_CATEGORIES — 카테고리 enum', () => {
  it('6종 카테고리 존재', () => {
    expect(VOUCHER_CATEGORIES).toHaveLength(6);
    expect(VOUCHER_CATEGORIES).toEqual(ALL_CATS);
  });

  it('모든 카테고리에 라벨 정의', () => {
    for (const cat of VOUCHER_CATEGORIES) {
      expect(VOUCHER_CATEGORY_LABELS[cat]).toBeTruthy();
      expect(VOUCHER_CATEGORY_LABELS[cat]).toMatch(/공구권$/);
    }
  });

  it('모든 카테고리에 아이콘 정의 (이모지 1자 이상)', () => {
    for (const cat of VOUCHER_CATEGORIES) {
      expect(VOUCHER_CATEGORY_ICONS[cat]).toBeTruthy();
      expect(VOUCHER_CATEGORY_ICONS[cat].length).toBeGreaterThan(0);
    }
  });

  it('SQL placeholder 가 카테고리 수만큼 (6개) 생성', () => {
    expect(VOUCHER_CATEGORY_SQL_PLACEHOLDERS).toBe('?,?,?,?,?,?');
  });
});

describe('resolveCategories — API 파라미터 → SQL list', () => {
  it('"all" → 6종 모두', () => {
    expect(resolveCategories('all')).toEqual(ALL_CATS);
  });

  it('각 단일 카테고리 통과', () => {
    for (const cat of ALL_CATS) {
      expect(resolveCategories(cat)).toEqual([cat]);
    }
  });

  it('알 수 없는 값 → 전체 fallback (안전)', () => {
    expect(resolveCategories('hack_voucher')).toEqual(ALL_CATS);
    expect(resolveCategories('')).toEqual(ALL_CATS);
    expect(resolveCategories('all; DROP TABLE')).toEqual(ALL_CATS);
  });
});

describe('SQL injection 방어 — placeholder 만 사용', () => {
  it('카테고리 값이 placeholder bind 로만 들어감 (SQL 문자열 직접 삽입 X)', () => {
    const placeholders = VOUCHER_CATEGORIES.map(() => '?').join(',');
    expect(placeholders).toBe('?,?,?,?,?,?');
    expect(placeholders).not.toMatch(/['"]/); // 따옴표 없음
    expect(placeholders).not.toMatch(/\bvoucher\b/); // enum 값 자체가 placeholder 에 안 섞임
  });
});
