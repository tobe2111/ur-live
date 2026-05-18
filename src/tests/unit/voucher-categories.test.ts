/**
 * 🛡️ 2026-05-17: 공구권 카테고리 4종 통합 (이전 6종 → 4종) + 레거시 3종 호환 SQL 매처 테스트.
 *
 * 신규 카테고리:
 *   meal_voucher (식사권) / beauty_voucher (미용) / stay_voucher (숙소) / etc_voucher (기타)
 *
 * 레거시 (마이그레이션 0255 가 자동 변환하지만 SQL 매처는 호환 유지):
 *   health_voucher → beauty_voucher
 *   pet_voucher → etc_voucher
 *   activity_voucher → etc_voucher
 *
 * SQL IN 절은 4 신규 + 3 레거시 = 7 placeholder (graceful 매칭).
 */
import { describe, it, expect } from 'vitest';
import {
  VOUCHER_CATEGORIES,
  VOUCHER_CATEGORY_LABELS,
  VOUCHER_CATEGORY_ICONS,
  VOUCHER_CATEGORY_SQL_PLACEHOLDERS,
  VOUCHER_CATEGORY_SQL_VALUES,
} from '@/shared/constants';

// API 의 카테고리 파라미터 → SQL category list 매핑
function resolveCategories(param: string): readonly string[] {
  if (param === 'all') return VOUCHER_CATEGORY_SQL_VALUES;
  if ((VOUCHER_CATEGORY_SQL_VALUES as readonly string[]).includes(param)) return [param];
  return VOUCHER_CATEGORY_SQL_VALUES; // unknown → 안전한 fallback (전체)
}

const NEW_CATS = ['meal_voucher', 'beauty_voucher', 'stay_voucher', 'etc_voucher'] as const;
const LEGACY_CATS = ['health_voucher', 'pet_voucher', 'activity_voucher'] as const;
const ALL_CATS = [...NEW_CATS, ...LEGACY_CATS];

describe('VOUCHER_CATEGORIES — 카테고리 enum (4종 통합)', () => {
  it('신규 4종 카테고리 존재', () => {
    expect(VOUCHER_CATEGORIES).toHaveLength(4);
    expect(VOUCHER_CATEGORIES).toEqual(NEW_CATS);
  });

  it('모든 카테고리에 라벨 정의', () => {
    for (const cat of VOUCHER_CATEGORIES) {
      expect(VOUCHER_CATEGORY_LABELS[cat]).toBeTruthy();
      expect(VOUCHER_CATEGORY_LABELS[cat].length).toBeGreaterThan(0);
    }
  });

  it('모든 카테고리에 아이콘 정의 (이모지 1자 이상)', () => {
    for (const cat of VOUCHER_CATEGORIES) {
      expect(VOUCHER_CATEGORY_ICONS[cat]).toBeTruthy();
      expect(VOUCHER_CATEGORY_ICONS[cat].length).toBeGreaterThan(0);
    }
  });

  it('SQL placeholder 가 7개 (신규 4 + 레거시 3 — 마이그레이션 사이 graceful)', () => {
    expect(VOUCHER_CATEGORY_SQL_PLACEHOLDERS).toBe('?,?,?,?,?,?,?');
    expect(VOUCHER_CATEGORY_SQL_VALUES).toHaveLength(7);
  });
});

describe('resolveCategories — API 파라미터 → SQL list', () => {
  it('"all" → 7종 모두 (신규 4 + 레거시 3)', () => {
    expect(resolveCategories('all')).toEqual(ALL_CATS);
  });

  it('각 단일 카테고리 통과 — 신규 + 레거시 모두', () => {
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
    expect(VOUCHER_CATEGORY_SQL_PLACEHOLDERS).toBe('?,?,?,?,?,?,?');
    expect(VOUCHER_CATEGORY_SQL_PLACEHOLDERS).not.toMatch(/['"]/);
    expect(VOUCHER_CATEGORY_SQL_PLACEHOLDERS).not.toMatch(/\bvoucher\b/);
  });
});
